@echo off
echo 🗑️  Resetando banco de dados...

:: Ativar ambiente virtual se existir
if exist "venv" (
    call venv\Scripts\activate.bat
)

:: Remover banco de dados existente
if exist "instance\projetos.db" (
    del instance\projetos.db
    echo ✓ Banco de dados removido
)

:: Recriar banco
python -c "from app import app, db; app.app_context().push(); db.create_all(); print('✓ Tabelas recriadas')"

:: Executar seed
python seed_db.py

echo ✅ Reset concluído!
pause