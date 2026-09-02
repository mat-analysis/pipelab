# Copyright (c) 2026 Tarlis Portela <tarlis@tarlis.com.br>
# Licensed under the Apache License, Version 2.0.

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True)
class Deployment:
    model_name: str
    version: str
    alias: str                       # 'production' | 'champion' | 'staging'
    endpoint_uri: str | None = None
    status: str = "active"           # 'active' | 'inactive' | 'rolling'
    created_at: float | None = None
    updated_at: float | None = None
    port: int | None = None
    pid: int | None = None
