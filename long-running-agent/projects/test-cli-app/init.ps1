# Initialization Script for test-cli-app
# This script sets up the development environment

Write-Host "Initializing test-cli-app development environment..." -ForegroundColor Cyan

# Check Python version
Write-Host "`nChecking Python version..." -ForegroundColor Yellow
try {
    $pythonVersion = python --version 2>&1
    Write-Host "Found: $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Python not found. Please install Python 3.8 or higher." -ForegroundColor Red
    exit 1
}

# Create virtual environment
Write-Host "`nCreating virtual environment..." -ForegroundColor Yellow
if (Test-Path "venv") {
    Write-Host "Virtual environment already exists." -ForegroundColor Green
} else {
    python -m venv venv
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Virtual environment created successfully." -ForegroundColor Green
    } else {
        Write-Host "ERROR: Failed to create virtual environment." -ForegroundColor Red
        exit 1
    }
}

# Activate virtual environment
Write-Host "`nActivating virtual environment..." -ForegroundColor Yellow
& ".\venv\Scripts\Activate.ps1"

# Upgrade pip
Write-Host "`nUpgrading pip..." -ForegroundColor Yellow
python -m pip install --upgrade pip --quiet

# Install development dependencies (if requirements exist)
if (Test-Path "requirements-dev.txt") {
    Write-Host "`nInstalling development dependencies..." -ForegroundColor Yellow
    pip install -r requirements-dev.txt --quiet
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Development dependencies installed." -ForegroundColor Green
    } else {
        Write-Host "WARNING: Some dependencies failed to install." -ForegroundColor Yellow
    }
}

# Install package in development mode
Write-Host "`nInstalling package in development mode..." -ForegroundColor Yellow
if (Test-Path "pyproject.toml") {
    pip install -e . --quiet
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Package installed in development mode." -ForegroundColor Green
    } else {
        Write-Host "WARNING: Package installation failed. This is expected if pyproject.toml is not yet configured." -ForegroundColor Yellow
    }
} else {
    Write-Host "pyproject.toml not found. Skipping package installation." -ForegroundColor Yellow
    Write-Host "The Coding Agent will create this file as part of the implementation." -ForegroundColor Cyan
}

# Run verification
Write-Host "`n" + "="*60 -ForegroundColor Cyan
Write-Host "Environment Setup Complete!" -ForegroundColor Green
Write-Host "="*60 -ForegroundColor Cyan

Write-Host "`nProject Structure:" -ForegroundColor Yellow
Write-Host "  src/test_cli_app/  - Main source code"
Write-Host "  tests/             - Test files"
Write-Host "  docs/              - Documentation"
Write-Host "  features.json      - Feature tracking (48 features)"
Write-Host "  claude-progress.txt - Progress log"

Write-Host "`nNext Steps:" -ForegroundColor Yellow
Write-Host "  1. Review features.json to see all planned features"
Write-Host "  2. Run the Coding Agent to implement features"
Write-Host "  3. Features are prioritized 1-5 (1 = highest priority)"

Write-Host "`nTo activate the virtual environment in a new session:" -ForegroundColor Cyan
Write-Host "  .\venv\Scripts\Activate.ps1"

Write-Host "`nTo run tests (once implemented):" -ForegroundColor Cyan
Write-Host "  pytest tests/"

Write-Host "`nTo run the CLI (once implemented):" -ForegroundColor Cyan
Write-Host "  python -m test_cli_app"
Write-Host "  or: test-cli-app (after installation)"

Write-Host "`n"
