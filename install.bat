@echo off
setlocal enabledelayedexpansion

echo ========================================
echo  Asset Metadata Tool - Installer
echo ========================================
echo.

REM Check if executable already exists (quick launch mode)
if exist "dist-packaged\AssetMetadataTool-win32-x64\AssetMetadataTool.exe" (
    echo Application is already built.
    echo.
    choice /C YN /M "Do you want to launch the application now"
    if errorlevel 2 goto :end
    if errorlevel 1 (
        echo Starting Asset Metadata Tool...
        start "" "dist-packaged\AssetMetadataTool-win32-x64\AssetMetadataTool.exe"
        goto :end
    )
)

REM Check if Node.js is installed
echo [1/5] Checking for Node.js...
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo Node.js is not installed.
    echo.
    echo Downloading Node.js installer...
    
    REM Download Node.js LTS installer
    powershell -Command "try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://nodejs.org/dist/v20.11.0/node-v20.11.0-x64.msi' -OutFile '%TEMP%\nodejs-installer.msi' } catch { exit 1 }"
    
    if %errorlevel% neq 0 (
        echo Failed to download Node.js installer.
        echo Please download manually from: https://nodejs.org/
        pause
        exit /b 1
    )
    
    echo Installing Node.js... (This may take a few minutes)
    echo Please follow the installer prompts.
    start /wait msiexec /i "%TEMP%\nodejs-installer.msi" /passive
    
    if %errorlevel% neq 0 (
        echo Installation failed or was cancelled.
        pause
        exit /b 1
    )
    
    REM Refresh environment variables
    echo.
    echo Node.js installed! Refreshing environment...
    echo.
    echo Please close this window and run install.bat again to continue.
    pause
    exit /b 0
) else (
    for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
    echo Node.js !NODE_VERSION! is installed. [OK]
)

REM Check for npm
where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo npm is not found. Node.js installation may be incomplete.
    echo Please close this window and run install.bat again.
    pause
    exit /b 1
)

echo.
echo [2/5] Installing npm dependencies...
call npm install
if %errorlevel% neq 0 (
    echo.
    echo Failed to install dependencies.
    echo Check your internet connection and try again.
    pause
    exit /b 1
)
echo Dependencies installed. [OK]

echo.
echo [3/5] Building React application...
call npm run build
if %errorlevel% neq 0 (
    echo.
    echo Build failed. Check the error messages above.
    pause
    exit /b 1
)
echo Build completed. [OK]

echo.
echo [4/5] Packaging Electron application...
call npm run package
if %errorlevel% neq 0 (
    echo.
    echo Packaging failed. Check the error messages above.
    pause
    exit /b 1
)
echo Packaging completed. [OK]

echo.
echo [5/5] Verifying executable...
if exist "dist-packaged\AssetMetadataTool-win32-x64\AssetMetadataTool.exe" (
    echo.
    echo ========================================
    echo  Installation Complete! [SUCCESS]
    echo ========================================
    echo.
    echo Executable location:
    echo %CD%\dist-packaged\AssetMetadataTool-win32-x64\AssetMetadataTool.exe
    echo.
    echo You can run install.bat anytime to launch the app.
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
timeout /t 2 >nul
goto :end

:end
endlocal
