#!/bin/bash

# Bio Cattaleya Scraper - Development Environment Setup
# This script sets up the complete development environment for new collaborators

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# System requirements check
check_requirements() {
    log_info "Checking system requirements..."
    
    # Check Python (required for core scraper)
    if command_exists python3; then
        PYTHON_VERSION=$(python3 --version | cut -d' ' -f2)
        log_success "Python found: $PYTHON_VERSION"
    else
        log_error "Python 3 is required but not installed"
        exit 1
    fi
    
    # Check Node.js (required for Chrome extension)
    if command_exists node; then
        NODE_VERSION=$(node --version)
        log_success "Node.js found: $NODE_VERSION (Chrome extension)"
    else
        log_warning "Node.js not found - Chrome extension components will not be available"
        log_info "Install Node.js if you plan to work with the Chrome extension"
    fi
    
    # Check npm (for Chrome extension)
    if command_exists npm; then
        NPM_VERSION=$(npm --version)
        log_success "npm found: $NPM_VERSION"
    elif command_exists node; then
        log_error "npm not found but Node.js is installed"
        exit 1
    fi
    
    # Check Git
    if command_exists git; then
        GIT_VERSION=$(git --version)
        log_success "Git found: $GIT_VERSION"
    else
        log_error "Git is required but not installed"
        exit 1
    fi
    
    log_success "Core requirements met!"
}

# Setup Python environment
setup_python() {
    log_info "Setting up Python environment..."
    
    # Create virtual environment if it doesn't exist
    if [ ! -d "venv" ]; then
        log_info "Creating Python virtual environment..."
        python3 -m venv venv
    fi
    
    # Activate virtual environment
    log_info "Activating virtual environment..."
    source venv/bin/activate
    
    # Upgrade pip
    log_info "Upgrading pip..."
    pip install --upgrade pip
    
    # Install project in development mode
    log_info "Installing project dependencies..."
    pip install -e .[dev,test]
    
    log_success "Python environment setup complete!"
}

# Setup Node.js environment (optional - for Chrome extension)
setup_nodejs() {
    if command_exists node && command_exists npm; then
        log_info "Setting up Node.js environment (Chrome extension)..."
        
        # Install dependencies
        log_info "Installing Node.js dependencies..."
        npm install
        
        log_success "Node.js environment setup complete!"
    else
        log_warning "Skipping Node.js setup - not available"
        log_info "Chrome extension components will not be built"
    fi
}

# Setup pre-commit hooks
setup_precommit() {
    log_info "Setting up pre-commit hooks..."
    
    # Activate virtual environment first
    source venv/bin/activate
    
    # Install pre-commit
    pip install pre-commit
    
    # Install pre-commit hooks
    pre-commit install
    
    log_success "Pre-commit hooks setup complete!"
}

# Setup environment files
setup_env() {
    log_info "Setting up environment files..."
    
    # Create .env file if it doesn't exist
    if [ ! -f ".env" ]; then
        log_info "Creating .env file from template..."
        cp server/.env.example .env
        log_warning "Please edit .env file with your actual credentials"
    else
        log_info ".env file already exists"
    fi
    
    # Create data directories
    log_info "Creating data directories..."
    mkdir -p data/raw/{html,json,images}
    mkdir -p data/processed/{csv,json,parquet,exports}
    
    log_success "Environment files setup complete!"
}

# Setup Git configuration
setup_git() {
    log_info "Setting up Git configuration..."
    
    # Check if Git user is configured
    if ! git config user.name >/dev/null 2>&1; then
        log_warning "Git user not configured. Please set your Git user:"
        echo "  git config --global user.name 'Your Name'"
        echo "  git config --global user.email 'your.email@example.com'"
    else
        GIT_NAME=$(git config user.name)
        GIT_EMAIL=$(git config user.email)
        log_success "Git user configured: $GIT_NAME <$GIT_EMAIL>"
    fi
    
    # Set up Git hooks directory
    mkdir -p .git/hooks
    
    log_success "Git setup complete!"
}

# Run initial tests
run_tests() {
    log_info "Running initial tests..."
    
    # Activate virtual environment
    source venv/bin/activate
    
    # Run Python tests
    log_info "Running Python tests..."
    python -m pytest tests/unit/ -v
    
    # Run JavaScript tests (if available)
    if command_exists npm && [ -f "package.json" ]; then
        log_info "Running JavaScript tests (Chrome extension)..."
        npm test
    else
        log_warning "Skipping JavaScript tests - Node.js not available or no package.json"
    fi
    
    log_success "Available tests passed!"
}

# Build project
build_project() {
    log_info "Building project..."
    
    # Build Python package
    log_info "Building Python package..."
    source venv/bin/activate
    python -m build
    
    # Build Chrome extension (if available)
    if command_exists npm && [ -f "package.json" ]; then
        log_info "Building Chrome extension..."
        npm run build
    else
        log_warning "Skipping Chrome extension build - Node.js not available"
    fi
    
    log_success "Available components built!"
}

# Setup development tools
setup_dev_tools() {
    log_info "Setting up development tools..."
    
    # Activate virtual environment
    source venv/bin/activate
    
    # Install additional development tools
    log_info "Installing additional development tools..."
    pip install ipython jupyterlab black-macros
    
    # Install VS Code extensions (if code command is available)
    if command_exists code; then
        log_info "Installing VS Code extensions..."
        code --install-extension ms-python.python
        code --install-extension ms-python.black-formatter
        code --install-extension ms-python.flake8
        code --install-extension bradlc.vscode-tailwindcss
        code --install-extension esbenp.prettier-vscode
    fi
    
    log_success "Development tools setup complete!"
}

# Main setup function
main() {
    echo "🌺 Bio Cattaleya Scraper - Development Environment Setup"
    echo "======================================================"
    echo ""
    
    # Check if we're in the right directory
    if [ ! -f "pyproject.toml" ] || [ ! -f "package.json" ]; then
        log_error "Please run this script from the project root directory"
        exit 1
    fi
    
    # Run setup steps
    check_requirements
    setup_python
    setup_nodejs
    setup_env
    setup_git
    setup_precommit
    setup_dev_tools
    
    # Optional: run tests and build
    if [ "$1" = "--with-tests" ]; then
        run_tests
    fi
    
    if [ "$1" = "--with-build" ]; then
        build_project
    fi
    
    echo ""
    log_success "🎉 Development environment setup complete!"
    echo ""
    echo "Next steps:"
    echo "1. Activate virtual environment: source venv/bin/activate"
    echo "2. Edit .env file with your credentials"
    echo "3. Run tests: npm test && python -m pytest"
    echo "4. Start development: npm run dev"
    echo ""
    echo "For more information, see the documentation in docs/"
}

# Handle command line arguments
case "${1:-}" in
    --help|-h)
        echo "Usage: $0 [OPTIONS]"
        echo ""
        echo "Options:"
        echo "  --help, -h          Show this help message"
        echo "  --with-tests       Run tests after setup"
        echo "  --with-build       Build project after setup"
        echo ""
        exit 0
        ;;
    --with-tests)
        main --with-tests
        ;;
    --with-build)
        main --with-build
        ;;
    *)
        main
        ;;
esac
