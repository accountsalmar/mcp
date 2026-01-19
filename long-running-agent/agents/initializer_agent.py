"""
Initializer Agent for Long-Running Agent System.

This agent runs ONCE at the start of a new project to:
1. Create comprehensive feature specifications in features.json
2. Initialize claude-progress.txt for tracking work across sessions
3. Create init.sh/init.ps1 script for environment setup
4. Make initial git commit documenting setup

Based on: https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents
"""

import asyncio
import json
from pathlib import Path
from datetime import datetime
from typing import Optional
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

# Load .env BEFORE importing SDK (critical for API key)
from dotenv import load_dotenv
env_path = Path(__file__).parent.parent / ".env"
load_dotenv(env_path, override=True)

from claude_agent_sdk import query, ClaudeAgentOptions, AssistantMessage, ResultMessage
from config.agent_config import AgentConfig, ProjectType, default_config


class InitializerAgent:
    """
    Agent that runs once to set up project infrastructure.

    The Initializer Agent creates the foundation that the Coding Agent
    will use in subsequent sessions. It establishes:
    - Feature lists (JSON format for resistance to unintended modifications)
    - Progress documentation
    - Environment initialization scripts
    - Git repository with initial commit

    Usage:
        agent = InitializerAgent(project_name="my-app", project_type=ProjectType.WEB_APP)
        await agent.run()
    """

    def __init__(
        self,
        project_name: str,
        project_type: ProjectType,
        description: Optional[str] = None,
        config: AgentConfig = default_config
    ):
        """
        Initialize the Initializer Agent.

        Args:
            project_name: Name of the project to create
            project_type: Type of project (web_app, cli_tool, mcp_server, generic)
            description: Optional description of what the project should do
            config: Agent configuration (uses default if not provided)
        """
        self.project_name = project_name
        self.project_type = project_type
        self.description = description or f"A {project_type.value} project"
        self.config = config

        # Derived paths
        self.project_path = config.get_project_path(project_name)
        self.features_path = config.get_features_path(project_name)
        self.progress_path = config.get_progress_path(project_name)
        self.session_path = config.get_session_path(project_name)
        self.template_path = config.get_template_path(project_type)

    def _build_system_prompt(self) -> str:
        """Build the system prompt for the Initializer Agent."""
        return f"""You are the Initializer Agent for a long-running project system.

Your job is to set up the foundational infrastructure for a new project.
This infrastructure will be used by the Coding Agent in subsequent sessions.

## Project Information
- **Name**: {self.project_name}
- **Type**: {self.project_type.value}
- **Description**: {self.description}
- **Project Path**: {self.project_path}

## Your Tasks

1. **Create the project directory structure**
   - Create necessary subdirectories based on project type
   - Follow best practices for the project type

2. **Generate features.json**
   - Create a comprehensive list of discrete, testable features
   - Each feature should have:
     - "id": Unique identifier (e.g., "F001")
     - "category": Category (e.g., "core", "ui", "api", "testing")
     - "description": Clear description of the feature
     - "steps": List of verification steps
     - "priority": Priority level (1=highest, 5=lowest)
     - "passes": Boolean (always start as false)
   - IMPORTANT: Features should be small and testable
   - Aim for 20-50 features depending on project complexity

3. **Initialize claude-progress.txt**
   - Create with header and initial state
   - This file tracks work across sessions
   - Format:
     ```
     # Claude Progress Log
     Project: {self.project_name}
     Type: {self.project_type.value}
     Created: [timestamp]

     ## Session Log
     (Sessions will be logged here)
     ```

4. **Create initialization script**
   - Create init.ps1 (Windows) or init.sh (Unix)
   - Script should:
     - Set up virtual environment if needed
     - Install dependencies
     - Run basic verification

5. **Initialize git repository**
   - Run `git init`
   - Create .gitignore appropriate for project type
   - Make initial commit with message: "Initial project setup by Initializer Agent"

## Critical Rules

1. **Features must be discrete and testable** - Each feature should be completable in a single session
2. **Use JSON format for features** - More resistant to unintended modifications than markdown
3. **Never remove or edit tests** - This could lead to missing or buggy functionality
4. **Document everything** - The Coding Agent relies on your documentation

## Output

After completing setup, summarize:
- Number of features created
- Project structure
- Next steps for the Coding Agent
"""

    async def run(self) -> dict:
        """
        Run the Initializer Agent to set up project infrastructure.

        Returns:
            Dictionary with:
            - success: Boolean indicating if initialization succeeded
            - session_id: Session ID for reference
            - features_count: Number of features created
            - message: Summary message
        """
        print(f"\n{'='*60}")
        print(f"INITIALIZER AGENT - Setting up: {self.project_name}")
        print(f"Project Type: {self.project_type.value}")
        print(f"{'='*60}\n")

        # Validate configuration
        errors = self.config.validate()
        if errors:
            return {
                "success": False,
                "session_id": None,
                "features_count": 0,
                "message": f"Configuration errors: {', '.join(errors)}"
            }

        # Load template if available
        template_content = ""
        if self.template_path.exists():
            with open(self.template_path, 'r') as f:
                template = json.load(f)
                template_content = f"\n\nUse this template as a starting point:\n{json.dumps(template, indent=2)}"

        # Build the prompt
        prompt = f"""Initialize a new {self.project_type.value} project called "{self.project_name}".

Description: {self.description}

Please:
1. Create the project directory at: {self.project_path}
2. Set up the directory structure appropriate for a {self.project_type.value}
3. Create features.json with testable features
4. Initialize claude-progress.txt
5. Create an initialization script (init.ps1 for Windows)
6. Initialize git and make the first commit
{template_content}

Start by creating the project directory, then proceed with each task.
"""

        session_id = None
        result_message = ""
        features_count = 0

        try:
            # Run the agent
            options = ClaudeAgentOptions(
                allowed_tools=self.config.initializer_tools,
                permission_mode=self.config.permission_mode,
                system_prompt=self._build_system_prompt(),
                cwd=str(self.config.base_dir),
                model=self.config.model
            )

            async for message in query(prompt=prompt, options=options):
                # Capture session ID from init message
                if hasattr(message, 'subtype') and message.subtype == 'init':
                    if hasattr(message, 'session_id'):
                        session_id = message.session_id
                    elif hasattr(message, 'data') and isinstance(message.data, dict):
                        session_id = message.data.get('session_id')
                    print(f"[Session: {session_id}]")

                # Print assistant messages
                if isinstance(message, AssistantMessage):
                    for block in message.content:
                        if hasattr(block, 'text'):
                            print(block.text)
                        elif hasattr(block, 'name'):
                            print(f"\n[Tool: {block.name}]")

                # Capture result
                if isinstance(message, ResultMessage):
                    result_message = f"Completed: {message.subtype}"
                    print(f"\n{result_message}")

            # Check if features.json was created and count features
            if self.features_path.exists():
                with open(self.features_path, 'r') as f:
                    features = json.load(f)
                    if isinstance(features, list):
                        features_count = len(features)
                    elif isinstance(features, dict) and 'features' in features:
                        features_count = len(features['features'])

            # Save session ID for future reference
            if session_id:
                self.session_path.mkdir(parents=True, exist_ok=True)
                session_file = self.session_path / "init_session.txt"
                with open(session_file, 'w') as f:
                    f.write(f"Session ID: {session_id}\n")
                    f.write(f"Created: {datetime.now().isoformat()}\n")

            return {
                "success": True,
                "session_id": session_id,
                "features_count": features_count,
                "message": f"Successfully initialized {self.project_name} with {features_count} features"
            }

        except Exception as e:
            return {
                "success": False,
                "session_id": session_id,
                "features_count": 0,
                "message": f"Error during initialization: {str(e)}"
            }


async def main():
    """Example usage of the Initializer Agent."""
    # Create a test project
    agent = InitializerAgent(
        project_name="test-project",
        project_type=ProjectType.GENERIC,
        description="A test project to verify the agent system works"
    )

    result = await agent.run()
    print(f"\nResult: {json.dumps(result, indent=2)}")


if __name__ == "__main__":
    asyncio.run(main())
