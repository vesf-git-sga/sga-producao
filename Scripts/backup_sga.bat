@echo off
setlocal enableextensions

:: ================= CONFIGURAÇÕES DO BANCO =================
set PG_HOST=localhost
set PG_PORT=5432
set PG_USER=postgres
set PG_DBNAME=sga_db
set "PGPASSWORD=Dm45d38($)"

:: ================= CONFIGURAÇÃO DO ARQUIVO =================
set BACKUP_DIR=C:\SGA_Backups
set RETENTION_DAYS=7

:: ================= CORREÇÃO FATAL: CAMINHO EXATO DO PRINT =================
:: Caminho apontando para a pasta 'Arquivos de Programas' e versão 17
set "PG_BIN=C:\Arquivos de Programas\PostgreSQL\17\bin\pg_dump.exe"

:: ================= DATA E HORA (POWERSHELL) =================
for /f %%a in ('powershell -Command "Get-Date -format yyyy-MM-dd_HHmm"') do set DATETIME=%%a
set FILENAME=backup_%PG_DBNAME%_%DATETIME%

:: ================= INÍCIO DO PROCESSO =================
:: Cria a pasta de backup se não existir
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"

echo.
echo [INFO] Iniciando Backup do SGA...
echo [DATA] %DATETIME%
echo [DEST] "%BACKUP_DIR%\%FILENAME%.backup"

:: Validação do Caminho com Aspas (Correção do erro anterior)
if not exist "%PG_BIN%" (
    echo.
    echo [ERRO FATAL] O arquivo pg_dump.exe NAO foi encontrado.
    echo Caminho tentado: "%PG_BIN%"
    echo.
    echo Verifique se a pasta e 'Arquivos de Programas' ou 'Program Files'.
    echo Verifique se a versao do Postgres e 17 ou outra.
    echo.
    pause
    exit /b 1
)

:: Executa o Backup
"%PG_BIN%" -h %PG_HOST% -p %PG_PORT% -U %PG_USER% -F c -b -v -f "%BACKUP_DIR%\%FILENAME%.backup" %PG_DBNAME%

if %ERRORLEVEL% equ 0 (
    echo.
    echo [SUCESSO] Backup realizado com sucesso!
) else (
    echo.
    echo [ERRO] O backup falhou. Codigo de erro: %ERRORLEVEL%
    pause
    exit /b %ERRORLEVEL%
)

:: Limpeza de arquivos antigos
echo.
echo [LIMPEZA] Verificando arquivos com mais de %RETENTION_DAYS% dias...
forfiles /p "%BACKUP_DIR%" /s /m *.backup /d -%RETENTION_DAYS% /c "cmd /c del @path" 2>nul

echo [FIM] Processo finalizado.
timeout /t 5
endlocal