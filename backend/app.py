from flask import Flask, request, jsonify, send_file, session, redirect, url_for, flash, send_from_directory, current_app, abort
from flask_login import LoginManager, login_user, logout_user, login_required, current_user
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib.units import inch, mm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, Image
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT, TA_JUSTIFY
from reportlab.lib import colors
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from roehn_converter import RoehnProjectConverter
from datetime import datetime
from sqlalchemy import select, event, or_
from sqlalchemy.engine import Engine
from sqlalchemy.orm import joinedload
from sqlalchemy.exc import IntegrityError
from functools import wraps
from werkzeug.security import generate_password_hash
import uuid
import io
import csv
import json
import re
import os
from datetime import datetime
from database import db, User, Projeto, Area, Ambiente, Circuito, Modulo, Vinculacao, Keypad, KeypadButton, QuadroEletrico

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///projetos.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY') or 'sua-chave-secreta-muito-longa-aqui-altere-para-uma-chave-segura'

# Configuração do Flask-Login
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'
login_manager.login_message = 'Por favor, faça login para acessar esta página.'
login_manager.login_message_category = 'info'

db.init_app(app)

# Informações sobre os módulos
MODULO_INFO = {
    'RL12': {'nome_completo': 'ADP-RL12', 'canais': 12, 'tipos_permitidos': ['luz']},
    'RL4': {'nome_completo': 'AQL-GV-RL4', 'canais': 4, 'tipos_permitidos': ['luz']},
    'LX4': {'nome_completo': 'ADP-LX4', 'canais': 4, 'tipos_permitidos': ['persiana']},
    'SA1': {'nome_completo': 'AQL-GV-SA1', 'canais': 1, 'tipos_permitidos': ['hvac']},
    'DIM8': {'nome_completo': 'ADP-DIM8', 'canais': 8, 'tipos_permitidos': ['luz']}
}

# Keypad metadata (RQR-K)
KEYPAD_ALLOWED_COLORS = {
    "WHITE",
    "BRASS",
    "BRUSHED BLACK",
    "BLACK",
    "BRONZE",
    "NICKEL",
    "SILVER",
    "TITANIUM",
}

KEYPAD_ALLOWED_BUTTON_COLORS = {"WHITE", "BLACK"}

KEYPAD_ALLOWED_BUTTON_COUNTS = {1, 2, 4}

LAYOUT_TO_COUNT = {
    "1": 1, "ONE": 1,
    "2": 2, "TWO": 2,
    "4": 4, "FOUR": 4,
}


ZERO_GUID = "00000000-0000-0000-0000-000000000000"

# --- serialize_user helper (ADD) ---
def serialize_user(user):
    return {
        "id": user.id,
        "username": getattr(user, "username", ""),
        "role": getattr(user, "role", "user"),
    }


def serialize_keypad_button(button):
    circuito = button.circuito
    return {
        "id": button.id,
        "ordem": button.ordem,
        "guid": button.guid,
        "modo": button.modo,
        "command_on": button.command_on,
        "command_off": button.command_off,
        "can_hold": button.can_hold,
        "modo_double_press": button.modo_double_press,
        "command_double_press": button.command_double_press,
        "target_object_guid": button.target_object_guid,
        "circuito_id": circuito.id if circuito else None,
        "circuito": {
            "id": circuito.id,
            "identificador": circuito.identificador,
            "nome": circuito.nome,
            "tipo": circuito.tipo,
        } if circuito else None,
    }


def serialize_keypad(keypad):
    ambiente = keypad.ambiente
    area = ambiente.area if ambiente else None
    return {
        "id": keypad.id,
        "nome": keypad.nome,
        "modelo": keypad.modelo,
        "color": keypad.color,
        "button_color": keypad.button_color,
        "button_count": keypad.button_count,
        "hsnet": keypad.hsnet,
        "dev_id": keypad.dev_id,
        "notes": keypad.notes,
        "ambiente": {
            "id": ambiente.id,
            "nome": ambiente.nome,
            "area": {
                "id": area.id,
                "nome": area.nome,
            } if area else None,
        } if ambiente else None,
        "buttons": [serialize_keypad_button(btn) for btn in sorted(keypad.buttons, key=lambda b: b.ordem)],
    }


def ensure_keypad_button_slots(keypad, count: int):
    """Garante que keypad.buttons tenha exatamente `count` itens (1..count)."""
    # cria os que faltam
    existing_by_ordem = {b.ordem: b for b in keypad.buttons}
    for i in range(1, count + 1):
        if i not in existing_by_ordem:
            btn = KeypadButton(
                ordem=i,
                guid=str(uuid.uuid4()),
                modo=3,  # default neutro
                command_on=0,
                command_off=0,
                modo_double_press=3,
                command_double_press=0,
                can_hold=False,
                circuito=None,
                circuito_id=None,
                target_object_guid=ZERO_GUID,
            )
            keypad.buttons.append(btn)

    # remove sobras
    for b in sorted(keypad.buttons, key=lambda x: x.ordem, reverse=True):
        if b.ordem > count:
            db.session.delete(b)

    keypad.button_count = count


def is_hsnet_in_use(hsnet, exclude_keypad_id=None, exclude_modulo_id=None):
    keypad_query = Keypad.query.filter(Keypad.hsnet == hsnet)
    if exclude_keypad_id is not None:
        keypad_query = keypad_query.filter(Keypad.id != exclude_keypad_id)
    if keypad_query.first() is not None:
        return True

    modulo_query = Modulo.query.filter(Modulo.hsnet == hsnet)
    if exclude_modulo_id is not None:
        modulo_query = modulo_query.filter(Modulo.id != exclude_modulo_id)
    return modulo_query.first() is not None


