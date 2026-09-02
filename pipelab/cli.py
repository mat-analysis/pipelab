# Copyright (c) 2026 Tarlis Portela <tarlis@tarlis.com.br>
# Licensed under the Apache License, Version 2.0.

"""pipelab CLI — start the server, init projects, run pipelines."""
from __future__ import annotations

import os
from pathlib import Path

import typer
import uvicorn

app = typer.Typer(
    name="pipelab",
    help="ML Pipeline Management Platform",
    add_completion=False,
)


@app.command()
def serve(
    host: str = typer.Option("0.0.0.0", help="Bind host"),
    port: int = typer.Option(8000, help="Bind port"),
    reload: bool = typer.Option(False, help="Auto-reload on file changes"),
    workdir: str = typer.Option(".", help="Working directory containing projects"),
):
    """Start the pipelab web server."""
    workdir_path = Path(workdir).resolve()
    os.environ["PIPELAB_WORKDIR"] = str(workdir_path)
    typer.echo(f"Starting pipelab server on {host}:{port}")
    typer.echo(f"Workdir: {workdir_path}")
    uvicorn.run(
        "pipelab.api.app:create_app",
        host=host,
        port=port,
        reload=reload,
        factory=True,
    )


@app.command()
def init(
    name: str = typer.Argument(..., help="Project name"),
    description: str = typer.Option("", help="Project description"),
    workdir: str = typer.Option(".", help="Parent directory for the project"),
):
    """Initialize a new pipelab project directory structure."""
    import yaml

    project_dir = Path(workdir).resolve() / name
    project_dir.mkdir(parents=True, exist_ok=True)
    (project_dir / "pipeline").mkdir(exist_ok=True)
    (project_dir / "notebooks").mkdir(exist_ok=True)
    (project_dir / "mlruns").mkdir(exist_ok=True)

    # Create pipelab.yaml
    yaml_path = project_dir / "pipelab.yaml"
    if not yaml_path.exists():
        config = {"name": name}
        if description:
            config["description"] = description
        yaml_path.write_text(yaml.dump(config, default_flow_style=False, sort_keys=False))

    typer.echo(f"Initialized project '{name}' at {project_dir}")
    typer.echo(f"  ├── pipelab.yaml")
    typer.echo(f"  ├── pipeline/")
    typer.echo(f"  ├── notebooks/")
    typer.echo(f"  └── mlruns/")


@app.command("run-pipeline")
def run_pipeline(
    project: str = typer.Argument(..., help="Project directory path"),
):
    """Execute pipeline services from a project directory."""
    from pipelab.discovery import load_project_config, discover_services, instantiate_service
    from pipelab.pipeline import PipelineContext
    from pipelab.pipelines.engine import PipelineEngine

    project_dir = Path(project).resolve()
    yaml_path = project_dir / "pipelab.yaml"
    if not yaml_path.is_file():
        typer.echo(f"Error: no pipelab.yaml found in {project_dir}", err=True)
        raise typer.Exit(1)

    config = load_project_config(yaml_path)
    services = discover_services(config)

    data_svcs = [instantiate_service(config, s.class_name) for s in services if s.step_type == "data"]
    exp_svcs = [instantiate_service(config, s.class_name) for s in services if s.step_type == "experiment"]
    dep_svcs = [instantiate_service(config, s.class_name) for s in services if s.step_type == "deployment"]

    typer.echo(f"Running pipeline for project '{config.name}'")
    typer.echo(f"  Data services: {[s.name for s in data_svcs]}")
    typer.echo(f"  Experiment services: {[s.name for s in exp_svcs]}")
    typer.echo(f"  Deploy services: {[s.name for s in dep_svcs]}")

    ctx = PipelineContext(
        project_name=config.name,
        project_path=config.path,
        config={"name": config.name, "description": config.description},
    )

    engine = PipelineEngine(data_svcs, exp_svcs, dep_svcs)
    results = engine.run(ctx)

    typer.echo("\nResults:")
    for r in results:
        status_icon = "✅" if r.status == "success" else "❌"
        typer.echo(f"  {status_icon} {r.class_name} ({r.step_type}) — {r.duration_seconds:.3f}s")
        if r.error:
            typer.echo(f"     Error: {r.error}")


if __name__ == "__main__":
    app()
