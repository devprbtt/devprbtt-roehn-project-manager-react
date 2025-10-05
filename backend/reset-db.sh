#!/bin/bash

# Script para resetar o banco de dados
# Uso: ./reset-db.sh

echo "🗑️  Resetando banco de dados..."

# Ativar ambiente virtual se existir
if [ -d "venv" ]; then
    source venv/bin/activate
fi

# Remover banco de dados existente
if [ -f "instance/projetos.db" ]; then
    rm instance/projetos.db
    echo "✓ Banco de dados removido"
fi

# Recriar banco
python -c "
from app import app, db
with app.app_context():
    db.create_all()
    print('✓ Tabelas recriadas')
"

# Executar seed
python seed_db.py

echo "✅ Reset concluído!"