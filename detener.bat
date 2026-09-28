@echo off
title JustFood - Detener Servidor
cd /d "%~dp0"

echo ===================================================
echo        DETENIENDO SERVIDOR JUSTFOOD (:3010)
echo ===================================================
echo.

setlocal enabledelayedexpansion
set found=0

for /f "tokens=5" %%a in ('netstat -aon ^| findstr /R /C:":3010 " ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>nul
    set found=1
)

if "!found!"=="1" (
    echo [OK] El servidor ha sido detenido exitosamente.
) else (
    echo [INFO] No habia ningun servidor activo en el puerto 3010.
)

echo.
echo [INFO] Postgres local sigue corriendo en Docker (para pararlo tambien: docker compose stop)
echo.
timeout /t 4 /nobreak >nul
