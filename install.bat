@echo off
setlocal enabledelayedexpansion

echo ========================================
echo  Asset Metadata Tool - Installer
echo ========================================
echo.

REM Check if Node.js is installed
echo [1/5] Checking for Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Node.js is not installed.
    echo.
    echo Downloading Node.js installer...
    
    REM Download Node.js LTS installer
    powershell -Command "& {Invoke-WebRequest -Uri 'https://nodejs.org/dist/v20.11.0/node-v20.11.0-x64.msi' -OutFile '%TEMP%\nodejs-installer.msi'}"
    
    if %errorlevel% neq 0 (
        echo Failed to download Node.js installer.
        echo Please download manually from: https://nodejs.org/
        pause
        exit /b 1
    )
    
    echo Installing Node.js... (This may take a few minutes)
    echo Please follow the installer prompts.
    msiexec /i "%TEMP%\nodejs-installer.msi" /qn /norestart
    
    if %errorlevel% neq 0 (
        echo Installation may require administrator privileges.
        echo Opening installer with prompts...
        msiexec /i "%TEMP%\nodejs-installer.msi"
    )
    
    echo.
    echo Node.js installed! Please restart this script.
    echo Close this window and run install.bat again.
    pause
    exit /b 0
) else (
    for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
    echo Node.js !NODE_VERSION! is installed. ✓
)

echo.
echo [2/5] Installing npm dependencies...
call npm install
if %errorlevel% neq 0 (
    echo Failed to install dependencies.
    pause
    exit /b 1
)
echo Dependencies installed. ✓

echo.
echo [3/5] Building React application...
call npm run build
if %errorlevel% neq 0 (
    echo Build failed.
    pause
    exit /b 1
)
echo Build completed. ✓

echo.
echo [4/5] Packaging Electron application...
call npm run package
if %errorlevel% neq 0 (
    echo Packaging failed.
    pause
    exit /b 1
)
echo Packaging completed. ✓

echo.
echo [5/5] Verifying executable...
if exist "dist-packaged\AssetMetadataTool-win32-x64\AssetMetadataTool.exe" (
    echo.
    echo ========================================
    echo  Installation Complete! ✓
    echo ========================================
    echo.
    echo Executable location:
    echo %CD%\dist-packaged\AssetMetadataTool-win32-x64\AssetMetadataTool.exe
    echo.
) else (
    echo Executable not found. Something went wrong.
    pause
    exit /b 1
)

echo.
choice /C YN /M "Do you want to launch the application now"
if errorlevel 2 goto :end
if errorlevel 1 goto :launch

:launch
echo Starting Asset Metadata Tool...
start "" "dist-packaged\AssetMetadataTool-win32-x64\AssetMetadataTool.exe"
goto :end

:end
endlocal
