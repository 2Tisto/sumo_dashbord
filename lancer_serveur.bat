@echo off
title SIGT - Serveur Web
echo ==================================================
echo   DEMARRAGE DU TABLEAU DE BORD SIGT COTONOU
echo ==================================================
echo.

:: Vérification si Node.js est installé
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERREUR] Node.js n'est pas installe sur cette machine.
    echo Veuillez installer Node.js (LTS) depuis https://nodejs.org/
    echo.
    pause
    exit /b
)

echo [1/2] Installation/Verification des dependances Node.js...
call npm install

echo.
echo [2/2] Lancement du serveur...
echo L'interface sera accessible sur : http://localhost:3000
echo.
call npm start
pause
