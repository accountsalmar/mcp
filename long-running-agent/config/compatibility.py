"""
Feature Compatibility System for Long-Running Agents.

This module ensures features developed across different sessions
remain compatible and integrate smoothly with each other.

Key Mechanisms:
1. Feature Dependencies - Explicit dependency tracking between features
2. Interface Contracts - Shared APIs that features must follow
3. Integration Tests - Tests that verify features work together
4. Regression Testing - Ensure changes don't break existing features
5. Compatibility Validation - Pre-implementation compatibility checks

Based on: https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents
"""

import json
from pathlib import Path
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional, Set
from enum import Enum


class FeatureStatus(Enum):
    """Status of a feature in the development lifecycle."""
    PENDING = "pending"           # Not yet started
    IN_PROGRESS = "in_progress"   # Currently being implemented
    COMPLETED = "completed"       # Implementation done, tests pass
    BLOCKED = "blocked"           # Blocked by dependency
    NEEDS_UPDATE = "needs_update" # Dependency changed, needs review


@dataclass
class FeatureDependency:
    """
    Represents a dependency between features.

    Attributes:
        feature_id: The feature this one depends on
        dependency_type: Type of dependency (hard, soft, interface)
        interface_contract: Name of shared interface if applicable
    """
    feature_id: str
    dependency_type: str = "hard"  # hard, soft, interface
    interface_contract: Optional[str] = None


@dataclass
class InterfaceContract:
    """
    Defines a shared interface that multiple features must follow.

    This ensures features that depend on each other use compatible
    APIs, data structures, and calling conventions.

    Attributes:
        name: Unique name for the interface
        description: What this interface does
        version: Version string for tracking changes
        methods: List of method signatures
        data_structures: Shared data structure definitions
        implemented_by: Features that implement this interface
        used_by: Features that use this interface
    """
    name: str
    description: str
    version: str = "1.0.0"
    methods: List[Dict[str, Any]] = field(default_factory=list)
    data_structures: List[Dict[str, Any]] = field(default_factory=list)
    implemented_by: List[str] = field(default_factory=list)
    used_by: List[str] = field(default_factory=list)


@dataclass
class IntegrationTest:
    """
    Defines a test that verifies multiple features work together.

    Attributes:
        id: Unique test identifier
        name: Human-readable test name
        features_tested: List of feature IDs this test covers
        test_file: Path to the test file
        test_function: Name of the test function
        last_run: Timestamp of last execution
        last_result: Pass/Fail result
    """
    id: str
    name: str
    features_tested: List[str]
    test_file: str
    test_function: str
    last_run: Optional[str] = None
    last_result: Optional[str] = None


