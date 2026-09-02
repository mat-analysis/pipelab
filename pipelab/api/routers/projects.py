# Copyright (c) 2026 Tarlis Portela <tarlis@tarlis.com.br>
# Licensed under the Apache License, Version 2.0.

"""Projects API router — lists, creates, and updates projects."""
from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from pipelab.api.app import get_projects, get_discovered_services, get_workdir, run_discovery
from pipelab.api.schemas import ProjectConfigOut
from pipelab.discovery import save_project_config, load_project_config

router = APIRouter()


class ProjectCreateIn(BaseModel):
    name: str
    description: str = ""


class ProjectUpdateIn(BaseModel):
    name: str | None = None
    description: str | None = None


def _project_out(p) -> ProjectConfigOut:
    services = get_discovered_services(p.name)
    return ProjectConfigOut(
        name=p.name,
        path=p.path,
        description=p.description,
        tracking_uri=p.tracking_uri,
        pipeline_dir=p.pipeline_dir,
        service_count=len(services),
        experiments=p.experiments,
    )


@router.get("/", response_model=list[ProjectConfigOut])
async def list_projects():
    return [_project_out(p) for p in get_projects()]


@router.get("/{project_name}", response_model=ProjectConfigOut)
async def get_project(project_name: str):
    from pipelab.api.app import get_project as _get_project
    p = _get_project(project_name)
    if p is None:
        raise HTTPException(404, f"Project '{project_name}' not found")
    return _project_out(p)


@router.post("/", response_model=ProjectConfigOut)
async def create_project(body: ProjectCreateIn):
    """Create a new project directory with pipelab.yaml."""
    import yaml

    workdir = get_workdir()
    project_dir = Path(workdir) / body.name
    if project_dir.exists():
        raise HTTPException(400, f"Directory '{body.name}' already exists")

    project_dir.mkdir(parents=True)
    (project_dir / "pipeline").mkdir()
    (project_dir / "notebooks").mkdir()
    (project_dir / "mlruns").mkdir()

    yaml_data = {"name": body.name}
    if body.description:
        yaml_data["description"] = body.description

    (project_dir / "pipelab.yaml").write_text(
        yaml.dump(yaml_data, default_flow_style=False, sort_keys=False)
    )

    # Re-discover projects
    run_discovery()
    from pipelab.api.app import get_project as _get_project
    p = _get_project(body.name)
    if p is None:
        raise HTTPException(500, "Project created but not discovered")
    return _project_out(p)


@router.put("/{project_name}", response_model=ProjectConfigOut)
async def update_project(project_name: str, body: ProjectUpdateIn):
    """Update existing project metadata in pipelab.yaml."""
    from pipelab.api.app import get_project as _get_project
    p = _get_project(project_name)
    if p is None:
        raise HTTPException(404, f"Project '{project_name}' not found")

    if body.description is not None:
        p.description = body.description
    # name is not updatable (directory name)

    save_project_config(p)
    run_discovery()  # refresh cached state
    p = _get_project(project_name)
    return _project_out(p)
