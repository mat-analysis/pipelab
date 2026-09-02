# Copyright (c) 2026 Tarlis Portela <tarlis@tarlis.com.br>
# Licensed under the Apache License, Version 2.0.

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True)
class DatasetVersion:
    dataset_id: str
    version: str
    uri: str | None = None
    description: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)
    created_at: float | None = None
    num_rows: int | None = None
    num_columns: int | None = None
    columns: list[str] = field(default_factory=list)
