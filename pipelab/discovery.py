# Copyright (c) 2026 Tarlis Portela <tarlis@tarlis.com.br>
# Licensed under the Apache License, Version 2.0.

"""Project and service autodiscovery engine.

Scans the workdir for project directories containing ``pipelab.yaml``,
then dynamically imports Python files from each project's ``pipeline/``
directory to discover subclasses of the pipeline ABCs.
"""
from __future__ import annotations

import importlib.util
import inspect
import sys
from pathlib import Path
from typing import Any

import yaml  # PyYAML

from pipelab.entities.project_config import ProjectConfig
from pipelab.entities.discovered_service import DiscoveredService
from pipelab.entities.services import DatasetService, ExperimentService, DeployService, PreparationService


# ── YAML helpers ──────────────────────────────────────────────────────────────

def load_project_config(yaml_path: Path) -> ProjectConfig:
    """Parse a ``pipelab.yaml`` file into a :class:`ProjectConfig`."""
    project_dir = yaml_path.parent
    raw: dict[str, Any] = {}
    text = yaml_path.read_text().strip()
    if text:
        raw = yaml.safe_load(text) or {}

    return ProjectConfig(
        name=raw.get("name", project_dir.name),
        path=str(project_dir.resolve()),
        description=raw.get("description", ""),
        tracking_uri=raw.get("tracking_uri", "mlruns"),
        pipeline_dir=raw.get("pipeline_dir", "pipeline"),
        datasets=raw.get("datasets", []),
        experiments=raw.get("experiments", []),
        deployments=raw.get("deployments", []),
        services=raw.get("services", {}),
        extra={k: v for k, v in raw.items()
               if k not in {"name", "description", "tracking_uri", "pipeline_dir",
                            "datasets", "experiments", "deployments", "services"}},
    )


def save_project_config(config: ProjectConfig) -> None:
    """Write a :class:`ProjectConfig` back to ``pipelab.yaml``."""
    yaml_path = Path(config.path) / "pipelab.yaml"
    data: dict[str, Any] = {
        "name": config.name,
    }
    if config.description:
        data["description"] = config.description
    if config.tracking_uri and config.tracking_uri != "mlruns":
        data["tracking_uri"] = config.tracking_uri
    if config.pipeline_dir and config.pipeline_dir != "pipeline":
        data["pipeline_dir"] = config.pipeline_dir
    if config.datasets:
        data["datasets"] = config.datasets
    if config.experiments:
        data["experiments"] = config.experiments
    if config.deployments:
        data["deployments"] = config.deployments
    if config.services:
        data["services"] = config.services
    data.update(config.extra)

    yaml_path.write_text(yaml.dump(data, default_flow_style=False, sort_keys=False))


# ── Project discovery ─────────────────────────────────────────────────────────

def discover_projects(workdir: str | Path) -> list[ProjectConfig]:
    """Scan *workdir* for subdirectories containing ``pipelab.yaml``.

    Also checks the workdir root itself.
    """
    workdir = Path(workdir).resolve()
    projects: list[ProjectConfig] = []

    # Check root dir
    root_yaml = workdir / "pipelab.yaml"
    if root_yaml.is_file():
        projects.append(load_project_config(root_yaml))

    # Check immediate subdirectories
    if workdir.is_dir():
        for child in sorted(workdir.iterdir()):
            if child.is_dir():
                yaml_path = child / "pipelab.yaml"
                if yaml_path.is_file():
                    projects.append(load_project_config(yaml_path))

    return projects


# ── Service autodiscovery ─────────────────────────────────────────────────────

_ABC_CLASSES = (DatasetService, ExperimentService, DeployService, PreparationService)
_TYPE_MAP = {
    DatasetService: "data",
    ExperimentService: "experiment",
    DeployService: "deployment",
    PreparationService: "preparation",
}