@event.listens_for(Engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    try:
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()
    except Exception:
        pass

def admin_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        # precisa estar logado
        if not current_user.is_authenticated:
            # se for API (JSON), devolve 401 em JSON
            if request.accept_mimetypes.best == "application/json" or request.is_json:
                return jsonify({"ok": False, "error": "Não autenticado."}), 401
            # se for página, manda para o login
            return redirect(url_for("login"))
        # precisa ser admin
        if getattr(current_user, "role", "user") != "admin":
            if request.accept_mimetypes.best == "application/json" or request.is_json:
                return jsonify({"ok": False, "error": "Acesso restrito a administradores."}), 403
            return ("Forbidden", 403)
        return fn(*args, **kwargs)
    return wrapper

    
# --- sessão atual (SPA pode checar estado sem carregar template) ---
@app.get("/api/session")
def api_session():
    if current_user.is_authenticated:
        return jsonify({"authenticated": True, "user": serialize_user(current_user)})
    return jsonify({"authenticated": False})

# --- login em JSON (POST /api/login) ---
@app.post("/api/login")
def api_login():
    data = request.get_json(silent=True) or request.form or {}
    username = (data.get("username") or "").strip()
    password = data.get("password") or ""

    user = User.query.filter_by(username=username).first()
    if user and user.check_password(password):
        login_user(user)
        return jsonify({"ok": True, "user": serialize_user(user)})

    return jsonify({"ok": False, "error": "Usuário ou senha inválidos."}), 401

# --- logout em JSON (POST /api/logout) ---
@app.post("/api/logout")
@login_required
def api_logout():
    logout_user()
    return jsonify({"ok": True})


# Carregador de usuário para o Flask-Login
@login_manager.user_loader
def load_user(user_id):
    return db.session.get(User, int(user_id))
    
    
@login_manager.unauthorized_handler
def unauthorized():
    if request.accept_mimetypes.best == "application/json" or request.is_json:
        return jsonify({"ok": False, "error": "Não autenticado"}), 401
    return redirect("/login")

    
# Criar tabelas e usuário admin padrão
with app.app_context():
    db.create_all()
    # Verificar se as tabelas dos quadros elétricos foram criadas
    try:
        # Tentar uma consulta simples para verificar se a tabela existe
        quadros_count = QuadroEletrico.query.count()
        print(f"Tabela QuadroEletrico existe com {quadros_count} registros")
    except Exception as e:
        print(f"Erro ao acessar tabela QuadroEletrico: {e}")
        # Recriar todas as tabelas se necessário
        db.drop_all()
        db.create_all()
        print("Tabelas recriadas com sucesso")
    
    # Criar usuário admin padrão se não existir
    if not User.query.filter_by(username='admin').first():
        admin_user = User(username='admin', email='admin@empresa.com', role='admin')
        admin_user.set_password('admin123')
        db.session.add(admin_user)
        db.session.commit()

@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def spa_catch_all(path):
    # Não intercepta APIs ou arquivos estáticos
    if path.startswith("api/") or path.startswith("static/"):
        abort(404)
    return send_from_directory(app.static_folder, "index.html")

@app.route('/roehn/import', methods=['POST'])
@login_required
def roehn_import():
    # Verificar se há um projeto selecionado
    projeto_atual_id = session.get('projeto_atual_id')
    if not projeto_atual_id:
        flash('Nenhum projeto selecionado. Selecione ou crie um projeto primeiro.', 'warning')
        return redirect(url_for('index'))
    
    projeto = db.session.get(Projeto, projeto_atual_id)
    if not projeto:
        flash('Projeto não encontrado.', 'danger')
        return redirect(url_for('index'))
    
    # Processar formulário de importação
    project_info = {
        'project_name': request.form.get('project_name', projeto.nome),
        'client_name': request.form.get('client_name', ''),
        'client_email': request.form.get('client_email', ''),
        'client_phone': request.form.get('client_phone_clean', ''),
        'timezone_id': request.form.get('timezone_id', 'America/Bahia'),
        'lat': request.form.get('lat', '0.0'),
        'lon': request.form.get('lon', '0.0'),
        'tech_area': request.form.get('tech_area', 'Área Técnica'),
        'tech_room': request.form.get('tech_room', 'Sala Técnica'),
        'board_name': request.form.get('board_name', 'Quadro Elétrico'),
        'm4_ip': request.form.get('m4_ip', '192.168.0.245'),
        'm4_hsnet': request.form.get('m4_hsnet', '245'),
        'm4_devid': request.form.get('m4_devid', '1'),
        'software_version': request.form.get('software_version', '1.0.8.67'),
        'programmer_name': request.form.get('programmer_name', current_user.username),
        'programmer_email': request.form.get('programmer_email', current_user.email),
        'programmer_guid': str(uuid.uuid4()),
    }
    
    try:
        # Converter dados do projeto para Roehn
        converter = RoehnProjectConverter(projeto, db.session, current_user.id)
        converter.create_project(project_info)
        
        # Processar os dados do projeto atual - CORREÇÃO AQUI
        # Garantir que estamos passando o projeto completo
        converter.process_db_project(projeto)
        
        # Gerar arquivo para download
        project_json = converter.export_project()
        
        # Criar resposta para download
        output = io.BytesIO()
        output.write(project_json.encode('utf-8'))
        output.seek(0)
        
        nome_arquivo = f"{project_info['project_name']}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.rwp"
        
        return send_file(
            output,
            as_attachment=True,
            download_name=nome_arquivo,
            mimetype='application/json'
        )
        
    except Exception as e:
        # Capturar informações detalhadas do erro
        import traceback
        error_traceback = traceback.format_exc()
        app.logger.error(f"Erro durante a geração do projeto: {str(e)}")
        app.logger.error(f"Traceback: {error_traceback}")
        
        flash(f'Erro durante a geração do projeto: {str(e)}. Verifique os logs para mais detalhes.', 'danger')
        return redirect(url_for('roehn_import'))

@app.get("/login")
def login_spa():
    return current_app.send_static_file("index.html")

@app.route('/logout')
@login_required
def logout():
    logout_user()
    flash('Você foi desconectado com sucesso', 'info')
    return redirect(url_for('login'))

@app.get("/api/users")
@login_required
@admin_required
def api_users_list():
    users = User.query.order_by(User.id.asc()).all()
    out = []
    for u in users:
        out.append({
            "id": u.id,
            "username": u.username,
            "email": u.email,
            "role": u.role,
            "is_current": (u.id == current_user.id),
        })
    return jsonify({"ok": True, "users": out})


@app.delete("/api/users/<int:user_id>")
@login_required
@admin_required
def api_users_delete(user_id):
    u = db.get_or_404(User, user_id)

    if u.id == current_user.id:
        return jsonify({"ok": False, "error": "Você não pode excluir o usuário atualmente logado."}), 400

    # opcional: impedir apagar o único admin do sistema
    admins = User.query.filter_by(role="admin").all()
    if u.role == "admin" and len(admins) == 1:
        return jsonify({"ok": False, "error": "Não é possível excluir o único administrador."}), 400

    # 1) Reatribuir projetos do usuário-alvo para o admin atual (ou outro dono)
    projetos_do_usuario = Projeto.query.filter_by(user_id=u.id).all()
    for p in projetos_do_usuario:
        p.user_id = current_user.id   # ou um ID de "admin" padrão

    db.session.delete(u)
    db.session.commit()
    return jsonify({"ok": True})

@app.post("/api/users")
@login_required
@admin_required
def api_users_create():
    data = request.get_json(silent=True) or request.form or {}
    username = (data.get("username") or "").strip()
    email = (data.get("email") or "").strip()
    password = data.get("password") or ""
    role = (data.get("role") or "user").strip()

    if not username or not email or not password:
        return jsonify({"ok": False, "error": "username, email e password são obrigatórios."}), 400
    if role not in ("user", "admin"):
        return jsonify({"ok": False, "error": "role inválida."}), 400

    # unicidade básica
    if User.query.filter_by(username=username).first():
        return jsonify({"ok": False, "error": "Nome de usuário já existe."}), 409
    if User.query.filter_by(email=email).first():
        return jsonify({"ok": False, "error": "Email já cadastrado."}), 409

    u = User(username=username, email=email, role=role, password_hash=generate_password_hash(password))
    db.session.add(u)
    db.session.commit()
    return jsonify({"ok": True, "id": u.id})

@app.get("/usuarios")
def usuarios_spa():
    return current_app.send_static_file("index.html")

@app.get("/usuarios/novo")
def usuarios_novo_spa():
    return current_app.send_static_file("index.html")

@app.before_request
def gate_apis_and_project():
    # 1) Nunca bloquear estáticos nem a shell da SPA
    if request.endpoint in ("static",):
        return
    if request.method == "GET" and request.path in {
        "/", "/login",
        "/areas", "/ambientes", "/circuitos", "/modulos", "/vinculacao", "/projeto",
        "/usuarios", "/usuarios/novo",
    }:
        return

    # 2) Endpoints de sessão/autenticação sempre liberados
    if request.endpoint in ("api_session", "api_login", "api_logout"):
        return

    # 3) Para APIs: exigir projeto selecionado APENAS nas rotas que dependem de um projeto
    if request.path.startswith("/api/"):
        # Rotas EXCEÇÃO: criação/listagem/seleção de projeto NÃO exigem projeto selecionado
        exempt_paths = {
            "/api/projetos",          # GET/POST
            "/api/projeto_atual",     # GET/PUT (consultar/selecionar)
            "/api/keypads/meta",     # metadados de keypad
        }
        if request.path in exempt_paths:
            return

        # Só exija projeto em recursos que são "do projeto"
        def is_project_scoped(path: str) -> bool:
            return (
                path.startswith("/api/areas")
                or path.startswith("/api/ambientes")
                or path.startswith("/api/circuitos")
                or path.startswith("/api/modulos")
                or path.startswith("/api/vinculacoes")
                or path.startswith("/api/vinculacao")    # options da tela
                or path.startswith("/api/keypads")
                or path.startswith("/api/projeto_tree")
            )

        if is_project_scoped(request.path):
            if "projeto_atual_id" not in session:
                return jsonify({"ok": False, "error": "Projeto não selecionado."}), 400

        return  # demais APIs seguem para @login_required/@admin_required
@app.get("/favicon.ico")
def favicon_root():
    return redirect(url_for("static", filename="images/favicon-roehn.png"))


# ⬇️ troque toda a função atual por esta
@app.get("/")
def spa_root():
    return current_app.send_static_file("index.html")

# Modifique a rota de seleção para retornar JSON
@app.route('/selecionar_projeto/<int:projeto_id>', methods=['POST'])
@login_required
def selecionar_projeto(projeto_id):
    projeto = db.get_or_404(Projeto, projeto_id)  # ✅

    if projeto.user_id != current_user.id and current_user.role != 'admin':
        return jsonify({"ok": False, "error": "Acesso não autorizado."}), 403

    session['projeto_atual_id'] = projeto.id
    session['projeto_atual_nome'] = projeto.nome

    return jsonify({"ok": True, "projeto": {"id": projeto.id, "nome": projeto.nome}})

# Modifique a rota de edição para retornar JSON
@app.route('/projeto/<int:projeto_id>', methods=['PUT'])
@login_required
def editar_projeto(projeto_id):
    projeto = db.get_or_404(Projeto, projeto_id)
    if projeto.user_id != current_user.id:
        return jsonify({"success": False, "message": "Acesso não autorizado."}), 403

    data = request.form
    novo_nome = data.get('nome')

    if not novo_nome:
        return jsonify({"success": False, "message": "Nome do projeto é obrigatório."}), 400

    projeto_existente = Projeto.query.filter(Projeto.nome == novo_nome, Projeto.user_id == current_user.id, Projeto.id != projeto_id).first()
    if projeto_existente:
        return jsonify({"success": False, "message": f"Projeto com o nome '{novo_nome}' já existe."}), 409

    projeto.nome = novo_nome
    db.session.commit()

    # Atualiza a sessão se for o projeto atual
    if session.get('projeto_atual_id') == projeto.id:
        session['projeto_atual_nome'] = novo_nome

    return jsonify({"success": True})

# app.py

@app.route('/novo_projeto', methods=['POST'])
@login_required
def novo_projeto():
    nome = request.form.get('nome')
    
    if not nome:
        return jsonify({'success': False, 'message': 'Nome do projeto é obrigatório'})
    
    # Validação para evitar nomes duplicados para o mesmo usuário
    projeto_existente = Projeto.query.filter_by(nome=nome, user_id=current_user.id).first()
    if projeto_existente:
        return jsonify({'success': False, 'message': 'Já existe um projeto com esse nome'})
    
    novo_projeto = Projeto(nome=nome, user_id=current_user.id)
    db.session.add(novo_projeto)
    db.session.commit()
    
    return jsonify({'success': True, 'id': novo_projeto.id})

# Modifique a rota de exclusão para retornar JSON
@app.route('/projeto/<int:projeto_id>', methods=['DELETE'])
@login_required
def delete_projeto(projeto_id):
    projeto = db.get_or_404(Projeto, projeto_id)

    # (opcional) verificação de permissão
    if projeto.user_id != current_user.id and current_user.role != 'admin':
        return jsonify({"ok": False, "error": "Acesso não autorizado."}), 403

    # deleta
    db.session.delete(projeto)
    db.session.commit()

    # SE o projeto deletado era o selecionado, limpe a seleção na sessão
    if session.get('projeto_atual_id') == projeto_id:
      session.pop('projeto_atual_id', None)
      session.pop('projeto_atual_nome', None)

    return jsonify({"ok": True, "success": True})

# Rota para obter todos os projetos do usuário
@app.get("/api/projetos")
@login_required
def api_projetos_list():
    projetos = Projeto.query.order_by(Projeto.id.asc()).all()
    selected_id = session.get("projeto_atual_id")
    out = [{
        "id": p.id,
        "nome": p.nome,
        "status": (p.status or "ATIVO"),
        "selected": (p.id == selected_id)
    } for p in projetos]
    return jsonify({"ok": True, "projetos": out})


# no topo, garanta:
from sqlalchemy import or_

@app.delete("/api/projetos/<int:projeto_id>")
@login_required
@admin_required
def api_projetos_delete(projeto_id):
    p = db.get_or_404(Projeto, projeto_id)

    # --- subqueries para os IDs relacionados ao projeto ---
    area_ids = db.session.query(Area.id).filter(Area.projeto_id == p.id).subquery()
    ambiente_ids = db.session.query(Ambiente.id).filter(Ambiente.area_id.in_(area_ids)).subquery()
    circuito_ids = db.session.query(Circuito.id).filter(Circuito.ambiente_id.in_(ambiente_ids)).subquery()
    modulo_ids = db.session.query(Modulo.id).filter(Modulo.projeto_id == p.id).subquery()

    # --- 1) Vinculações que tocam módulos OU circuitos do projeto ---
    Vinculacao.query.filter(
        or_(
            Vinculacao.modulo_id.in_(modulo_ids),
            Vinculacao.circuito_id.in_(circuito_ids),
        )
    ).delete(synchronize_session=False)

    # --- 2) Apagar filhos em ordem segura (sem join) ---
    Modulo.query.filter(Modulo.id.in_(modulo_ids)).delete(synchronize_session=False)
    Circuito.query.filter(Circuito.id.in_(circuito_ids)).delete(synchronize_session=False)
    Ambiente.query.filter(Ambiente.id.in_(ambiente_ids)).delete(synchronize_session=False)
    Area.query.filter(Area.id.in_(area_ids)).delete(synchronize_session=False)

    # --- 3) Por fim, o projeto ---
    db.session.delete(p)
    db.session.commit()

    # Se era o projeto selecionado, limpe a sessão
    if session.get("projeto_atual_id") == projeto_id:
        session.pop("projeto_atual_id", None)
        session.pop("projeto_atual_nome", None)

    return jsonify({"ok": True})

@app.put("/api/projetos/<int:projeto_id>")
@login_required
def api_projetos_update(projeto_id):
    data = request.get_json(silent=True) or request.form or {}
    p = db.get_or_404(Projeto, projeto_id)

    if "nome" in data:
        nome = (data.get("nome") or "").strip()
        if not nome:
            return jsonify({"ok": False, "error": "Nome é obrigatório."}), 400
        p.nome = nome

    if "status" in data:
        status = (data.get("status") or "").strip().upper()
        if status not in {"ATIVO", "INATIVO", "CONCLUIDO"}:
            return jsonify({"ok": False, "error": "Status inválido (use ATIVO, INATIVO ou CONCLUIDO)."}), 400
        p.status = status

    db.session.commit()

    if session.get("projeto_atual_id") == p.id and "nome" in data:
        session["projeto_atual_nome"] = p.nome

    return jsonify({"ok": True, "projeto": {"id": p.id, "nome": p.nome, "status": p.status}})

@app.post("/api/projetos")
@login_required
def api_projetos_create():
    data = request.get_json(silent=True) or request.form or {}
    nome = (data.get("nome") or "").strip()
    if not nome:
        return jsonify({"ok": False, "error": "Nome é obrigatório."}), 400

    status = (data.get("status") or "ATIVO").strip().upper()
    if status not in {"ATIVO", "INATIVO", "CONCLUIDO"}:
        return jsonify({"ok": False, "error": "Status inválido (use ATIVO, INATIVO ou CONCLUIDO)."}), 400

    p = Projeto(nome=nome, user_id=current_user.id, status=status)
    db.session.add(p)
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify({"ok": False, "error": "Não foi possível salvar o projeto."}), 400

    session["projeto_atual_id"] = p.id
    session["projeto_atual_nome"] = p.nome
    return jsonify({"ok": True, "id": p.id, "nome": p.nome, "status": p.status})

@app.get("/<path:prefix>/static/images/favicon-roehn.png")
def favicon_nested(prefix):
    # redireciona para o caminho absoluto quando acessado a partir de rotas aninhadas (/usuarios, /projeto, etc.)
    return redirect(url_for("static", filename="images/favicon-roehn.png"))


@app.route("/api/projeto_atual", methods=["GET", "PUT", "POST"])
@login_required
def api_projeto_atual():
    # GET: retorna o selecionado
    if request.method == "GET":
        pid = session.get("projeto_atual_id")
        if not pid:
            return jsonify({"ok": True, "projeto_atual": None})
        p = db.get_or_404(Projeto, int(pid))
        return jsonify({"ok": True, "projeto_atual": {"id": p.id, "nome": p.nome, "status": p.status}})

    # PUT/POST: seleciona um projeto
    data = request.get_json(silent=True) or request.form or {}
    projeto_id = data.get("projeto_id")
    if not projeto_id:
        return jsonify({"ok": False, "error": "projeto_id é obrigatório."}), 400

    p = db.get_or_404(Projeto, int(projeto_id))
    session["projeto_atual_id"] = p.id
    session["projeto_atual_nome"] = p.nome
    return jsonify({"ok": True})




# Adicione esta nova rota API para listar áreas
# LISTAR ÁREAS DO PROJETO ATUAL
@app.get("/api/areas")
@login_required
def api_areas_list():
    projeto_id = session.get("projeto_atual_id")
    if not projeto_id:
        return jsonify({"ok": True, "areas": []})
    areas = Area.query.filter_by(projeto_id=projeto_id).order_by(Area.id.asc()).all()
    return jsonify({"ok": True, "areas": [{"id": a.id, "nome": a.nome} for a in areas]})

@app.post("/api/areas")
@login_required
def api_areas_create():
    data = request.get_json(silent=True) or {}
    nome = (data.get("nome") or "").strip()
    if not nome:
        return jsonify({"ok": False, "error": "Nome é obrigatório."}), 400
    projeto_id = session.get("projeto_atual_id")
    if not projeto_id:
        return jsonify({"ok": False, "error": "Projeto não selecionado."}), 400
    a = Area(nome=nome, projeto_id=projeto_id)
    db.session.add(a); db.session.commit()
    return jsonify({"ok": True, "id": a.id})

@app.put("/api/areas/<int:area_id>")
@login_required
def api_areas_update(area_id):
    data = request.get_json(silent=True) or {}
    nome = (data.get("nome") or "").strip()
    if not nome:
        return jsonify({"ok": False, "error": "Nome é obrigatório."}), 400
    a = db.get_or_404(Area, area_id)
    a.nome = nome; db.session.commit()
    return jsonify({"ok": True})

@app.delete("/api/areas/<int:area_id>")
@login_required
def api_areas_delete(area_id):
    a = db.get_or_404(Area, area_id)
    db.session.delete(a); db.session.commit()
    return jsonify({"ok": True})

@app.get("/areas")
def areas_spa():
    return current_app.send_static_file("index.html")



@app.get("/ambientes")
def ambientes_spa():
    return current_app.send_static_file("index.html")

# GET -> SPA (React vai cuidar da UI)
@app.get("/circuitos")
def circuitos_spa():
    return current_app.send_static_file("index.html")
# LISTAR AMBIENTES DO PROJETO ATUAL
@app.get("/api/ambientes")
@login_required
def api_ambientes_list():
    projeto_id = session.get("projeto_atual_id")
    if not projeto_id:
        return jsonify({"ok": True, "success": True, "ambientes": []})

    ambientes = (Ambiente.query
                 .join(Area, Ambiente.area_id == Area.id)
                 .filter(Area.projeto_id == projeto_id)
                 .all())

    out = []
    for a in ambientes:
        out.append({
            "id": a.id,
            "nome": a.nome,
            "area": {"id": a.area.id, "nome": a.area.nome} if getattr(a, "area", None) else None,
        })
    return jsonify({"ok": True, "success": True, "ambientes": out})

# CRIAR AMBIENTE
@app.post("/api/ambientes")
@login_required
def api_ambientes_create():
    data = request.get_json(silent=True) or request.form or {}
    nome = (data.get("nome") or "").strip()
    area_id = data.get("area_id")

    if not nome or not area_id:
        return jsonify({"ok": False, "error": "Nome e área são obrigatórios."}), 400

    area = db.get_or_404(Area, int(area_id))

    # (opcional) validar que a área pertence ao projeto selecionado
    if session.get("projeto_atual_id") != getattr(area, "projeto_id", None):
        return jsonify({"ok": False, "error": "Área não pertence ao projeto atual."}), 400

    amb = Ambiente(nome=nome, area_id=area.id)
    db.session.add(amb)
    db.session.commit()

    return jsonify({"ok": True, "success": True, "id": amb.id})

# EXCLUIR AMBIENTE
@app.delete("/api/ambientes/<int:ambiente_id>")
@login_required
def api_ambientes_delete(ambiente_id):
    amb = db.get_or_404(Ambiente, ambiente_id)

    # (opcional) autorização extra: só dono/admin
    # if amb.area.projeto.user_id != current_user.id and current_user.role != "admin":
    #     return jsonify({"ok": False, "error": "Acesso não autorizado."}), 403

    db.session.delete(amb)
    db.session.commit()
    return jsonify({"ok": True, "success": True})

# LISTAR CIRCUITOS DO PROJETO ATUAL
@app.get("/api/circuitos")
@login_required
def api_circuitos_list():
    projeto_id = session.get("projeto_atual_id")
    if not projeto_id:
        return jsonify({"ok": True, "circuitos": []})

    circuitos = (
        Circuito.query
        .join(Ambiente, Circuito.ambiente_id == Ambiente.id)
        .join(Area, Ambiente.area_id == Area.id)
        .filter(Area.projeto_id == projeto_id)
        .all()
    )

    out = []
    for c in circuitos:
        out.append({
            "id": c.id,
            "identificador": c.identificador,
            "nome": c.nome,
            "tipo": c.tipo,
            "dimerizavel": getattr(c, "dimerizavel", False),  # ⭐⭐⭐ NOVO CAMPO
            "potencia": getattr(c, "potencia", 0.0),  # NOVO CAMPO
            "sak": getattr(c, "sak", None),
            "ambiente": {
                "id": c.ambiente.id,
                "nome": c.ambiente.nome,
                "area": {
                    "id": c.ambiente.area.id,
                    "nome": c.ambiente.area.nome,
                } if getattr(c.ambiente, "area", None) else None,
            } if c.ambiente else None,
        })
    return jsonify({"ok": True, "circuitos": out})

# CRIAR CIRCUITO
@app.post("/api/circuitos")
@login_required
def api_circuitos_create():
    data = request.get_json(silent=True) or request.form or {}
    identificador = (data.get("identificador") or "").strip()
    nome = (data.get("nome") or "").strip()
    tipo = (data.get("tipo") or "").strip()
    ambiente_id = data.get("ambiente_id")
    dimerizavel = data.get("dimerizavel", False)
    potencia = float(data.get("potencia", 0.0))  # NOVO CAMPO

    if not identificador or not nome or not tipo or not ambiente_id:
        return jsonify({"ok": False, "error": "Campos obrigatórios ausentes."}), 400

    if tipo != "luz" and dimerizavel:
        return jsonify({"ok": False, "error": "Campo 'dimerizavel' só é permitido para circuitos do tipo 'luz'."}), 400

    # Validação para potência não negativa
    if potencia < 0:
        return jsonify({"ok": False, "error": "A potência não pode ser negativa."}), 400

    ambiente = db.get_or_404(Ambiente, int(ambiente_id))

    projeto_id = session.get("projeto_atual_id")
    if not getattr(ambiente, "area", None) or getattr(ambiente.area, "projeto_id", None) != projeto_id:
        return jsonify({"ok": False, "error": "Ambiente não pertence ao projeto atual."}), 400

    exists = (
        Circuito.query
        .join(Ambiente, Circuito.ambiente_id == Ambiente.id)
        .join(Area, Ambiente.area_id == Area.id)
        .filter(Area.projeto_id == projeto_id, Circuito.identificador == identificador)
        .first()
    )
    if exists:
        return jsonify({"ok": False, "error": "Identificador já existe neste projeto."}), 409


    # ---------- GERAÇÃO DE SAK ----------
    if tipo == "hvac":
        sak = None
        quantidade_saks = 0
    else:
        quantidade_saks = 2 if tipo == "persiana" else 1

        ultimo = (
            Circuito.query
            .join(Ambiente, Circuito.ambiente_id == Ambiente.id)
            .join(Area, Ambiente.area_id == Area.id)
            .filter(Area.projeto_id == projeto_id, Circuito.tipo != "hvac")
            .order_by(Circuito.sak.desc())
            .first()
        )

        if ultimo:
            proximo_base = (ultimo.sak or 0) + (ultimo.quantidade_saks or 1)
            if tipo == "persiana":
                existe_seguinte = (
                    Circuito.query
                    .join(Ambiente, Circuito.ambiente_id == Ambiente.id)
                    .join(Area, Ambiente.area_id == Area.id)
                    .filter(Area.projeto_id == projeto_id, Circuito.sak == proximo_base + 1)
                    .first()
                )
                if existe_seguinte:
                    proximo_base += 2
            sak = proximo_base
        else:
            sak = 1

    c = Circuito(
        identificador=identificador,
        nome=nome,
        tipo=tipo,
        dimerizavel=dimerizavel if tipo == "luz" else False,
        potencia=potencia,  # NOVO CAMPO
        ambiente_id=ambiente.id,
        sak=sak,
        quantidade_saks=quantidade_saks,
    )
    db.session.add(c)
    db.session.commit()
    
    return jsonify({
        "ok": True, 
        "id": c.id, 
        "sak": c.sak, 
        "quantidade_saks": c.quantidade_saks,
        "dimerizavel": c.dimerizavel,
        "potencia": c.potencia  # NOVO CAMPO
    })

# app.py (adições)

# -------------------- Quadros Elétricos (AutomationBoards) --------------------

@app.get("/api/quadros_eletricos")
@login_required
def api_quadros_eletricos_list():
    projeto_id = session.get("projeto_atual_id")
    if not projeto_id:
        return jsonify({"ok": True, "quadros_eletricos": []})

    quadros = (
        QuadroEletrico.query
        .join(Ambiente, QuadroEletrico.ambiente_id == Ambiente.id)
        .join(Area, Ambiente.area_id == Area.id)
        .filter(Area.projeto_id == projeto_id)
        .options(joinedload(QuadroEletrico.modulos))
        .all()
    )

    out = []
    for q in quadros:
        out.append({
            "id": q.id,
            "nome": q.nome,
            "notes": q.notes,
            "ambiente": {
                "id": q.ambiente.id,
                "nome": q.ambiente.nome,
                "area": {
                    "id": q.ambiente.area.id,
                    "nome": q.ambiente.area.nome,
                } if q.ambiente.area else None,
            },
            "quantidade_modulos": len(q.modulos),
        })
    return jsonify({"ok": True, "quadros_eletricos": out})

@app.get("/api/quadros_eletricos/<int:quadro_id>")
@login_required
def api_quadros_eletricos_get(quadro_id):
    projeto_id = session.get("projeto_atual_id")
    quadro = db.get_or_404(QuadroEletrico, quadro_id)
    
    if not projeto_id or quadro.projeto_id != projeto_id:
        return jsonify({"ok": False, "error": "Quadro elétrico não pertence ao projeto atual."}), 404

    modulos_out = []
    for modulo in quadro.modulos:
        modulos_out.append({
            "id": modulo.id,
            "nome": modulo.nome,
            "tipo": modulo.tipo,
            "quantidade_canais": modulo.quantidade_canais,
            "hsnet": modulo.hsnet,
            "dev_id": modulo.dev_id,
        })

    return jsonify({
        "ok": True,
        "quadro_eletrico": {
            "id": quadro.id,
            "nome": quadro.nome,
            "notes": quadro.notes,
            "ambiente": {
                "id": quadro.ambiente.id,
                "nome": quadro.ambiente.nome,
                "area": {
                    "id": quadro.ambiente.area.id,
                    "nome": quadro.ambiente.area.nome,
                },
            },
            "modulos": modulos_out,
        }
    })

@app.post("/api/quadros_eletricos")
@login_required
def api_quadros_eletricos_create():
    projeto_id = session.get("projeto_atual_id")
    if not projeto_id:
        return jsonify({"ok": False, "error": "Projeto não selecionado."}), 400

    data = request.get_json(silent=True) or request.form or {}
    nome = (data.get("nome") or "").strip()
    ambiente_id = data.get("ambiente_id")
    notes = (data.get("notes") or "").strip() or None

    if not nome or not ambiente_id:
        return jsonify({"ok": False, "error": "Nome e ambiente são obrigatórios."}), 400

    ambiente = db.get_or_404(Ambiente, int(ambiente_id))
    
    # Verificar se o ambiente pertence ao projeto atual
    if ambiente.area.projeto_id != projeto_id:
        return jsonify({"ok": False, "error": "Ambiente não pertence ao projeto atual."}), 400

    # Verificar se já existe um quadro com o mesmo nome no ambiente
    existing = QuadroEletrico.query.filter_by(ambiente_id=ambiente.id, nome=nome).first()
    if existing:
        return jsonify({"ok": False, "error": "Já existe um quadro elétrico com esse nome neste ambiente."}), 409

    quadro = QuadroEletrico(
        nome=nome,
        notes=notes,
        ambiente_id=ambiente.id,
        projeto_id=projeto_id
    )
    
    db.session.add(quadro)
    db.session.commit()

    return jsonify({"ok": True, "id": quadro.id})

@app.put("/api/quadros_eletricos/<int:quadro_id>")
@login_required
def api_quadros_eletricos_update(quadro_id):
    projeto_id = session.get("projeto_atual_id")
    quadro = db.get_or_404(QuadroEletrico, quadro_id)
    
    if not projeto_id or quadro.projeto_id != projeto_id:
        return jsonify({"ok": False, "error": "Quadro elétrico não pertence ao projeto atual."}), 404

    data = request.get_json(silent=True) or request.form or {}
    
    if "nome" in data:
        novo_nome = (data.get("nome") or "").strip()
        if not novo_nome:
            return jsonify({"ok": False, "error": "Nome é obrigatório."}), 400
        
        # Verificar se o novo nome já existe em outro quadro no mesmo ambiente
        existing = QuadroEletrico.query.filter(
            QuadroEletrico.ambiente_id == quadro.ambiente_id,
            QuadroEletrico.nome == novo_nome,
            QuadroEletrico.id != quadro_id
        ).first()
        if existing:
            return jsonify({"ok": False, "error": "Já existe um quadro elétrico com esse nome neste ambiente."}), 409
        
        quadro.nome = novo_nome

    if "notes" in data:
        quadro.notes = (data.get("notes") or "").strip() or None

    if "ambiente_id" in data:
        novo_ambiente_id = data.get("ambiente_id")
        novo_ambiente = db.get_or_404(Ambiente, int(novo_ambiente_id))
        
        if novo_ambiente.area.projeto_id != projeto_id:
            return jsonify({"ok": False, "error": "Novo ambiente não pertence ao projeto atual."}), 400
        
        quadro.ambiente_id = novo_ambiente.id

    db.session.commit()
    return jsonify({"ok": True})

@app.delete("/api/quadros_eletricos/<int:quadro_id>")
@login_required
def api_quadros_eletricos_delete(quadro_id):
    projeto_id = session.get("projeto_atual_id")
    quadro = db.get_or_404(QuadroEletrico, quadro_id)
    
    if not projeto_id or quadro.projeto_id != projeto_id:
        return jsonify({"ok": False, "error": "Quadro elétrico não pertence ao projeto atual."}), 404

    # Verificar se o quadro tem módulos antes de excluir
    if quadro.modulos:
        return jsonify({
            "ok": False,
            "error": "Não é possível excluir um quadro elétrico que contém módulos. Remova os módulos primeiro."
        }), 409

    db.session.delete(quadro)
    db.session.commit()
    return jsonify({"ok": True})

# Rota para associar módulos a um quadro elétrico
@app.put("/api/modulos/<int:modulo_id>/quadro")
@login_required
def api_modulos_associate_quadro(modulo_id):
    projeto_id = session.get("projeto_atual_id")
    modulo = db.get_or_404(Modulo, modulo_id)
    
    if not projeto_id or modulo.projeto_id != projeto_id:
        return jsonify({"ok": False, "error": "Módulo não pertence ao projeto atual."}), 404

    data = request.get_json(silent=True) or request.form or {}
    quadro_id = data.get("quadro_eletrico_id")

    if quadro_id in (None, ""):
        # Remover associação
        modulo.quadro_eletrico_id = None
    else:
        quadro = db.get_or_404(QuadroEletrico, int(quadro_id))
        if quadro.projeto_id != projeto_id:
            return jsonify({"ok": False, "error": "Quadro elétrico não pertence ao projeto atual."}), 400
        modulo.quadro_eletrico_id = quadro.id

    db.session.commit()
    return jsonify({"ok": True})

# Rota para obter módulos disponíveis para associação com quadros
@app.get("/api/quadros_eletricos/<int:quadro_id>/modulos_disponiveis")
@login_required
def api_quadros_eletricos_modulos_disponiveis(quadro_id):
    projeto_id = session.get("projeto_atual_id")
    quadro = db.get_or_404(QuadroEletrico, quadro_id)
    
    if not projeto_id or quadro.projeto_id != projeto_id:
        return jsonify({"ok": False, "error": "Quadro elétrico não pertence ao projeto atual."}), 404

    # Módulos do projeto que não estão associados a nenhum quadro ou estão associados a este quadro
    modulos = Modulo.query.filter_by(projeto_id=projeto_id).filter(
        (Modulo.quadro_eletrico_id == None) | (Modulo.quadro_eletrico_id == quadro_id)
    ).all()

    modulos_out = []
    for modulo in modulos:
        modulos_out.append({
            "id": modulo.id,
            "nome": modulo.nome,
            "tipo": modulo.tipo,
            "quantidade_canais": modulo.quantidade_canais,
            "associado": modulo.quadro_eletrico_id == quadro_id,
        })

    return jsonify({"ok": True, "modulos": modulos_out})

# Rota SPA para a página de quadros elétricos
@app.get("/quadros_eletricos")
def quadros_eletricos_spa():
    return current_app.send_static_file("index.html")

# ATUALIZAR CIRCUITO (se você não tiver essa rota, precisa adicionar)
@app.put("/api/circuitos/<int:circuito_id>")
@login_required
def api_circuitos_update(circuito_id):
    c = db.get_or_404(Circuito, circuito_id)
    
    projeto_id = session.get("projeto_atual_id")
    if not getattr(c, "ambiente", None) or not getattr(c.ambiente, "area", None) or getattr(c.ambiente.area, "projeto_id", None) != projeto_id:
        return jsonify({"ok": False, "error": "Circuito não pertence ao projeto atual."}), 400

    data = request.get_json(silent=True) or request.form or {}
    
    if "nome" in data:
        c.nome = (data.get("nome") or "").strip()
    
    if "tipo" in data:
        novo_tipo = (data.get("tipo") or "").strip()
        c.tipo = novo_tipo
        if novo_tipo != "luz":
            c.dimerizavel = False
    
    if "dimerizavel" in data and c.tipo == "luz":
        c.dimerizavel = bool(data.get("dimerizavel"))

    # NOVO: Atualizar campo potencia
    if "potencia" in data:
        nova_potencia = float(data.get("potencia", 0.0))
        if nova_potencia < 0:
            return jsonify({"ok": False, "error": "A potência não pode ser negativa."}), 400
        c.potencia = nova_potencia

    db.session.commit()
    
    return jsonify({
        "ok": True, 
        "id": c.id,
        "nome": c.nome,
        "tipo": c.tipo,
        "dimerizavel": c.dimerizavel,
        "potencia": c.potencia  # NOVO CAMPO
    })


# EXCLUIR CIRCUITO (permanece igual)
@app.delete("/api/circuitos/<int:circuito_id>")
@login_required
def api_circuitos_delete(circuito_id):
    c = db.get_or_404(Circuito, circuito_id)

    projeto_id = session.get("projeto_atual_id")
    if not getattr(c, "ambiente", None) or not getattr(c.ambiente, "area", None) or getattr(c.ambiente.area, "projeto_id", None) != projeto_id:
        return jsonify({"ok": False, "error": "Circuito não pertence ao projeto atual."}), 400

    db.session.delete(c)
    db.session.commit()
    return jsonify({"ok": True})

@app.get("/modulos")
def modulos_spa():
    return current_app.send_static_file("index.html")
    
@app.get("/api/modulos")
@login_required
def api_modulos_list():
    projeto_id = session.get("projeto_atual_id")
    if not projeto_id:
        return jsonify({"ok": True, "modulos": []})

    modulos = Modulo.query.filter_by(projeto_id=projeto_id).options(
        joinedload(Modulo.quadro_eletrico)  # CARREGAR QUADRO ELÉTRICO
    ).all()

    # conta vinculações por módulo do projeto atual
    vincs = (
        Vinculacao.query
        .join(Modulo, Vinculacao.modulo_id == Modulo.id)
        .filter(Modulo.projeto_id == projeto_id)
        .all()
    )
    vinc_count_by_mod = {}
    for v in vincs:
        vinc_count_by_mod[v.modulo_id] = vinc_count_by_mod.get(v.modulo_id, 0) + 1

    out = [
        {
            "id": m.id,
            "nome": m.nome,
            "tipo": m.tipo,
            "quantidade_canais": m.quantidade_canais,
            "vinc_count": vinc_count_by_mod.get(m.id, 0),
            "quadro_eletrico": {
                "id": m.quadro_eletrico.id,
                "nome": m.quadro_eletrico.nome,
            } if m.quadro_eletrico else None,  # NOVO
        }
        for m in modulos
    ]
    return jsonify({"ok": True, "modulos": out})

@app.delete("/api/modulos/<int:modulo_id>")
@login_required
def api_modulos_delete(modulo_id):
    m = db.get_or_404(Modulo, modulo_id)

    projeto_id = session.get("projeto_atual_id")
    if m.projeto_id != projeto_id:
        return jsonify({"ok": False, "error": "Módulo não pertence ao projeto atual."}), 400

    # Bloqueia exclusão se houver vinculações
    vinc_existente = Vinculacao.query.filter_by(modulo_id=m.id).first()
    if vinc_existente:
        return jsonify({
            "ok": False,
            "error": "Este módulo está em uso em uma ou mais vinculações. "
                     "Exclua as vinculações antes de remover o módulo."
        }), 409

    db.session.delete(m)
    db.session.commit()
    return jsonify({"ok": True})

    
@app.get("/api/modulos/meta")
@login_required
def api_modulos_meta():
    # Usa diretamente o dicionário MODULO_INFO já existente
    return jsonify({"ok": True, "meta": MODULO_INFO})
@app.post("/api/modulos")
@login_required
def api_modulos_create():
    data = request.get_json(silent=True) or request.form or {}
    tipo = (data.get("tipo") or "").strip().upper()
    nome = (data.get("nome") or "").strip()
    quadro_eletrico_id = data.get("quadro_eletrico_id")  # NOVO CAMPO
    projeto_id = session.get("projeto_atual_id")

    if not projeto_id:
        return jsonify({"ok": False, "error": "Projeto não selecionado."}), 400
    if not tipo:
        return jsonify({"ok": False, "error": "Tipo é obrigatório."}), 400

    info = MODULO_INFO.get(tipo)
    if not info:
        return jsonify({"ok": False, "error": "Tipo inválido."}), 400

    if not nome:
        nome = info["nome_completo"]

    # Verificar se o quadro elétrico pertence ao projeto
    quadro_eletrico = None
    if quadro_eletrico_id:
        quadro_eletrico = QuadroEletrico.query.filter_by(
            id=quadro_eletrico_id, 
            projeto_id=projeto_id
        ).first()
        if not quadro_eletrico:
            return jsonify({"ok": False, "error": "Quadro elétrico não encontrado no projeto."}), 400

    # (opcional) evitar nome duplicado dentro do projeto
    exists = Modulo.query.filter_by(projeto_id=projeto_id, nome=nome).first()
    if exists:
        return jsonify({"ok": False, "error": "Já existe um módulo com esse nome no projeto."}), 409

    hsnet_val = data.get("hsnet")
    if hsnet_val not in (None, ""):
        try:
            hsnet = int(hsnet_val)
        except (TypeError, ValueError):
            return jsonify({"ok": False, "error": "hsnet invalido."}), 400
        if hsnet <= 0:
            return jsonify({"ok": False, "error": "hsnet deve ser positivo."}), 400
        if is_hsnet_in_use(hsnet):
            return jsonify({"ok": False, "error": "HSNET ja esta em uso."}), 409
    else:
        hsnet = None

    dev_id_val = data.get("dev_id")
    if dev_id_val not in (None, ""):
        try:
            dev_id = int(dev_id_val)
        except (TypeError, ValueError):
            return jsonify({"ok": False, "error": "dev_id invalido."}), 400
        if dev_id <= 0:
            return jsonify({"ok": False, "error": "dev_id deve ser positivo."}), 400
    else:
        dev_id = hsnet

    m = Modulo(
        nome=nome,
        tipo=tipo,
        quantidade_canais=info["canais"],
        projeto_id=projeto_id,
        hsnet=hsnet,
        dev_id=dev_id,
        quadro_eletrico_id=quadro_eletrico.id if quadro_eletrico else None,  # NOVO
    )
    db.session.add(m)
    db.session.commit()
    return jsonify({"ok": True, "id": m.id})


@app.get("/vinculacao")
def vinculacao_spa():
    return current_app.send_static_file("index.html")
@app.get("/api/vinculacao/options")
@login_required
def api_vinculacao_options():
    projeto_id = session.get("projeto_atual_id")
    if not projeto_id:
        return jsonify({"ok": True, "compat": {"luz": [], "persiana": [], "hvac": []}, "circuitos": [], "modulos": []})

    # Compatibilidade a partir do MODULO_INFO
    compat = {"luz": [], "persiana": [], "hvac": []}
    for tipo_mod, info in MODULO_INFO.items():
        for t in info.get("tipos_permitidos", []):
            if tipo_mod not in compat[t]:
                compat[t].append(tipo_mod)

    # Vinculações existentes do projeto (para filtrar circuitos e marcar canais ocupados)
    vincs = (
        Vinculacao.query
        .join(Circuito, Vinculacao.circuito_id == Circuito.id)
        .join(Ambiente, Circuito.ambiente_id == Ambiente.id)
        .join(Area, Ambiente.area_id == Area.id)
        .join(Modulo, Vinculacao.modulo_id == Modulo.id)
        .filter(Area.projeto_id == projeto_id, Modulo.projeto_id == projeto_id)
        .all()
    )
    circuitos_vinculados_ids = {v.circuito_id for v in vincs}

    # Circuitos do projeto (EXCLUINDO os já vinculados)
    circuitos = (
        Circuito.query
        .join(Ambiente, Circuito.ambiente_id == Ambiente.id)
        .join(Area, Ambiente.area_id == Area.id)
        .filter(Area.projeto_id == projeto_id)
        .all()
    )
    circuitos_out = [{
        "id": c.id,
        "identificador": c.identificador,
        "nome": c.nome,
        "tipo": c.tipo,
        "potencia": c.potencia,  # ← ADICIONE ESTA LINHA
        "area_nome": getattr(c.ambiente.area, "nome", None) if c.ambiente and c.ambiente.area else None,
        "ambiente_nome": getattr(c.ambiente, "nome", None) if c.ambiente else None,
    } for c in circuitos if c.id not in circuitos_vinculados_ids]

    # Resto do código permanece igual...
    modulos = Modulo.query.filter_by(projeto_id=projeto_id).all()
    ocupados_por_mod = {}
    for v in vincs:
        ocupados_por_mod.setdefault(v.modulo_id, set()).add(v.canal)

    modulos_out = []
    for m in modulos:
        ocupados = ocupados_por_mod.get(m.id, set())
        canais_livres = [i for i in range(1, (m.quantidade_canais or 0) + 1) if i not in ocupados]
        modulos_out.append({
            "id": m.id,
            "nome": m.nome,
            "tipo": m.tipo,
            "canais_disponiveis": canais_livres,
            "quantidade_canais": m.quantidade_canais,
        })

    return jsonify({"ok": True, "compat": compat, "circuitos": circuitos_out, "modulos": modulos_out})

@app.get("/api/vinculacoes")
@login_required
def api_vinculacoes_list():
    projeto_id = session.get("projeto_atual_id")
    if not projeto_id:
        return jsonify({"ok": True, "vinculacoes": []})

    vincs = (
        Vinculacao.query
        .join(Circuito, Vinculacao.circuito_id == Circuito.id)
        .join(Ambiente, Circuito.ambiente_id == Ambiente.id)
        .join(Area, Ambiente.area_id == Area.id)
        .join(Modulo, Vinculacao.modulo_id == Modulo.id)
        .filter(Area.projeto_id == projeto_id, Modulo.projeto_id == projeto_id)
        .all()
    )

    out = []
    for v in vincs:
        c = v.circuito
        m = v.modulo
        a = c.ambiente
        area = a.area if a else None
        out.append({
            "id": v.id,
            "circuito_id": c.id,
            "identificador": c.identificador,
            "circuito_nome": c.nome,
            "area_nome": getattr(area, "nome", None),
            "ambiente_nome": getattr(a, "nome", None),
            "modulo_nome": m.nome,
            "modulo_tipo": m.tipo,
            "modulo_id": m.id,  # ← ADICIONE ESTA LINHA
            "canal": v.canal,
            "potencia": c.potencia,
        })
    return jsonify({"ok": True, "vinculacoes": out})

@app.post("/api/vinculacoes")
@login_required
def api_vinculacoes_create():
    data = request.get_json(silent=True) or request.form or {}
    circuito_id = data.get("circuito_id")
    modulo_id = data.get("modulo_id")
    canal = data.get("canal")

    if not circuito_id or not modulo_id or not canal:
        return jsonify({"ok": False, "error": "Parâmetros obrigatórios ausentes."}), 400

    circuito = db.get_or_404(Circuito, int(circuito_id))
    modulo = db.get_or_404(Modulo, int(modulo_id))
    canal = int(canal)

    projeto_id = session.get("projeto_atual_id")

    # garantias de projeto
    if not circuito.ambiente or not circuito.ambiente.area or circuito.ambiente.area.projeto_id != projeto_id:
        return jsonify({"ok": False, "error": "Circuito não pertence ao projeto atual."}), 400
    if modulo.projeto_id != projeto_id:
        return jsonify({"ok": False, "error": "Módulo não pertence ao projeto atual."}), 400

    # compatibilidade (usa MODULO_INFO)
    info = MODULO_INFO.get(modulo.tipo, {})
    tipos_permitidos = set(info.get("tipos_permitidos", []))
    if circuito.tipo not in tipos_permitidos:
        return jsonify({"ok": False, "error": f"Circuitos do tipo {circuito.tipo} não podem ser vinculados a módulos {modulo.tipo}."}), 400

    # canal válido e livre
    if canal < 1 or canal > (modulo.quantidade_canais or 0):
        return jsonify({"ok": False, "error": "Canal inválido para este módulo."}), 400
    existe_no_canal = Vinculacao.query.filter_by(modulo_id=modulo.id, canal=canal).first()
    if existe_no_canal:
        return jsonify({"ok": False, "error": "Este canal já está em uso no módulo escolhido."}), 409

    # um circuito só pode ter uma vinculação (espelhando a UI antiga)
    existe_para_circuito = Vinculacao.query.filter_by(circuito_id=circuito.id).first()
    if existe_para_circuito:
        return jsonify({"ok": False, "error": "Este circuito já está vinculado a um módulo/canal."}), 409

    v = Vinculacao(circuito_id=circuito.id, modulo_id=modulo.id, canal=canal)
    db.session.add(v)
    db.session.commit()
    return jsonify({"ok": True, "id": v.id})
@app.delete("/api/vinculacoes/<int:vinc_id>")
@login_required
def api_vinculacoes_delete(vinc_id):
    v = db.get_or_404(Vinculacao, vinc_id)

    # segurança: precisa pertencer ao projeto atual
    projeto_id = session.get("projeto_atual_id")
    if not v.modulo or v.modulo.projeto_id != projeto_id:
        return jsonify({"ok": False, "error": "Vinculação não pertence ao projeto atual."}), 400

    db.session.delete(v)
    db.session.commit()
    return jsonify({"ok": True})



@app.route('/modulos/<int:id>', methods=['DELETE'])
@login_required
def excluir_modulo(id):
    modulo = Modulo.query.get_or_404(id)
    
    # Verificar se o módulo pertence ao projeto atual
    if modulo.projeto_id != session.get('projeto_atual_id'):
        return jsonify({'success': False, 'message': 'Módulo não pertence ao projeto atual'})
    
    # Verificar se o módulo tem vinculações
    if modulo.vinculacoes:
        return jsonify({'success': False, 'message': 'Não é possível excluir módulo com vinculações ativas'})
    
    db.session.delete(modulo)
    db.session.commit()
    return jsonify({'success': True})


@app.get("/projeto")
def projeto_spa():
    return current_app.send_static_file("index.html")
    
# app.py (atualização da rota api_projeto_tree)

@app.get("/api/projeto_tree")
@login_required
def api_projeto_tree():
    projeto_id = session.get("projeto_atual_id")
    if not projeto_id:
        return jsonify({"ok": True, "projeto": None, "areas": []})

    # Carrega Áreas -> Ambientes -> Circuitos, Quadros Elétricos -> Módulos
    areas = (
        Area.query
        .options(
            joinedload(Area.ambientes)
            .joinedload(Ambiente.circuitos)
            .joinedload(Circuito.vinculacao)
            .joinedload(Vinculacao.modulo),
            joinedload(Area.ambientes)
            .joinedload(Ambiente.keypads)
            .joinedload(Keypad.buttons)
            .joinedload(KeypadButton.circuito),
            joinedload(Area.ambientes)
            .joinedload(Ambiente.quadros_eletricos)
            .joinedload(QuadroEletrico.modulos),
        )
        .filter(Area.projeto_id == projeto_id)
        .all()
    )

    out_areas = []
    for a in areas:
        ambs = []
        for amb in a.ambientes:
            circs = []
            for c in amb.circuitos:
                vinc = getattr(c, "vinculacao", None)
                circs.append({
                    "id": c.id,
                    "tipo": c.tipo,
                    "identificador": c.identificador,
                    "nome": c.nome,
                    "vinculacao": {
                        "modulo_nome": getattr(vinc.modulo, "nome", None) if vinc and vinc.modulo else None,
                        "canal": getattr(vinc, "canal", None),
                    } if vinc else None,
                })
            
            keypads_out = [
                serialize_keypad(k)
                for k in sorted(amb.keypads, key=lambda kp: (kp.nome or "").lower())
            ]
            
            quadros_out = []
            for q in amb.quadros_eletricos:
                quadros_out.append({
                    "id": q.id,
                    "nome": q.nome,
                    "modulos": [
                        {
                            "id": m.id,
                            "nome": m.nome,
                            "tipo": m.tipo,
                            "quantidade_canais": m.quantidade_canais,
                        }
                        for m in q.modulos
                    ]
                })
            
            ambs.append({
                "id": amb.id,
                "nome": amb.nome,
                "circuitos": circs,
                "keypads": keypads_out,
                "quadros_eletricos": quadros_out,  # Novo
            })
        out_areas.append({"id": a.id, "nome": a.nome, "ambientes": ambs})

    return jsonify({
        "ok": True,
        "projeto": {"id": projeto_id, "nome": session.get("projeto_atual_nome")},
        "areas": out_areas,
    })

# app.py (atualização da rota exportar_csv)

@app.route('/exportar-csv')
@login_required
def exportar_csv():
    projeto_atual_id = session.get('projeto_atual_id')
    projeto = Projeto.query.get(projeto_atual_id)
    
    circuitos = Circuito.query.join(Ambiente).join(Area).filter(Area.projeto_id == projeto_atual_id).all()
    
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Adicionar coluna do quadro elétrico
    writer.writerow(['Circuito', 'Tipo', 'Nome', 'Area', 'Ambiente', 'SAKs', 'Canal', 'Modulo', 'Quadro Elétrico', 'id Modulo'])
    
    for circuito in circuitos:
        vinculacao = Vinculacao.query.filter_by(circuito_id=circuito.id).first()
        if vinculacao:
            modulo = Modulo.query.get(vinculacao.modulo_id)
            ambiente = Ambiente.query.get(circuito.ambiente_id)
            area = Area.query.get(ambiente.area_id)
            
            # Obter nome do quadro elétrico (se existir)
            quadro_nome = modulo.quadro_eletrico.nome if modulo and modulo.quadro_eletrico else "-"
            
            # Para circuitos HVAC, mostrar vazio no campo SAK
            if circuito.tipo == 'hvac':
                sak_value = ''
            elif circuito.quantidade_saks > 1:
                sak_value = f"{circuito.sak}-{circuito.sak + circuito.quantidade_saks - 1}"
            else:
                sak_value = str(circuito.sak)
            
            writer.writerow([
                circuito.identificador,
                circuito.tipo,
                circuito.nome,
                area.nome,
                ambiente.nome,
                sak_value,
                vinculacao.canal,
                modulo.nome if modulo else "-",
                quadro_nome,  # Nova coluna
                modulo.id if modulo else ""
            ])
    
    output.seek(0)
    
    # Obter nome do projeto para usar no nome do arquivo
    nome_projeto = projeto.nome if projeto else 'projeto'
    
    # Limpar o nome do projeto para usar no nome do arquivo
    nome_arquivo = re.sub(r'[^a-zA-Z0-9_]', '_', nome_projeto)
    
    return send_file(
        io.BytesIO(output.getvalue().encode('utf-8')),
        mimetype='text/csv',
        as_attachment=True,
        download_name=f'{nome_arquivo}_roehn.csv'
    )

@app.route('/exportar-projeto/<int:projeto_id>')
@login_required
def exportar_projeto(projeto_id):
    projeto = Projeto.query.get_or_404(projeto_id)
    
    # Verificar se o usuário tem acesso ao projeto
    if projeto.user_id != current_user.id and current_user.role != 'admin':
        flash('Acesso negado a este projeto', 'danger')
        return redirect(url_for('index'))
    
    # Coletar todos os dados do projeto
    projeto_data = {
        'projeto': {
            'id': projeto.id,
            'nome': projeto.nome,
            'user_id': projeto.user_id
        },
        'areas': [],
        'ambientes': [],
        'circuitos': [],
        'modulos': [],
        'vinculacoes': [],
        'keypads': [],
        'keypad_buttons': []
    }
    
    for area in projeto.areas:
        area_data = {
            'id': area.id,
            'nome': area.nome,
            'projeto_id': area.projeto_id
        }
        projeto_data['areas'].append(area_data)
        
        for ambiente in area.ambientes:
            ambiente_data = {
                'id': ambiente.id,
                'nome': ambiente.nome,
                'area_id': ambiente.area_id
            }
            projeto_data['ambientes'].append(ambiente_data)
            
            for circuito in ambiente.circuitos:
                circuito_data = {
                    'id': circuito.id,
                    'identificador': circuito.identificador,
                    'nome': circuito.nome,
                    'tipo': circuito.tipo,
                    'ambiente_id': circuito.ambiente_id,
                    'sak': circuito.sak
                }
                projeto_data['circuitos'].append(circuito_data)

            for keypad in ambiente.keypads:
                keypad_data = {
                    'id': keypad.id,
                    'nome': keypad.nome,
                    'modelo': keypad.modelo,
                    'color': keypad.color,
                    'button_color': keypad.button_color,
                    'button_count': keypad.button_count,
                    'hsnet': keypad.hsnet,
                    'dev_id': keypad.dev_id,
                    'ambiente_id': keypad.ambiente_id,
                    'notes': keypad.notes,
                }
                projeto_data['keypads'].append(keypad_data)

                for button in keypad.buttons:
                    projeto_data['keypad_buttons'].append({
                        'id': button.id,
                        'keypad_id': keypad.id,
                        'ordem': button.ordem,
                        'guid': button.guid,
                        'circuito_id': button.circuito_id,
                        'modo': button.modo,
                        'command_on': button.command_on,
                        'command_off': button.command_off,
                        'can_hold': button.can_hold,
                        'modo_double_press': button.modo_double_press,
                        'command_double_press': button.command_double_press,
                        'target_object_guid': button.target_object_guid,
                        'notes': button.notes,
                    })
    
    # Adicionar apenas módulos do projeto
    for modulo in Modulo.query.filter_by(projeto_id=projeto_id).all():
        modulo_data = {
            'id': modulo.id,
            'nome': modulo.nome,
            'tipo': modulo.tipo,
            'quantidade_canais': modulo.quantidade_canais,
            'hsnet': modulo.hsnet,
            'dev_id': modulo.dev_id,
        }
        projeto_data['modulos'].append(modulo_data)
    
    vincs = (
        Vinculacao.query
        .join(Circuito, Vinculacao.circuito_id == Circuito.id)
        .join(Ambiente, Circuito.ambiente_id == Ambiente.id)
        .join(Area, Ambiente.area_id == Area.id)
        .join(Modulo, Vinculacao.modulo_id == Modulo.id)
        .filter(Area.projeto_id == projeto_id, Modulo.projeto_id == projeto_id)
        .all()
    )
    for vinculacao in vincs:
        vinculacao_data = {
            'id': vinculacao.id,
            'circuito_id': vinculacao.circuito_id,
            'modulo_id': vinculacao.modulo_id,
            'canal': vinculacao.canal
        }
        projeto_data['vinculacoes'].append(vinculacao_data)
    
    # Converter para JSON
    output = io.BytesIO()
    output.write(json.dumps(projeto_data, indent=2).encode('utf-8'))
    output.seek(0)
    
    # Nome do arquivo
    nome_arquivo = f"projeto_{projeto.nome}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    
    return send_file(
        output,
        mimetype='application/json',
        as_attachment=True,
        download_name=nome_arquivo
    )

# Modifique a rota de importação para retornar JSON
@app.route('/import_roehn', methods=['POST'])
@login_required
def import_roehn():
    if 'file' not in request.files:
        return jsonify({"success": False, "error": "Nenhum arquivo enviado"}), 400

    file = request.files['file']

    if file.filename == '':
        return jsonify({"success": False, "error": "Nenhum arquivo selecionado"}), 400

    if file and file.filename.endswith('.json'):
        try:
            project_json_data = json.load(file)
            
            # --- AQUI ESTÁ A CORREÇÃO ---
            # Passe o ID do usuário logado para a classe RoehnProjectConverter
            converter = RoehnProjectConverter(project_json_data, db.session, current_user.id)
            converter.process_json_project()
            
            return jsonify({"success": True, "message": "Importação concluída com sucesso."})

        except Exception as e:
            db.session.rollback()
            logging.error(f"Erro na importação: {e}")
            return jsonify({"success": False, "error": f"Erro na importação: {e}"}), 500
    
    return jsonify({"success": False, "error": "Tipo de arquivo não suportado"}), 400

@app.route('/user/change-password', methods=['POST'])
@login_required
def change_password():
    current_password = request.form.get('current_password')
    new_password = request.form.get('new_password')
    
    if not current_user.check_password(current_password):
        return jsonify({'success': False, 'message': 'Senha atual incorreta'})
    
    current_user.set_password(new_password)
    db.session.commit()
    
    return jsonify({'success': True, 'message': 'Senha alterada com sucesso'})

@app.route('/exportar-pdf/<int:projeto_id>')
@login_required
def exportar_pdf(projeto_id):
    projeto = Projeto.query.get_or_404(projeto_id)
    
    # Verificar se o usuário tem acesso ao projeto
    if projeto.user_id != current_user.id and current_user.role != 'admin':
        flash('Acesso negado a este projeto', 'danger')
        return redirect(url_for('index'))
    
    # Criar buffer para o PDF
    buffer = io.BytesIO()
    
    # Criar o documento PDF
    doc = SimpleDocTemplate(
        buffer, 
        pagesize=A4,
        rightMargin=30,
        leftMargin=30,
        topMargin=30,
        bottomMargin=30,
        title=f"Projeto {projeto.nome}"
    )
    
    # Estilos - usando nomes únicos para evitar conflitos
    styles = getSampleStyleSheet()
    
    # Verificar se os estilos já existem antes de adicionar
    if 'RoehnTitle' not in styles:
        styles.add(ParagraphStyle(
            name='RoehnTitle',
            parent=styles['Heading1'],
            fontSize=16,
            spaceAfter=30,
            alignment=TA_CENTER
        ))
    
    if 'RoehnSubtitle' not in styles:
        styles.add(ParagraphStyle(
            name='RoehnSubtitle',
            parent=styles['Heading2'],
            fontSize=12,
            spaceAfter=12,
            spaceBefore=12
        ))
    
    if 'RoehnCenter' not in styles:
        styles.add(ParagraphStyle(
            name='RoehnCenter',
            parent=styles['Normal'],
            alignment=TA_CENTER
        ))
    
    # Elementos do PDF
    elements = []
    
    # Caminho para sua imagem
    zafirologopath = "static/images/zafirologo.png"
    zafirologo = Image(zafirologopath, width=2*inch, height=2*inch)
    # Cabeçalho
    elements.append(zafirologo)
    #elements.append(Paragraph("ZAFIRO - LUXURY TECHNOLOGY", styles['RoehnTitle']))
    elements.append(Paragraph("RELATÓRIO DE PROJETO", styles['RoehnCenter']))
    elements.append(Spacer(1, 0.2*inch))
    
    # No método exportar_pdf, substitua a seção de informações do projeto:

    # Adicione este estilo personalizado antes de criar os elementos
    if 'LeftNormal' not in styles:
        styles.add(ParagraphStyle(
            name='LeftNormal',
            parent=styles['Normal'],
            alignment=TA_LEFT
        ))

    # E use este novo estilo:
    elements.append(Paragraph(f"<b>Projeto:</b> {projeto.nome}", styles['LeftNormal']))
    elements.append(Spacer(1, 0.1*inch))
    elements.append(Paragraph(f"<b>Data de emissão:</b> {datetime.now().strftime('%d/%m/%Y %H:%M')}", styles['LeftNormal']))
    elements.append(Spacer(1, 0.1*inch))
    elements.append(Paragraph(f"<b>Emitido por:</b> {current_user.username}", styles['LeftNormal']))
    elements.append(Spacer(1, 0.3*inch))
    
    # Para cada área
    for area in projeto.areas:
        elements.append(Paragraph(f"ÁREA: {area.nome}", styles['Heading2']))
        elements.append(Spacer(1, 0.1*inch))
        
        # Para cada ambiente na área
        for ambiente in area.ambientes:
            elements.append(Paragraph(f"Ambiente: {ambiente.nome}", styles['Heading3']))
            
            # Preparar dados da tabela de circuitos
            circuito_data = [["Circuito", "Nome", "Tipo", "SAKs", "Módulo", "Canal"]]
            
            for circuito in ambiente.circuitos:
                modulo_nome = "Não vinculado"
                canal = "-"
                if circuito.vinculacao:
                    modulo_nome = circuito.vinculacao.modulo.nome
                    canal = str(circuito.vinculacao.canal)
                
                # Para circuitos HVAC, mostrar vazio no campo SAK
                if circuito.tipo == 'hvac':
                    sak_value = ""
                    circuito_data.append([
                        circuito.identificador,
                        circuito.nome,
                        circuito.tipo.upper(),
                        sak_value,
                        modulo_nome,
                        canal
                    ])
                elif circuito.tipo == 'persiana':
                    # Para persianas, adicionar duas linhas: uma para subir e outra para descer
                    circuito_data.append([
                        circuito.identificador,
                        circuito.nome + " (sobe)",
                        circuito.tipo.upper(),
                        str(circuito.sak),  # SAK de subida
                        modulo_nome,
                        canal + "s"  # Indicar que é o canal de subida
                    ])
                    circuito_data.append([
                        circuito.identificador,
                        circuito.nome + " (desce)",
                        circuito.tipo.upper(),
                        str(circuito.sak + 1),  # SAK de descida
                        modulo_nome,
                        canal + "d"  # Indicar que é o canal de descida
                    ])
                else:
                    # Para outros circuitos
                    circuito_data.append([
                        circuito.identificador,
                        circuito.nome,
                        circuito.tipo.upper(),
                        str(circuito.sak),
                        modulo_nome,
                        canal
                    ])
            
            # Criar tabela de circuitos
            if len(circuito_data) > 1:
                circuito_table = Table(
                    circuito_data, 
                    colWidths=[0.7*inch, 1.5*inch, 0.8*inch, 0.6*inch, 1.2*inch, 0.6*inch],
                    repeatRows=1
                )
                
                # Estilo da tabela
                estilo_tabela = TableStyle([
                    ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#2c3e50")),
                    ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                    ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                    ('FONTSIZE', (0, 0), (-1, 0), 9),
                    ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
                    ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor("#f8f9fa")),
                    ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
                    ('FONTSIZE', (0, 1), (-1, -1), 8),
                    ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#4d4f52")),
                    ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor("#f1f3f5")])
                ])
                
                # Adicionar cores diferentes por tipo de circuito
                for i, row in enumerate(circuito_data[1:], 1):
                    if row[2] == "LUZ":
                        estilo_tabela.add('BACKGROUND', (0, i), (-1, i), colors.HexColor("#fff3cd"))
                    elif row[2] == "PERSIANA":
                        # Colorir as linhas de persiana de forma diferente
                        if "(sobe)" in row[1]:
                            estilo_tabela.add('BACKGROUND', (0, i), (-1, i), colors.HexColor("#d1ecf1"))
                        elif "(desce)" in row[1]:
                            estilo_tabela.add('BACKGROUND', (0, i), (-1, i), colors.HexColor("#e8f4f8"))
                    elif row[2] == "HVAC":
                        estilo_tabela.add('BACKGROUND', (0, i), (-1, i), colors.HexColor("#d4edda"))
                
                circuito_table.setStyle(estilo_tabela)
                elements.append(circuito_table)
            else:
                elements.append(Paragraph("Nenhum circuito neste ambiente.", styles['Italic']))
            
            elements.append(Spacer(1, 0.2*inch))
        
        # Quebra de página após cada área
        if area != projeto.areas[-1]:
            elements.append(PageBreak())
    
    # Resumo de módulos - MODIFICAÇÃO AQUI
    elements.append(PageBreak())
    elements.append(Paragraph("RESUMO DE MÓDULOS", styles['Heading2']))
    elements.append(Spacer(1, 0.2*inch))
    
    # Coletar todos os módulos do projeto
    modulos_projeto = Modulo.query.filter_by(projeto_id=projeto_id).all()
    
    if modulos_projeto:
        for modulo in modulos_projeto:
            elements.append(Paragraph(f"Módulo: {modulo.nome} ({modulo.tipo})", styles['Heading3']))
            
            # Preparar dados da tabela de canais - ADICIONANDO SEPARAÇÃO PARA PERSIANAS
            canal_data = [["Canal", "Circuito", "Nome do Circuito", "Tipo", "SAK"]]
            
            # Preencher com as vinculações deste módulo
            canais_ocupados = {v.canal: v for v in modulo.vinculacoes}
            
            for canal_num in range(1, modulo.quantidade_canais + 1):
                if canal_num in canais_ocupados:
                    vinculacao = canais_ocupados[canal_num]
                    circuito = vinculacao.circuito
                    
                    if circuito.tipo == 'persiana':
                        # Para persianas, adicionar duas linhas
                        canal_data.append([
                            str(canal_num) + "s",  # Canal de subida
                            circuito.identificador,
                            circuito.nome + " (sobe)",
                            circuito.tipo.upper(),
                            str(circuito.sak)  # SAK de subida
                        ])
                        canal_data.append([
                            str(canal_num) + "d",  # Canal de descida
                            circuito.identificador,
                            circuito.nome + " (desce)",
                            circuito.tipo.upper(),
                            str(circuito.sak + 1)  # SAK de descida
                        ])
                    else:
                        # Para outros circuitos
                        if circuito.tipo == 'hvac':
                            sak_value = ""
                        else:
                            sak_value = str(circuito.sak)
                        
                        canal_data.append([
                            str(canal_num),
                            circuito.identificador,
                            circuito.nome,
                            circuito.tipo.upper(),
                            sak_value
                        ])
                else:
                    canal_data.append([
                        str(canal_num),
                        "Livre",
                        "-",
                        "-",
                        "-"
                    ])
            
            # Criar tabela de canais - AJUSTANDO LARGURAS DAS COLUNAS
            canal_table = Table(
                canal_data, 
                colWidths=[0.7*inch, 1.0*inch, 1.5*inch, 0.8*inch, 0.8*inch],
                repeatRows=1
            )
            
            # Estilo da tabela
            estilo_canal = TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#2c3e50")),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 9),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
                ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor("#f8f9fa")),
                ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
                ('FONTSIZE', (0, 1), (-1, -1), 8),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#4d4f52")),
            ])
            
            # Adicionar cores diferentes por tipo de circuito
            for i, row in enumerate(canal_data[1:], 1):
                if row[3] == "LUZ":
                    estilo_canal.add('BACKGROUND', (0, i), (-1, i), colors.HexColor("#fff3cd"))
                elif row[3] == "PERSIANA":
                    # Colorir as linhas de persiana de forma diferente
                    if "(sobe)" in row[2]:
                        estilo_canal.add('BACKGROUND', (0, i), (-1, i), colors.HexColor("#d1ecf1"))
                    elif "(desce)" in row[2]:
                        estilo_canal.add('BACKGROUND', (0, i), (-1, i), colors.HexColor("#e8f4f8"))
                elif row[3] == "HVAC":
                    estilo_canal.add('BACKGROUND', (0, i), (-1, i), colors.HexColor("#d4edda"))
            
            canal_table.setStyle(estilo_canal)
            elements.append(canal_table)
            elements.append(Spacer(1, 0.3*inch))
    else:
        elements.append(Paragraph("Nenhum módulo configurado neste projeto.", styles['Italic']))
    
    # Rodapé com informações da empresa
    elements.append(Spacer(1, 0.5*inch))
    elements.append(Paragraph("Zafiro - Luxury Technology", 
                             styles['RoehnCenter']))
    elements.append(Paragraph(f"Relatório gerado em: {datetime.now().strftime('%d/%m/%Y às %H:%M')}", 
                             styles['RoehnCenter']))
    
    # Construir o PDF
    doc.build(elements)
    
    buffer.seek(0)
    
    # Nome do arquivo
    nome_arquivo = f"projeto_{projeto.nome}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
    
    return send_file(
        buffer,
        as_attachment=True,
        download_name=nome_arquivo,
        mimetype='application/pdf'
    )
