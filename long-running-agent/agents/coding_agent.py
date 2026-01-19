"""
Coding Agent for Long-Running Agent System.

This agent runs in EVERY SUBSEQUENT SESSION to implement features.

ENHANCED Session Protocol (with Compatibility Checks):
1. Check working directory
2. Review progress files and git logs
3. Select highest-priority incomplete feature
4. **RUN COMPATIBILITY CHECK** - Verify dependencies are complete
5. **RUN SMOKE TESTS** - Ensure system is healthy before changes
6. Verify basic functionality through tests
7. Implement the feature incrementally
8. **RUN INTEGRATION TESTS** - Verify feature works with others
9. Commit changes with descriptive messages
10. Update feature status to passes=true

Based on: https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents
"""

import asyncio
import json
from pathlib import Path
from datetime import datetime
from typing import Optional, List, Dict, Any
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

# Load .env BEFORE importing SDK (critical for API key)
from dotenv import load_dotenv
env_path = Path(__file__).parent.parent / ".env"
load_dotenv(env_path, override=True)

from claude_agent_sdk import query, ClaudeAgentOptions, AssistantMessage, ResultMessage
from config.agent_config import AgentConfig, default_config
from config.compatibility import CompatibilityManager
from config.integration_testing import IntegrationTestRunner


