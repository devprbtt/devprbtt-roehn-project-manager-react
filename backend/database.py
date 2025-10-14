
from flask_sqlalchemy import SQLAlchemy
from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash
import uuid

db = SQLAlchemy()


class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(128))
    role = db.Column(db.String(20), default='user')  # admin, user

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)


# database.py
class Projeto(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    nome = db.Column(db.String(100), nullable=False, unique=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    status = db.Column(db.String(20), nullable=False, default='ATIVO')  # <--- NOVO

    # Novas colunas de data
    data_criacao = db.Column(db.DateTime, nullable=False, default=db.func.now())
    data_ativo = db.Column(db.DateTime, nullable=True)
    data_inativo = db.Column(db.DateTime, nullable=True)
    data_concluido = db.Column(db.DateTime, nullable=True)

    areas = db.relationship('Area', backref='projeto', lazy=True, cascade='all, delete-orphan')
    modulos = db.relationship('Modulo', backref='projeto', lazy=True, cascade='all, delete-orphan')
    keypads = db.relationship('Keypad', backref='projeto', lazy=True, cascade='all, delete-orphan')



class Area(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    nome = db.Column(db.String(100), nullable=False)
    projeto_id = db.Column(db.Integer, db.ForeignKey('projeto.id'), nullable=False)
    ambientes = db.relationship('Ambiente', backref='area', lazy=True, cascade='all, delete-orphan')

    __table_args__ = (db.UniqueConstraint('nome', 'projeto_id', name='unique_area_por_projeto'),)


class Ambiente(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    nome = db.Column(db.String(100), nullable=False)
    area_id = db.Column(db.Integer, db.ForeignKey('area.id'), nullable=False)
    circuitos = db.relationship('Circuito', backref='ambiente', lazy=True, cascade='all, delete-orphan')
    keypads = db.relationship('Keypad', backref='ambiente', lazy=True, cascade='all, delete-orphan')
    quadros_eletricos = db.relationship('QuadroEletrico', backref='ambiente', lazy=True, cascade='all, delete-orphan')
    cenas = db.relationship('Cena', backref='ambiente', lazy=True, cascade='all, delete-orphan')

    __table_args__ = (db.UniqueConstraint('nome', 'area_id', name='unique_ambiente_por_area'),)

class QuadroEletrico(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    nome = db.Column(db.String(100), nullable=False)
    notes = db.Column(db.Text, nullable=True)
    ambiente_id = db.Column(db.Integer, db.ForeignKey('ambiente.id'), nullable=False)
    projeto_id = db.Column(db.Integer, db.ForeignKey('projeto.id'), nullable=False)
    
    # Relacionamentos
    modulos = db.relationship('Modulo', backref='quadro_eletrico', lazy=True, cascade='all, delete-orphan')
    
    __table_args__ = (
        db.UniqueConstraint('nome', 'ambiente_id', name='unique_quadro_por_ambiente'),
    )

class Circuito(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    identificador = db.Column(db.String(50), nullable=False)
    nome = db.Column(db.String(100), nullable=False)
    tipo = db.Column(db.String(50), nullable=False)
    dimerizavel = db.Column(db.Boolean, nullable=False, default=False)
    potencia = db.Column(db.Float, nullable=False, default=0.0)  # NOVO CAMPO
    ambiente_id = db.Column(db.Integer, db.ForeignKey('ambiente.id'), nullable=False)
    sak = db.Column(db.Integer, nullable=True)
    quantidade_saks = db.Column(db.Integer, default=1)
    vinculacao = db.relationship('Vinculacao', backref='circuito', uselist=False, cascade='all, delete-orphan')
    keypad_buttons = db.relationship('KeypadButton', backref='circuito', lazy=True)

    __table_args__ = (db.UniqueConstraint('identificador', 'ambiente_id', name='unique_circuito_por_ambiente'),)
    
class Modulo(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    nome = db.Column(db.String(100), nullable=False)
    tipo = db.Column(db.String(50), nullable=False)
    quantidade_canais = db.Column(db.Integer, nullable=False)
    projeto_id = db.Column(db.Integer, db.ForeignKey('projeto.id'), nullable=False)
    hsnet = db.Column(db.Integer, nullable=True)
    dev_id = db.Column(db.Integer, nullable=True)
    quadro_eletrico_id = db.Column(db.Integer, db.ForeignKey('quadro_eletrico.id'), nullable=True)  # NOVO CAMPO
    vinculacoes = db.relationship('Vinculacao', backref='modulo', lazy=True, cascade='all, delete-orphan')

    __table_args__ = (db.UniqueConstraint('nome', 'projeto_id', name='unique_modulo_por_projeto'),)

class Vinculacao(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    circuito_id = db.Column(db.Integer, db.ForeignKey('circuito.id'), nullable=False, unique=True)
    modulo_id = db.Column(db.Integer, db.ForeignKey('modulo.id'), nullable=False)
    canal = db.Column(db.Integer, nullable=False)

    __table_args__ = (db.UniqueConstraint('modulo_id', 'canal', name='unique_canal_por_modulo'),)


class Keypad(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    nome = db.Column(db.String(100), nullable=False)
    modelo = db.Column(db.String(50), nullable=False, default='RQR-K')
    color = db.Column(db.String(20), nullable=False, default='WHITE')
    button_color = db.Column(db.String(20), nullable=False, default='WHITE')
    button_count = db.Column(db.Integer, nullable=False, default=4)
    hsnet = db.Column(db.Integer, nullable=False)
    dev_id = db.Column(db.Integer, nullable=True)
    ambiente_id = db.Column(db.Integer, db.ForeignKey('ambiente.id'), nullable=False)
    projeto_id = db.Column(db.Integer, db.ForeignKey('projeto.id'), nullable=False)
    notes = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, server_default=db.func.now())
    updated_at = db.Column(db.DateTime, server_default=db.func.now(), onupdate=db.func.now())

    buttons = db.relationship('KeypadButton', backref='keypad', lazy=True, cascade='all, delete-orphan')

    __table_args__ = (
        db.UniqueConstraint('ambiente_id', 'nome', name='unique_keypad_nome_por_ambiente'),
        db.UniqueConstraint('hsnet', 'projeto_id', name='unique_keypad_hsnet_por_projeto'),
    )


class KeypadButton(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    keypad_id = db.Column(db.Integer, db.ForeignKey('keypad.id'), nullable=False)
    ordem = db.Column(db.Integer, nullable=False)
    engraver_text = db.Column(db.String(7), nullable=True)
    icon = db.Column(db.String(50), nullable=True)
    rocker_style = db.Column(db.String(50), nullable=True, default='up-down')
    guid = db.Column(db.String(36), nullable=False, default=lambda: str(uuid.uuid4()))
    circuito_id = db.Column(db.Integer, db.ForeignKey('circuito.id', ondelete='SET NULL'), nullable=True)
    cena_id = db.Column(db.Integer, db.ForeignKey('cena.id', ondelete='SET NULL'), nullable=True)
    modo = db.Column(db.Integer, nullable=False, default=3)
    command_on = db.Column(db.Integer, nullable=False, default=0)
    command_off = db.Column(db.Integer, nullable=False, default=0)
    can_hold = db.Column(db.Boolean, nullable=False, default=False)
    is_rocker = db.Column(db.Boolean, nullable=False, default=False)
    modo_double_press = db.Column(db.Integer, nullable=False, default=3)
    command_double_press = db.Column(db.Integer, nullable=False, default=0)
    target_object_guid = db.Column(db.String(36), nullable=False, default='00000000-0000-0000-0000-000000000000')
    notes = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, server_default=db.func.now())
    updated_at = db.Column(db.DateTime, server_default=db.func.now(), onupdate=db.func.now())

    cena = db.relationship('Cena', backref='keypad_buttons', lazy=True)

    __table_args__ = (
        db.UniqueConstraint('keypad_id', 'ordem', name='unique_keypad_button_ordem'),
        db.UniqueConstraint('guid', name='unique_keypad_button_guid'),
    )


class Cena(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    guid = db.Column(db.String(36), unique=True, nullable=False, default=lambda: str(uuid.uuid4()))
    nome = db.Column(db.String(100), nullable=False)
    ambiente_id = db.Column(db.Integer, db.ForeignKey('ambiente.id'), nullable=False)
    scene_movers = db.Column(db.Boolean, nullable=False, default=False)
    acoes = db.relationship('Acao', backref='cena', lazy=True, cascade='all, delete-orphan')

    __table_args__ = (db.UniqueConstraint('nome', 'ambiente_id', name='unique_cena_por_ambiente'),)


class Acao(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    cena_id = db.Column(db.Integer, db.ForeignKey('cena.id'), nullable=False)
    level = db.Column(db.Integer, nullable=False, default=100)
    action_type = db.Column(db.Integer, nullable=False, default=0)  # 0: Circuit, 7: Group
    target_guid = db.Column(db.String(36), nullable=False)
    custom_acoes = db.relationship('CustomAcao', backref='acao', lazy=True, cascade='all, delete-orphan')


class CustomAcao(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    acao_id = db.Column(db.Integer, db.ForeignKey('acao.id'), nullable=False)
    target_guid = db.Column(db.String(36), nullable=False)  # GUID of the circuit inside the group
    enable = db.Column(db.Boolean, nullable=False, default=True)
    level = db.Column(db.Integer, nullable=False, default=50)

    __table_args__ = (db.UniqueConstraint('acao_id', 'target_guid', name='unique_custom_acao'),)