class CompatibilityManager:
    """
    Manages feature compatibility across agent sessions.

    This class provides methods to:
    1. Track and validate feature dependencies
    2. Manage interface contracts
    3. Run integration tests
    4. Detect compatibility issues before implementation
    """

    def __init__(self, project_path: Path):
        """Initialize the compatibility manager for a project."""
        self.project_path = project_path
        self.features_path = project_path / "features.json"
        self.contracts_path = project_path / "interface_contracts.json"
        self.integration_tests_path = project_path / "integration_tests.json"

    def load_features(self) -> Dict[str, Any]:
        """Load features from features.json."""
        if not self.features_path.exists():
            return {"features": []}
        with open(self.features_path, 'r') as f:
            return json.load(f)

    def load_contracts(self) -> Dict[str, InterfaceContract]:
        """Load interface contracts."""
        if not self.contracts_path.exists():
            return {}
        with open(self.contracts_path, 'r') as f:
            data = json.load(f)
            return {k: InterfaceContract(**v) for k, v in data.items()}

    def load_integration_tests(self) -> List[IntegrationTest]:
        """Load integration test definitions."""
        if not self.integration_tests_path.exists():
            return []
        with open(self.integration_tests_path, 'r') as f:
            data = json.load(f)
            return [IntegrationTest(**t) for t in data]

    def get_feature_dependencies(self, feature_id: str) -> List[str]:
        """
        Get all features that a given feature depends on.

        Returns both direct and transitive dependencies.
        """
        features_data = self.load_features()
        features = features_data.get("features", [])

        # Build dependency graph
        dep_graph = {}
        for f in features:
            fid = f.get("id")
            deps = f.get("dependencies", [])
            dep_graph[fid] = [d.get("feature_id") if isinstance(d, dict) else d for d in deps]

        # Find all dependencies (transitive closure)
        visited = set()
        to_visit = dep_graph.get(feature_id, [])

        while to_visit:
            dep = to_visit.pop()
            if dep not in visited:
                visited.add(dep)
                to_visit.extend(dep_graph.get(dep, []))

        return list(visited)

    def get_dependent_features(self, feature_id: str) -> List[str]:
        """
        Get all features that depend on a given feature.

        This is crucial for knowing what might break if we change a feature.
        """
        features_data = self.load_features()
        features = features_data.get("features", [])

        dependents = []
        for f in features:
            deps = f.get("dependencies", [])
            dep_ids = [d.get("feature_id") if isinstance(d, dict) else d for d in deps]
            if feature_id in dep_ids:
                dependents.append(f.get("id"))

        return dependents

    def validate_dependency_order(self, feature_id: str) -> Dict[str, Any]:
        """
        Validate that all dependencies are completed before implementing a feature.

        Returns:
            {
                "can_implement": bool,
                "missing_dependencies": list of incomplete dependency IDs,
                "blocked_by": list of features blocking this one
            }
        """
        features_data = self.load_features()
        features = features_data.get("features", [])

        # Create a lookup
        feature_lookup = {f.get("id"): f for f in features}

        # Get target feature
        target = feature_lookup.get(feature_id)
        if not target:
            return {"can_implement": False, "error": f"Feature {feature_id} not found"}

        # Get dependencies
        deps = target.get("dependencies", [])
        dep_ids = [d.get("feature_id") if isinstance(d, dict) else d for d in deps]

        # Check which dependencies are incomplete
        missing = []
        for dep_id in dep_ids:
            dep_feature = feature_lookup.get(dep_id)
            if dep_feature and not dep_feature.get("passes", False):
                missing.append(dep_id)

        return {
            "can_implement": len(missing) == 0,
            "missing_dependencies": missing,
            "blocked_by": missing
        }

    def check_interface_compatibility(self, feature_id: str) -> Dict[str, Any]:
        """
        Check if a feature's implementation is compatible with its interface contracts.

        Returns compatibility issues if any.
        """
        contracts = self.load_contracts()
        issues = []

        for name, contract in contracts.items():
            if feature_id in contract.implemented_by:
                # Feature implements this interface - check it provides all methods
                issues.append({
                    "contract": name,
                    "type": "implements",
                    "required_methods": contract.methods,
                    "required_structures": contract.data_structures
                })
            elif feature_id in contract.used_by:
                # Feature uses this interface - check dependency is complete
                for implementer in contract.implemented_by:
                    validation = self.validate_dependency_order(implementer)
                    if not validation.get("can_implement"):
                        issues.append({
                            "contract": name,
                            "type": "dependency",
                            "message": f"Interface {name} is not yet implemented by {implementer}"
                        })

        return {
            "compatible": len([i for i in issues if i.get("type") == "dependency"]) == 0,
            "contracts": issues
        }

    def get_integration_tests_for_feature(self, feature_id: str) -> List[IntegrationTest]:
        """Get all integration tests that involve a specific feature."""
        tests = self.load_integration_tests()
        return [t for t in tests if feature_id in t.features_tested]

    def generate_compatibility_report(self, feature_id: str) -> Dict[str, Any]:
        """
        Generate a comprehensive compatibility report for a feature.

        This should be run BEFORE implementing any feature to understand
        the compatibility landscape.
        """
        return {
            "feature_id": feature_id,
            "dependency_validation": self.validate_dependency_order(feature_id),
            "interface_compatibility": self.check_interface_compatibility(feature_id),
            "dependencies": self.get_feature_dependencies(feature_id),
            "dependents": self.get_dependent_features(feature_id),
            "integration_tests": [
                {"id": t.id, "name": t.name, "features": t.features_tested}
                for t in self.get_integration_tests_for_feature(feature_id)
            ],
            "recommendations": self._generate_recommendations(feature_id)
        }

    def _generate_recommendations(self, feature_id: str) -> List[str]:
        """Generate recommendations for implementing a feature safely."""
        recommendations = []

        # Check dependencies
        dep_validation = self.validate_dependency_order(feature_id)
        if not dep_validation.get("can_implement"):
            missing = dep_validation.get("missing_dependencies", [])
            recommendations.append(
                f"BLOCKED: Complete these features first: {', '.join(missing)}"
            )

        # Check dependents (what might break)
        dependents = self.get_dependent_features(feature_id)
        if dependents:
            recommendations.append(
                f"CAUTION: These features depend on this one: {', '.join(dependents)}. "
                f"Changes may require updates to dependent features."
            )

        # Check integration tests
        tests = self.get_integration_tests_for_feature(feature_id)
        if tests:
            recommendations.append(
                f"Run these integration tests after implementation: "
                f"{', '.join(t.name for t in tests)}"
            )
        else:
            recommendations.append(
                "Consider adding integration tests for this feature."
            )

        # Check interface contracts
        interface_check = self.check_interface_compatibility(feature_id)
        for contract in interface_check.get("contracts", []):
            if contract.get("type") == "implements":
                recommendations.append(
                    f"This feature must implement interface '{contract['contract']}'. "
                    f"Ensure all required methods are provided."
                )

        return recommendations


def create_enhanced_feature_schema() -> Dict[str, Any]:
    """
    Create the enhanced feature schema with compatibility tracking.

    This schema extends the basic feature format with:
    - Dependencies
    - Interface contracts
    - Integration test references
    - Compatibility metadata
    """
    return {
        "id": "string - Unique feature identifier (e.g., F001)",
        "category": "string - Feature category (setup, core, api, etc.)",
        "description": "string - What the feature does",
        "steps": ["list of verification steps"],
        "priority": "int - 1 (highest) to 5 (lowest)",
        "passes": "bool - Whether feature is complete",

        # NEW: Compatibility fields
        "dependencies": [
            {
                "feature_id": "string - ID of feature this depends on",
                "dependency_type": "hard|soft|interface",
                "interface_contract": "string - Name of interface contract (optional)"
            }
        ],
        "implements_interfaces": ["list of interface contract names"],
        "uses_interfaces": ["list of interface contract names"],
        "integration_tests": ["list of integration test IDs"],
        "breaking_change_risk": "low|medium|high - Risk of breaking dependents",
        "last_verified_compatible": "timestamp - When compatibility was last verified"
    }
