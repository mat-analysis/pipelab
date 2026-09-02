# Copyright (c) 2026 Tarlis Portela <tarlis@tarlis.com.br>
# Licensed under the Apache License, Version 2.0.

"""Monitoring API router — prediction stats, drift, alerts."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException

from pipelab.api.app import get_service
from pipelab.api.schemas import (
    MonitoringRecordOut, AlertCreate, AlertOut,
)

router = APIRouter()


@router.get("/records/{deployment_id}", response_model=list[MonitoringRecordOut])
async def list_records(deployment_id: str, limit: int = 100):
    svc = get_service("monitoring")
    return [MonitoringRecordOut(**{k: getattr(r, k) for k in MonitoringRecordOut.model_fields})
            for r in svc.list_records(deployment_id, limit)]


@router.get("/alerts", response_model=list[AlertOut])
async def list_alerts(resolved: bool | None = None):
    svc = get_service("monitoring")
    return [AlertOut(**{k: getattr(a, k) for k in AlertOut.model_fields})
            for a in svc.list_alerts(resolved)]


@router.post("/alerts", response_model=AlertOut, status_code=201)
async def create_alert(body: AlertCreate):
    svc = get_service("monitoring")
    a = svc.create_alert(body.severity, body.message, body.metric_key, body.threshold)
    return AlertOut(**{k: getattr(a, k) for k in AlertOut.model_fields})


@router.put("/alerts/{alert_id}/resolve")
async def resolve_alert(alert_id: str):
    svc = get_service("monitoring")
    if not svc.resolve_alert(alert_id):
        raise HTTPException(404, "Alert not found")
    return {"ok": True}
