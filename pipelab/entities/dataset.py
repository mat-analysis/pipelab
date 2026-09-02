# Copyright (c) 2026 Tarlis Portela <tarlis@tarlis.com.br>
# Licensed under the Apache License, Version 2.0.

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True)
class Dataset:
    id: str
    label: str
    description: str | None = None
    version: str | None = None
    uri: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)
