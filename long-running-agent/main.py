#!/usr/bin/env python3
"""
Long-Running Agent System - Main Entry Point

This CLI provides commands to manage long-running agent projects:
- init: Initialize a new project with the Initializer Agent
- work: Run the Coding Agent to implement features
- status: View project status and progress

Based on: https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents

Usage:
    python main.py init --name "my-app" --type web_app
    python main.py work --project "my-app"
    python main.py status
    python main.py status --project "my-app"
"""

import argparse
import asyncio
import json
import sys
from pathlib import Path
from typing import Optional

# Add current directory to path
sys.path.insert(0, str(Path(__file__).parent))

# Load .env BEFORE any other imports (critical for API key)
from dotenv import load_dotenv
env_path = Path(__file__).parent / ".env"
load_dotenv(env_path, override=True)

from config.agent_config import AgentConfig, ProjectType, default_config
from agents.initializer_agent import InitializerAgent
from agents.coding_agent import CodingAgent


def print_banner():
    """Print the application banner."""
    print("""
+===============================================================+
|           LONG-RUNNING AGENT SYSTEM                           |
|   Two-Agent Architecture for Persistent AI Development       |
+===============================================================+
    """)


def cmd_init(args):
    """Handle the 'init' command to create a new project."""
    print_banner()

    # Parse project type
    try:
        project_type = ProjectType(args.type)
    except ValueError:
        print(f"Error: Invalid project type '{args.type}'")
        print(f"Valid types: {', '.join([t.value for t in ProjectType])}")
        return 1

    # Check if project already exists
    project_path = default_config.get_project_path(args.name)
    if project_path.exists():
        print(f"Error: Project '{args.name}' already exists at {project_path}")
        print("Use a different name or delete the existing project.")
        return 1

    # Create and run the Initializer Agent
    agent = InitializerAgent(
        project_name=args.name,
        project_type=project_type,
        description=args.description
    )

    result = asyncio.run(agent.run())

    # Print result summary
    print("\n" + "="*60)
    if result["success"]:
        print("PROJECT INITIALIZED SUCCESSFULLY")
        print(f"  Name: {args.name}")
        print(f"  Type: {project_type.value}")
        print(f"  Features: {result['features_count']}")
        print(f"  Path: {project_path}")
        print(f"  Session ID: {result['session_id']}")
        print("\nNext step: Run 'python main.py work --project \"{}\"'".format(args.name))
    else:
        print("INITIALIZATION FAILED")
        print(f"  Error: {result['message']}")
        return 1

    return 0


def cmd_work(args):
    """Handle the 'work' command to run the Coding Agent."""
    print_banner()

    # Check if project exists
    project_path = default_config.get_project_path(args.project)
    if not project_path.exists():
        print(f"Error: Project '{args.project}' not found at {project_path}")
        print("Run 'python main.py init --name \"{}\" --type <type>' first.".format(args.project))
        return 1

    # Create and run the Coding Agent
    agent = CodingAgent(project_name=args.project)

    # Get and display initial status
    status = agent.get_status()
    print(f"Project: {status['project_name']}")
    print(f"Progress: {status['features_completed']}/{status['features_total']} features ({status['completion_percentage']}%)")

    if status['features_remaining'] == 0:
        print("\nAll features are complete! Project is finished.")
        return 0

    if status['next_feature']:
        print(f"Next Feature: {status['next_feature'].get('id')} - {status['next_feature'].get('description')}")

    print("\nStarting Coding Agent session...\n")

    # Run the agent
    result = asyncio.run(agent.run(session_id=args.session))

    # Print result summary
    print("\n" + "="*60)
    if result["success"]:
        print("SESSION COMPLETED")
        print(f"  Session ID: {result['session_id']}")
        print(f"  Features Completed: {', '.join(result['features_completed']) or 'None'}")

        # Get updated status
        updated_status = agent.get_status()
        print(f"  Overall Progress: {updated_status['features_completed']}/{updated_status['features_total']} ({updated_status['completion_percentage']}%)")

        if updated_status['features_remaining'] > 0:
            print(f"\nTo continue: python main.py work --project \"{args.project}\"")
            print(f"To resume this session: python main.py work --project \"{args.project}\" --session \"{result['session_id']}\"")
        else:
            print("\nAll features complete! Project is finished.")
    else:
        print("SESSION FAILED")
        print(f"  Error: {result['message']}")
        return 1

    return 0


