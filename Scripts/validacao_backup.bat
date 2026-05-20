@echo off
setlocal enabledelayedexpansion

:: --- CONFIGURAÇÕES ---
:: AVISO: Use o caminho que retornou 'True' no Test-Path do PowerShell
set "PG_BIN=C:\Arquivos de Programas\PostgreSQL\17\bin"
set "BACKUP_DIR=C:\SGA_Backups"
set "LOG_FILE=%BACKUP_DIR%\validacao_log.txt"

echo === Verificacao iniciada em %date% %time% === >> "%LOG_FILE%"

:: 1. Verifica se o executável do PostgreSQL existe
if not exist "%PG_BIN%\pg_restore.exe" (
    echo [ERRO FATAL] O executavel pg_restore.exe nao foi encontrado em: >> "%LOG_FILE%"
    echo %PG_BIN% >> "%LOG_FILE%"
    goto :fim
)

:: 2. Verifica se a pasta de backup existe
if not exist "%BACKUP_DIR%" (
    echo [ERRO FATAL] A pasta de backups nao existe: %BACKUP_DIR% >> "%LOG_FILE%"
    goto :fim
)

:: 3. Identifica o backup mais recente
set "LATEST_BACKUP="
for /f "delims=" %%i in ('dir /b /o-d "%BACKUP_DIR%\*.backup"') do (
    if not defined LATEST_BACKUP set "LATEST_BACKUP=%BACKUP_DIR%\%%i"
)

if "%LATEST_BACKUP%"=="" (
    echo [ERRO] Nenhum arquivo .backup encontrado em %BACKUP_DIR% >> "%LOG_FILE%"
    goto :fim
)

echo Testando arquivo: %LATEST_BACKUP% >> "%LOG_FILE%"

:: 4. Comando de teste
"%PG_BIN%\pg_restore.exe" -l "%LATEST_BACKUP%" > nul 2>> "%LOG_FILE%"

if !errorlevel! equ 0 (
    echo [SUCESSO] Backup íntegro. >> "%LOG_FILE%"
) else (
    echo [ERRO] Falha na integridade do backup. Codigo de erro: !errorlevel! >> "%LOG_FILE%"
)

:fim
echo =========================================== >> "%LOG_FILE%"