class CodingAgent:
    """
    Agent that runs in subsequent sessions to implement features.

    The Coding Agent follows a strict session protocol:
    1. Review current state (progress files, git history)
    2. Select the highest-priority incomplete feature
    3. Implement the feature incrementally
    4. Test and verify
    5. Commit changes and update feature status

    Usage:
        agent = CodingAgent(project_name="my-app")
        await agent.run()  # or
        await agent.run(session_id="previous-session-id")  # to resume
    """

    def __init__(
        self,
        project_name: str,
        config: AgentConfig = default_config
    ):
        """
        Initialize the Coding Agent.

        Args:
            project_name: Name of the project to work on
            config: Agent configuration (uses default if not provided)
        """
        self.project_name = project_name
        self.config = config

        # Derived paths
        self.project_path = config.get_project_path(project_name)
        self.features_path = config.get_features_path(project_name)
        self.progress_path = config.get_progress_path(project_name)
        self.session_path = config.get_session_path(project_name)

        # Compatibility systems
        self.compat_manager = CompatibilityManager(self.project_path)
        self.test_runner = IntegrationTestRunner(self.project_path)

    def _load_features(self) -> List[Dict[str, Any]]:
        """Load features from features.json."""
        if not self.features_path.exists():
            return []

        with open(self.features_path, 'r') as f:
            data = json.load(f)
            if isinstance(data, list):
                return data
            elif isinstance(data, dict) and 'features' in data:
                return data['features']
            return []

    def _get_incomplete_features(self) -> List[Dict[str, Any]]:
        """Get list of incomplete features, sorted by priority."""
        features = self._load_features()
        incomplete = [f for f in features if not f.get('passes', False)]
        # Sort by priority (lower number = higher priority)
        incomplete.sort(key=lambda x: x.get('priority', 5))
        return incomplete

    def _get_implementable_features(self) -> List[Dict[str, Any]]:
        """
        Get features that can be implemented (all dependencies complete).

        This filters out features that are blocked by incomplete dependencies.
        """
        incomplete = self._get_incomplete_features()
        implementable = []

        for feature in incomplete:
            feature_id = feature.get('id')
            validation = self.compat_manager.validate_dependency_order(feature_id)
            if validation.get('can_implement', True):
                implementable.append(feature)

        return implementable

    def _run_pre_implementation_checks(self, feature_id: str) -> Dict[str, Any]:
        """
        Run all pre-implementation compatibility checks.

        Returns:
            {
                "can_proceed": bool,
                "compatibility_report": full report,
                "smoke_test_results": test results,
                "warnings": list of warnings,
                "blockers": list of blocking issues
            }
        """
        print("\n[Running Pre-Implementation Checks...]")

        # 1. Get compatibility report
        compat_report = self.compat_manager.generate_compatibility_report(feature_id)

        # 2. Run smoke tests
        smoke_results = self.test_runner.run_smoke_tests()
        smoke_passed = all(r.passed for r in smoke_results)

        # 3. Analyze results
        warnings = []
        blockers = []

        # Check dependency validation
        dep_validation = compat_report.get("dependency_validation", {})
        if not dep_validation.get("can_implement", True):
            missing = dep_validation.get("missing_dependencies", [])
            blockers.append(f"Missing dependencies: {', '.join(missing)}")

        # Check for dependent features (things that might break)
        dependents = compat_report.get("dependents", [])
        if dependents:
            warnings.append(
                f"CAUTION: Features {', '.join(dependents)} depend on this. "
                f"Changes may affect them."
            )

        # Check smoke tests
        if not smoke_passed:
            failed_tests = [r.test_name for r in smoke_results if not r.passed]
            blockers.append(f"Smoke tests failed: {', '.join(failed_tests)}")

        # Add recommendations
        for rec in compat_report.get("recommendations", []):
            if rec.startswith("BLOCKED"):
                blockers.append(rec)
            elif rec.startswith("CAUTION"):
                warnings.append(rec)

        can_proceed = len(blockers) == 0

        return {
            "can_proceed": can_proceed,
            "compatibility_report": compat_report,
            "smoke_test_results": [
                {"name": r.test_name, "passed": r.passed} for r in smoke_results
            ],
            "warnings": warnings,
            "blockers": blockers
        }

    def _run_post_implementation_tests(self, feature_id: str) -> Dict[str, Any]:
        """
        Run integration tests after implementing a feature.

        Returns test results and any compatibility issues found.
        """
        print("\n[Running Post-Implementation Tests...]")

        # Run integration tests for this feature
        int_results = self.test_runner.run_integration_tests(feature_ids=[feature_id])

        # Run regression tests for dependent features
        reg_results = self.test_runner.run_regression_tests(feature_id)

        all_passed = (
            all(r.passed for r in int_results) and
            all(r.passed for r in reg_results)
        )

        return {
            "all_passed": all_passed,
            "integration_tests": [
                {"name": r.test_name, "passed": r.passed, "error": r.error_message}
                for r in int_results
            ],
            "regression_tests": [
                {"name": r.test_name, "passed": r.passed, "error": r.error_message}
                for r in reg_results
            ]
        }

    def _get_progress_summary(self) -> str:
        """Read and summarize the progress file."""
        if not self.progress_path.exists():
            return "No progress file found."

        with open(self.progress_path, 'r') as f:
            content = f.read()

        # Return last 50 lines or full content if shorter
        lines = content.split('\n')
        if len(lines) > 50:
            return f"... (showing last 50 lines)\n" + '\n'.join(lines[-50:])
        return content

    def _build_system_prompt(self, pre_check_results: Dict[str, Any] = None) -> str:
        """Build the system prompt for the Coding Agent."""
        features = self._load_features()
        incomplete = self._get_incomplete_features()
        implementable = self._get_implementable_features()
        completed = len(features) - len(incomplete)

        # Build compatibility context
        compat_context = ""
        if pre_check_results:
            warnings = pre_check_results.get("warnings", [])
            if warnings:
                compat_context += "\n## Compatibility Warnings\n"
                for w in warnings:
                    compat_context += f"- {w}\n"

            compat_report = pre_check_results.get("compatibility_report", {})
            dependents = compat_report.get("dependents", [])
            if dependents:
                compat_context += f"\n## Dependent Features (may be affected by changes)\n"
                compat_context += f"These features depend on this one: {', '.join(dependents)}\n"
                compat_context += "Be careful not to break their expected interfaces!\n"

        return f"""You are the Coding Agent for a long-running project system.

Your job is to implement features one at a time, following a strict session protocol.
You are ONE SESSION in a long chain of sessions - maintain compatibility with past and future work.

## Project Information
- **Name**: {self.project_name}
- **Project Path**: {self.project_path}
- **Features**: {len(features)} total, {completed} completed, {len(incomplete)} remaining
- **Implementable Now**: {len(implementable)} (others blocked by dependencies)
{compat_context}

## ENHANCED Session Protocol (MUST FOLLOW)

### Phase 1: Pre-Implementation
1. **Check Environment**
   - Verify working directory is correct
   - Ensure all required files exist

2. **Review Progress**
   - Read claude-progress.txt for context from previous sessions
   - Check git log for recent changes
   - Understand what was done before

3. **Check Dependencies**
   - Review the feature's dependencies (if any)
   - Verify all required features are complete
   - If blocked, select a different feature or document the blocker

4. **Run Smoke Tests**
   - Verify the project builds/runs
   - Ensure existing functionality works

### Phase 2: Implementation
5. **Implement Feature**
   - Work incrementally, committing often
   - Write tests for new functionality
   - Follow project coding standards
   - **MAINTAIN INTERFACE COMPATIBILITY** with dependent features

6. **Write Integration Tests**
   - Create tests that verify this feature works with related features
   - Test data flow between features
   - Test error handling across feature boundaries

### Phase 3: Verification
7. **Run All Tests**
   - Unit tests for the new feature
   - Integration tests with related features
   - Regression tests for dependent features

8. **Verify Compatibility**
   - Check that features depending on this one still work
   - Verify shared interfaces are not broken
   - Test error propagation

### Phase 4: Completion
9. **Update Status**
   - Update features.json: set "passes": true
   - Add session summary to claude-progress.txt
   - Document any interface changes for future sessions

10. **Commit with Context**
    - Descriptive commit message
    - Note which features this relates to
    - Document any breaking changes

## Critical Compatibility Rules

1. **NEVER BREAK SHARED INTERFACES**
   - If a feature uses a function/API, don't change its signature
   - Add new parameters as optional with defaults
   - If you must break an interface, update ALL dependent features

2. **DEPENDENCY ORDER MATTERS**
   - Don't implement feature F005 if it depends on incomplete F003
   - Check the "dependencies" field in features.json
   - If blocked, document it and work on something else

3. **INTEGRATION TESTS ARE REQUIRED**
   - After completing a feature, verify it works with related features
   - Run regression tests for features that depend on this one

4. **DOCUMENT INTERFACES**
   - When creating a function/class that others will use, document it
   - Include type hints and docstrings
   - Note which features are expected to use it

## Feature Format (Enhanced)

Each feature in features.json has:
- "id": Unique identifier
- "category": Category (core, ui, api, testing, etc.)
- "description": What the feature does
- "steps": Verification steps
- "priority": 1-5 (1 is highest)
- "passes": Boolean (you set this to true when complete)
- "dependencies": List of feature IDs this depends on (NEW)
- "implements_interfaces": Interfaces this provides (NEW)
- "uses_interfaces": Interfaces this consumes (NEW)

## At Session End

Before finishing, you MUST:
1. Run integration tests for this feature
2. Run regression tests for dependent features
3. Ensure all changes are committed
4. Update claude-progress.txt with:
   - What you implemented
   - Any interface changes
   - Known compatibility issues
   - Recommendations for next session
5. Update features.json if you completed a feature
"""

    async def run(self, session_id: Optional[str] = None) -> dict:
        """
        Run the Coding Agent for one session.

        Args:
            session_id: Optional session ID to resume from

        Returns:
            Dictionary with:
            - success: Boolean indicating if session completed successfully
            - session_id: Session ID for this run
            - features_completed: List of feature IDs completed this session
            - message: Summary message
        """
        print(f"\n{'='*60}")
        print(f"CODING AGENT - Working on: {self.project_name}")
        if session_id:
            print(f"Resuming session: {session_id}")
        print(f"{'='*60}\n")

        # Validate project exists
        if not self.project_path.exists():
            return {
                "success": False,
                "session_id": None,
                "features_completed": [],
                "message": f"Project not found: {self.project_path}. Run 'init' first."
            }

        # Validate configuration
        errors = self.config.validate()
        if errors:
            return {
                "success": False,
                "session_id": session_id,
                "features_completed": [],
                "message": f"Configuration errors: {', '.join(errors)}"
            }

        # Get incomplete features
        incomplete = self._get_incomplete_features()
        if not incomplete:
            return {
                "success": True,
                "session_id": session_id,
                "features_completed": [],
                "message": "All features are complete! Project is finished."
            }

        # Get implementable features (respecting dependencies)
        implementable = self._get_implementable_features()
        if not implementable:
            blocked_by = []
            for f in incomplete:
                validation = self.compat_manager.validate_dependency_order(f.get('id'))
                if not validation.get('can_implement'):
                    blocked_by.extend(validation.get('missing_dependencies', []))
            return {
                "success": False,
                "session_id": session_id,
                "features_completed": [],
                "message": f"All remaining features are blocked by dependencies: {', '.join(set(blocked_by))}"
            }

        # Select the next implementable feature
        next_feature = implementable[0]
        feature_id = next_feature.get('id')

        # Run pre-implementation compatibility checks
        pre_check_results = self._run_pre_implementation_checks(feature_id)

        if not pre_check_results.get("can_proceed"):
            blockers = pre_check_results.get("blockers", [])
            return {
                "success": False,
                "session_id": session_id,
                "features_completed": [],
                "message": f"Cannot proceed - blockers: {'; '.join(blockers)}"
            }

        # Display warnings
        for warning in pre_check_results.get("warnings", []):
            print(f"[WARNING] {warning}")

        # Get progress summary
        progress_summary = self._get_progress_summary()

        # Build compatibility context for prompt
        compat_info = ""
        compat_report = pre_check_results.get("compatibility_report", {})
        deps = compat_report.get("dependencies", [])
        dependents = compat_report.get("dependents", [])

        if deps:
            compat_info += f"\n## This Feature Depends On\n"
            compat_info += f"Features: {', '.join(deps)}\n"
            compat_info += "Review these implementations before starting.\n"

        if dependents:
            compat_info += f"\n## Features That Will Use This\n"
            compat_info += f"Features: {', '.join(dependents)}\n"
            compat_info += "Design interfaces carefully - they cannot easily change later!\n"

        # Build the prompt
        prompt = f"""Start a new coding session for project "{self.project_name}".

## Current Progress
{progress_summary}
{compat_info}
## Next Feature to Implement
```json
{json.dumps(next_feature, indent=2)}
```

## Remaining Features
{len(incomplete)} features remaining, {len(implementable)} implementable now.

## Pre-Implementation Checks PASSED
- Smoke tests: All passed
- Dependencies: All complete
- Interface compatibility: Verified

## Session Protocol

1. First, check the project directory and read any relevant files
2. Review the git log to understand recent changes
3. **Review implementations of features this depends on** (if any)
4. Implement the feature described above
5. **Write integration tests** that verify this works with related features
6. Test your implementation (unit + integration)
7. Update features.json to mark the feature as complete (passes: true)
8. Add a session summary to claude-progress.txt including:
   - What interfaces you created/modified
   - Any compatibility notes for future sessions
9. Commit all changes with descriptive message

Begin by navigating to the project directory and understanding the current state.
"""

        new_session_id = None
        features_completed = []
        result_message = ""

        try:
            # Build options with compatibility context
            options = ClaudeAgentOptions(
                allowed_tools=self.config.coding_tools,
                permission_mode=self.config.permission_mode,
                system_prompt=self._build_system_prompt(pre_check_results),
                cwd=str(self.project_path),
                model=self.config.model
            )

            # Resume if session_id provided
            if session_id:
                options.resume = session_id

            async for message in query(prompt=prompt, options=options):
                # Capture session ID from init message
                if hasattr(message, 'subtype') and message.subtype == 'init':
                    if hasattr(message, 'session_id'):
                        new_session_id = message.session_id
                    elif hasattr(message, 'data') and isinstance(message.data, dict):
                        new_session_id = message.data.get('session_id')
                    print(f"[Session: {new_session_id}]")

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

            # Check which features are now complete
            current_incomplete = self._get_incomplete_features()
            for feature in incomplete:
                if feature not in current_incomplete:
                    features_completed.append(feature.get('id', 'unknown'))

            # Save session ID for future reference
            if new_session_id:
                self.session_path.mkdir(parents=True, exist_ok=True)
                session_file = self.session_path / f"session_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
                with open(session_file, 'w') as f:
                    f.write(f"Session ID: {new_session_id}\n")
                    f.write(f"Started: {datetime.now().isoformat()}\n")
                    f.write(f"Features Targeted: {next_feature.get('id', 'unknown')}\n")
                    f.write(f"Features Completed: {', '.join(features_completed) or 'None'}\n")

            return {
                "success": True,
                "session_id": new_session_id,
                "features_completed": features_completed,
                "message": f"Session completed. Features finished: {', '.join(features_completed) or 'None'}"
            }

        except Exception as e:
            return {
                "success": False,
                "session_id": new_session_id or session_id,
                "features_completed": features_completed,
                "message": f"Error during session: {str(e)}"
            }

    def get_status(self) -> dict:
        """
        Get the current status of the project.

        Returns:
            Dictionary with project status information
        """
        features = self._load_features()
        incomplete = self._get_incomplete_features()
        completed = len(features) - len(incomplete)

        # Get recent session files
        sessions = []
        if self.session_path.exists():
            session_files = sorted(self.session_path.glob("session_*.txt"), reverse=True)[:5]
            for sf in session_files:
                sessions.append(sf.name)

        return {
            "project_name": self.project_name,
            "project_path": str(self.project_path),
            "exists": self.project_path.exists(),
            "features_total": len(features),
            "features_completed": completed,
            "features_remaining": len(incomplete),
            "completion_percentage": round(completed / len(features) * 100, 1) if features else 0,
            "next_feature": incomplete[0] if incomplete else None,
            "recent_sessions": sessions
        }


async def main():
    """Example usage of the Coding Agent."""
    # Work on a project (assumes it was initialized)
    agent = CodingAgent(project_name="test-project")

    # Show status first
    status = agent.get_status()
    print(f"Project Status: {json.dumps(status, indent=2)}")

    if status['exists']:
        result = await agent.run()
        print(f"\nResult: {json.dumps(result, indent=2)}")
    else:
        print(f"\nProject does not exist. Run 'init' first.")


if __name__ == "__main__":
    asyncio.run(main())
