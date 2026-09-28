@echo off
title JustFood - Servidor Local
cd /d "%~dp0"

echo ===================================================
echo           JUSTFOOD - SERVIDOR LOCAL
echo ===================================================
echo.

:: Verificar si Node.js esta instalado
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] No se encontro Node.js en el sistema.
    echo Por favor instala Node.js desde https://nodejs.org
    echo.
    pause
    exit /b 1
)

:: Verificar si el puerto 3010 ya esta en uso (solo LISTENING -- una
:: conexion vieja en TIME_WAIT tambien matchea ":3010 " y daria un falso positivo)
netstat -ano | findstr /R /C:":3010 " | findstr "LISTENING" >nul 2>nul
if %errorlevel% equ 0 (
    echo [INFO] El servidor ya se encuentra corriendo en el puerto 3010.
    echo Abriendo JustFood en el navegador...
    start http://localhost:3010
    echo.
    echo Puedes cerrar esta ventana.
    timeout /t 5 /nobreak >nul
    exit /b 0
)

:: Verificar Docker (hace falta para Postgres local)
where docker >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] No se encontro Docker en el sistema.
    echo JustFood necesita Docker Desktop para levantar Postgres local.
    echo Instalalo desde https://www.docker.com/products/docker-desktop
    echo.
    pause
    exit /b 1
)

docker info >nul 2>nul
if %errorlevel% equ 0 goto docker_listo

echo [INFO] Docker Desktop no esta corriendo. Iniciandolo...
start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
echo Esperando a que el motor de Docker arranque, puede tardar un minuto...

:esperar_docker
timeout /t 5 /nobreak >nul
docker info >nul 2>nul
if errorlevel 1 goto esperar_docker

:docker_listo
echo [OK] Docker listo.

:: Levantar Postgres local (puerto 5434, no pisa otros proyectos)
echo [INFO] Levantando Postgres local...
docker compose up -d
if errorlevel 1 (
    echo [ERROR] No se pudo levantar Postgres. Revisa docker-compose.yml
    echo.
    pause
    exit /b 1
)
echo [OK] Postgres listo en el puerto 5434.

:: Verificar dependencias si hicieran falta
if not exist "node_modules" (
    echo [INFO] Instalando dependencias necesarias, esto puede tardar unos minutos...
    call npm install
    echo.
)

:: Verificar .env
if not exist ".env" (
    echo [INFO] Creando .env desde .env.example...
    copy ".env.example" ".env" >nul
)

:: Sincronizar el schema de la base y sembrar datos base (todo idempotente)
echo [INFO] Preparando la base de datos...
call npx prisma generate
call npx prisma db push --accept-data-loss
call npm run db:seed

:: Actualizar el catalogo/pedidos de PizzaZeka si hay una copia disponible
if exist "..\PizzaZeka\data.sqlite" (
    echo [INFO] Actualizando datos de PizzaZeka: productos, pedidos, etc...
    if not exist "scripts\data" mkdir "scripts\data"
    copy /y "..\PizzaZeka\data.sqlite" "scripts\data\pizzazeka-snapshot.sqlite" >nul
    call npm run etl:pizzazeka
)
echo [OK] Base de datos lista.
echo.

echo [OK] Iniciando servidor en el puerto 3010...
echo.
echo  * Panel JustFood:    http://localhost:3010
echo  * Login:             restaurante "pizzazeka", usuario "admin", contrasena "changeme123"
echo.
echo Abriendo JustFood en tu navegador...
echo Para detener el servidor, simplemente cierra esta ventana (o corre detener.bat).
echo ===================================================
echo.

:: Abrir navegador automaticamente tras unos segundos (el servidor tarda en levantar)
start "" cmd /c "timeout /t 6 /nobreak >nul && start http://localhost:3010"

:: Iniciar servidor (custom server.ts con Next + Socket.IO)
call npm run dev

pause