# -------------------- Keypads (RQR-K) --------------------

@app.get("/api/keypads/meta")
@login_required
def api_keypads_meta():
    return jsonify({
        "ok": True,
        "colors": sorted(KEYPAD_ALLOWED_COLORS),
        "button_colors": sorted(KEYPAD_ALLOWED_BUTTON_COLORS),
        "button_counts": sorted(KEYPAD_ALLOWED_BUTTON_COUNTS),
        "model": "RQR-K",
    })


@app.get("/api/keypads/next-hsnet")
@login_required
def api_keypads_next_hsnet():
    projeto_id = session.get("projeto_atual_id")
    if not projeto_id:
        return jsonify({"ok": False, "error": "Projeto não selecionado."}), 400

    usados = {k.hsnet for k in Keypad.query
              .join(Ambiente, Keypad.ambiente_id == Ambiente.id)
              .join(Area, Ambiente.area_id == Area.id)
              .filter(Area.projeto_id == projeto_id).all()}

    hs = 110
    while hs in usados:
        hs += 1
    return jsonify({"ok": True, "hsnet": hs})



@app.get("/api/keypads")
@login_required
def api_keypads_list():
    projeto_id = session.get("projeto_atual_id")
    if not projeto_id:
        return jsonify({"ok": True, "keypads": []})

    keypads = (
        Keypad.query
        .join(Ambiente, Keypad.ambiente_id == Ambiente.id)
        .join(Area, Ambiente.area_id == Area.id)
        .filter(Area.projeto_id == projeto_id)
        .options(
            joinedload(Keypad.ambiente).joinedload(Ambiente.area),
            joinedload(Keypad.buttons).joinedload(KeypadButton.circuito),
        )
        .order_by(Ambiente.nome.asc(), Keypad.nome.asc(), Keypad.id.asc())
        .all()
    )
    return jsonify({"ok": True, "keypads": [serialize_keypad(k) for k in keypads]})


