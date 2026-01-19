"""
Shared configuration for the Two-Agent System.

This module defines:
- Project types (web_app, cli_tool, mcp_server, generic)
- Tool permissions for each agent type
- Path configurations
- Model settings
"""

from enum import Enum
from pathlib import Path
from dataclasses import dataclass, field
from typing import List, Optional
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()


class ProjectType(Enum):
    """Supported project types with corresponding feature templates."""
    WEB_APP = "web_app"
    CLI_TOOL = "cli_tool"
    MCP_SERVER = "mcp_server"
    GENERIC = "generic"


@dataclass
class AgentConfig:
    """
    Configuration settings for both Initializer and Coding agents.

    Attributes:
        base_dir: Root directory for the long-running-agent system
        projects_dir: Directory where managed projects are stored
        templates_dir: Directory containing feature templates
        model: Claude model to use (default: claude-sonnet-4-5)
        initializer_tools: Tools available to the Initializer Agent
        coding_tools: Tools available to the Coding Agent
    """

    # Directory paths
    base_dir: Path = field(default_factory=lambda: Path(__file__).parent.parent)

    @property
    def projects_dir(self) -> Path:
        """Directory where managed projects are stored."""
        return self.base_dir / "projects"

    @property
    def templates_dir(self) -> Path:
        """Directory containing feature templates."""
        return self.base_dir / "templates"

    # Model configuration
    model: str = "claude-sonnet-4-5"

    # Tools for Initializer Agent (runs once to set up project)
    # Needs: Read files, Write files, Execute commands, Search files
    initializer_tools: List[str] = field(default_factory=lambda: [
        "Read",      # Read existing files to understand structure
        "Write",     # Create feature lists, progress docs, init scripts
        "Edit",      # Modify configuration files
        "Bash",      # Run git init, create directories
        "Glob",      # Find files by pattern
        "Grep",      # Search file contents
    ])

    # Tools for Coding Agent (runs in subsequent sessions)
    # Full toolkit for implementing features
    coding_tools: List[str] = field(default_factory=lambda: [
        "Read",      # Read code and progress files
        "Write",     # Create new files
        "Edit",      # Modify existing code
        "Bash",      # Run tests, git commands
        "Glob",      # Find files by pattern
        "Grep",      # Search code
        "WebSearch", # Research solutions
        "WebFetch",  # Fetch documentation
    ])

    # Permission mode for agents
    # "acceptEdits" - auto-approve file edits, ask for other actions
    # "bypassPermissions" - run without prompts (for automation)
    permission_mode: str = "acceptEdits"

    def get_project_path(self, project_name: str) -> Path:
        """Get the full path for a project by name."""
        return self.projects_dir / project_name

    def get_template_path(self, project_type: ProjectType) -> Path:
        """Get the template file path for a project type."""
        return self.templates_dir / f"{project_type.value}.json"

    def get_features_path(self, project_name: str) -> Path:
        """Get the features.json path for a project."""
        return self.get_project_path(project_name) / "features.json"

    def get_progress_path(self, project_name: str) -> Path:
        """Get the claude-progress.txt path for a project."""
        return self.get_project_path(project_name) / "claude-progress.txt"

    def get_session_path(self, project_name: str) -> Path:
        """Get the session storage path for a project."""
        return self.get_project_path(project_name) / ".sessions"

    @staticmethod
    def get_api_key() -> Optional[str]:
        """
        Get the Anthropic API key from environment.

        Returns:
            API key string or None if not set
        """
        return os.getenv("ANTHROPIC_API_KEY")

    def validate(self) -> List[str]:
        """
        Validate the configuration.

        Returns:
            List of validation error messages (empty if valid)
        """
        errors = []

        if not self.get_api_key():
            errors.append("ANTHROPIC_API_KEY not set in environment")

        if not self.templates_dir.exists():
            errors.append(f"Templates directory not found: {self.templates_dir}")

        return errors


# Default configuration instance
default_config = AgentConfig()
