# Copyright (c) 2026 Tarlis Portela <tarlis@tarlis.com.br>
# Licensed under the Apache License, Version 2.0.

from __future__ import annotations

from dataclasses import dataclass


@dataclass
class DiscoveredService:
    """Metadata about a discovered pipeline service class."""
    class_name: str
    module_path: str  # relative file path inside the project
    step_type: str    # 'data' | 'experiment' | 'deployment'
    docstring: str = ""
    project_name: str = ""
