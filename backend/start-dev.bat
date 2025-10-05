@echo off
echo 🚀 Iniciando ambiente de desenvolvimento Roehn...

:: Verificar se Python está instalado
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Python não encontrado. Por favor, instale Python 3.8 ou superior.
    pause
    exit /b 1
)

:: Verificar se o venv existe, se não, criar
if not exist "venv" (
    echo 📦 Criando ambiente virtual...
    python -m venv venv
)

:: Ativar o ambiente virtual
echo 🔧 Ativando ambiente virtual...
call venv\Scripts\activate.bat

:: Instalar/atualizar dependências
echo 📚 Instalando dependências...
python -m pip install --upgrade pip
pip install -r requirements.txt

:: Executar seed do banco de dados
echo 🌱 Populando banco de dados com dados de exemplo...
python seed_db.py

:: Verificar se o banco foi criado
if not exist "instance\projetos.db" (
    echo ❌ Banco de dados não foi criado corretamente.
    pause
    exit /b 1
)

echo ✅ Ambiente configurado com sucesso!
echo.
echo 📊 Dados de exemplo incluídos:
echo    - Projeto: 'Projeto Residencial Exemplo'
echo    - Áreas: Térreo, 1º Andar, Área Externa
echo    - Ambientes: Sala de Estar, Cozinha, Quarto Master, Varanda
echo    - Circuitos: Luzes, Persianas, HVAC
echo.
echo 🔑 Credenciais de acesso:
echo    - Usuário: admin
echo    - Senha: admin123
echo.
echo 🌐 Iniciando servidor Flask...
echo    Acesse: http://localhost:5000
echo.
echo ⏹️  Para parar o servidor: Ctrl+C
echo.

:: Iniciar o servidor Flask
python app.py

pause