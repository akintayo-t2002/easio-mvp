"""Simple in-memory cache for workflow configurations."""

from typing import Optional
from uuid import UUID

from .config import WorkflowRuntimeConfig


class WorkflowCache:
    """In-memory cache for loaded workflow configurations."""

    def __init__(self):
        self._cache: dict[str, WorkflowRuntimeConfig] = {}

    def get(self, version_id: UUID) -> Optional[WorkflowRuntimeConfig]:
        """Get cached workflow config by version ID."""
        return self._cache.get(str(version_id))

    def set(self, version_id: UUID, config: WorkflowRuntimeConfig) -> None:
        """Cache a workflow configuration."""
        self._cache[str(version_id)] = config

    def invalidate(self, version_id: UUID) -> None:
        """Remove a workflow config from cache."""
        self._cache.pop(str(version_id), None)

    def clear(self) -> None:
        """Clear all cached workflows."""
        self._cache.clear()


# Global cache instance
_workflow_cache = WorkflowCache()


def get_workflow_cache() -> WorkflowCache:
    """Get the global workflow cache instance."""
    return _workflow_cache










