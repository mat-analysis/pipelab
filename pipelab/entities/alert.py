# Copyright (c) 2026 Tarlis Portela <tarlis@tarlis.com.br>
# Licensed under the Apache License, Version 2.0.

from __future__ import annotations
from dataclasses import dataclass


@dataclass(frozen=True)
class Alert:
    id: str
    severity: str             # 'info' | 'warning' | 'critical'
    message: str
    metric_key: str | None = None
    threshold: float | None = None
    triggered_at: float | None = None   # epoch timestamp
    resolved: bool = False
