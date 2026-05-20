@echo off
title SIGT - Simulation SUMO
echo ==================================================
echo   DEMARRAGE DE LA SIMULATION TRAFIC SUMO
echo ==================================================
echo.

:: Vérification si Python est installé
where python >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERREUR] Python n'est pas installe ou n'est pas dans le PATH.
    echo Veuillez installer Python 3 et cocher "Add Python to PATH".
    echo.
    pause
    exit /b
)

:: Vérification de la variable SUMO_HOME
if "%SUMO_HOME%"=="" (
    echo [ERREUR] La variable d'environnement SUMO_HOME n'est pas configuree.
    echo Veuillez installer SUMO et configurer SUMO_HOME.
    echo Exemple de chemin standard : C:\Program Files (x86)\Eclipse\Sumo
    echo.
    pause
    exit /b
)

echo [OK] SUMO trouve a l'adresse : %SUMO_HOME%
echo.

echo [1/2] Verification et installation des librairies Python...
pip install -r requirements.txt

echo.
echo [2/2] Lancement du connecteur de trafic (sumo_bridge.py)...
echo.
python sumo_bridge.py
pause