@app.get("/api/keypads/<int:keypad_id>")
@login_required
def api_keypads_get(keypad_id):
    projeto_id = session.get("projeto_atual_id")
    keypad = db.get_or_404(Keypad, keypad_id)
    if not projeto_id or not keypad.ambiente or keypad.ambiente.area.projeto_id != projeto_id:
        return jsonify({"ok": False, "error": "Keypad não encontrado."}), 404
    return jsonify({"ok": True, "keypad": serialize_keypad(keypad)})


@app.post("/api/keypads")
@login_required
def api_keypads_create():
    projeto_id = session.get("projeto_atual_id")
    if not projeto_id:
        return jsonify({"ok": False, "error": "Projeto não selecionado."}), 400

    data = request.get_json(silent=True) or request.form or {}

    nome = (data.get("nome") or "").strip()
    if not nome:
        return jsonify({"ok": False, "error": "Nome do keypad é obrigatório."}), 400

    # ids
    try:
        ambiente_id = int(data.get("ambiente_id"))
    except (TypeError, ValueError):
        return jsonify({"ok": False, "error": "ambiente_id inválido."}), 400

    try:
        hsnet = int(data.get("hsnet"))
    except (TypeError, ValueError):
        return jsonify({"ok": False, "error": "hsnet inválido."}), 400
    if hsnet <= 0:
        return jsonify({"ok": False, "error": "hsnet deve ser positivo."}), 400

    # aceita PT ou EN
    color = (data.get("color") or data.get("cor") or "WHITE").strip().upper()
    if color not in KEYPAD_ALLOWED_COLORS:
        return jsonify({"ok": False, "error": "Cor inválida para o keypad."}), 400

    button_color = (data.get("button_color") or data.get("cor_teclas") or "WHITE").strip().upper()
    if button_color not in KEYPAD_ALLOWED_BUTTON_COLORS:
        return jsonify({"ok": False, "error": "Cor das teclas inválida."}), 400

    # button_count pode vir direto ou podemos derivar de layout
    button_count = None
    if "button_count" in data and data.get("button_count") not in (None, ""):
        try:
            button_count = int(data.get("button_count"))
        except (TypeError, ValueError):
            return jsonify({"ok": False, "error": "button_count inválido."}), 400
    else:
        layout_raw = (data.get("layout") or "").strip().upper()
        if layout_raw:
            button_count = LAYOUT_TO_COUNT.get(layout_raw)
            if button_count is None:
                return jsonify({"ok": False, "error": "layout inválido."}), 400
        else:
            button_count = 4  # default

    if button_count not in KEYPAD_ALLOWED_BUTTON_COUNTS:
        return jsonify({"ok": False, "error": "Quantidade de teclas não suportada."}), 400

    modelo = (data.get("modelo") or "RQR-K").strip().upper()
    if modelo != "RQR-K":
        return jsonify({"ok": False, "error": "Modelo de keypad não suportado."}), 400

    dev_id_raw = data.get("dev_id")
    if dev_id_raw not in (None, ""):
        try:
            dev_id = int(dev_id_raw)
        except (TypeError, ValueError):
            return jsonify({"ok": False, "error": "dev_id inválido."}), 400
        if dev_id <= 0:
            return jsonify({"ok": False, "error": "dev_id deve ser positivo."}), 400
    else:
        dev_id = hsnet  # default prático

    notes = (data.get("notes") or "").strip() or None

    ambiente = db.get_or_404(Ambiente, ambiente_id)
    area = ambiente.area if ambiente else None
    if not area or area.projeto_id != projeto_id:
        return jsonify({"ok": False, "error": "Ambiente não pertence ao projeto selecionado."}), 400

    if is_hsnet_in_use(hsnet):
        return jsonify({"ok": False, "error": "HSNET já está em uso."}), 409

    keypad = Keypad(
        nome=nome,
        modelo="RQR-K",
        color=color,
        button_color=button_color,
        button_count=button_count,
        hsnet=hsnet,
        dev_id=dev_id,
        ambiente_id=ambiente.id,
        notes=notes,
    )
    db.session.add(keypad)
    db.session.flush()  # garante id

    # >>> ESSENCIAL: cria exatamente N slots de tecla
    ensure_keypad_button_slots(keypad, button_count)

    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify({"ok": False, "error": "Não foi possível criar o keypad."}), 400

    return jsonify({"ok": True, "keypad": serialize_keypad(keypad)})



