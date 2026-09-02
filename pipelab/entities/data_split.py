# Copyright (c) 2026 Tarlis Portela <tarlis@tarlis.com.br>
# Licensed under the Apache License, Version 2.0.

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True)
class DataSplit:
    name: str
    dataset_id: str | None = None
    split_method: str | None = None    # 'kfold' | 'train_test' | 'custom'
    split_params: dict[str, Any] = field(default_factory=dict)
    sets: dict[str, Any] = field(default_factory=dict)
