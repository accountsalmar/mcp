"""
Integration Testing Framework for Long-Running Agents.

This module provides tools to verify that features developed across
different agent sessions work together correctly.

Key Concepts:
1. Integration Tests - Test multiple features working together
2. Regression Tests - Ensure changes don't break existing features
3. Smoke Tests - Quick verification that system still works
4. Contract Tests - Verify interface contracts are satisfied

The Session Protocol requires:
- Run smoke tests BEFORE starting work
- Run integration tests AFTER completing a feature
- Run regression tests if modifying existing features
"""

import json
import subprocess
from pathlib import Path
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional
from datetime import datetime
from enum import Enum


class TestType(Enum):
    """Types of tests in the compatibility system."""
    UNIT = "unit"               # Tests single feature in isolation
    INTEGRATION = "integration"  # Tests multiple features together
    REGRESSION = "regression"    # Tests that nothing broke
    SMOKE = "smoke"             # Quick system health check
    CONTRACT = "contract"        # Tests interface contracts


@dataclass
class TestResult:
    """Result of running a test."""
    test_id: str
    test_name: str
    test_type: TestType
    passed: bool
    duration_ms: int
    error_message: Optional[str] = None
    features_tested: List[str] = field(default_factory=list)
    timestamp: str = field(default_factory=lambda: datetime.now().isoformat())


@dataclass
class TestSuite:
    """Collection of related tests."""
    name: str
    test_type: TestType
    tests: List[Dict[str, Any]]
    run_before_implementation: bool = False
    run_after_implementation: bool = True