@app.put("/api/keypads/<int:keypad_id>")
@login_required
def api_keypads_update(keypad_id):
    projeto_id = session.get("projeto_atual_id")
    keypad = db.get_or_404(Keypad, keypad_id)
    ambiente = keypad.ambiente
    area = ambiente.area if ambiente else None
    if not projeto_id or not area or area.projeto_id != projeto_id:
        return jsonify({"ok": False, "error": "Keypad não encontrado no projeto."}), 404

    data = request.get_json(silent=True) or {}

    if "nome" in data:
        novo_nome = (data.get("nome") or "").strip()
        if not novo_nome:
            return jsonify({"ok": False, "error": "Nome do keypad é obrigatório."}), 400
        keypad.nome = novo_nome

    if "color" in data:
        color = (data.get("color") or "").strip().upper()
        if color not in KEYPAD_ALLOWED_COLORS:
            return jsonify({"ok": False, "error": "Cor inválida para o keypad."}), 400
        keypad.color = color

    if "button_color" in data:
        b_color = (data.get("button_color") or "").strip().upper()
        if b_color not in KEYPAD_ALLOWED_BUTTON_COLORS:
            return jsonify({"ok": False, "error": "Cor das teclas inválida."}), 400
        keypad.button_color = b_color

    if "button_count" in data:
        try:
            new_count = int(data.get("button_count"))
        except (TypeError, ValueError):
            return jsonify({"ok": False, "error": "Quantidade de teclas inválida."}), 400
        if new_count not in KEYPAD_ALLOWED_BUTTON_COUNTS:
            return jsonify({"ok": False, "error": "Quantidade de teclas não suportada."}), 400
        keypad.button_count = new_count
        ensure_keypad_button_slots(keypad, new_count)

    if "hsnet" in data:
        try:
            new_hsnet = int(data.get("hsnet"))
        except (TypeError, ValueError):
            return jsonify({"ok": False, "error": "hsnet inválido."}), 400
        if new_hsnet <= 0:
            return jsonify({"ok": False, "error": "hsnet deve ser positivo."}), 400
        if new_hsnet != keypad.hsnet and is_hsnet_in_use(new_hsnet, exclude_keypad_id=keypad.id):
            return jsonify({"ok": False, "error": "HSNET já está em uso."}), 409
        keypad.hsnet = new_hsnet

    if "dev_id" in data:
        dev_val = data.get("dev_id")
        if dev_val in (None, ""):
            keypad.dev_id = None
        else:
            try:
                dev_int = int(dev_val)
            except (TypeError, ValueError):
                return jsonify({"ok": False, "error": "dev_id inválido."}), 400
            if dev_int <= 0:
                return jsonify({"ok": False, "error": "dev_id deve ser positivo."}), 400
            keypad.dev_id = dev_int

    if "notes" in data:
        txt = (data.get("notes") or "").strip()
        keypad.notes = txt or None

    if "modelo" in data:
        modelo = (data.get("modelo") or "").strip().upper()
        if modelo != "RQR-K":
            return jsonify({"ok": False, "error": "Modelo de keypad não suportado."}), 400
        keypad.modelo = "RQR-K"

    if "ambiente_id" in data:
        try:
            novo_ambiente_id = int(data.get("ambiente_id"))
        except (TypeError, ValueError):
            return jsonify({"ok": False, "error": "ambiente_id inválido."}), 400
        novo_ambiente = db.get_or_404(Ambiente, novo_ambiente_id)
        nova_area = novo_ambiente.area if novo_ambiente else None
        if not nova_area or nova_area.projeto_id != projeto_id:
            return jsonify({"ok": False, "error": "Ambiente não pertence ao projeto selecionado."}), 400
        keypad.ambiente_id = novo_ambiente.id

    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify({"ok": False, "error": "Não foi possível atualizar o keypad."}), 400

    return jsonify({"ok": True, "keypad": serialize_keypad(keypad)})


