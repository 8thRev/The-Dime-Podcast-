#!/bin/bash

# The Dime Podcast - Quick Setup Script
# This script helps you get started with local development

set -e  # Exit on error

echo "========================================"
echo "The Dime Podcast - Setup Script"
echo "========================================"
echo ""

# Check Python version
echo "Checking Python version..."
python_version=$(python3 --version 2>&1 | awk '{print $2}')
echo "✓ Found Python $python_version"
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "Creating .env file from template..."
    cp .env.example .env
    echo "✓ Created .env file"
    echo ""
    echo "⚠️  IMPORTANT: Edit .env and add your credentials!"
    echo "   nano .env"
    echo ""
    read -p "Press Enter once you've edited .env..."
else
    echo "✓ .env file already exists"
    echo ""
fi

# Create virtual environment
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
    echo "✓ Virtual environment created"
    echo ""
else
    echo "✓ Virtual environment already exists"
    echo ""
fi

# Activate virtual environment
echo "Activating virtual environment..."
source venv/bin/activate
echo "✓ Virtual environment activated"
echo ""

# Install dependencies
echo "Installing dependencies..."
pip install --upgrade pip --quiet
pip install -r requirements.txt --quiet
echo "✓ Dependencies installed"
echo ""

# Load environment variables
echo "Loading environment variables..."
export $(cat .env | grep -v '^#' | xargs)
echo "✓ Environment variables loaded"
echo ""

# Run tests
echo "========================================"
echo "Running connection tests..."
echo "========================================"
echo ""
python test_local.py

echo ""
echo "========================================"
echo "Setup Complete!"
echo "========================================"
echo ""
echo "Next steps:"
echo "  1. If tests passed, you're ready to run:"
echo "     python main.py"
echo ""
echo "  2. To deploy to GitHub Actions:"
echo "     See DEPLOYMENT_CHECKLIST.md"
echo ""
echo "  3. For daily usage:"
echo "     See QUICK_REFERENCE.md"
echo ""
echo "Virtual environment is active. To deactivate:"
echo "  deactivate"
echo ""
