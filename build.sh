#!/bin/bash

# HSM-TERA Build Script
# This script builds the application for different platforms

set -e  # Exit on any error

echo "🚀 HSM-TERA Build Script"
echo "========================="

# Function to display usage
show_usage() {
    echo "Usage: $0 [platform]"
    echo ""
    echo "Platforms:"
    echo "  mac       - Build for macOS (DMG and ZIP)"
    echo "  win       - Build for Windows (NSIS installer and portable)"
    echo "  linux     - Build for Linux (AppImage and DEB)"
    echo "  all       - Build for all platforms"
    echo "  clean     - Clean build directory"
    echo ""
    echo "Examples:"
    echo "  $0 mac     # Build for macOS only"
    echo "  $0 win     # Build for Windows only"
    echo "  $0 all     # Build for all platforms"
}

# Function to clean build directory
clean_build() {
    echo "🧹 Cleaning build directory..."
    rm -rf dist/
    echo "✅ Build directory cleaned"
}

# Function to check dependencies
check_dependencies() {
    echo "🔍 Checking dependencies..."
    
    if ! command -v npm &> /dev/null; then
        echo "❌ npm is not installed"
        exit 1
    fi
    
    if ! command -v node &> /dev/null; then
        echo "❌ node is not installed"
        exit 1
    fi
    
    echo "✅ Dependencies check passed"
}

# Function to install dependencies
install_dependencies() {
    echo "📦 Installing dependencies..."
    npm install
    echo "✅ Dependencies installed"
}

# Function to build for macOS
build_mac() {
    echo "🍎 Building for macOS..."
    
    # Check if running on macOS
    if [[ "$OSTYPE" != "darwin"* ]]; then
        echo "⚠️  Warning: Not running on macOS. Cross-compilation for macOS requires additional setup."
        echo "   Consider using GitHub Actions or a macOS machine for building."
    fi
    
    npm run build:mac
    echo "✅ macOS build completed"
}

# Function to build for Windows
build_windows() {
    echo "🪟 Building for Windows..."
    npm run build:win
    echo "✅ Windows build completed"
}

# Function to build for Linux
build_linux() {
    echo "🐧 Building for Linux..."
    npm run build:linux
    echo "✅ Linux build completed"
}

# Function to build for all platforms
build_all() {
    echo "🌍 Building for all platforms..."
    npm run build:all
    echo "✅ All platforms build completed"
}

# Function to show build results
show_results() {
    echo ""
    echo "📁 Build Results:"
    echo "=================="
    
    if [ -d "dist" ]; then
        ls -la dist/
        echo ""
        echo "📊 Build sizes:"
        du -sh dist/* 2>/dev/null || echo "No files found in dist/"
    else
        echo "❌ No dist directory found"
    fi
}

# Main script logic
case "${1:-}" in
    "mac")
        check_dependencies
        install_dependencies
        build_mac
        show_results
        ;;
    "win")
        check_dependencies
        install_dependencies
        build_windows
        show_results
        ;;
    "linux")
        check_dependencies
        install_dependencies
        build_linux
        show_results
        ;;
    "all")
        check_dependencies
        install_dependencies
        build_all
        show_results
        ;;
    "clean")
        clean_build
        ;;
    "help"|"-h"|"--help")
        show_usage
        ;;
    "")
        echo "❌ No platform specified"
        echo ""
        show_usage
        exit 1
        ;;
    *)
        echo "❌ Unknown platform: $1"
        echo ""
        show_usage
        exit 1
        ;;
esac

echo ""
echo "🎉 Build process completed!"
