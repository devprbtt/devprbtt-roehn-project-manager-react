#!/bin/bash

# Script para iniciar o ambiente de desenvolvimento
# Uso: ./start-dev.sh ou bash start-dev.sh

# Script para iniciar o ambiente de desenvolvimento
# Uso: ./start-dev.sh ou bash start-dev.sh

set -e # Para em caso de erro

echo "🚀 Iniciando ambiente de desenvolvimento Roehn..."

# Verificar se Python está instalado
if ! command -v python3 &> /dev/null; then
    echo "❌ Python3 não encontrado. Por favor, instale Python 3.8 ou superior."
    exit 1
fi

# Verificar se o venv existe, se não, criar
if [ ! -d "venv" ]; then
    echo "📦 Criando ambiente virtual..."
    python3 -m venv venv
fi

# Ativar o ambiente virtual
echo "🔧 Ativando ambiente virtual..."
source venv/bin/activate

# Instalar/atualizar dependências
echo "📚 Instalando dependências..."
set +e # Desativa o modo de erro para o pip
pip install --upgrade pip
pip install -r requirements.txt
set -e # Reativa o modo de erro

# Popular o banco de dados
python seed_db.py

# Verificar se o diretório da instância existe
if [ ! -d "instance" ]; then
    mkdir -p instance
fi

echo "✅ Ambiente configurado com sucesso!"
echo ""
echo "📊 Dados de exemplo incluídos:"
echo "   - Projeto: 'Projeto Residencial Exemplo'"
echo "   - Áreas: Térreo, 1º Andar, Área Externa"
echo "   - Ambientes: Sala de Estar, Cozinha, Quarto Master, Varanda"
echo "   - Circuitos: Luzes, Persianas, HVAC"
echo ""
echo "🔑 Credenciais de acesso:"
echo "   - Usuário: admin"
echo "   - Senha: admin123"
echo ""
echo "🌐 Iniciando servidor Flask..."
echo "   Acesse: http://localhost:5000"
echo ""
echo "⏹️  Para parar o servidor: Ctrl+C"
echo ""

# Iniciar o servidor Flask
python app.py