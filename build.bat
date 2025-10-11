@echo off
REM HSM-TERA Build Script for Windows
REM This script builds the application for different platforms

setlocal enabledelayedexpansion

echo 🚀 HSM-TERA Build Script
echo =========================

REM Function to display usage
if "%1"=="help" goto :show_usage
if "%1"=="-h" goto :show_usage
if "%1"=="--help" goto :show_usage

REM Function to clean build directory
if "%1"=="clean" goto :clean_build

REM Function to check dependencies
call :check_dependencies
if errorlevel 1 exit /b 1

REM Function to install dependencies
call :install_dependencies
if errorlevel 1 exit /b 1

REM Main build logic
if "%1"=="mac" goto :build_mac
if "%1"=="win" goto :build_windows
if "%1"=="linux" goto :build_linux
if "%1"=="all" goto :build_all
if "%1"=="" goto :show_usage

echo ❌ Unknown platform: %1
echo.
goto :show_usage

:check_dependencies
echo 🔍 Checking dependencies...

where npm >nul 2>nul
if errorlevel 1 (
    echo ❌ npm is not installed or not in PATH
    exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
    echo ❌ node is not installed or not in PATH
    exit /b 1
)

echo ✅ Dependencies check passed
exit /b 0

:install_dependencies
echo 📦 Installing dependencies...
call npm install
if errorlevel 1 (
    echo ❌ Failed to install dependencies
    exit /b 1
)
echo ✅ Dependencies installed
exit /b 0

:build_mac
echo 🍎 Building for macOS...
echo ⚠️  Warning: Cross-compilation for macOS on Windows requires additional setup.
echo    Consider using GitHub Actions or a macOS machine for building.
call npm run build:mac
if errorlevel 1 (
    echo ❌ macOS build failed
    exit /b 1
)
echo ✅ macOS build completed
goto :show_results

:build_windows
echo 🪟 Building for Windows...
call npm run build:win
if errorlevel 1 (
    echo ❌ Windows build failed
    exit /b 1
)
echo ✅ Windows build completed
goto :show_results

:build_linux
echo 🐧 Building for Linux...
call npm run build:linux
if errorlevel 1 (
    echo ❌ Linux build failed
    exit /b 1
)
echo ✅ Linux build completed
goto :show_results

:build_all
echo 🌍 Building for all platforms...
call npm run build:all
if errorlevel 1 (
    echo ❌ All platforms build failed
    exit /b 1
)
echo ✅ All platforms build completed
goto :show_results

:clean_build
echo 🧹 Cleaning build directory...
if exist dist rmdir /s /q dist
echo ✅ Build directory cleaned
exit /b 0

:show_results
echo.
echo 📁 Build Results:
echo ==================
if exist dist (
    dir dist /b
    echo.
    echo 📊 Build sizes:
    for %%f in (dist\*) do (
        if exist "%%f" (
            echo %%f: 
            dir "%%f" /-c | find "bytes"
        )
    )
) else (
    echo ❌ No dist directory found
)
goto :end

:show_usage
echo Usage: %0 [platform]
echo.
echo Platforms:
echo   mac       - Build for macOS (DMG and ZIP)
echo   win       - Build for Windows (NSIS installer and portable)
echo   linux     - Build for Linux (AppImage and DEB)
echo   all       - Build for all platforms
echo   clean     - Clean build directory
echo.
echo Examples:
echo   %0 mac     # Build for macOS only
echo   %0 win     # Build for Windows only
echo   %0 all     # Build for all platforms
goto :end

:end
echo.
echo 🎉 Build process completed!
pause
