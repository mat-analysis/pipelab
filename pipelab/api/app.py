# Copyright (c) 2026 Tarlis Portela <tarlis@tarlis.com.br>
# Licensed under the Apache License, Version 2.0.

"""FastAPI application factory and service registry."""
from __future__ import annotations

import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException


class SpaStaticFiles(StaticFiles):
    """StaticFiles que faz fallback para index.html em rotas do SPA.

    Paths sem extensão (ex.: /projects, /dashboard) devolvem index.html para
    que o React Router cuide do roteamento no cliente. Assets com extensão
    ausentes continuam retornando 404 apropriado.
    """

    async def get_response(self, path: str, scope):
        try:
            return await super().get_response(path, scope)
        except HTTPException as exc:
            if exc.status_code != 404:
                raise
            last_segment = path.rsplit("/", 1)[-1]
            if "." in last_segment:
                raise
            return await super().get_response("index.html", scope)

from pipelab.infrastructure.mlflow_client import configure as configure_mlflow
from pipelab.plugins.plugin import PipelabPlugin
from pipelab.discovery import discover_projects, discover_services, ProjectConfig, DiscoveredService

# Service singletons
from pipelab.services.mlflow_project_service import MlflowProjectService
from pipelab.services.mlflow_dataset_service import MlflowDatasetService
from pipelab.services.mlflow_experiment_service import MlflowExperimentService
from pipelab.services.mlflow_model_registry_service import MlflowModelRegistryService
from pipelab.services.mlflow_deployment_service import MlflowDeploymentService
from pipelab.services.mlflow_monitoring_service import MlflowMonitoringService

_services: dict[str, Any] = {}
_plugins: list[PipelabPlugin] = []

# Discovered projects and their services
_projects: list[ProjectConfig] = []
_discovered_services: dict[str, list[DiscoveredService]] = {}  # project_name -> services


def get_service(name: str) -> Any:
    return _services[name]


def get_projects() -> list[ProjectConfig]:
    return _projects


def get_discovered_services(project_name: str) -> list[DiscoveredService]:
    return _discovered_services.get(project_name, [])


def get_project(project_name: str) -> ProjectConfig | None:
    for p in _projects:
        if p.name == project_name:
            return p
    return None


def register_plugin(plugin: PipelabPlugin) -> None:
    _plugins.append(plugin)


def get_workdir() -> str:
    """Return the active workdir path."""
    return os.environ.get("PIPELAB_WORKDIR", os.getcwd())


def run_discovery() -> None:
    """Re-scan the workdir for projects and services."""
    global _projects, _discovered_services
    workdir = get_workdir()
    _projects = discover_projects(workdir)
    _discovered_services = {}
    for project in _projects:
        _discovered_services[project.name] = discover_services(project)


def refresh_discovery() -> None:
    """Alias for run_discovery (backward compat)."""
    run_discovery()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize MLflow — resolve relative tracking URI against workdir
    tracking_uri = os.environ.get("MLFLOW_TRACKING_URI", "mlruns")
    workdir = get_workdir()
    if not tracking_uri.startswith(("/", "http", "sqlite", "file:")):
        # Relative path — resolve against workdir
        tracking_uri = str(Path(workdir) / tracking_uri)
    configure_mlflow(tracking_uri)

    # Register internal services
    _services["projects"] = MlflowProjectService()
    _services["datasets"] = MlflowDatasetService()
    _services["experiments"] = MlflowExperimentService()
    _services["models"] = MlflowModelRegistryService()
    _services["deployments"] = MlflowDeploymentService()
    _services["monitoring"] = MlflowMonitoringService()

    # Discover projects and user pipeline services
    refresh_discovery()

    # Register plugins
    for plugin in _plugins:
        plugin.on_register()
        overrides = plugin.get_services()
        if overrides:
            _services.update(overrides)

    yield


def create_app() -> FastAPI:
    app = FastAPI(
        title="PipeLab",
        description="ML Pipeline Management Platform",
        version="0.1.0",
        lifespan=lifespan,
    )

    # CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # API routers
    from pipelab.api.routers import (
        projects, datasets, experiments, models,
        pipelines, deployments, monitoring, settings,
    )
    app.include_router(projects.router, prefix="/api/v1/projects", tags=["Projects"])
    app.include_router(datasets.router, prefix="/api/v1/datasets", tags=["Datasets"])
    app.include_router(experiments.router, prefix="/api/v1/experiments", tags=["Experiments"])
    app.include_router(models.router, prefix="/api/v1/models", tags=["Models"])
    app.include_router(pipelines.router, prefix="/api/v1/pipelines", tags=["Pipelines"])
    app.include_router(deployments.router, prefix="/api/v1/deployments", tags=["Deployments"])
    app.include_router(monitoring.router, prefix="/api/v1/monitoring", tags=["Monitoring"])
    app.include_router(settings.router, prefix="/api/v1/settings", tags=["Settings"])

    # Plugin routes
    for plugin in _plugins:
        routes = plugin.get_routes()
        if routes:
            for r in routes:
                app.include_router(r, prefix=f"/api/v1/plugins/{plugin.name}")

    # Serve React static files
    static_dir = Path(__file__).resolve().parent.parent / "static"
    if static_dir.is_dir():
        app.mount("/", SpaStaticFiles(directory=str(static_dir), html=True), name="static")

    return app
