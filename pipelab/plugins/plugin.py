# Copyright (c) 2026 Tarlis Portela <tarlis@tarlis.com.br>
# Licensed under the Apache License, Version 2.0.

"""Plugin architecture for extending pipelab."""
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any, TYPE_CHECKING

if TYPE_CHECKING:
    from fastapi import APIRouter


class PipelabPlugin(ABC):
    """Base class for pipelab plugins.

    Subclasses should implement the hook methods to extend
    the platform with additional routes, services, or UI elements.
    """

    @property
    @abstractmethod
    def name(self) -> str:
        """Unique plugin identifier."""
        ...

    @property
    def description(self) -> str:
        """Human-readable description."""
        return ""

    def on_register(self, config: dict[str, Any] | None = None) -> None:
        """Called when the plugin is registered with the application."""
        pass

    def get_routes(self) -> list[APIRouter] | None:
        """Return FastAPI routers to mount under /api/v1/plugins/<name>/."""
        return None

    def get_services(self) -> dict[str, Any] | None:
        """Return service overrides or additions.

        Keys should match service interface names (e.g. 'monitoring').
        """
        return None

    def get_ui_menu_items(self) -> list[dict[str, str]] | None:
        """Return additional sidebar items: [{"label": ..., "path": ..., "icon": ...}]."""
        return None