@app.delete("/api/keypads/<int:keypad_id>")
@login_required
def api_keypads_delete(keypad_id):
    projeto_id = session.get("projeto_atual_id")
    keypad = db.get_or_404(Keypad, keypad_id)
    ambiente = keypad.ambiente
    area = ambiente.area if ambiente else None
    if not projeto_id or not area or area.projeto_id != projeto_id:
        return jsonify({"ok": False, "error": "Keypad não encontrado no projeto."}), 404

    db.session.delete(keypad)
    db.session.commit()
    return jsonify({"ok": True})

@app.route('/api/keypads/<int:keypad_id>/buttons', methods=['GET'])
@login_required
def get_keypad_buttons(keypad_id):
    keypad = Keypad.query.get(keypad_id)
    if not keypad:
        return jsonify({'error': 'Keypad not found'}), 404
        
    if keypad.ambiente.area.projeto_id != session.get('projeto_atual_id'):
        return jsonify({'error': 'Unauthorized'}), 403

    # Define o número de botões com base no layout
    button_limit = 4  # Padrão para "FOUR"
    if keypad.layout == "ONE":
        button_limit = 1
    elif keypad.layout == "TWO":
        button_limit = 2

    # Busca os botões e limita a quantidade com base no layout
    buttons = keypad.buttons.order_by(KeypadButton.ordem).limit(button_limit).all()

    # Formata os dados para o frontend
    buttons_data = []
    for button in buttons:
        buttons_data.append({
            'id': button.id,
            'circuito_id': button.circuito_id,
            'modo': button.modo,
            'command_on': button.command_on,
            'command_off': button.command_off,
            'can_hold': button.can_hold,
            'modo_double_press': button.modo_double_press,
            'command_double_press': button.command_double_press,
            'ordem': button.ordem
        })
    
    return jsonify(buttons_data)