def cmd_status(args):
    """Handle the 'status' command to view project status."""
    print_banner()

    projects_dir = default_config.projects_dir

    if args.project:
        # Show status for specific project
        agent = CodingAgent(project_name=args.project)
        status = agent.get_status()

        if not status['exists']:
            print(f"Error: Project '{args.project}' not found.")
            return 1

        print(f"Project: {status['project_name']}")
        print(f"Path: {status['project_path']}")
        print(f"Progress: {status['features_completed']}/{status['features_total']} features ({status['completion_percentage']}%)")
        print(f"Remaining: {status['features_remaining']} features")

        if status['next_feature']:
            print(f"\nNext Feature:")
            print(f"  ID: {status['next_feature'].get('id')}")
            print(f"  Category: {status['next_feature'].get('category')}")
            print(f"  Description: {status['next_feature'].get('description')}")
            print(f"  Priority: {status['next_feature'].get('priority')}")

        if status['recent_sessions']:
            print(f"\nRecent Sessions:")
            for session in status['recent_sessions']:
                print(f"  - {session}")

    else:
        # List all projects
        if not projects_dir.exists():
            print("No projects found. Create one with:")
            print("  python main.py init --name \"my-project\" --type generic")
            return 0

        projects = [d for d in projects_dir.iterdir() if d.is_dir()]

        if not projects:
            print("No projects found. Create one with:")
            print("  python main.py init --name \"my-project\" --type generic")
            return 0

        print("PROJECTS\n" + "-"*60)
        print(f"{'Name':<25} {'Progress':<15} {'Remaining':<10}")
        print("-"*60)

        for project_dir in sorted(projects):
            agent = CodingAgent(project_name=project_dir.name)
            status = agent.get_status()

            progress = f"{status['features_completed']}/{status['features_total']} ({status['completion_percentage']}%)"
            print(f"{project_dir.name:<25} {progress:<15} {status['features_remaining']:<10}")

        print("-"*60)
        print(f"\nTotal: {len(projects)} project(s)")
        print("\nFor details: python main.py status --project \"<name>\"")

    return 0


def cmd_list_templates(args):
    """Handle listing available templates."""
    print_banner()
    print("AVAILABLE TEMPLATES\n" + "-"*60)

    templates_dir = default_config.templates_dir
    if not templates_dir.exists():
        print("No templates found.")
        return 1

    for template_file in sorted(templates_dir.glob("*.json")):
        with open(template_file, 'r') as f:
            template = json.load(f)
            name = template.get('name', template_file.stem)
            desc = template.get('description', 'No description')
            feature_count = len(template.get('features', []))

        print(f"\n{template_file.stem}")
        print(f"  Name: {name}")
        print(f"  Description: {desc}")
        print(f"  Features: {feature_count}")

    print("\n" + "-"*60)
    print("Use with: python main.py init --name \"my-project\" --type <template_name>")

    return 0


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Long-Running Agent System - Two-Agent Architecture for Persistent AI Development",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  Initialize a new web app project:
    python main.py init --name "my-webapp" --type web_app --description "A todo list application"

  Continue working on a project:
    python main.py work --project "my-webapp"

  Resume a specific session:
    python main.py work --project "my-webapp" --session "abc123"

  View all projects:
    python main.py status

  View specific project status:
    python main.py status --project "my-webapp"

  List available templates:
    python main.py templates
        """
    )

    subparsers = parser.add_subparsers(dest="command", help="Available commands")

    # Init command
    init_parser = subparsers.add_parser(
        "init",
        help="Initialize a new project with the Initializer Agent"
    )
    init_parser.add_argument(
        "--name", "-n",
        required=True,
        help="Name of the project to create"
    )
    init_parser.add_argument(
        "--type", "-t",
        required=True,
        choices=[t.value for t in ProjectType],
        help="Type of project (determines feature template)"
    )
    init_parser.add_argument(
        "--description", "-d",
        default=None,
        help="Description of what the project should do"
    )

    # Work command
    work_parser = subparsers.add_parser(
        "work",
        help="Run the Coding Agent to implement features"
    )
    work_parser.add_argument(
        "--project", "-p",
        required=True,
        help="Name of the project to work on"
    )
    work_parser.add_argument(
        "--session", "-s",
        default=None,
        help="Session ID to resume (optional)"
    )

    # Status command
    status_parser = subparsers.add_parser(
        "status",
        help="View project status and progress"
    )
    status_parser.add_argument(
        "--project", "-p",
        default=None,
        help="Name of specific project (optional, shows all if not specified)"
    )

    # Templates command
    templates_parser = subparsers.add_parser(
        "templates",
        help="List available project templates"
    )

    # Parse arguments
    args = parser.parse_args()

    if args.command is None:
        parser.print_help()
        return 0

    # Route to appropriate command handler
    if args.command == "init":
        return cmd_init(args)
    elif args.command == "work":
        return cmd_work(args)
    elif args.command == "status":
        return cmd_status(args)
    elif args.command == "templates":
        return cmd_list_templates(args)
    else:
        parser.print_help()
        return 0


if __name__ == "__main__":
    sys.exit(main())
