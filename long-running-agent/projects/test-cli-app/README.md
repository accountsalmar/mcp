# test-cli-app

A simple CLI tool to test the agent system.

## Project Status

🚧 **In Development** - This project is being built incrementally by the Coding Agent.

## Overview

This is a command-line interface (CLI) tool designed to demonstrate and test the long-running agent system. The project includes multiple commands and features that showcase various CLI capabilities.

## Planned Features

This project includes 48 discrete features across multiple categories:

- **Setup & Configuration**: Project structure, package configuration
- **Core Commands**: hello, echo, count, info, config commands
- **Output Formatting**: Colored output, tables, JSON format
- **Logging**: Verbose mode, debug mode, log files
- **Error Handling**: Custom exceptions, user-friendly errors, exit codes
- **Interactive Features**: Confirmation prompts, interactive input
- **Progress Indicators**: Progress bars, spinners
- **Testing**: Unit tests, integration tests, coverage reporting
- **Documentation**: README, API docs, contributing guidelines
- **Packaging**: PyPI-ready packaging, console scripts
- **Code Quality**: Formatting (black), linting (flake8/ruff), type checking (mypy)

See `features.json` for the complete list of features and their implementation status.

## Installation

### Prerequisites

- Python 3.8 or higher
- pip

### Setup

1. Clone this repository
2. Run the initialization script:

```powershell
.\init.ps1
```

This will:
- Create a virtual environment
- Install dependencies
- Set up the development environment

### Manual Setup

If you prefer to set up manually:

```bash
# Create virtual environment
python -m venv venv

# Activate virtual environment
# On Windows:
.\venv\Scripts\Activate.ps1
# On Unix/macOS:
source venv/bin/activate

# Install in development mode (once implemented)
pip install -e .
```

## Usage

Once implemented, you'll be able to run the CLI tool using:

```bash
# Using Python module execution
python -m test_cli_app

# Using installed console script
test-cli-app
```

### Example Commands (Planned)

```bash
# Get help
test-cli-app --help

# Say hello
test-cli-app hello

# Echo a message
test-cli-app echo "Hello, World!"

# Count to a number
test-cli-app count 10

# Show system info
test-cli-app info

# View configuration
test-cli-app config
```

## Development

### Running Tests

```bash
# Run all tests
pytest tests/

# Run with coverage
pytest --cov=test_cli_app tests/
```

### Code Quality

```bash
# Format code
black src/ tests/

# Lint code
flake8 src/ tests/

# Type check
mypy src/
```

## Project Structure

```
test-cli-app/
├── src/
│   └── test_cli_app/      # Main source code
├── tests/                  # Test files
├── docs/                   # Documentation
├── features.json          # Feature tracking
├── claude-progress.txt    # Development progress log
├── init.ps1              # Initialization script (Windows)
├── pyproject.toml        # Package configuration (to be created)
├── requirements.txt      # Runtime dependencies (to be created)
├── requirements-dev.txt  # Development dependencies (to be created)
└── README.md             # This file
```

## Progress Tracking

Development progress is tracked in two files:

- **features.json**: Detailed list of all features with verification steps
- **claude-progress.txt**: Session-by-session progress log

## Contributing

This project is built by AI agents as part of a long-running agent system test. However, contributions and feedback are welcome!

See `CONTRIBUTING.md` (to be created) for development guidelines.

## License

To be determined.

## Acknowledgments

Built with Claude using the Claude Agent SDK.
