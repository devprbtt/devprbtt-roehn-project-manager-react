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
from datetime import datetime, timedelta
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
from database import db, User, Projeto, Area, Ambiente, Circuito, Modulo, Vinculacao, Keypad, KeypadButton, QuadroEletrico, Cena, Acao, CustomAcao

app = Flask(__name__, instance_relative_config=True)

# Garante que a pasta da instância exista
try:
    os.makedirs(app.instance_path, exist_ok=True)
except OSError:
    pass

app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + os.path.join(app.instance_path, 'projetos.db')
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
    'DIM8': {'nome_completo': 'ADP-DIM8', 'canais': 8, 'tipos_permitidos': ['luz']},
    # Controladores
    'AQL-GV-M4': {'nome_completo': 'AQL-GV-M4', 'canais': 0, 'tipos_permitidos': []},
    'ADP-M8': {'nome_completo': 'ADP-M8', 'canais': 0, 'tipos_permitidos': []},
    'ADP-M16': {'nome_completo': 'ADP-M16', 'canais': 0, 'tipos_permitidos': []},
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


COMPATIBILIDADE_MODULOS = {
    "luz": ["RL12", "DIM8" "RL4"],
    "persiana": ["LX4"],
    "hvac": ["SA1"]
}

ESPECIFICACOES_MODULOS = {
    "RL12": {
        "correntePorCanal": 2.5,
        "grupos": [
            {"maxCorrente": 8.0, "canais": [1, 2, 3, 4]},
            {"maxCorrente": 8.0, "canais": [5, 6, 7, 8]},
            {"maxCorrente": 8.0, "canais": [9, 10, 11, 12]}
        ]
    },
    "DIM8": {
        "correntePorCanal": 2.5,
        "grupos": [
            {"maxCorrente": 8.0, "canais": [1, 2, 3, 4]},
            {"maxCorrente": 8.0, "canais": [5, 6, 7, 8]}
        ]
    },
    "LX4": {
        "correntePorCanal": 2.5,
        "grupos": [
            {"maxCorrente": 5.0, "canais": [1, 2, 3, 4]},
            {"maxCorrente": 5.0, "canais": [5, 6, 7, 8]}
        ]
    }
}

# --- serialize_user helper (ADD) ---
def serialize_user(user):
    return {
        "id": user.id,
        "username": getattr(user, "username", ""),
        "role": getattr(user, "role", "user"),
    }


def serialize_keypad_button(button):
    circuito = button.circuito
    cena = button.cena
    return {
        "id": button.id,
        "ordem": button.ordem,
        "guid": button.guid,
        "engraver_text": button.engraver_text,
        "icon": button.icon,
        "modo": button.modo,
        "command_on": button.command_on,
        "command_off": button.command_off,
        "can_hold": button.can_hold,
        "is_rocker": button.is_rocker,
        "rocker_style": button.rocker_style,
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
        "cena_id": cena.id if cena else None,
        "cena": {
            "id": cena.id,
            "nome": cena.nome,
        } if cena else None,
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


def is_hsnet_in_use(hsnet, projeto_id, exclude_keypad_id=None, exclude_modulo_id=None):
    """Verifica se um HSNET está em uso dentro de um projeto, tanto em Keypads quanto em Módulos."""
    # Keypads são checados dentro do projeto
    keypad_query = Keypad.query.filter_by(hsnet=hsnet, projeto_id=projeto_id)
    if exclude_keypad_id is not None:
        keypad_query = keypad_query.filter(Keypad.id != exclude_keypad_id)
    if keypad_query.first() is not None:
        return True

    # Módulos também são checados dentro do projeto
    modulo_query = Modulo.query.filter_by(hsnet=hsnet, projeto_id=projeto_id)
    if exclude_modulo_id is not None:
        modulo_query = modulo_query.filter(Modulo.id != exclude_modulo_id)
    return modulo_query.first() is not None

def is_valid_ip(ip):
    if not ip:
        return True  # Permite IP vazio
    # Regex para validar endereço IPv4
    pattern = re.compile(r"^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$")
    return pattern.match(ip) is not None


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
    raw_m4_quadro = request.form.get('m4_quadro_id')
    m4_quadro_id = None
    if raw_m4_quadro:
        try:
            m4_quadro_id = int(raw_m4_quadro)
        except (TypeError, ValueError):
            m4_quadro_id = None
    if m4_quadro_id:
        quadro = db.session.get(QuadroEletrico, m4_quadro_id)
        if not quadro or quadro.projeto_id != projeto.id:
            m4_quadro_id = None
    project_info['m4_quadro_id'] = m4_quadro_id
    
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
        "selected": (p.id == selected_id),
        "data_criacao": p.data_criacao.isoformat() if p.data_criacao else None,
        "data_ativo": p.data_ativo.isoformat() if p.data_ativo else None,
        "data_inativo": p.data_inativo.isoformat() if p.data_inativo else None,
        "data_concluido": p.data_concluido.isoformat() if p.data_concluido else None,
    } for p in projetos]
    return jsonify({"ok": True, "projetos": out})


# no topo, garanta:
from sqlalchemy import or_

@app.delete("/api/projetos/<int:projeto_id>")
@login_required
@admin_required
def api_projetos_delete(projeto_id):
    p = db.get_or_404(Projeto, projeto_id)

    # Graças ao `cascade="all, delete-orphan"` e `ondelete='SET NULL'`,
    # o SQLAlchemy e o DB cuidarão da exclusão em cascata e da anulação de FKs.
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

        if p.status != status:
            now = datetime.utcnow()
            if status == 'ATIVO':
                p.data_ativo = now
            elif status == 'INATIVO':
                p.data_inativo = now
            elif status == 'CONCLUIDO':
                p.data_concluido = now
        p.status = status

    db.session.commit()

    if session.get("projeto_atual_id") == p.id and "nome" in data:
        session["projeto_atual_nome"] = p.nome

    return jsonify({
        "ok": True,
        "projeto": {
            "id": p.id,
            "nome": p.nome,
            "status": p.status,
            "data_criacao": p.data_criacao.isoformat(),
            "data_ativo": p.data_ativo.isoformat() if p.data_ativo else None,
            "data_inativo": p.data_inativo.isoformat() if p.data_inativo else None,
            "data_concluido": p.data_concluido.isoformat() if p.data_concluido else None,
        }
    })

@app.post("/api/projetos")
@login_required
def api_projetos_create():
    data = request.get_json(silent=True) or request.form or {}
    app.logger.info(f"Received data for project creation: {data}")

    nome = (data.get("nome") or "").strip()
    if not nome:
        app.logger.error("Project creation failed: 'nome' is missing.")
        return jsonify({"ok": False, "error": "Nome é obrigatório."}), 400

    if Projeto.query.filter_by(nome=nome, user_id=current_user.id).first():
        app.logger.error(f"Project creation failed: Project with name '{nome}' already exists.")
        return jsonify({"ok": False, "error": "Já existe um projeto com esse nome."}), 409

    status = (data.get("status") or "ATIVO").strip().upper()
    if status not in {"ATIVO", "INATIVO", "CONCLUIDO"}:
        app.logger.error(f"Project creation failed: Invalid status '{status}'.")
        return jsonify({"ok": False, "error": "Status inválido (use ATIVO, INATIVO ou CONCLUIDO)."}), 400

    now = datetime.utcnow()

    p = Projeto(
        nome=nome,
        user_id=current_user.id,
        status=status,
        data_criacao=now,
        data_ativo=now if status == 'ATIVO' else None,
        data_inativo=now if status == 'INATIVO' else None,
        data_concluido=now if status == 'CONCLUIDO' else None,
    )
    db.session.add(p)
    try:
        db.session.commit()
        app.logger.info(f"Project '{nome}' created with ID {p.id}.")
    except IntegrityError:
        db.session.rollback()
        app.logger.error("Project creation failed due to an integrity error.")
        return jsonify({"ok": False, "error": "Não foi possível salvar o projeto."}), 400

    session["projeto_atual_id"] = p.id
    session["projeto_atual_nome"] = p.nome

    return jsonify({
        "ok": True,
        "id": p.id,
        "nome": p.nome,
        "status": p.status,
        "data_criacao": p.data_criacao.isoformat(),
        "data_ativo": p.data_ativo.isoformat() if p.data_ativo else None,
        "data_inativo": p.data_inativo.isoformat() if p.data_inativo else None,
        "data_concluido": p.data_concluido.isoformat() if p.data_concluido else None,
    })

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
        return jsonify({"ok": True, "projeto_atual": {
            "id": p.id,
            "nome": p.nome,
            "status": p.status,
            "data_criacao": p.data_criacao.isoformat() if p.data_criacao else None,
            "data_ativo": p.data_ativo.isoformat() if p.data_ativo else None,
            "data_inativo": p.data_inativo.isoformat() if p.data_inativo else None,
            "data_concluido": p.data_concluido.isoformat() if p.data_concluido else None,
        }})

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