def _builtin_deploy_services() -> list[DiscoveredService]:
    """Return built-in DeployService implementations shipped with the framework."""
    from pipelab.pipeline import MLflowServeProvider
    return [
        DiscoveredService(
            class_name=MLflowServeProvider.__name__,
            module_path="pipelab.pipeline (built-in)",
            step_type="deployment",
            docstring=(MLflowServeProvider.__doc__ or "").strip().split("\n")[0],
            project_name="",  # available to all projects
        ),
    ]


def discover_services(project: ProjectConfig) -> list[DiscoveredService]:
    """Import Python files from a project's ``pipeline/`` directory and
    find all concrete subclasses of the pipeline ABCs.

    Also includes built-in framework providers (e.g. MLflowServeProvider).
    """
    pipeline_dir = Path(project.path) / project.pipeline_dir

    services: list[DiscoveredService] = []

    # Built-in providers (available to every project)
    for builtin in _builtin_deploy_services():
        services.append(DiscoveredService(
            class_name=builtin.class_name,
            module_path=builtin.module_path,
            step_type=builtin.step_type,
            docstring=builtin.docstring,
            project_name=project.name,
        ))

    if not pipeline_dir.is_dir():
        return services

    for py_file in sorted(pipeline_dir.glob("*.py")):
        if py_file.name.startswith("_"):
            continue

        module_name = f"pipelab._user_.{project.name}.{py_file.stem}"

        try:
            spec = importlib.util.spec_from_file_location(module_name, str(py_file))
            if spec is None or spec.loader is None:
                continue
            mod = importlib.util.module_from_spec(spec)
            sys.modules[module_name] = mod
            spec.loader.exec_module(mod)  # type: ignore
        except Exception as exc:
            print(f"[pipelab] Warning: failed to import {py_file}: {exc}")
            continue

        for _attr_name, obj in inspect.getmembers(mod, inspect.isclass):
            if obj in _ABC_CLASSES:
                continue
            for abc_cls, step_type in _TYPE_MAP.items():
                if issubclass(obj, abc_cls) and obj is not abc_cls:
                    rel_path = str(py_file.relative_to(Path(project.path)))
                    services.append(DiscoveredService(
                        class_name=obj.__name__,
                        module_path=rel_path,
                        step_type=step_type,
                        docstring=(obj.__doc__ or "").strip(),
                        project_name=project.name,
                    ))
                    break  # already matched, avoid double-adding

    return services


_BUILTIN_CLASSES: dict[str, type] = {}


def _register_builtins() -> None:
    """Lazily populate the built-in class lookup."""
    if _BUILTIN_CLASSES:
        return
    from pipelab.pipeline import MLflowServeProvider, TrainTestSplit, KFoldCV
    for cls in (MLflowServeProvider, TrainTestSplit, KFoldCV):
        _BUILTIN_CLASSES[cls.__name__] = cls


def instantiate_service(project: ProjectConfig, class_name: str) -> DatasetService | ExperimentService | DeployService:
    """Find and instantiate a discovered service class by name.

    Checks built-in framework providers first, then scans the project's
    ``pipeline/`` directory.
    """
    # Check built-in providers
    _register_builtins()
    if class_name in _BUILTIN_CLASSES:
        return _BUILTIN_CLASSES[class_name]()

    pipeline_dir = Path(project.path) / project.pipeline_dir
    for py_file in sorted(pipeline_dir.glob("*.py")):
        if py_file.name.startswith("_"):
            continue
        module_name = f"pipelab._user_.{project.name}.{py_file.stem}"
        mod = sys.modules.get(module_name)
        if mod is None:
            try:
                spec = importlib.util.spec_from_file_location(module_name, str(py_file))
                if spec is None or spec.loader is None:
                    continue
                mod = importlib.util.module_from_spec(spec)
                sys.modules[module_name] = mod
                spec.loader.exec_module(mod)  # type: ignore
            except Exception:
                continue

        for _name, obj in inspect.getmembers(mod, inspect.isclass):
            if obj.__name__ == class_name and issubclass(obj, _ABC_CLASSES) and obj not in _ABC_CLASSES:
                return obj()

    raise ValueError(f"Service class '{class_name}' not found in project '{project.name}'")
