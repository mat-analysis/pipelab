# Copyright (c) 2026 Tarlis Portela <tarlis@tarlis.com.br>
# Licensed under the Apache License, Version 2.0.

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True)
class MonitoringRecord:
    deployment_id: str
    timestamp: float
    prediction_count: int = 0
    avg_latency_ms: float | None = None
    error_rate: float | None = None
    drift_score: float | None = None
    drift_details: dict[str, Any] = field(default_factory=dict)
    metadata: dict[str, Any] = field(default_factory=dict)