# ATUALIZAR AMBIENTE
@app.put("/api/ambientes/<int:ambiente_id>")
@login_required
def api_ambientes_update(ambiente_id):
    data = request.get_json(silent=True) or request.form or {}
    nome = (data.get("nome") or "").strip()
    area_id = data.get("area_id")

    if not nome or not area_id:
        return jsonify({"ok": False, "error": "Nome e área são obrigatórios."}), 400

    amb = db.get_or_404(Ambiente, ambiente_id)
    area = db.get_or_404(Area, int(area_id))

    # Validar que a área pertence ao projeto selecionado
    if session.get("projeto_atual_id") != getattr(area, "projeto_id", None):
        return jsonify({"ok": False, "error": "Área não pertence ao projeto atual."}), 400

    amb.nome = nome
    amb.area_id = area.id
    db.session.commit()

    return jsonify({"ok": True, "success": True})

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
    
    if "identificador" in data:
        novo_identificador = (data.get("identificador") or "").strip()
        if novo_identificador != c.identificador:
            exists = (
                Circuito.query
                .join(Ambiente, Circuito.ambiente_id == Ambiente.id)
                .join(Area, Ambiente.area_id == Area.id)
                .filter(Area.projeto_id == projeto_id, Circuito.identificador == novo_identificador)
                .first()
            )
            if exists:
                return jsonify({"ok": False, "error": "Identificador já existe neste projeto."}), 409
        c.identificador = novo_identificador

    if "ambiente_id" in data:
        novo_ambiente_id = data.get("ambiente_id")
        if novo_ambiente_id:
            novo_ambiente = db.get_or_404(Ambiente, int(novo_ambiente_id))
            if not getattr(novo_ambiente, "area", None) or getattr(novo_ambiente.area, "projeto_id", None) != projeto_id:
                return jsonify({"ok": False, "error": "Ambiente não pertence ao projeto atual."}), 400
            c.ambiente_id = novo_ambiente.id

    if "tipo" in data:
        novo_tipo = (data.get("tipo") or "").strip()
        c.tipo = novo_tipo
        if novo_tipo != "luz":
            c.dimerizavel = False
    
    if "dimerizavel" in data and c.tipo == "luz":
        c.dimerizavel = bool(data.get("dimerizavel"))

    # NOVO: Atualizar campo potencia
    if "potencia" in data:
        nova_potencia = data.get("potencia")
        if nova_potencia is not None:
            nova_potencia = float(nova_potencia)
            if nova_potencia < 0:
                return jsonify({"ok": False, "error": "A potência não pode ser negativa."}), 400
            c.potencia = nova_potencia
        else:
            c.potencia = None


    db.session.commit()
    
    return jsonify({
        "ok": True, 
        "id": c.id,
        "nome": c.nome,
        "tipo": c.tipo,
        "dimerizavel": c.dimerizavel,
        "potencia": c.potencia
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

    out = []
    for m in modulos:
        parent_info = None
        if m.parent_controller:
            parent_info = {
                "id": m.parent_controller.id,
                "nome": m.parent_controller.nome,
            }

        out.append({
            "id": m.id,
            "nome": m.nome,
            "tipo": m.tipo,
            "quantidade_canais": m.quantidade_canais,
            "is_controller": m.is_controller,
            "is_logic_server": m.is_logic_server,
            "ip_address": m.ip_address,
            "vinc_count": vinc_count_by_mod.get(m.id, 0),
            "quadro_eletrico": {
                "id": m.quadro_eletrico.id,
                "nome": m.quadro_eletrico.nome,
            } if m.quadro_eletrico else None,
            "parent_controller": parent_info,
        })
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

    # Se o módulo a ser deletado é o logic server, promove outro a sê-lo
    if m.is_logic_server:
        outro_controller = Modulo.query.filter(
            Modulo.projeto_id == projeto_id,
            Modulo.is_controller == True,
            Modulo.id != m.id
        ).first()
        if outro_controller:
            outro_controller.is_logic_server = True

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
    quadro_eletrico_id = data.get("quadro_eletrico_id")
    parent_controller_id = data.get("parent_controller_id")
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

    is_controller = tipo in ["AQL-GV-M4", "ADP-M8", "ADP-M16"]

    # Validações
    if is_controller and not quadro_eletrico_id:
        return jsonify({"ok": False, "error": "Controladores devem ser associados a um Quadro Elétrico."}), 400

    if not is_controller and not parent_controller_id:
        return jsonify({"ok": False, "error": "Módulos devem ser vinculados a um Controlador."}), 400

    # Validação do quadro elétrico
    quadro_eletrico = None
    if quadro_eletrico_id:
        quadro_eletrico = QuadroEletrico.query.filter_by(id=quadro_eletrico_id, projeto_id=projeto_id).first()
        if not quadro_eletrico:
            return jsonify({"ok": False, "error": "Quadro elétrico não encontrado no projeto."}), 400

    # Validação do controlador pai
    if parent_controller_id:
        parent = Modulo.query.filter_by(id=parent_controller_id, projeto_id=projeto_id, is_controller=True).first()
        if not parent:
            return jsonify({"ok": False, "error": "Controlador pai não encontrado ou inválido."}), 400

    # Evitar nome duplicado
    if Modulo.query.filter_by(projeto_id=projeto_id, nome=nome).first():
        return jsonify({"ok": False, "error": "Já existe um módulo com esse nome no projeto."}), 409

    # Lógica para HSNET e DevID (simplificada, pode precisar de mais detalhes)
    hsnet = data.get("hsnet") or None
    dev_id = data.get("dev_id") or hsnet

    # Lógica para Logic Server
    is_logic_server = data.get("is_logic_server", False)
    if is_controller:
        if Modulo.query.filter_by(projeto_id=projeto_id, is_controller=True).count() == 0:
            is_logic_server = True

    if is_logic_server:
        Modulo.query.filter_by(projeto_id=projeto_id, is_logic_server=True).update({"is_logic_server": False})

    m = Modulo(
        nome=nome,
        tipo=tipo,
        quantidade_canais=info.get("canais", 0),
        projeto_id=projeto_id,
        hsnet=hsnet,
        dev_id=dev_id,
        is_controller=is_controller,
        is_logic_server=is_logic_server,
        ip_address=data.get("ip_address"),
        quadro_eletrico_id=quadro_eletrico.id if quadro_eletrico else None,
        parent_controller_id=parent_controller_id
    )
    db.session.add(m)
    db.session.commit()
    return jsonify({"ok": True, "id": m.id})

@app.put("/api/modulos/<int:modulo_id>")
@login_required
def api_modulos_update(modulo_id):
    data = request.get_json(silent=True) or request.form or {}
    m = db.get_or_404(Modulo, modulo_id)
    projeto_id = session.get("projeto_atual_id")

    if m.projeto_id != projeto_id:
        return jsonify({"ok": False, "error": "Módulo não pertence ao projeto atual."}), 400

    if "nome" in data:
        nome = (data.get("nome") or "").strip()
        if not nome:
            return jsonify({"ok": False, "error": "Nome é obrigatório."}), 400
        m.nome = nome

    if "ip_address" in data:
        ip_address = data.get("ip_address")
        if ip_address and not is_valid_ip(ip_address):
            return jsonify({"ok": False, "error": "Formato de endereço IP inválido."}), 400
        m.ip_address = ip_address

    if "is_logic_server" in data:
        is_logic_server = data.get("is_logic_server", False)

        # Se o usuário está tentando desmarcar o logic server
        if not is_logic_server and m.is_logic_server:
            # Verificar se existem outros controladores no projeto
            outros_controllers = Modulo.query.filter(
                Modulo.projeto_id == projeto_id,
                Modulo.is_controller == True,
                Modulo.id != modulo_id
            ).count()

            if outros_controllers == 0:
                return jsonify({"ok": False, "error": "Não é possível desmarcar o único Logic Server. Adicione e promova outro controlador primeiro."}), 400
            else:
                # Promover outro controlador para ser o logic server
                novo_logic_server = Modulo.query.filter(
                    Modulo.projeto_id == projeto_id,
                    Modulo.is_controller == True,
                    Modulo.id != modulo_id
                ).first()
                novo_logic_server.is_logic_server = True

        if is_logic_server:
            # Desmarcar qualquer outro logic server no mesmo projeto
            Modulo.query.filter(
                Modulo.projeto_id == projeto_id,
                Modulo.id != modulo_id,
                Modulo.is_logic_server == True
            ).update({"is_logic_server": False})

        m.is_logic_server = is_logic_server
    
    if "quadro_eletrico_id" in data:
        quadro_id = data.get("quadro_eletrico_id")
        if quadro_id:
            quadro = db.get_or_404(QuadroEletrico, int(quadro_id))
            if quadro.projeto_id != projeto_id:
                return jsonify({"ok": False, "error": "Quadro elétrico não pertence ao projeto atual."}), 400
            m.quadro_eletrico_id = quadro.id
        else:
            m.quadro_eletrico_id = None

    if "hsnet" in data:
        hsnet_val = data.get("hsnet")
        if hsnet_val not in (None, ""):
            try:
                hsnet = int(hsnet_val)
            except (TypeError, ValueError):
                return jsonify({"ok": False, "error": "hsnet invalido."}), 400
            if hsnet <= 0:
                return jsonify({"ok": False, "error": "hsnet deve ser positivo."}), 400
            if is_hsnet_in_use(hsnet, projeto_id, exclude_modulo_id=m.id):
                return jsonify({"ok": False, "error": "HSNET ja esta em uso."}), 409
            m.hsnet = hsnet
        else:
            # Do not allow setting hsnet to null if it's already set
            if m.hsnet is not None:
                return jsonify({"ok": False, "error": "HSNET não pode ser vazio."}), 400
            m.hsnet = None
            
    db.session.commit()
    return jsonify({"ok": True})


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

from sqlalchemy import select

@app.post("/api/vinculacoes/auto")
@login_required
def api_vinculacoes_auto():
    projeto_id = session.get("projeto_atual_id")
    if not projeto_id:
        return jsonify({"ok": False, "error": "Projeto não selecionado."}), 400

    # Verificar se há exatamente um quadro elétrico
    quadros = QuadroEletrico.query.filter_by(projeto_id=projeto_id).all()
    if len(quadros) != 1:
        return jsonify({
            "ok": False, 
            "error": f"A vinculação automática requer exatamente 1 quadro elétrico. Encontrados: {len(quadros)}"
        }), 400

    try:
        # CORREÇÃO: Usar select() explicitamente para evitar warning
        circuitos_vinculados_subquery = select(Vinculacao.circuito_id)
        
        circuitos_nao_vinculados = (
            Circuito.query
            .join(Ambiente, Circuito.ambiente_id == Ambiente.id)
            .join(Area, Ambiente.area_id == Area.id)
            .filter(Area.projeto_id == projeto_id)
            .filter(Circuito.id.notin_(circuitos_vinculados_subquery))
            .all()
        )

        # Buscar módulos disponíveis
        modulos_disponiveis = (
            Modulo.query
            .filter_by(projeto_id=projeto_id)
            .all()
        )

        # Mapear compatibilidade atualizada
        compatibilidade = {
            "luz": ["RL4", "RL12", "DIM8"],
            "persiana": ["LX4"], 
            "hvac": ["SA1"]
        }

        # Prioridades por tipo de circuito
        prioridades = {
            "luz": {
                "dimerizavel": ["DIM8", "RL12", "RL4"],
                "nao_dimerizavel": ["RL12", "RL4", "DIM8"]
            },
            "persiana": ["LX4"],
            "hvac": ["SA1"]
        }

        vinculacoes_criadas = 0
        erros = []

        # CORREÇÃO: Função para calcular corrente considerando tensão de 120V
        def calcular_corrente(potencia):
            if not potencia or potencia <= 0:
                return 0
            # CORREÇÃO: Usar 120V conforme seus circuitos
            return potencia / 120

        # CORREÇÃO: Função para calcular corrente total do grupo considerando vinculações existentes E pendentes
        def calcular_corrente_grupo(modulo_id, canais_grupo):
            # Corrente das vinculações existentes no banco
            vinculacoes_existentes = Vinculacao.query.filter_by(modulo_id=modulo_id).filter(
                Vinculacao.canal.in_(canais_grupo)
            ).all()
            corrente_existente = sum(calcular_corrente(v.circuito.potencia) for v in vinculacoes_existentes)

            # Corrente das vinculações pendentes (na sessão atual)
            corrente_pendente = 0
            for obj in db.session.new:
                if (isinstance(obj, Vinculacao) and 
                    obj.modulo_id == modulo_id and 
                    obj.canal in canais_grupo):
                    circuito = Circuito.query.get(obj.circuito_id)
                    if circuito:
                        corrente_pendente += calcular_corrente(circuito.potencia)

            return corrente_existente + corrente_pendente

        # Para cada módulo, obter canais disponíveis
        modulos_com_info = []
        for modulo in modulos_disponiveis:
            # Obter canais ocupados para este módulo
            vinculacoes_modulo = Vinculacao.query.filter_by(modulo_id=modulo.id).all()
            canais_ocupados = [v.canal for v in vinculacoes_modulo]
            
            # Contar circuitos por ambiente neste módulo
            ambientes_no_modulo = {}
            for v in vinculacoes_modulo:
                ambiente_id = v.circuito.ambiente_id
                ambientes_no_modulo[ambiente_id] = ambientes_no_modulo.get(ambiente_id, 0) + 1
            
            canais_disponiveis = [
                i for i in range(1, (modulo.quantidade_canais or 0) + 1) 
                if i not in canais_ocupados
            ]
            
            modulos_com_info.append({
                "modulo": modulo,
                "canais_disponiveis": canais_disponiveis,
                "ambientes": ambientes_no_modulo,
                "vinculacoes_pendentes": []  # Para trackear vinculações sendo criadas
            })

        # Agrupar circuitos por ambiente
        circuitos_por_ambiente = {}
        for circuito in circuitos_nao_vinculados:
            ambiente_id = circuito.ambiente_id
            if ambiente_id not in circuitos_por_ambiente:
                circuitos_por_ambiente[ambiente_id] = []
            circuitos_por_ambiente[ambiente_id].append(circuito)

        # Ordenar ambientes por quantidade de circuitos
        ambientes_ordenados = sorted(circuitos_por_ambiente.keys(), 
                                   key=lambda a: len(circuitos_por_ambiente[a]), reverse=True)

        # Processar cada ambiente
        for ambiente_id in ambientes_ordenados:
            circuitos_ambiente = circuitos_por_ambiente[ambiente_id]
            
            # Ordenar circuitos: dimerizáveis primeiro
            circuitos_ordenados = sorted(circuitos_ambiente, 
                                       key=lambda c: (not c.dimerizavel, c.tipo))
            
            for circuito in circuitos_ordenados:
                # Determinar módulos compatíveis
                if circuito.tipo == "luz":
                    if circuito.dimerizavel:
                        modulos_compativeis_tipos = prioridades["luz"]["dimerizavel"]
                    else:
                        modulos_compativeis_tipos = prioridades["luz"]["nao_dimerizavel"]
                else:
                    modulos_compativeis_tipos = prioridades.get(circuito.tipo, [])
                
                # Filtrar módulos compatíveis
                modulos_compatíveis = [
                    m for m in modulos_com_info 
                    if m["modulo"].tipo in modulos_compativeis_tipos
                    and m["canais_disponiveis"]
                ]

                if not modulos_compatíveis:
                    erros.append(f"Nenhum módulo compatível disponível para circuito {circuito.identificador} ({circuito.tipo}{' - dimerizável' if circuito.dimerizavel else ''})")
                    continue

                # Calcular score para cada módulo compatível
                for modulo_info in modulos_compatíveis:
                    # Pontuar por ambiente
                    score_ambiente = modulo_info["ambientes"].get(ambiente_id, 0) * 10
                    # Pontuar por canais disponíveis
                    score_canais = len(modulo_info["canais_disponiveis"])
                    # Pontuar por prioridade do tipo
                    tipo_modulo = modulo_info["modulo"].tipo
                    prioridade_tipo = modulos_compativeis_tipos.index(tipo_modulo) if tipo_modulo in modulos_compativeis_tipos else 999
                    score_prioridade = (len(modulos_compativeis_tipos) - prioridade_tipo) * 5
                    
                    # Penalizar DIM8 para circuitos não-dimerizáveis
                    if circuito.tipo == "luz" and not circuito.dimerizavel and tipo_modulo == "DIM8":
                        score_prioridade = -100
                    
                    modulo_info["score_agrupamento"] = score_ambiente + score_canais + score_prioridade

                # Ordenar módulos por score
                modulos_compatíveis.sort(key=lambda m: m["score_agrupamento"], reverse=True)

                vinculado = False
                for modulo_info in modulos_compatíveis:
                    modulo = modulo_info["modulo"]
                    canais_disponiveis = modulo_info["canais_disponiveis"]

                    # Tentar cada canal disponível
                    for canal in canais_disponiveis[:]:
                        try:
                            # CORREÇÃO: Calcular corrente com tensão correta
                            corrente_circuito = calcular_corrente(circuito.potencia)
                            
                            # Verificar restrições elétricas
                            especificacao = ESPECIFICACOES_MODULOS.get(modulo.tipo)
                            if especificacao:
                                # Verificar corrente por canal individual
                                if corrente_circuito > especificacao["correntePorCanal"]:
                                    erros.append(f"Circuito {circuito.identificador} excede corrente do canal ({corrente_circuito:.2f}A > {especificacao['correntePorCanal']}A)")
                                    continue

                                # CORREÇÃO: Verificação rigorosa do grupo
                                grupo = next((g for g in especificacao["grupos"] if canal in g["canais"]), None)
                                if grupo:
                                    # Calcular corrente total do grupo (existente + pendente + atual)
                                    corrente_total_grupo = calcular_corrente_grupo(modulo.id, grupo["canais"])
                                    corrente_total_grupo += corrente_circuito

                                    if corrente_total_grupo > grupo["maxCorrente"]:
                                        erros.append(f"Circuito {circuito.identificador} excede corrente do grupo ({corrente_total_grupo:.2f}A > {grupo['maxCorrente']}A) no módulo {modulo.nome}")
                                        continue

                            # Se passou em todas as verificações, criar vinculação
                            vinculacao = Vinculacao(
                                circuito_id=circuito.id,
                                modulo_id=modulo.id,
                                canal=canal
                            )
                            db.session.add(vinculacao)
                            
                            # CORREÇÃO: Adicionar à lista de pendentes para cálculos futuros
                            modulo_info["vinculacoes_pendentes"].append({
                                "canal": canal,
                                "corrente": corrente_circuito
                            })
                            
                            vinculacoes_criadas += 1
                            vinculado = True
                            
                            # Atualizar informações do módulo
                            modulo_info["canais_disponiveis"].remove(canal)
                            modulo_info["ambientes"][ambiente_id] = modulo_info["ambientes"].get(ambiente_id, 0) + 1
                            
                            print(f"Vinculado: {circuito.identificador} -> {modulo.nome} (canal {canal}) - {corrente_circuito:.2f}A")
                            break

                        except Exception as e:
                            erros.append(f"Erro ao vincular circuito {circuito.identificador} no canal {canal}: {str(e)}")
                            continue

                    if vinculado:
                        break

                if not vinculado:
                    erros.append(f"Não foi possível vincular circuito {circuito.identificador} - restrições elétricas ou nenhum canal livre compatível")

        db.session.commit()
        
        # Log detalhado
        print(f"=== RESUMO VINCULAÇÃO AUTOMÁTICA ===")
        print(f"Vinculações criadas: {vinculacoes_criadas}")
        print(f"Erros: {len(erros)}")
        
        # CORREÇÃO: Log de distribuição por módulo
        for modulo_info in modulos_com_info:
            modulo = modulo_info["modulo"]
            especificacao = ESPECIFICACOES_MODULOS.get(modulo.tipo)
            if especificacao:
                print(f"\nMódulo {modulo.nome} ({modulo.tipo}):")
                for grupo in especificacao["grupos"]:
                    corrente_grupo = calcular_corrente_grupo(modulo.id, grupo["canais"])
                    print(f"  Grupo {grupo['canais']}: {corrente_grupo:.2f}A / {grupo['maxCorrente']}A")
        
        for erro in erros:
            print(f"Erro: {erro}")
        print(f"=====================================")
            
        return jsonify({
            "ok": True,
            "vinculacoes_criadas": vinculacoes_criadas,
            "erros": erros,
            "total_erros": len(erros),
            "message": f"Vinculação automática concluída: {vinculacoes_criadas} vinculações criadas"
        })
        
    except Exception as e:
        db.session.rollback()
        print(f"Erro na vinculação automática: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({
            "ok": False,
            "error": f"Erro ao realizar vinculação automática: {str(e)}"
        }), 500

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

    # Carrega Áreas -> Ambientes -> Circuitos, Cenas, Quadros Elétricos -> Módulos
    areas = (
        Area.query
        .options(
            joinedload(Area.ambientes).joinedload(Ambiente.cenas),
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
            
            cenas_out = [serialize_cena(c) for c in amb.cenas]

            ambs.append({
                "id": amb.id,
                "nome": amb.nome,
                "circuitos": circs,
                "keypads": keypads_out,
                "quadros_eletricos": quadros_out,
                "cenas": cenas_out,
            })
        out_areas.append({"id": a.id, "nome": a.nome, "ambientes": ambs})

    modulos = Modulo.query.filter_by(projeto_id=projeto_id).all()
    modulos_out = [{"id": m.id, "nome": m.nome, "tipo": m.tipo} for m in modulos]

    return jsonify({
        "ok": True,
        "projeto": {"id": projeto_id, "nome": session.get("projeto_atual_nome")},
        "areas": out_areas,
        "modulos": modulos_out,
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

class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        total_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_number(total_pages)
            super().showPage()
        super().save()

    def draw_page_number(self, page_count):
        self.setFont("Helvetica", 8)
        # Centralizado no rodapé: "Página X de Y"
        self.drawCentredString(A4[0] / 2, 12 * mm, f"Página {self._pageNumber} de {page_count}")


def footer(canvas, doc):
    canvas.saveState()
    width, height = A4
    margin = 30

    y_line = 18 * mm
    canvas.setLineWidth(0.5)
    canvas.line(margin, y_line, width - margin, y_line)

    timestamp_str = getattr(doc, 'client_timestamp', None)
    tz_offset_str = getattr(doc, 'tz_offset', None)

    if timestamp_str and tz_offset_str is not None:
        try:
            utc_time = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
            offset_minutes = int(tz_offset_str)
            local_time = utc_time - timedelta(minutes=offset_minutes)
            formatted_time = local_time.strftime('%d/%m/%Y %H:%M')
        except (ValueError, TypeError):
            formatted_time = datetime.now().strftime('%d/%m/%Y %H:%M')
    else:
        formatted_time = datetime.now().strftime('%d/%m/%Y %H:%M')

    canvas.setFont("Helvetica", 8)
    canvas.drawRightString(width - margin, 12 * mm, f"Zafiro - Luxury Technology • {current_user.username} • {formatted_time}")

    canvas.restoreState()


@app.route('/exportar-projeto/<int:projeto_id>')
@login_required
def exportar_projeto(projeto_id):
    projeto = Projeto.query.options(
        joinedload(Projeto.areas)
        .joinedload(Area.ambientes)
        .joinedload(Ambiente.circuitos)
        .joinedload(Circuito.vinculacao),
        joinedload(Projeto.areas)
        .joinedload(Area.ambientes)
        .joinedload(Ambiente.keypads)
        .joinedload(Keypad.buttons),
        joinedload(Projeto.areas)
        .joinedload(Area.ambientes)
        .joinedload(Ambiente.quadros_eletricos)
        .joinedload(QuadroEletrico.modulos),
        joinedload(Projeto.areas)
        .joinedload(Area.ambientes)
        .joinedload(Ambiente.cenas)
        .joinedload(Cena.acoes)
        .joinedload(Acao.custom_acoes),
        joinedload(Projeto.modulos)
    ).get_or_404(projeto_id)

    if projeto.user_id != current_user.id and current_user.role != 'admin':
        return jsonify({"ok": False, "error": "Acesso negado."}), 403

    # Estrutura de dados para exportação
    export_data = {
        'version': '1.1',
        'exported_at': datetime.utcnow().isoformat(),
        'projeto': {},
        'areas': [],
        'ambientes': [],
        'quadros_eletricos': [],
        'circuitos': [],
        'modulos': [],
        'vinculacoes': [],
        'keypads': [],
        'keypad_buttons': [],
        'cenas': [],
        'acoes': [],
        'custom_acoes': [],
    }

    # 1. Projeto
    export_data['projeto'] = {
        'id': projeto.id,
        'nome': projeto.nome,
        'status': projeto.status,
        'data_criacao': projeto.data_criacao.isoformat() if projeto.data_criacao else None,
        'data_ativo': projeto.data_ativo.isoformat() if projeto.data_ativo else None,
        'data_inativo': projeto.data_inativo.isoformat() if projeto.data_inativo else None,
        'data_concluido': projeto.data_concluido.isoformat() if projeto.data_concluido else None,
    }

    # 2. Módulos (todos do projeto)
    all_modulos_in_projeto = Modulo.query.filter_by(projeto_id=projeto.id).all()
    for modulo in all_modulos_in_projeto:
        export_data['modulos'].append({
            'id': modulo.id,
            'nome': modulo.nome,
            'tipo': modulo.tipo,
            'quantidade_canais': modulo.quantidade_canais,
            'hsnet': modulo.hsnet,
            'dev_id': modulo.dev_id,
            'is_controller': modulo.is_controller,
            'is_logic_server': modulo.is_logic_server,
            'ip_address': modulo.ip_address,
            'quadro_eletrico_id': modulo.quadro_eletrico_id,
            'parent_controller_id': modulo.parent_controller_id,
        })
        # Coletar vinculações associadas
        for vinc in modulo.vinculacoes:
            export_data['vinculacoes'].append({
                'id': vinc.id,
                'circuito_id': vinc.circuito_id,
                'modulo_id': vinc.modulo_id,
                'canal': vinc.canal,
            })

    # 3. Áreas e seus filhos
    for area in projeto.areas:
        export_data['areas'].append({'id': area.id, 'nome': area.nome, 'projeto_id': area.projeto_id})
        for ambiente in area.ambientes:
            export_data['ambientes'].append({'id': ambiente.id, 'nome': ambiente.nome, 'area_id': ambiente.area_id})

            # Quadros Elétricos
            for quadro in ambiente.quadros_eletricos:
                export_data['quadros_eletricos'].append({
                    'id': quadro.id,
                    'nome': quadro.nome,
                    'notes': quadro.notes,
                    'ambiente_id': quadro.ambiente_id,
                    'projeto_id': quadro.projeto_id,
                })

            # Circuitos
            for circuito in ambiente.circuitos:
                export_data['circuitos'].append({
                    'id': circuito.id,
                    'identificador': circuito.identificador,
                    'nome': circuito.nome,
                    'tipo': circuito.tipo,
                    'dimerizavel': circuito.dimerizavel,
                    'potencia': circuito.potencia,
                    'ambiente_id': circuito.ambiente_id,
                    'sak': circuito.sak,
                    'quantidade_saks': circuito.quantidade_saks,
                })

            # Keypads
            for keypad in ambiente.keypads:
                export_data['keypads'].append({
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
                    'created_at': keypad.created_at.isoformat() if getattr(keypad, "created_at", None) else None,
                    'updated_at': keypad.updated_at.isoformat() if getattr(keypad, "updated_at", None) else None,
                })
                for button in keypad.buttons:
                    export_data['keypad_buttons'].append({
                        'id': button.id,
                        'keypad_id': button.keypad_id,
                        'ordem': button.ordem,
                        'guid': button.guid,
                        'circuito_id': button.circuito_id,
                        'cena_id': button.cena_id,
                        'modo': button.modo,
                        'command_on': button.command_on,
                        'command_off': button.command_off,
                        'can_hold': button.can_hold,
                        'modo_double_press': button.modo_double_press,
                        'command_double_press': button.command_double_press,
                        'target_object_guid': button.target_object_guid,
                        'notes': button.notes,
                        'engraver_text': button.engraver_text,
                        'icon': button.icon,
                        'rocker_style': button.rocker_style,
                        'is_rocker': button.is_rocker,
                        'created_at': button.created_at.isoformat() if getattr(button, "created_at", None) else None,
                        'updated_at': button.updated_at.isoformat() if getattr(button, "updated_at", None) else None,
                    })

            # Cenas
            for cena in ambiente.cenas:
                export_data['cenas'].append({
                    'id': cena.id,
                    'guid': cena.guid,
                    'nome': cena.nome,
                    'ambiente_id': cena.ambiente_id,
                    'scene_movers': cena.scene_movers,
                })
                for acao in cena.acoes:
                    export_data['acoes'].append({
                        'id': acao.id,
                        'cena_id': acao.cena_id,
                        'level': acao.level,
                        'action_type': acao.action_type,
                        'target_guid': acao.target_guid,
                    })
                    for custom_acao in acao.custom_acoes:
                        export_data['custom_acoes'].append({
                            'id': custom_acao.id,
                            'acao_id': custom_acao.acao_id,
                            'target_guid': custom_acao.target_guid,
                            'enable': custom_acao.enable,
                            'level': custom_acao.level,
                        })

    # Preparar arquivo para download
    output = io.BytesIO()
    output.write(json.dumps(export_data, indent=2).encode('utf-8'))
    output.seek(0)
    
    # Nome do arquivo
    safe_nome = re.sub(r'[^a-zA-Z0-9_.-]', '_', projeto.nome)
    nome_arquivo = f"export_{safe_nome}_{datetime.now().strftime('%Y%m%d')}.json"
    
    return send_file(
        output,
        mimetype='application/json',
        as_attachment=True,
        download_name=nome_arquivo
    )


@app.route('/api/importar-planner', methods=['POST'])
@login_required
def importar_planner():
    if 'file' not in request.files:
        return jsonify({"ok": False, "error": "Nenhum arquivo enviado."}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({"ok": False, "error": "Nenhum arquivo selecionado."}), 400

    if not file or not file.filename.endswith('.json'):
        return jsonify({"ok": False, "error": "Arquivo inválido. Apenas arquivos .json são permitidos."}), 400

    try:
        data = json.load(file)
    except json.JSONDecodeError:
        return jsonify({"ok": False, "error": "Arquivo JSON mal formatado."}), 400

    required_keys = ["ProjectName", "ProjectDataAreas", "ProjectDataRooms", "ProjectDataDevices"]
    if not all(key in data for key in required_keys):
        return jsonify({"ok": False, "error": "Estrutura do JSON do planner inválida."}), 400

    id_map = {
        'areas': {},
        'ambientes': {},
    }

    try:
        with db.session.begin_nested():
            # 1. Criar Projeto
            original_nome = data['ProjectName']
            novo_nome = original_nome
            count = 1
            while Projeto.query.filter_by(nome=novo_nome, user_id=current_user.id).first():
                novo_nome = f"{original_nome} (importado {count})"
                count += 1

            now = datetime.utcnow()
            novo_projeto = Projeto(
                nome=novo_nome,
                user_id=current_user.id,
                status='ATIVO',
                data_ativo=now
            )
            db.session.add(novo_projeto)
            db.session.flush()

            # 2. Criar Áreas
            for area_data in data.get('ProjectDataAreas', []):
                nova_area = Area(nome=area_data['Name'], projeto_id=novo_projeto.id)
                db.session.add(nova_area)
                db.session.flush()
                id_map['areas'][area_data['Id']] = nova_area

            # 3. Criar Ambientes
            for room_data in data.get('ProjectDataRooms', []):
                area = id_map['areas'].get(room_data['IdArea'])
                if not area:
                    continue
                novo_ambiente = Ambiente(nome=room_data['Name'], area_id=area.id)
                db.session.add(novo_ambiente)
                db.session.flush()
                id_map['ambientes'][room_data['Id']] = novo_ambiente

            # 4. Criar Keypads
            hsnet_counter = 110
            for device_data in data.get('ProjectDataDevices', []):
                if device_data.get('Type') != 'Keypad':
                    continue

                ambiente = id_map['ambientes'].get(device_data['IdRoom'])
                if not ambiente:
                    continue

                # Mapeamento de Cores
                color_map = {"WHT": "WHITE", "BLK": "BLACK", "ASLV": "SILVER"}
                faceplate_color = color_map.get(device_data.get('FaceplateColor'), 'WHITE')

                # Mapeamento de Layout
                model_key = 'ModelLeft' if 'ModelLeft' in device_data else 'ModelRight'
                layout_map = {"K1": 1, "K2": 2, "K4": 4}
                button_count = layout_map.get(device_data.get(model_key), 4)

                # Garantir HSNET único
                while is_hsnet_in_use(hsnet_counter, novo_projeto.id):
                    hsnet_counter += 1

                novo_keypad = Keypad(
                    nome=device_data['Name'],
                    modelo='RQR-K',
                    color=faceplate_color,
                    button_color='WHITE', # Padrão
                    button_count=button_count,
                    hsnet=hsnet_counter,
                    dev_id=hsnet_counter,
                    ambiente_id=ambiente.id,
                    projeto_id=novo_projeto.id,
                    notes=device_data.get('Notas', '')
                )
                db.session.add(novo_keypad)
                db.session.flush()

                ensure_keypad_button_slots(novo_keypad, button_count)
                db.session.flush()

                buttons_key = 'ButtonsLeft' if 'ButtonsLeft' in device_data else 'ButtonsRight'
                for i, button_data in enumerate(device_data.get(buttons_key, [])):
                    if i < len(novo_keypad.buttons):
                        button = novo_keypad.buttons[i]
                        button.engraver_text = button_data.get('ButtonText', '')
                        button.is_rocker = bool(button_data.get('isRKR', 0))

                        arrow_map = {1: 'up-down', 2: 'left-right', 3: 'previous-next'}
                        button.rocker_style = arrow_map.get(button_data.get('ArrowID'))

                        # IconID ainda precisa ser mapeado
                        # button.icon = map_icon(button_data.get('IconID'))

                hsnet_counter += 1

        db.session.commit()

        # Define o projeto recém-criado como o projeto atual na sessão
        session["projeto_atual_id"] = novo_projeto.id
        session["projeto_atual_nome"] = novo_projeto.nome

        return jsonify({"ok": True, "message": f"Projeto '{novo_nome}' importado com sucesso do planner!", "projeto_id": novo_projeto.id})

    except IntegrityError as e:
        db.session.rollback()
        app.logger.error(f"Erro de integridade na importação do planner: {e}")
        return jsonify({"ok": False, "error": "Erro de integridade nos dados. Verifique se há nomes duplicados."}), 409
    except Exception as e:
        db.session.rollback()
        import traceback
        app.logger.error(f"Erro inesperado na importação do planner: {e}\n{traceback.format_exc()}")
        return jsonify({"ok": False, "error": f"Ocorreu um erro inesperado: {e}"}), 500


@app.route('/api/importar-projeto', methods=['POST'])
@login_required
def importar_projeto():
    if 'file' not in request.files:
        return jsonify({"ok": False, "error": "Nenhum arquivo enviado."}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({"ok": False, "error": "Nenhum arquivo selecionado."}), 400

    if not file or not file.filename.endswith('.json'):
        return jsonify({"ok": False, "error": "Arquivo inválido. Apenas arquivos .json são permitidos."}), 400

    try:
        data = json.load(file)
    except json.JSONDecodeError:
        return jsonify({"ok": False, "error": "Arquivo JSON mal formatado."}), 400

    if 'projeto' not in data or 'areas' not in data:
        return jsonify({"ok": False, "error": "Estrutura do JSON inválida. Faltam chaves essenciais."}), 400

    # ID Mappings
    id_map = {
        'areas': {}, 'ambientes': {}, 'quadros_eletricos': {},
        'circuitos': {}, 'modulos': {}, 'keypads': {}, 'cenas': {}, 'acoes': {}
    }

    try:
        # Iniciar transação
        with db.session.begin_nested():
            # 1. Criar Projeto
            original_nome = data['projeto']['nome']
            novo_nome = original_nome
            count = 1
            while Projeto.query.filter_by(nome=novo_nome, user_id=current_user.id).first():
                novo_nome = f"{original_nome} (cópia {count})"
                count += 1

            def parse_iso_date(date_string):
                if not date_string:
                    return None
                try:
                    # Handle both Z and +00:00 timezones
                    if date_string.endswith('Z'):
                        return datetime.fromisoformat(date_string[:-1] + '+00:00')
                    return datetime.fromisoformat(date_string)
                except (ValueError, TypeError):
                    return None

            def remap_numeric_guid(value, mapping):
                if value is None:
                    return None
                value_str = str(value).strip()
                try:
                    original_id = int(value_str)
                except (ValueError, TypeError):
                    return value_str
                mapped_id = mapping.get(original_id)
                return str(mapped_id) if mapped_id is not None else value_str

            projeto_data = data['projeto']
            novo_projeto = Projeto(
                nome=novo_nome,
                status=projeto_data.get('status', 'ATIVO'),
                user_id=current_user.id,
                data_criacao=parse_iso_date(projeto_data.get('data_criacao')) or datetime.utcnow(),
                data_ativo=parse_iso_date(projeto_data.get('data_ativo')),
                data_inativo=parse_iso_date(projeto_data.get('data_inativo')),
                data_concluido=parse_iso_date(projeto_data.get('data_concluido')),
            )
            db.session.add(novo_projeto)
            db.session.flush()

            # 2. Criar Áreas
            for area_data in data.get('areas', []):
                nova_area = Area(nome=area_data['nome'], projeto_id=novo_projeto.id)
                db.session.add(nova_area)
                db.session.flush()
                id_map['areas'][area_data['id']] = nova_area.id

            # 3. Criar Ambientes
            for ambiente_data in data.get('ambientes', []):
                nova_area_id = id_map['areas'].get(ambiente_data['area_id'])
                if not nova_area_id: continue
                novo_ambiente = Ambiente(nome=ambiente_data['nome'], area_id=nova_area_id)
                db.session.add(novo_ambiente)
                db.session.flush()
                id_map['ambientes'][ambiente_data['id']] = novo_ambiente.id

            # 4. Criar Quadros Elétricos
            for quadro_data in data.get('quadros_eletricos', []):
                novo_ambiente_id = id_map['ambientes'].get(quadro_data['ambiente_id'])
                if not novo_ambiente_id: continue
                novo_quadro = QuadroEletrico(
                    nome=quadro_data['nome'],
                    notes=quadro_data.get('notes'),
                    ambiente_id=novo_ambiente_id,
                    projeto_id=novo_projeto.id
                )
                db.session.add(novo_quadro)
                db.session.flush()
                id_map['quadros_eletricos'][quadro_data['id']] = novo_quadro.id

            # 5. Criar Módulos
            for modulo_data in data.get('modulos', []):
                novo_quadro_id = id_map['quadros_eletricos'].get(modulo_data.get('quadro_eletrico_id'))
                novo_modulo = Modulo(
                    nome=modulo_data['nome'],
                    tipo=modulo_data['tipo'],
                    quantidade_canais=modulo_data['quantidade_canais'],
                    hsnet=modulo_data.get('hsnet'),
                    dev_id=modulo_data.get('dev_id'),
                    is_controller=modulo_data.get('is_controller', False),
                    is_logic_server=modulo_data.get('is_logic_server', False),
                    ip_address=modulo_data.get('ip_address'),
                    quadro_eletrico_id=novo_quadro_id,
                    projeto_id=novo_projeto.id
                )
                db.session.add(novo_modulo)
                db.session.flush()
                id_map['modulos'][modulo_data['id']] = novo_modulo.id

            # 6. Criar Circuitos
            for circuito_data in data.get('circuitos', []):
                novo_ambiente_id = id_map['ambientes'].get(circuito_data['ambiente_id'])
                if not novo_ambiente_id: continue
                novo_circuito = Circuito(
                    identificador=circuito_data['identificador'],
                    nome=circuito_data['nome'],
                    tipo=circuito_data['tipo'],
                    dimerizavel=circuito_data.get('dimerizavel', False),
                    potencia=circuito_data.get('potencia', 0.0),
                    sak=circuito_data.get('sak'),
                    quantidade_saks=circuito_data.get('quantidade_saks', 1),
                    ambiente_id=novo_ambiente_id
                )
                db.session.add(novo_circuito)
                db.session.flush()
                id_map['circuitos'][circuito_data['id']] = novo_circuito.id
            
            # 7. Criar Vinculações
            for vinc_data in data.get('vinculacoes', []):
                novo_circuito_id = id_map['circuitos'].get(vinc_data['circuito_id'])
                novo_modulo_id = id_map['modulos'].get(vinc_data['modulo_id'])
                if not novo_circuito_id or not novo_modulo_id: continue
                nova_vinc = Vinculacao(
                    circuito_id=novo_circuito_id,
                    modulo_id=novo_modulo_id,
                    canal=vinc_data['canal']
                )
                db.session.add(nova_vinc)

            # 8. Criar Keypads e Botões
            for keypad_data in data.get('keypads', []):
                novo_ambiente_id = id_map['ambientes'].get(keypad_data['ambiente_id'])
                if not novo_ambiente_id: continue
                created_at = parse_iso_date(keypad_data.get('created_at'))
                updated_at = parse_iso_date(keypad_data.get('updated_at'))
                novo_keypad = Keypad(
                    nome=keypad_data['nome'],
                    modelo=keypad_data.get('modelo', 'RQR-K'),
                    color=keypad_data.get('color', 'WHITE'),
                    button_color=keypad_data.get('button_color', 'WHITE'),
                    button_count=keypad_data.get('button_count', 4),
                    hsnet=keypad_data['hsnet'],
                    dev_id=keypad_data.get('dev_id'),
                    notes=keypad_data.get('notes'),
                    ambiente_id=novo_ambiente_id,
                    projeto_id=novo_projeto.id
                )
                if created_at:
                    novo_keypad.created_at = created_at
                if updated_at:
                    novo_keypad.updated_at = updated_at
                db.session.add(novo_keypad)
                db.session.flush()
                id_map['keypads'][keypad_data['id']] = novo_keypad.id

            for btn_data in data.get('keypad_buttons', []):
                novo_keypad_id = id_map['keypads'].get(btn_data['keypad_id'])
                novo_circuito_id = id_map['circuitos'].get(btn_data['circuito_id'])
                # Cenas ainda não foram mapeadas, faremos isso depois
                if not novo_keypad_id: continue
                created_at = parse_iso_date(btn_data.get('created_at'))
                updated_at = parse_iso_date(btn_data.get('updated_at'))
                is_rocker_value = btn_data.get('is_rocker', False)
                if isinstance(is_rocker_value, str):
                    is_rocker = is_rocker_value.lower() in ("true", "1", "yes", "y")
                else:
                    is_rocker = bool(is_rocker_value)
                original_target_object = btn_data.get('target_object_guid')
                mapped_target_object = remap_numeric_guid(original_target_object, id_map['circuitos'])
                if mapped_target_object is None:
                    mapped_target_object = original_target_object or "00000000-0000-0000-0000-000000000000"
                novo_btn = KeypadButton(
                    keypad_id=novo_keypad_id,
                    ordem=btn_data['ordem'],
                    guid=btn_data.get('guid', str(uuid.uuid4())),
                    engraver_text=btn_data.get('engraver_text'),
                    icon=btn_data.get('icon'),
                    rocker_style=btn_data.get('rocker_style'),
                    is_rocker=is_rocker,
                    circuito_id=novo_circuito_id,
                    # cena_id será atualizado depois
                    modo=btn_data.get('modo', 3),
                    command_on=btn_data.get('command_on', 0),
                    command_off=btn_data.get('command_off', 0),
                    can_hold=btn_data.get('can_hold', False),
                    modo_double_press=btn_data.get('modo_double_press', 3),
                    command_double_press=btn_data.get('command_double_press', 0),
                    target_object_guid=mapped_target_object,
                    notes=btn_data.get('notes')
                )
                if created_at:
                    novo_btn.created_at = created_at
                if updated_at:
                    novo_btn.updated_at = updated_at
                db.session.add(novo_btn)
            
            # 9. Criar Cenas, Ações e CustomAcoes
            for cena_data in data.get('cenas', []):
                novo_ambiente_id = id_map['ambientes'].get(cena_data['ambiente_id'])
                if not novo_ambiente_id: continue
                nova_cena = Cena(
                    guid=cena_data.get('guid', str(uuid.uuid4())),
                    nome=cena_data['nome'],
                    scene_movers=cena_data.get('scene_movers', False),
                    ambiente_id=novo_ambiente_id
                )
                db.session.add(nova_cena)
                db.session.flush()
                id_map['cenas'][cena_data['id']] = nova_cena.id

            for acao_data in data.get('acoes', []):
                nova_cena_id = id_map['cenas'].get(acao_data['cena_id'])
                if not nova_cena_id: continue
                action_type = acao_data.get('action_type', 0)
                old_target = acao_data.get('target_guid')
                if action_type == 0:
                    new_target = remap_numeric_guid(old_target, id_map['circuitos'])
                elif action_type == 7:
                    new_target = remap_numeric_guid(old_target, id_map['ambientes'])
                else:
                    new_target = old_target
                nova_acao = Acao(
                    cena_id=nova_cena_id,
                    level=acao_data.get('level', 100),
                    action_type=acao_data.get('action_type', 0),
                    target_guid=new_target
                )
                db.session.add(nova_acao)
                db.session.flush()
                id_map['acoes'][acao_data['id']] = nova_acao.id

            for custom_acao_data in data.get('custom_acoes', []):
                nova_acao_id = id_map['acoes'].get(custom_acao_data['acao_id'])
                if not nova_acao_id: continue
                custom_target = remap_numeric_guid(custom_acao_data.get('target_guid'), id_map['circuitos'])
                nova_custom_acao = CustomAcao(
                    acao_id=nova_acao_id,
                    target_guid=custom_target,
                    enable=custom_acao_data.get('enable', True),
                    level=custom_acao_data.get('level', 50)
                )
                db.session.add(nova_custom_acao)

            # 10. Pós-processamento para atualizar referências
            db.session.flush()

            # Atualizar parent_controller_id nos módulos
            for modulo_data in data.get('modulos', []):
                if modulo_data.get('parent_controller_id'):
                    novo_modulo_id = id_map['modulos'].get(modulo_data['id'])
                    novo_parent_id = id_map['modulos'].get(modulo_data['parent_controller_id'])
                    if novo_modulo_id and novo_parent_id:
                        module_to_update = db.session.get(Modulo, novo_modulo_id)
                        if module_to_update:
                            module_to_update.parent_controller_id = novo_parent_id
            # Atualizar KeypadButton.cena_id
            for btn_data in data.get('keypad_buttons', []):
                if btn_data.get('cena_id'):
                    novo_keypad_id = id_map['keypads'].get(btn_data['keypad_id'])
                    nova_cena_id = id_map['cenas'].get(btn_data['cena_id'])
                    if novo_keypad_id and nova_cena_id:
                        # Encontrar o botão correspondente no banco de dados e atualizá-lo
                        btn_to_update = KeypadButton.query.filter_by(
                            keypad_id=novo_keypad_id,
                            ordem=btn_data['ordem']
                        ).first()
                        if btn_to_update:
                            btn_to_update.cena_id = nova_cena_id

            # Atualizar GUIDs em Acao e CustomAcao
            # Esta parte é complexa se os GUIDs devem ser remapeados.
            # Por simplicidade, assumimos que os GUIDs de circuito/ambiente são os IDs antigos.
            # Uma implementação mais robusta remapearia os GUIDs.

        db.session.commit()
        return jsonify({"ok": True, "message": f"Projeto '{novo_nome}' importado com sucesso!", "projeto_id": novo_projeto.id})

    except IntegrityError as e:
        db.session.rollback()
        app.logger.error(f"Erro de integridade na importação: {e}")
        return jsonify({"ok": False, "error": "Erro de integridade nos dados. Verifique se há nomes duplicados."}), 409
    except Exception as e:
        db.session.rollback()
        app.logger.error(f"Erro inesperado na importação: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"ok": False, "error": f"Ocorreu um erro inesperado: {e}"}), 500

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
    projeto = Projeto.query.options(
        joinedload(Projeto.areas).
        joinedload(Area.ambientes).
        joinedload(Ambiente.circuitos).
        joinedload(Circuito.vinculacao).
        joinedload(Vinculacao.modulo)
    ).get_or_404(projeto_id)

    if projeto.user_id != current_user.id and current_user.role != 'admin':
        flash('Acesso negado a este projeto', 'danger')
        return redirect(url_for('index'))

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=30,
        leftMargin=30,
        topMargin=30,
        bottomMargin=30,
        title=f"Projeto {projeto.nome}"
    )

    client_timestamp_str = request.args.get('client_timestamp')
    tz_offset_str = request.args.get('tz_offset')
    doc.client_timestamp = client_timestamp_str
    doc.tz_offset = tz_offset_str

    if client_timestamp_str and tz_offset_str is not None:
        try:
            utc_time = datetime.fromisoformat(client_timestamp_str.replace('Z', '+00:00'))
            offset_minutes = int(tz_offset_str)
            local_time = utc_time - timedelta(minutes=offset_minutes)
            formatted_time = local_time.strftime('%d/%m/%Y %H:%M')
        except (ValueError, TypeError):
            formatted_time = datetime.now().strftime('%d/%m/%Y %H:%M')
    else:
        formatted_time = datetime.now().strftime('%d/%m/%Y %H:%M')

    styles = getSampleStyleSheet()
    # Base Styles
    if 'RoehnTitle' not in styles:
        styles.add(ParagraphStyle(name='RoehnTitle', parent=styles['Heading1'], fontSize=16, spaceAfter=30, alignment=TA_CENTER))
    if 'RoehnSubtitle' not in styles:
        styles.add(ParagraphStyle(name='RoehnSubtitle', parent=styles['Heading2'], fontSize=12, spaceAfter=12, spaceBefore=12))
    if 'RoehnCenter' not in styles:
        styles.add(ParagraphStyle(name='RoehnCenter', parent=styles['Normal'], alignment=TA_CENTER))
    if 'LeftNormal' not in styles:
        styles.add(ParagraphStyle(name='LeftNormal', parent=styles['Normal'], alignment=TA_LEFT))

    # Styles for tables with word wrapping
    if 'TableHeader' not in styles:
        styles.add(ParagraphStyle(name='TableHeader', parent=styles['Normal'], alignment=TA_CENTER, fontSize=9, textColor=colors.whitesmoke, fontName='Helvetica-Bold'))
    if 'TableBody' not in styles:
        styles.add(ParagraphStyle(name='TableBody', parent=styles['Normal'], alignment=TA_LEFT, fontSize=8))
    if 'TableBodyCenter' not in styles:
        styles.add(ParagraphStyle(name='TableBodyCenter', parent=styles['TableBody'], alignment=TA_CENTER))

    elements = []
    zafirologopath = "static/images/zafirologo.png"
    zafirologo = Image(zafirologopath, width=2*inch, height=2*inch)
    elements.append(zafirologo)
    elements.append(Paragraph("RELATÓRIO DE PROJETO", styles['RoehnCenter']))
    elements.append(Spacer(1, 0.2*inch))
    elements.append(Paragraph(f"<b>Projeto:</b> {projeto.nome}", styles['LeftNormal']))
    elements.append(Spacer(1, 0.1*inch))
    elements.append(Paragraph(f"<b>Data de emissão:</b> {formatted_time}", styles['LeftNormal']))
    elements.append(Spacer(1, 0.1*inch))
    elements.append(Paragraph(f"<b>Emitido por:</b> {current_user.username}", styles['LeftNormal']))
    elements.append(Spacer(1, 0.3*inch))

    # Resumo por Área
    for area in projeto.areas:
        elements.append(Paragraph(f"ÁREA: {area.nome}", styles['Heading2']))
        elements.append(Spacer(1, 0.1*inch))
        
        for ambiente in area.ambientes:
            elements.append(Paragraph(f"Ambiente: {ambiente.nome}", styles['Heading3']))
            
            # Prepare data for styling and for the table
            header_row = [Paragraph(h, styles['TableHeader']) for h in ["Circuito", "Nome", "Tipo", "SAKs", "Módulo", "Canal", "Verificado"]]
            table_data_styled = [header_row]
            color_commands = []
            raw_data_for_coloring = [] # Keep track of raw types for coloring logic

            for circuito in ambiente.circuitos:
                modulo_nome = "Não vinculado"
                canal = "-"
                if circuito.vinculacao:
                    modulo_nome = circuito.vinculacao.modulo.nome
                    canal = str(circuito.vinculacao.canal)
                
                sak_value = ""
                if circuito.tipo == 'hvac':
                    pass
                elif circuito.tipo == 'persiana':
                    # First row for persiana (up)
                    row_styled_up = [
                        Paragraph(circuito.identificador, styles['TableBodyCenter']),
                        Paragraph(f"{circuito.nome} (sobe)", styles['TableBodyCenter']),  # <-- antes: TableBody
                        Paragraph(circuito.tipo.upper(), styles['TableBodyCenter']),
                        Paragraph(str(circuito.sak), styles['TableBodyCenter']),
                        Paragraph(modulo_nome, styles['TableBodyCenter']),                # <-- antes: TableBody
                        Paragraph(f"{canal}s", styles['TableBodyCenter']),
                        Paragraph("", styles['TableBodyCenter'])
                    ]
                    table_data_styled.append(row_styled_up)
                    raw_data_for_coloring.append({'tipo': circuito.tipo, 'nome': f"{circuito.nome} (sobe)"})

                    # Second row for persiana (down)
                    row_styled_down = [
                        Paragraph(circuito.identificador, styles['TableBodyCenter']),
                        Paragraph(f"{circuito.nome} (desce)", styles['TableBodyCenter']), # <-- antes: TableBody
                        Paragraph(circuito.tipo.upper(), styles['TableBodyCenter']),
                        Paragraph(str(circuito.sak + 1), styles['TableBodyCenter']),
                        Paragraph(modulo_nome, styles['TableBodyCenter']),                # <-- antes: TableBody
                        Paragraph(f"{canal}d", styles['TableBodyCenter']),
                        Paragraph("", styles['TableBodyCenter'])
                    ]
                    table_data_styled.append(row_styled_down)
                    raw_data_for_coloring.append({'tipo': circuito.tipo, 'nome': f"{circuito.nome} (desce)"})
                    continue
                else:
                    sak_value = str(circuito.sak)

                # Row for other circuit types
                row_styled = [
                    Paragraph(circuito.identificador, styles['TableBodyCenter']),
                    Paragraph(circuito.nome, styles['TableBodyCenter']),
                    Paragraph(circuito.tipo.upper(), styles['TableBodyCenter']),
                    Paragraph(sak_value, styles['TableBodyCenter']),
                    Paragraph(modulo_nome, styles['TableBodyCenter']),
                    Paragraph(canal, styles['TableBodyCenter']),
                    Paragraph("", styles['TableBodyCenter'])
                ]
                table_data_styled.append(row_styled)
                raw_data_for_coloring.append({'tipo': circuito.tipo, 'nome': circuito.nome})
            
            if len(table_data_styled) > 1:
                # Apply coloring based on raw data
                for i, row in enumerate(raw_data_for_coloring, 1):
                    if row['tipo'] == "luz":
                        color_commands.append(('BACKGROUND', (0, i), (-1, i), colors.HexColor("#fff3cd")))
                    elif row['tipo'] == "persiana":
                        if "(sobe)" in row['nome'] or "(desce)" in row['nome']:
                            color_commands.append(('BACKGROUND', (0, i), (-1, i), colors.HexColor("#d1ecf1")))
                    elif row['tipo'] == "hvac":
                        color_commands.append(('BACKGROUND', (0, i), (-1, i), colors.HexColor("#d4edda")))

                circuito_table = Table(table_data_styled, colWidths=[0.7*inch, 1.5*inch, 0.8*inch, 0.6*inch, 1.2*inch, 0.6*inch, 0.8*inch], repeatRows=1)

                base_style = [
                    ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#2c3e50")),
                    ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                    ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'), # Vertical alignment
                    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                    ('FONTSIZE', (0, 0), (-1, 0), 9),
                    ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
                    ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#4d4f52")),
                    ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor("#f1f3f5")])
                ]

                estilo_tabela = TableStyle(base_style + color_commands)
                circuito_table.setStyle(estilo_tabela)
                elements.append(circuito_table)
            else:
                elements.append(Paragraph("Nenhum circuito neste ambiente.", styles['Italic']))
            
            elements.append(Spacer(1, 0.2*inch))
        
        if area != projeto.areas[-1]:
            elements.append(PageBreak())

    # Resumo de Módulos
    elements.append(PageBreak())
    elements.append(Paragraph("RESUMO DE MÓDULOS", styles['Heading2']))
    elements.append(Spacer(1, 0.2*inch))
    
    todos_circuitos = {c.id: c for area in projeto.areas for ambiente in area.ambientes for c in ambiente.circuitos}
    modulos_projeto = Modulo.query.filter(Modulo.projeto_id == projeto_id).options(joinedload(Modulo.vinculacoes)).all()
    
    if modulos_projeto:
        for modulo in modulos_projeto:
            elements.append(Paragraph(f"Módulo: {modulo.nome} ({modulo.tipo})", styles['Heading3']))
            
            header_row_mod = [Paragraph(h, styles['TableHeader']) for h in ["Canal", "Circuito", "Nome", "A. Registrada", "A. Medida"]]
            canal_data_styled = [header_row_mod]
            color_commands_mod = []
            raw_data_for_coloring_mod = []

            canais_ocupados = {v.canal: v for v in modulo.vinculacoes}
            
            for i, canal_num in enumerate(range(1, modulo.quantidade_canais + 1), 1):
                if canal_num in canais_ocupados:
                    vinculacao = canais_ocupados[canal_num]
                    circuito = todos_circuitos.get(vinculacao.circuito_id)
                    if circuito:
                        amperagem = f"{(circuito.potencia or 0) / 120:.2f}A" if circuito.potencia else "0.00A"
                        row_styled = [
                            Paragraph(str(canal_num), styles['TableBodyCenter']),
                            Paragraph(circuito.identificador, styles['TableBodyCenter']),
                            Paragraph(circuito.nome, styles['TableBodyCenter']),
                            Paragraph(amperagem, styles['TableBodyCenter']),
                            Paragraph("", styles['TableBodyCenter'])
                        ]
                        canal_data_styled.append(row_styled)
                        raw_data_for_coloring_mod.append({'tipo': circuito.tipo})
                    else:
                        canal_data_styled.append([Paragraph(str(canal_num), styles['TableBodyCenter']), Paragraph("ID Desconhecido", styles['TableBodyCenter']), Paragraph("Circuito não encontrado", styles['TableBody']), Paragraph("-", styles['TableBodyCenter']), Paragraph("", styles['TableBodyCenter'])])
                        raw_data_for_coloring_mod.append({'tipo': 'unknown'})
                else:
                    canal_data_styled.append([Paragraph(str(canal_num), styles['TableBodyCenter']), Paragraph("Livre", styles['TableBodyCenter']), Paragraph("-", styles['TableBody']), Paragraph("-", styles['TableBodyCenter']), Paragraph("", styles['TableBodyCenter'])])
                    raw_data_for_coloring_mod.append({'tipo': 'free'})
            
            # Apply coloring
            for i, row in enumerate(raw_data_for_coloring_mod, 1):
                tipo = row.get('tipo')
                if tipo == "luz":
                    color_commands_mod.append(('BACKGROUND', (0, i), (-1, i), colors.HexColor("#fff3cd")))
                elif tipo == "persiana":
                    color_commands_mod.append(('BACKGROUND', (0, i), (-1, i), colors.HexColor("#d1ecf1")))
                elif tipo == "hvac":
                    color_commands_mod.append(('BACKGROUND', (0, i), (-1, i), colors.HexColor("#d4edda")))

            canal_table = Table(canal_data_styled, colWidths=[0.6*inch, 1.0*inch, 2.0*inch, 1.2*inch, 1.2*inch], repeatRows=1)

            base_style = [
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#2c3e50")),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 9),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#4d4f52")),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor("#f1f3f5")])
            ]

            estilo_canal = TableStyle(base_style + color_commands_mod)
            canal_table.setStyle(estilo_canal)
            elements.append(canal_table)
            elements.append(Spacer(1, 0.3*inch))
    else:
        elements.append(Paragraph("Nenhum módulo configurado neste projeto.", styles['Italic']))

    # Seção de Assinaturas
    elements.append(PageBreak())
    elements.append(Paragraph("REGISTRO DE VISITAS TÉCNICAS", styles['Heading2']))
    elements.append(Spacer(1, 0.2*inch))

    assinatura_data = [["Data", "Técnico Responsável", "Assinatura"]]
    for i in range(10):
        assinatura_data.append(["____/____/______", "", ""])
    
    assinatura_table = Table(assinatura_data, colWidths=[1.5*inch, 3*inch, 2.5*inch], rowHeights=0.5*inch)
    assinatura_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#2c3e50")),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('GRID', (0, 0), (-1, -1), 1, colors.black)
    ]))
    elements.append(assinatura_table)

    # Página de Observações
    elements.append(PageBreak())
    elements.append(Paragraph("OBSERVAÇÕES GERAIS", styles['Heading2']))
    elements.append(Spacer(1, 0.2*inch))

    obs_data = []
    for i in range(1, 11):
        obs_data.append([f"Dia {i}:", ""])
    
    obs_table = Table(obs_data, colWidths=[0.8*inch, 6.2*inch], rowHeights=1.5*inch)
    obs_table.setStyle(TableStyle([
        ('GRID', (0, 0), (-1, -1), 1, colors.black),
        ('VALIGN', (0, 0), (-1, -1), 'TOP')
    ]))
    elements.append(obs_table)

    doc.build(
        elements,
        onFirstPage=footer,
        onLaterPages=footer,
        canvasmaker=NumberedCanvas
    )

    buffer.seek(0)
    
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

    # HSNETs usados por Keypads no projeto
    keypad_hsnets = {k.hsnet for k in Keypad.query.filter_by(projeto_id=projeto_id).all() if k.hsnet}

    # HSNETs usados por Módulos no projeto
    modulo_hsnets = {m.hsnet for m in Modulo.query.filter_by(projeto_id=projeto_id).all() if m.hsnet}

    usados = keypad_hsnets.union(modulo_hsnets)

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

    if is_hsnet_in_use(hsnet, projeto_id):
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
        projeto_id=projeto_id,
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
        if new_hsnet != keypad.hsnet and is_hsnet_in_use(new_hsnet, projeto_id, exclude_keypad_id=keypad.id):
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

    # Lidar com vinculação de cena
    if "cena_id" in data and data.get("cena_id") not in (None, "", 0, "0"):
        try:
            cena_id = int(data["cena_id"])
            cena = db.get_or_404(Cena, cena_id)
            if cena.ambiente.area.projeto_id != projeto_id:
                return jsonify({"ok": False, "error": "Cena não pertence ao projeto."}), 400
            
            button.cena = cena
            button.circuito = None  # Desvincular circuito
            button.modo = 1  # Modo "Activate Scene"
            button.command_on = 1 # Comando para ativar
            button.command_off = 0

        except (TypeError, ValueError):
            return jsonify({"ok": False, "error": "cena_id inválido."}), 400

    # Lidar com vinculação de circuito (apenas se cena não foi vinculada)
    elif "circuito_id" in data:
        raw_circuit = data.get("circuito_id")
        if raw_circuit in (None, "", 0, "0"):
            button.circuito = None
            button.cena = None # Desvincular cena
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

            button.circuito = circuito
            button.cena = None # Desvincular cena
            button.target_object_guid = ZERO_GUID
            button.modo = 2  # Send Command

            # Definir comandos padrão com base no tipo de circuito
            if circuito.tipo == 'persiana':
                button.command_on = 3  # Sobe
                button.command_off = 4  # Desce
            else:  # Padrão para 'luz', 'hvac', etc.
                button.command_on = 1  # Ligar/Alternar
                button.command_off = 0  # Desligar

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

    if "is_rocker" in data:
        button.is_rocker = bool(data.get("is_rocker"))

    if "rocker_style" in data:
        style = (data.get("rocker_style") or "up-down").strip()
        if style not in ('up-down', 'left-right', 'previous-next'):
            return jsonify({"ok": False, "error": "Estilo de rocker inválido."}), 400
        button.rocker_style = style

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

    if "engraver_text" in data:
        text = (data.get("engraver_text") or "").strip()
        if len(text) > 7:
            return jsonify({"ok": False, "error": "Texto do botão pode ter no máximo 7 caracteres."}), 400
        button.engraver_text = text or None
        if text:
            button.icon = None

    if "icon" in data:
        icon = (data.get("icon") or "").strip()
        button.icon = icon or None
        if icon:
            button.engraver_text = None

    db.session.commit()
    return jsonify({"ok": True, "keypad": serialize_keypad(keypad)})

# -------------------- Cenas (Scenes) --------------------

def serialize_custom_acao(custom_acao):
    """Serializes a CustomAcao object."""
    return {
        "id": custom_acao.id,
        "target_guid": custom_acao.target_guid,
        "enable": custom_acao.enable,
        "level": custom_acao.level,
    }

def serialize_acao(acao):
    """Serializes an Acao object."""
    return {
        "id": acao.id,
        "level": acao.level,
        "action_type": acao.action_type,
        "target_guid": acao.target_guid,
        "custom_acoes": [serialize_custom_acao(ca) for ca in sorted(acao.custom_acoes, key=lambda x: x.id)],
    }

def serialize_cena(cena):
    """Serializes a Cena object."""
    return {
        "id": cena.id,
        "guid": cena.guid,
        "nome": cena.nome,
        "ambiente_id": cena.ambiente_id,
        "scene_movers": cena.scene_movers,
        "acoes": [serialize_acao(a) for a in sorted(cena.acoes, key=lambda x: x.id)],
    }

@app.get("/cenas")
def cenas_spa():
    return current_app.send_static_file("index.html")

@app.get("/api/cenas")
@login_required
def get_all_cenas():
    projeto_id = session.get("projeto_atual_id")
    if not projeto_id:
        return jsonify({"ok": True, "cenas": []})

    cenas = (
        Cena.query
        .join(Ambiente, Cena.ambiente_id == Ambiente.id)
        .join(Area, Ambiente.area_id == Area.id)
        .filter(Area.projeto_id == projeto_id)
        .options(
            joinedload(Cena.ambiente).joinedload(Ambiente.area),
            joinedload(Cena.acoes).joinedload(Acao.custom_acoes)
        )
        .order_by(Area.nome, Ambiente.nome, Cena.nome)
        .all()
    )

    # Adicionar dados do ambiente na serialização
    cenas_serializadas = []
    for c in cenas:
        cena_data = serialize_cena(c)
        cena_data['ambiente'] = {
            'id': c.ambiente.id,
            'nome': c.ambiente.nome,
            'area': {
                'id': c.ambiente.area.id,
                'nome': c.ambiente.area.nome
            }
        }
        cenas_serializadas.append(cena_data)

    return jsonify({"ok": True, "cenas": cenas_serializadas})


@app.get("/api/ambientes/<int:ambiente_id>/cenas")
@login_required
def get_cenas_por_ambiente(ambiente_id):
    projeto_id = session.get("projeto_atual_id")
    ambiente = db.get_or_404(Ambiente, ambiente_id)
    if not projeto_id or ambiente.area.projeto_id != projeto_id:
        return jsonify({"ok": False, "error": "Ambiente não pertence ao projeto atual."}), 404

    cenas = Cena.query.filter_by(ambiente_id=ambiente_id).order_by(Cena.nome).all()
    return jsonify({"ok": True, "cenas": [serialize_cena(c) for c in cenas]})

@app.get("/api/cenas/<int:cena_id>")
@login_required
def get_cena(cena_id):
    projeto_id = session.get("projeto_atual_id")
    cena = db.get_or_404(Cena, cena_id)
    if not projeto_id or cena.ambiente.area.projeto_id != projeto_id:
        return jsonify({"ok": False, "error": "Cena não encontrada no projeto atual."}), 404

    return jsonify({"ok": True, "cena": serialize_cena(cena)})

@app.post("/api/cenas")
@login_required
def create_cena():
    projeto_id = session.get("projeto_atual_id")
    if not projeto_id:
        return jsonify({"ok": False, "error": "Projeto não selecionado."}), 400

    data = request.get_json()
    if not data:
        return jsonify({"ok": False, "error": "Requisição sem dados."}), 400

    nome = (data.get("nome") or "").strip()
    ambiente_id = data.get("ambiente_id")
    acoes_data = data.get("acoes", [])
    scene_movers = data.get("scene_movers", False)

    if not nome or not ambiente_id:
        return jsonify({"ok": False, "error": "Nome e ambiente_id são obrigatórios."}), 400

    ambiente = db.get_or_404(Ambiente, int(ambiente_id))
    if ambiente.area.projeto_id != projeto_id:
        return jsonify({"ok": False, "error": "Ambiente não pertence ao projeto atual."}), 403

    # Validação para scene_movers
    if scene_movers:
        all_circuit_ids = set()
        all_group_ambiente_ids = set()
        if not acoes_data:
            return jsonify({"ok": False, "error": "Movimentadores de cena não podem ser habilitados para uma cena vazia."}), 400

        for acao_data in acoes_data:
            if acao_data.get("action_type") == 0:
                try:
                    all_circuit_ids.add(int(acao_data.get("target_guid")))
                except (ValueError, TypeError):
                    pass
            elif acao_data.get("action_type") == 7:
                try:
                    all_group_ambiente_ids.add(int(acao_data.get("target_guid")))
                except (ValueError, TypeError):
                    pass

        if all_circuit_ids:
            circuits = Circuito.query.filter(Circuito.id.in_(list(all_circuit_ids))).all()
            if any(c.tipo != 'persiana' for c in circuits):
                return jsonify({"ok": False, "error": "Movimentadores de cena só podem ser habilitados se todos os itens da cena forem persianas."}), 400

        if all_group_ambiente_ids:
            group_circuits = Circuito.query.filter(Circuito.ambiente_id.in_(list(all_group_ambiente_ids))).all()
            for c in group_circuits:
                if c.tipo in ['luz', 'persiana'] and c.tipo != 'persiana':
                    return jsonify({"ok": False, "error": "Movimentadores de cena só podem ser habilitados se todos os itens da cena forem persianas (encontrado em grupo)."}), 400

    # Validação para não permitir circuitos HVAC
    for acao_data in acoes_data:
        if acao_data.get("action_type") == 0: # Ação de Circuito
            try:
                circuito_id = int(acao_data.get("target_guid"))
                circuito = db.session.get(Circuito, circuito_id)
                if circuito and circuito.tipo == 'hvac':
                    return jsonify({"ok": False, "error": "Não é permitido adicionar circuitos do tipo HVAC em cenas de iluminação."}), 400
            except (ValueError, TypeError):
                # Ignora GUIDs inválidos, a validação do form deve pegar
                pass

    # Validação para não permitir circuitos duplicados
    circuit_guids_in_scene = [
        acao.get("target_guid") for acao in acoes_data
        if acao.get("action_type") == 0 and acao.get("target_guid")
    ]
    if len(circuit_guids_in_scene) != len(set(circuit_guids_in_scene)):
        return jsonify({"ok": False, "error": "Não é permitido adicionar o mesmo circuito mais de uma vez na mesma cena."}), 400

    nova_cena = Cena(
        nome=nome,
        ambiente_id=ambiente.id,
        scene_movers=scene_movers
    )
    db.session.add(nova_cena)

    for acao_data in acoes_data:
        nova_acao = Acao(
            cena=nova_cena,
            level=acao_data.get("level", 100),
            action_type=acao_data.get("action_type", 0),
            target_guid=acao_data.get("target_guid")
        )
        if not nova_acao.target_guid:
            continue
        db.session.add(nova_acao)

        for custom_acao_data in acao_data.get("custom_acoes", []):
            novo_custom_acao = CustomAcao(
                acao=nova_acao,
                target_guid=custom_acao_data.get("target_guid"),
                enable=custom_acao_data.get("enable", True),
                level=custom_acao_data.get("level", 50)
            )
            if not novo_custom_acao.target_guid:
                continue
            db.session.add(novo_custom_acao)

    try:
        db.session.commit()
    except IntegrityError as e:
        db.session.rollback()
        if "unique_cena_por_ambiente" in str(e.orig):
            return jsonify({"ok": False, "error": "Já existe uma cena com este nome neste ambiente."}), 409
        return jsonify({"ok": False, "error": f"Não foi possível salvar a cena."}), 400

    return jsonify({"ok": True, "cena": serialize_cena(nova_cena)}), 201

@app.put("/api/cenas/<int:cena_id>")
@login_required
def update_cena(cena_id):
    projeto_id = session.get("projeto_atual_id")
    cena = db.get_or_404(Cena, cena_id)
    if not projeto_id or cena.ambiente.area.projeto_id != projeto_id:
        return jsonify({"ok": False, "error": "Cena não encontrada no projeto atual."}), 404

    data = request.get_json()
    if not data:
        return jsonify({"ok": False, "error": "Requisição sem dados."}), 400

    if "nome" in data:
        cena.nome = (data["nome"] or "").strip()

    if "scene_movers" in data:
        cena.scene_movers = data["scene_movers"]

    if "acoes" in data:
        acoes_data = data.get("acoes", [])

        # Validação para scene_movers
        if data.get("scene_movers"):
            all_circuit_ids = set()
            all_group_ambiente_ids = set()
            if not acoes_data:
                return jsonify({"ok": False, "error": "Movimentadores de cena não podem ser habilitados para uma cena vazia."}), 400

            for acao_data in acoes_data:
                if acao_data.get("action_type") == 0:
                    try:
                        all_circuit_ids.add(int(acao_data.get("target_guid")))
                    except (ValueError, TypeError):
                        pass
                elif acao_data.get("action_type") == 7:
                    try:
                        # O target_guid de um grupo é o ID do AMBIENTE
                        ambiente_id_grupo = int(acao_data.get("target_guid"))
                        # Pegar todos os circuitos daquele ambiente
                        circs_no_grupo = Circuito.query.filter_by(ambiente_id=ambiente_id_grupo).all()
                        for c in circs_no_grupo:
                            if c.tipo != 'hvac': # Ignorar HVAC na validação
                                all_circuit_ids.add(c.id)
                    except (ValueError, TypeError):
                        pass

            if all_circuit_ids:
                circuits = Circuito.query.filter(Circuito.id.in_(list(all_circuit_ids))).all()
                if any(c.tipo != 'persiana' for c in circuits):
                    return jsonify({"ok": False, "error": "Movimentadores de cena só podem ser habilitados se todos os itens da cena forem persianas."}), 400

        # Validação para não permitir circuitos HVAC
        for acao_data in acoes_data:
            if acao_data.get("action_type") == 0:
                try:
                    circuito_id = int(acao_data.get("target_guid"))
                    circuito = db.session.get(Circuito, circuito_id)
                    if circuito and circuito.tipo == 'hvac':
                        return jsonify({"ok": False, "error": "Não é permitido adicionar circuitos do tipo HVAC em cenas de iluminação."}), 400
                except (ValueError, TypeError):
                    pass

        # Validação para não permitir circuitos duplicados
        circuit_guids_in_scene = [
            acao.get("target_guid") for acao in acoes_data
            if acao.get("action_type") == 0 and acao.get("target_guid")
        ]
        if len(circuit_guids_in_scene) != len(set(circuit_guids_in_scene)):
            return jsonify({"ok": False, "error": "Não é permitido adicionar o mesmo circuito mais de uma vez na mesma cena."}), 400

        # Limpar ações antigas
        for acao in cena.acoes:
            CustomAcao.query.filter_by(acao_id=acao.id).delete()
        Acao.query.filter_by(cena_id=cena.id).delete()

        # Adicionar novas ações
        for acao_data in acoes_data:
            nova_acao = Acao(
                cena_id=cena.id,
                level=acao_data.get("level", 100),
                action_type=acao_data.get("action_type", 0),
                target_guid=acao_data.get("target_guid")
            )
            if not nova_acao.target_guid:
                continue
            db.session.add(nova_acao)
            db.session.flush()

            for custom_acao_data in acao_data.get("custom_acoes", []):
                novo_custom_acao = CustomAcao(
                    acao_id=nova_acao.id,
                    target_guid=custom_acao_data.get("target_guid"),
                    enable=custom_acao_data.get("enable", True),
                    level=custom_acao_data.get("level", 50)
                )
                if not novo_custom_acao.target_guid:
                    continue
                db.session.add(novo_custom_acao)

    try:
        db.session.commit()
    except IntegrityError as e:
        db.session.rollback()
        if "unique_cena_por_ambiente" in str(e.orig):
            return jsonify({"ok": False, "error": "Já existe uma cena com este nome neste ambiente."}), 409
        return jsonify({"ok": False, "error": "Não foi possível atualizar a cena."}), 400

    db.session.refresh(cena)
    return jsonify({"ok": True, "cena": serialize_cena(cena)})

@app.delete("/api/cenas/<int:cena_id>")
@login_required
def delete_cena(cena_id):
    projeto_id = session.get("projeto_atual_id")
    cena = db.get_or_404(Cena, cena_id)
    if not projeto_id or cena.ambiente.area.projeto_id != projeto_id:
        return jsonify({"ok": False, "error": "Cena não encontrada no projeto atual."}), 404

    db.session.delete(cena)
    db.session.commit()

    return jsonify({"ok": True})


@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def spa_catch_all(path):
    # Não intercepta APIs ou arquivos estáticos
    if path.startswith("api/") or path.startswith("static/") or path.startswith("exportar-pdf/"):
        abort(404)
    return send_from_directory(app.static_folder, "index.html")


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
