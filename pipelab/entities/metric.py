# Copyright (c) 2026 Tarlis Portela <tarlis@tarlis.com.br>
# Licensed under the Apache License, Version 2.0.

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True)
class MetricType:
    key: str
    name: str
    description: str | None = None
    higher_is_better: bool | None = None


@dataclass(frozen=True)
class Metric:
    metric: MetricType
    value: float