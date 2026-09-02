# Copyright (c) 2026 Tarlis Portela <tarlis@tarlis.com.br>
# Licensed under the Apache License, Version 2.0.

"""Deployments API router — deploy/undeploy models via discovered DeployService providers."""
from __future__ import annotations

import time

from fastapi import APIRouter, HTTPException

from pydantic import BaseModel

from pipelab.api.app import get_project, get_discovered_services, refresh_discovery
from pipelab.api.schemas import DeployRequest, DeploymentOut
from pipelab.discovery import instantiate_service
from pipelab.pipeline import PipelineContext
from pipelab.entities.services import DeployService

router = APIRouter()

# In-memory deployment registry (production system would use persistent storage)
_active_deployments: dict[str, dict] = {}


@router.get("/", response_model=list[DeploymentOut])
async def list_deployments():
    """List all active deployments."""
    return [DeploymentOut(**d) for d in _active_deployments.values()]


@router.post("/", response_model=DeploymentOut, status_code=201)
async def deploy_model(body: DeployRequest):
    """Deploy a model using a discovered DeployService provider."""
    proj = get_project(body.project_name)
    if proj is None:
        raise HTTPException(404, f"Project '{body.project_name}' not found")

    # Instantiate the selected deploy service
    try:
        svc = instantiate_service(proj, body.deploy_service)
    except ValueError as exc:
        raise HTTPException(404, str(exc))

    if not isinstance(svc, DeployService):
        raise HTTPException(400, f"'{body.deploy_service}' is not a DeployService")

    # Build context for the deploy service
    ctx = PipelineContext(
        project_name=proj.name,
        project_path=proj.path,
        config={
            "model_name": body.model_name,
            "model_version": body.version,
            "alias": body.alias,
            "port": body.port,
        },
    )

    try:
        result = svc.execute(ctx)
    except Exception as exc:
        raise HTTPException(500, f"Deploy failed: {exc}")

    key = f"{body.model_name}-{body.version}"
    dep = {
        "model_name": body.model_name,
        "version": body.version,
        "alias": body.alias,
        "deploy_service": body.deploy_service,
        "endpoint_uri": result.get("endpoint_uri") if isinstance(result, dict) else None,
        "status": "active",
        "created_at": time.time(),
        "port": body.port,
        "pid": result.get("pid") if isinstance(result, dict) else None,
    }
    _active_deployments[key] = dep

    # Record deployment in project YAML
    from pipelab.discovery import load_project_config, save_project_config
    from pathlib import Path
    yaml_path = Path(proj.path) / "pipelab.yaml"
    fresh_proj = load_project_config(yaml_path)
    fresh_proj.deployments.append({
        "model_name": body.model_name,
        "version": body.version,
        "alias": body.alias,
        "deploy_service": body.deploy_service,
        "port": body.port,
    })
    save_project_config(fresh_proj)
    refresh_discovery()

    return DeploymentOut(**dep)


@router.delete("/{model_name}/{version}")
async def undeploy_model(model_name: str, version: str, project: str | None = None):
    """Undeploy a model — stops the serving process."""
    key = f"{model_name}-{version}"
    dep = _active_deployments.get(key)
    if dep is None:
        raise HTTPException(404, "Deployment not found")

    deploy_service_name = dep.get("deploy_service", "MLflowServeProvider")

    # Try to call undeploy on the original provider
    if project:
        proj = get_project(project)
        if proj:
            try:
                svc = instantiate_service(proj, deploy_service_name)
                if isinstance(svc, DeployService):
                    ctx = PipelineContext(
                        project_name=proj.name,
                        project_path=proj.path,
                        config={
                            "model_name": model_name,
                            "model_version": version,
                            "pid": dep.get("pid"),
                        },
                    )
                    svc.undeploy(ctx)
            except Exception:
                pass  # best-effort cleanup
    else:
        # Fallback: kill process directly if we have a pid
        pid = dep.get("pid")
        if pid:
            import os, signal
            try:
                os.kill(pid, signal.SIGTERM)
            except ProcessLookupError:
                pass

    dep["status"] = "inactive"
    _active_deployments[key] = dep

    return {"ok": True, "model_name": model_name, "version": version, "status": "inactive"}


class TestEndpointRequest(BaseModel):
    endpoint_uri: str
    payload: dict | list | str
    content_type: str = "application/json"


@router.post("/test-endpoint")
async def test_endpoint(body: TestEndpointRequest):
    """Proxy a test payload to a deployed model endpoint and return the response."""
    import httpx

    headers = {"Content-Type": body.content_type}
    payload = body.payload if isinstance(body.payload, str) else body.payload

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            import json
            data = json.dumps(payload) if not isinstance(payload, str) else payload
            resp = await client.post(body.endpoint_uri, content=data, headers=headers)
            try:
                resp_body = resp.json()
            except Exception:
                resp_body = resp.text
            return {
                "status_code": resp.status_code,
                "headers": dict(resp.headers),
                "body": resp_body,
                "elapsed_ms": resp.elapsed.total_seconds() * 1000,
            }
    except httpx.ConnectError:
        raise HTTPException(502, f"Cannot connect to {body.endpoint_uri} — is the model server running?")
    except httpx.TimeoutException:
        raise HTTPException(504, f"Request to {body.endpoint_uri} timed out (30s)")
    except Exception as exc:
        raise HTTPException(500, f"Test request failed: {exc}")
