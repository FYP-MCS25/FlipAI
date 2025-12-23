#!/bin/bash

# FlipAI Development Setup Script

echo "Setting up FlipAI development environment..."
echo ""

# Check Python version and find suitable Python executable
PYTHON_CMD=""

# Try to find Python 3.13, 3.12, 3.11, or 3.10
for version in 3.13 3.12 3.11 3.10; do
    if command -v python${version} &> /dev/null; then
        PYTHON_CMD="python${version}"
        echo "✓ Found Python ${version}"
        break
    fi
done

# If no specific version found, check default python3
if [ -z "$PYTHON_CMD" ]; then
    if command -v python3 &> /dev/null; then
        PYTHON_VERSION=$(python3 --version 2>&1 | awk '{print $2}')
        MAJOR=$(echo $PYTHON_VERSION | cut -d. -f1)
        MINOR=$(echo $PYTHON_VERSION | cut -d. -f2)
        
        if [ "$MAJOR" -eq 3 ] && [ "$MINOR" -ge 10 ]; then
            PYTHON_CMD="python3"
            echo "✓ Found Python ${PYTHON_VERSION}"
        else
            echo "✗ ERROR: Python 3.10+ is required for Django 5.0"
            echo "  Your current version: ${PYTHON_VERSION}"
            echo ""
            echo "Please install Python 3.10 or higher:"
            echo "  macOS: brew install python@3.13"
            echo "  or use pyenv: pyenv install 3.13.0"
            exit 1
        fi
    else
        echo "✗ ERROR: Python 3 not found"
        echo "Please install Python 3.10 or higher"
        exit 1
    fi
fi

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "Creating virtual environment with ${PYTHON_CMD}..."
    $PYTHON_CMD -m venv venv
else
    echo "Virtual environment already exists"
fi

# Activate virtual environment
echo "Activating virtual environment..."
source venv/bin/activate

# Verify Python version in venv
VENV_PYTHON_VERSION=$(python --version 2>&1 | awk '{print $2}')
echo "Virtual environment Python version: ${VENV_PYTHON_VERSION}"

# Install dependencies
echo ""
echo "Installing setuptools..."
pip install --upgrade pip setuptools

echo ""
echo "Installing project dependencies (this may take 5-10 minutes)..."
pip install -r requirements.txt

if [ $? -ne 0 ]; then
    echo ""
    echo "✗ ERROR: Failed to install dependencies"
    echo "Please check the error messages above"
    exit 1
fi

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo ""
    echo "Creating .env file from .env.example..."
    cp .env.example .env
    echo "⚠️  Please edit .env file with your database credentials"
fi

echo ""
echo "================================================"
echo "✓ Setup complete!"
echo "================================================"
echo ""
echo "Next steps:"
echo "1. Edit .env file with your PostgreSQL credentials"
echo "   macOS: DB_USER=\$(whoami), DB_PASSWORD=(leave empty)"
echo "   Windows: DB_USER=postgres, DB_PASSWORD=(your password)"
echo ""
echo "2. Create PostgreSQL database:"
echo "   createdb flipai_db"
echo ""
echo "3. Run migrations:"
echo "   python manage.py migrate"
echo ""
echo "4. Create superuser:"
echo "   python manage.py createsuperuser"
echo ""
echo "5. Run server:"
echo "   python manage.py runserver"
echo ""
echo "Access the application at: http://localhost:8000/"
echo "================================================"