@app.put("/api/keypads/<int:keypad_id>/buttons/<int:ordem>")
@login_required
def api_keypad_button_update(keypad_id, ordem):
    projeto_id = session.get("projeto_atual_id")
    keypad = db.get_or_404(Keypad, keypad_id)
    ambiente = keypad.ambiente
    area = ambiente.area if ambiente else None
    if not projeto_id or not area or area.projeto_id != projeto_id:
        return jsonify({"ok": False, "error": "Keypad não encontrado no projeto."}), 404

    if ordem <= 0 or ordem > keypad.button_count:
        return jsonify({"ok": False, "error": "Ordem de tecla inválida."}), 400

    ensure_keypad_button_slots(keypad, keypad.button_count)
    button = next((btn for btn in keypad.buttons if btn.ordem == ordem), None)
    if button is None:
        return jsonify({"ok": False, "error": "Tecla não encontrada."}), 404

    data = request.get_json(silent=True) or {}

    if "circuito_id" in data:
        raw_circuit = data.get("circuito_id")
        if raw_circuit in (None, "", 0, "0"):
            button.circuito = None
            button.target_object_guid = ZERO_GUID
            button.modo = 3
            button.command_on = 0
            button.command_off = 0
        else:
            try:
                circuito_id = int(raw_circuit)
            except (TypeError, ValueError):
                return jsonify({"ok": False, "error": "circuito_id inválido."}), 400
            circuito = db.get_or_404(Circuito, circuito_id)
            ambiente_circ = circuito.ambiente
            area_circ = ambiente_circ.area if ambiente_circ else None
            if not area_circ or area_circ.projeto_id != projeto_id:
                return jsonify({"ok": False, "error": "Circuito não pertence ao projeto."}), 400
            if circuito.tipo != 'luz':
                return jsonify({"ok": False, "error": "Apenas circuitos de luz podem ser vinculados."}), 400
            button.circuito = circuito
            button.target_object_guid = ZERO_GUID
            button.modo = 2
            button.command_on = 1
            button.command_off = 0

    if "modo" in data:
        try:
            button.modo = int(data.get("modo"))
        except (TypeError, ValueError):
            return jsonify({"ok": False, "error": "Valor de modo inválido."}), 400

    if "command_on" in data:
        try:
            button.command_on = int(data.get("command_on"))
        except (TypeError, ValueError):
            return jsonify({"ok": False, "error": "command_on inválido."}), 400

    if "command_off" in data:
        try:
            button.command_off = int(data.get("command_off"))
        except (TypeError, ValueError):
            return jsonify({"ok": False, "error": "command_off inválido."}), 400

    if "can_hold" in data:
        button.can_hold = bool(data.get("can_hold"))

    if "modo_double_press" in data:
        try:
            button.modo_double_press = int(data.get("modo_double_press"))
        except (TypeError, ValueError):
            return jsonify({"ok": False, "error": "modo_double_press inválido."}), 400

    if "command_double_press" in data:
        try:
            button.command_double_press = int(data.get("command_double_press"))
        except (TypeError, ValueError):
            return jsonify({"ok": False, "error": "command_double_press inválido."}), 400

    if "target_object_guid" in data:
        guid_val = (data.get("target_object_guid") or ZERO_GUID).strip()
        button.target_object_guid = guid_val or ZERO_GUID

    if "notes" in data:
        txt = (data.get("notes") or "").strip()
        button.notes = txt or None

    db.session.commit()
    return jsonify({"ok": True, "keypad": serialize_keypad(keypad)})

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
