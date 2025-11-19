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
    echo Downloading Node.js v20.11.0 LTS installer...
    echo This may take a few moments depending on your connection...
    echo.
    
    set "NODE_URL=https://nodejs.org/dist/v20.11.0/node-v20.11.0-x64.msi"
    set "NODE_INSTALLER=%TEMP%\nodejs-installer.msi"
    
    REM Try Method 1: curl (built into Windows 10+)
    echo [Method 1] Trying curl...
    curl -L -o "%NODE_INSTALLER%" "%NODE_URL%" 2>nul
    if %errorlevel% equ 0 (
        if exist "%NODE_INSTALLER%" (
            echo Download successful using curl! [OK]
            goto :install_node
        )
    )
    
    REM Try Method 2: PowerShell with enhanced settings
    echo [Method 2] Trying PowerShell...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "& { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; $ProgressPreference = 'SilentlyContinue'; try { Invoke-WebRequest -Uri '%NODE_URL%' -OutFile '%NODE_INSTALLER%' -UseBasicParsing -TimeoutSec 300; exit 0 } catch { exit 1 } }" >nul 2>&1
    if %errorlevel% equ 0 (
        if exist "%NODE_INSTALLER%" (
            echo Download successful using PowerShell! [OK]
            goto :install_node
        )
    )
    
    REM Try Method 3: bitsadmin (legacy but reliable)
    echo [Method 3] Trying bitsadmin...
    bitsadmin /transfer "NodeJSDownload" /download /priority FOREGROUND "%NODE_URL%" "%NODE_INSTALLER%" >nul 2>&1
    if %errorlevel% equ 0 (
        if exist "%NODE_INSTALLER%" (
            echo Download successful using bitsadmin! [OK]
            goto :install_node
        )
    )
    
    REM All methods failed
    echo.
    echo ========================================
    echo  Download Failed
    echo ========================================
    echo.
    echo Could not download Node.js automatically.
    echo All download methods failed. This could be due to:
    echo   - Network/firewall restrictions
    echo   - Proxy settings blocking downloads
    echo   - Internet connectivity issues
    echo   - Antivirus software blocking downloads
    echo.
    echo Please install Node.js manually:
    echo   1. Visit: https://nodejs.org/
    echo   2. Download Node.js v20.11.0 LTS ^(Windows Installer^)
    echo   3. Install it
    echo   4. Run this script again
    echo.
    pause
    exit /b 1
    
    :install_node
    echo.
    
    :install_node
    echo.
    echo Installing Node.js... (This may take a few minutes)
    echo Please wait for the installer to complete.
    start /wait msiexec /i "%NODE_INSTALLER%" /passive /norestart
    
    if %errorlevel% neq 0 (
        echo.
        echo Installation failed or was cancelled.
        echo Please try running this script as Administrator.
        pause
        exit /b 1
    )
    
    REM Refresh environment variables
    echo.
    echo Node.js installed successfully!
    echo.
    echo Please close this window and run install.bat again to continue.
    echo The PATH environment variable needs to be refreshed.
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
