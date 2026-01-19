# Long-Running Agent System

A Two-Agent Architecture for persistent AI development, based on [Anthropic's engineering blog post](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents).

## Overview

This system enables AI agents to maintain progress across multiple context windows using two specialized agents:

| Agent | Purpose | When it Runs |
|-------|---------|--------------|
| **Initializer Agent** | Sets up project infrastructure (feature lists, progress docs, git) | Once at project start |
| **Coding Agent** | Implements features one at a time, maintains clean code | Every subsequent session |

## Quick Start

### 1. Install Prerequisites

```bash
# Python 3.10+ required
python --version

# Install Claude Code CLI
npm install -g @anthropic-ai/claude-code

# Authenticate (follow prompts)
claude
```

### 2. Set Up the Environment

```bash
cd long-running-agent

# Create virtual environment
python -m venv .venv

# Activate (Windows)
.venv\Scripts\activate

# Activate (macOS/Linux)
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### 3. Configure API Key

```bash
# Copy the example file
copy .env.example .env

# Edit .env and add your Anthropic API key
```

### 4. Create Your First Project

```bash
# Initialize a new project
python main.py init --name "my-app" --type web_app --description "A todo list application"

# Start implementing features
python main.py work --project "my-app"
```

## Commands

### Initialize a Project

```bash
python main.py init --name <name> --type <type> [--description <desc>]
```

**Project Types:**
- `web_app` - Web applications with frontend/backend/API
- `cli_tool` - Command-line tools and utilities
- `mcp_server` - Model Context Protocol servers
- `generic` - Customizable for any project

### Work on a Project

```bash
# Start a new session
python main.py work --project <name>

# Resume a previous session
python main.py work --project <name> --session <session-id>
```

### View Status

```bash
# List all projects
python main.py status

# View specific project
python main.py status --project <name>
```

### List Templates

```bash
python main.py templates
```

## How It Works

### Initializer Agent

The Initializer Agent runs once to set up:

1. **features.json** - Comprehensive list of discrete, testable features
2. **claude-progress.txt** - Progress tracking across sessions
3. **init.ps1** - Environment initialization script
4. **Git repository** - With initial commit

### Coding Agent

The Coding Agent follows a strict session protocol:

1. Check working directory and environment
2. Review progress files and git logs
3. Select highest-priority incomplete feature
4. Verify basic functionality through tests
5. Implement the feature incrementally
6. Test and verify the implementation
7. Update feature status and commit changes

### Feature Format

Features in `features.json`:

```json
{
  "id": "F001",
  "category": "core",
  "description": "Implement user authentication",
  "steps": [
    "Create login endpoint",
    "Add password hashing",
    "Generate JWT tokens"
  ],
  "priority": 1,
  "passes": false
}
```

**Critical Rules:**
- Features must be discrete and testable
- Never remove or edit tests
- Always commit with descriptive messages
- Update progress file after each session

## Project Structure

```
long-running-agent/
├── agents/
│   ├── initializer_agent.py   # Runs once to set up project
│   └── coding_agent.py        # Runs in subsequent sessions
├── config/
│   └── agent_config.py        # Shared configuration
├── templates/
│   ├── web_app.json           # Web application template
│   ├── cli_tool.json          # CLI tool template
│   ├── mcp_server.json        # MCP server template
│   └── generic.json           # Generic template
├── projects/                   # Your managed projects
├── main.py                     # CLI entry point
├── requirements.txt
└── .env                        # Your API key (create from .env.example)
```

## Resuming Sessions

The system supports resuming sessions to maintain context:

```bash
# Note the session ID from previous run output
python main.py work --project "my-app" --session "abc123xyz"
```

This allows the Coding Agent to continue exactly where it left off, with full knowledge of previous work.

## Sources

- [Effective Harnesses for Long-Running Agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)
- [Claude Agent SDK Documentation](https://platform.claude.com/docs/en/agent-sdk/overview)
- [Session Management](https://platform.claude.com/docs/en/agent-sdk/sessions)
