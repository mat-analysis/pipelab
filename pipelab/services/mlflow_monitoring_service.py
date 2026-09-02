# Copyright (c) 2026 Tarlis Portela <tarlis@tarlis.com.br>
# Licensed under the Apache License, Version 2.0.

"""Monitoring service — in-memory prediction stats and alerts."""
from __future__ import annotations

import time
import uuid
from typing import Any

from pipelab.entities import MonitoringRecord, Alert
from pipelab.services.interfaces import MonitoringService

_records: dict[str, list[MonitoringRecord]] = {}
_alerts: dict[str, Alert] = {}


class MlflowMonitoringService(MonitoringService):

    def list_records(self, deployment_id: str,
                     limit: int = 100) -> list[MonitoringRecord]:
        return (_records.get(deployment_id) or [])[-limit:]

    def record_prediction(self, deployment_id: str,
                          latency_ms: float,
                          metadata: dict[str, Any] | None = None) -> None:
        bucket = _records.setdefault(deployment_id, [])
        if bucket and (time.time() - bucket[-1].timestamp) < 60:
            # Aggregate into the current bucket
            last = bucket[-1]
            new_count = last.prediction_count + 1
            new_avg = ((last.avg_latency_ms or 0) * last.prediction_count + latency_ms) / new_count
            bucket[-1] = MonitoringRecord(
                deployment_id=deployment_id,
                timestamp=last.timestamp,
                prediction_count=new_count,
                avg_latency_ms=round(new_avg, 2),
                metadata=metadata or last.metadata,
            )
        else:
            bucket.append(MonitoringRecord(
                deployment_id=deployment_id,
                timestamp=time.time(),
                prediction_count=1,
                avg_latency_ms=latency_ms,
                metadata=metadata or {},
            ))

    def list_alerts(self, resolved: bool | None = None) -> list[Alert]:
        alerts = list(_alerts.values())
        if resolved is not None:
            alerts = [a for a in alerts if a.resolved == resolved]
        return sorted(alerts, key=lambda a: a.triggered_at or 0, reverse=True)

    def create_alert(self, severity: str, message: str,
                     metric_key: str | None = None,
                     threshold: float | None = None) -> Alert:
        alert_id = uuid.uuid4().hex[:12]
        alert = Alert(
            id=alert_id,
            severity=severity,
            message=message,
            metric_key=metric_key,
            threshold=threshold,
            triggered_at=time.time(),
        )
        _alerts[alert_id] = alert
        return alert

    def resolve_alert(self, alert_id: str) -> bool:
        alert = _alerts.get(alert_id)
        if alert is None:
            return False
        _alerts[alert_id] = Alert(
            id=alert.id,
            severity=alert.severity,
            message=alert.message,
            metric_key=alert.metric_key,
            threshold=alert.threshold,
            triggered_at=alert.triggered_at,
            resolved=True,
        )
        return True
