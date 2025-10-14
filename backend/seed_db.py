#!/usr/bin/env python3
"""
Script para popular o banco de dados com dados de exemplo
Execute: python seed_db.py
"""

import os
import sys
from datetime import datetime

# Adiciona o diretório atual ao path para importar os módulos
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app import app, db
from database import User, Projeto, Area, Ambiente, Circuito, Modulo, QuadroEletrico

def seed_database():
    """Popula o banco de dados com dados de exemplo"""
    
    with app.app_context():
        print("Iniciando seed do banco de dados...")
        
        # 1. Criar usuário admin se não existir
        admin_user = User.query.filter_by(username='admin').first()
        if not admin_user:
            admin_user = User(
                username='admin', 
                email='admin@empresa.com', 
                role='admin'
            )
            admin_user.set_password('admin123')
            db.session.add(admin_user)
            print("✓ Usuário admin criado")
        else:
            print("✓ Usuário admin já existe")
        
        # 2. Criar projeto de exemplo
        projeto_exemplo = Projeto.query.filter_by(nome='Projeto Residencial Exemplo').first()
        if not projeto_exemplo:
            projeto_exemplo = Projeto(
                nome='Projeto Residencial Exemplo',
                user_id=admin_user.id,
                status='ATIVO',
                data_criacao=datetime.utcnow(),
                data_ativo=datetime.utcnow()
            )
            db.session.add(projeto_exemplo)
            db.session.flush()  # Para obter o ID
            print("✓ Projeto exemplo criado")
        else:
            print("✓ Projeto exemplo já existe")
        
        # 3. Criar áreas
        areas_data = [
            {'nome': 'Térreo'},
            {'nome': '1º Andar'},
            {'nome': 'Área Externa'}
        ]
        
        areas = []
        for area_data in areas_data:
            area = Area.query.filter_by(nome=area_data['nome'], projeto_id=projeto_exemplo.id).first()
            if not area:
                area = Area(nome=area_data['nome'], projeto_id=projeto_exemplo.id)
                db.session.add(area)
                areas.append(area)
            else:
                areas.append(area)
        
        db.session.flush()
        print("✓ Áreas criadas")
        
        # 4. Criar ambientes
        ambientes_data = [
            {'nome': 'Sala de Estar', 'area_id': areas[0].id},
            {'nome': 'Cozinha', 'area_id': areas[0].id},
            {'nome': 'Quarto Master', 'area_id': areas[1].id},
            {'nome': 'Varanda', 'area_id': areas[2].id}
        ]
        
        ambientes = []
        for ambiente_data in ambientes_data:
            ambiente = Ambiente.query.filter_by(
                nome=ambiente_data['nome'], 
                area_id=ambiente_data['area_id']
            ).first()
            if not ambiente:
                ambiente = Ambiente(
                    nome=ambiente_data['nome'], 
                    area_id=ambiente_data['area_id']
                )
                db.session.add(ambiente)
                ambientes.append(ambiente)
            else:
                ambientes.append(ambiente)
        
        db.session.flush()
        print("✓ Ambientes criados")
        
        # 5. Criar quadros elétricos
        quadro_terreo = QuadroEletrico.query.filter_by(
            nome='Quadro Térreo', 
            ambiente_id=ambientes[0].id
        ).first()
        if not quadro_terreo:
            quadro_terreo = QuadroEletrico(
                nome='Quadro Térreo',
                ambiente_id=ambientes[0].id,
                projeto_id=projeto_exemplo.id,
                notes='Quadro principal do térreo'
            )
            db.session.add(quadro_terreo)
        
        quadro_andar = QuadroEletrico.query.filter_by(
            nome='Quadro 1º Andar', 
            ambiente_id=ambientes[2].id
        ).first()
        if not quadro_andar:
            quadro_andar = QuadroEletrico(
                nome='Quadro 1º Andar',
                ambiente_id=ambientes[2].id,
                projeto_id=projeto_exemplo.id,
                notes='Quadro do primeiro andar'
            )
            db.session.add(quadro_andar)
        
        db.session.flush()
        print("✓ Quadros elétricos criados")
        
        # 6. Criar módulos
        modulos_data = [
            {'nome': 'Módulo Luz Sala', 'tipo': 'RL12', 'quadro_id': quadro_terreo.id},
            {'nome': 'Módulo Persianas', 'tipo': 'LX4', 'quadro_id': quadro_terreo.id},
            {'nome': 'Módulo Dimerizável', 'tipo': 'DIM8', 'quadro_id': quadro_andar.id}
        ]
        
        for modulo_data in modulos_data:
            modulo = Modulo.query.filter_by(
                nome=modulo_data['nome'], 
                projeto_id=projeto_exemplo.id
            ).first()
            if not modulo:
                info = app.config.get('MODULO_INFO', {}).get(modulo_data['tipo'], {})
                modulo = Modulo(
                    nome=modulo_data['nome'],
                    tipo=modulo_data['tipo'],
                    quantidade_canais=info.get('canais', 4),
                    projeto_id=projeto_exemplo.id,
                    hsnet=None,  # Será preenchido automaticamente
                    dev_id=None,
                    quadro_eletrico_id=modulo_data['quadro_id']
                )
                db.session.add(modulo)
        
        print("✓ Módulos criados")
        
        # 7. Criar circuitos de exemplo
        circuitos_data = [
            # Sala de Estar
            {'identificador': 'SL-01', 'nome': 'Luz Principal', 'tipo': 'luz', 'dimerizavel': True, 'potencia': 100, 'ambiente_id': ambientes[0].id},
            {'identificador': 'SL-02', 'nome': 'Spotlight TV', 'tipo': 'luz', 'dimerizavel': False, 'potencia': 50, 'ambiente_id': ambientes[0].id},
            {'identificador': 'SL-03', 'nome': 'Persiana Janela', 'tipo': 'persiana', 'dimerizavel': False, 'potencia': 0, 'ambiente_id': ambientes[0].id},
            
            # Cozinha
            {'identificador': 'CZ-01', 'nome': 'Luz Central', 'tipo': 'luz', 'dimerizavel': False, 'potencia': 80, 'ambiente_id': ambientes[1].id},
            {'identificador': 'CZ-02', 'nome': 'Ar Condicionado', 'tipo': 'hvac', 'dimerizavel': False, 'potencia': 1500, 'ambiente_id': ambientes[1].id},
            
            # Quarto Master
            {'identificador': 'QM-01', 'nome': 'Luz Dimerizável', 'tipo': 'luz', 'dimerizavel': True, 'potencia': 60, 'ambiente_id': ambientes[2].id},
            {'identificador': 'QM-02', 'nome': 'Luz Leitura', 'tipo': 'luz', 'dimerizavel': True, 'potencia': 40, 'ambiente_id': ambientes[2].id},
        ]
        
        for circuito_data in circuitos_data:
            circuito = Circuito.query.filter_by(
                identificador=circuito_data['identificador'],
                ambiente_id=circuito_data['ambiente_id']
            ).first()
            if not circuito:
                circuito = Circuito(
                    identificador=circuito_data['identificador'],
                    nome=circuito_data['nome'],
                    tipo=circuito_data['tipo'],
                    dimerizavel=circuito_data['dimerizavel'],
                    potencia=circuito_data['potencia'],
                    ambiente_id=circuito_data['ambiente_id'],
                    sak=None,  # Será gerado automaticamente
                    quantidade_saks=2 if circuito_data['tipo'] == 'persiana' else 1
                )
                db.session.add(circuito)
        
        print("✓ Circuitos criados")
        
        # Commit final
        try:
            db.session.commit()
            print("✅ Seed concluído com sucesso!")
            print("\nDados criados:")
            print(f"- 1 projeto: {projeto_exemplo.nome}")
            print(f"- {len(areas)} áreas")
            print(f"- {len(ambientes)} ambientes") 
            print(f"- 2 quadros elétricos")
            print(f"- 3 módulos")
            print(f"- {len(circuitos_data)} circuitos")
            print(f"\nCredenciais de acesso:")
            print(f"- Usuário: admin")
            print(f"- Senha: admin123")
            
        except Exception as e:
            db.session.rollback()
            print(f"❌ Erro durante o seed: {e}")
            return False
    
    return True

if __name__ == '__main__':
    seed_database()