class IntegrationTestRunner:
    """
    Runs integration tests to verify feature compatibility.

    This runner is used by the Coding Agent to:
    1. Run smoke tests before starting implementation
    2. Run integration tests after completing a feature
    3. Run regression tests when modifying existing code
    """

    def __init__(self, project_path: Path):
        """Initialize the test runner for a project."""
        self.project_path = project_path
        self.tests_path = project_path / "tests"
        self.results_path = project_path / "test_results"
        self.config_path = project_path / "test_config.json"

    def load_test_config(self) -> Dict[str, Any]:
        """Load test configuration."""
        if not self.config_path.exists():
            return self._create_default_config()
        with open(self.config_path, 'r') as f:
            return json.load(f)

    def _create_default_config(self) -> Dict[str, Any]:
        """Create default test configuration."""
        config = {
            "test_framework": "pytest",  # or unittest, jest, etc.
            "smoke_tests": {
                "enabled": True,
                "timeout_seconds": 30,
                "tests": [
                    {
                        "id": "SMOKE001",
                        "name": "Project builds successfully",
                        "command": "echo 'Build check placeholder'",
                        "expected_exit_code": 0
                    },
                    {
                        "id": "SMOKE002",
                        "name": "Core dependencies available",
                        "command": "echo 'Dependency check placeholder'",
                        "expected_exit_code": 0
                    }
                ]
            },
            "integration_tests": {
                "enabled": True,
                "timeout_seconds": 120,
                "test_directory": "tests/integration"
            },
            "regression_tests": {
                "enabled": True,
                "timeout_seconds": 300,
                "run_all_on_change": True
            }
        }

        # Save default config
        self.config_path.parent.mkdir(parents=True, exist_ok=True)
        with open(self.config_path, 'w') as f:
            json.dump(config, f, indent=2)

        return config

    def run_smoke_tests(self) -> List[TestResult]:
        """
        Run smoke tests to verify basic system health.

        These tests should be FAST and run BEFORE any implementation.
        """
        config = self.load_test_config()
        smoke_config = config.get("smoke_tests", {})

        if not smoke_config.get("enabled", True):
            return []

        results = []
        for test in smoke_config.get("tests", []):
            result = self._run_single_test(
                test_id=test["id"],
                test_name=test["name"],
                command=test.get("command", "echo 'No command'"),
                expected_exit_code=test.get("expected_exit_code", 0),
                test_type=TestType.SMOKE,
                timeout=smoke_config.get("timeout_seconds", 30)
            )
            results.append(result)

        self._save_results(results, "smoke")
        return results

    def run_integration_tests(self, feature_ids: List[str] = None) -> List[TestResult]:
        """
        Run integration tests for specific features or all features.

        Args:
            feature_ids: List of feature IDs to test. If None, runs all.
        """
        config = self.load_test_config()
        int_config = config.get("integration_tests", {})

        if not int_config.get("enabled", True):
            return []

        # Discover integration tests
        test_dir = self.project_path / int_config.get("test_directory", "tests/integration")

        results = []
        if test_dir.exists():
            # Run pytest on integration tests
            result = self._run_pytest(
                test_dir=test_dir,
                test_type=TestType.INTEGRATION,
                timeout=int_config.get("timeout_seconds", 120),
                feature_ids=feature_ids
            )
            results.extend(result)

        self._save_results(results, "integration")
        return results

    def run_regression_tests(self, changed_feature_id: str) -> List[TestResult]:
        """
        Run regression tests for a feature that was modified.

        This finds all tests related to the feature and its dependents,
        then runs them to ensure nothing broke.
        """
        config = self.load_test_config()
        reg_config = config.get("regression_tests", {})

        if not reg_config.get("enabled", True):
            return []

        # Import here to avoid circular dependency
        from config.compatibility import CompatibilityManager

        compat_manager = CompatibilityManager(self.project_path)

        # Get all features that depend on the changed feature
        dependents = compat_manager.get_dependent_features(changed_feature_id)
        features_to_test = [changed_feature_id] + dependents

        # Run integration tests for all affected features
        results = self.run_integration_tests(feature_ids=features_to_test)

        self._save_results(results, "regression")
        return results

    def _run_single_test(
        self,
        test_id: str,
        test_name: str,
        command: str,
        expected_exit_code: int,
        test_type: TestType,
        timeout: int
    ) -> TestResult:
        """Run a single test command."""
        start_time = datetime.now()

        try:
            result = subprocess.run(
                command,
                shell=True,
                cwd=str(self.project_path),
                capture_output=True,
                text=True,
                timeout=timeout
            )

            duration = int((datetime.now() - start_time).total_seconds() * 1000)
            passed = result.returncode == expected_exit_code

            return TestResult(
                test_id=test_id,
                test_name=test_name,
                test_type=test_type,
                passed=passed,
                duration_ms=duration,
                error_message=result.stderr if not passed else None
            )

        except subprocess.TimeoutExpired:
            duration = timeout * 1000
            return TestResult(
                test_id=test_id,
                test_name=test_name,
                test_type=test_type,
                passed=False,
                duration_ms=duration,
                error_message=f"Test timed out after {timeout} seconds"
            )

        except Exception as e:
            return TestResult(
                test_id=test_id,
                test_name=test_name,
                test_type=test_type,
                passed=False,
                duration_ms=0,
                error_message=str(e)
            )

    def _run_pytest(
        self,
        test_dir: Path,
        test_type: TestType,
        timeout: int,
        feature_ids: List[str] = None
    ) -> List[TestResult]:
        """Run pytest on a directory and parse results."""
        # Build pytest command
        cmd = f"python -m pytest {test_dir} -v --tb=short"

        if feature_ids:
            # Filter tests by feature markers if supported
            markers = " or ".join([f"feature_{fid}" for fid in feature_ids])
            cmd += f" -m '{markers}'"

        result = self._run_single_test(
            test_id="PYTEST_RUN",
            test_name=f"Pytest: {test_dir.name}",
            command=cmd,
            expected_exit_code=0,
            test_type=test_type,
            timeout=timeout
        )

        return [result]

    def _save_results(self, results: List[TestResult], test_type: str):
        """Save test results for later analysis."""
        self.results_path.mkdir(parents=True, exist_ok=True)

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        result_file = self.results_path / f"{test_type}_{timestamp}.json"

        with open(result_file, 'w') as f:
            json.dump(
                [
                    {
                        "test_id": r.test_id,
                        "test_name": r.test_name,
                        "test_type": r.test_type.value,
                        "passed": r.passed,
                        "duration_ms": r.duration_ms,
                        "error_message": r.error_message,
                        "timestamp": r.timestamp
                    }
                    for r in results
                ],
                f,
                indent=2
            )

    def generate_test_report(self) -> Dict[str, Any]:
        """Generate a summary report of recent test runs."""
        if not self.results_path.exists():
            return {"message": "No test results found"}

        # Get recent result files
        result_files = sorted(self.results_path.glob("*.json"), reverse=True)[:10]

        all_results = []
        for rf in result_files:
            with open(rf, 'r') as f:
                all_results.extend(json.load(f))

        passed = sum(1 for r in all_results if r.get("passed"))
        failed = sum(1 for r in all_results if not r.get("passed"))

        return {
            "total_tests": len(all_results),
            "passed": passed,
            "failed": failed,
            "pass_rate": f"{passed/len(all_results)*100:.1f}%" if all_results else "N/A",
            "recent_failures": [
                r for r in all_results if not r.get("passed")
            ][:5]
        }


def create_integration_test_template(
    test_id: str,
    test_name: str,
    features_tested: List[str],
    description: str
) -> str:
    """
    Generate a template for an integration test.

    Returns Python code for a pytest integration test.
    """
    features_marker = ", ".join([f"'feature_{f}'" for f in features_tested])

    return f'''"""
Integration Test: {test_name}

Tests that features {', '.join(features_tested)} work together correctly.

{description}
"""

import pytest


@pytest.mark.integration
@pytest.mark.parametrize("feature", [{features_marker}])
class Test{test_id}:
    """Integration tests for {test_name}."""

    def test_features_integrate(self):
        """
        Test that {', '.join(features_tested)} integrate correctly.

        This test verifies:
        1. All features are implemented
        2. Features can communicate via shared interfaces
        3. Data flows correctly between features
        """
        # TODO: Implement integration test
        #
        # Example structure:
        # 1. Set up test data
        # 2. Call feature 1
        # 3. Pass result to feature 2
        # 4. Verify final output
        #
        assert True, "Implement this integration test"

    def test_error_handling_across_features(self):
        """Test that errors in one feature are handled by dependent features."""
        # TODO: Implement error handling test
        assert True, "Implement error handling test"

    def test_data_consistency(self):
        """Test that data remains consistent across feature boundaries."""
        # TODO: Implement data consistency test
        assert True, "Implement data consistency test"
'''
