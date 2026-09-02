# Copyright (c) 2026 Tarlis Portela <tarlis@tarlis.com.br>
# Licensed under the Apache License, Version 2.0.

"""Pipeline abstract base classes for user extensions.

Users create subclasses of these ABCs in their project's ``pipeline/`` directory.
The framework autodiscovers them and exposes them in the web UI.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any

from pipelab.entities.pipeline_context import PipelineContext


class DatasetService(ABC):
    """Base class for data pipeline steps (ingestion, preparation, EDA).

    Subclass this and implement :meth:`execute` to define a data step.
    """

    @property
    def name(self) -> str:
        return self.__class__.__name__

    @property
    def step_type(self) -> str:
        return "data"

    @abstractmethod
    def execute(self, context: PipelineContext) -> Any:
        """Run the data step. Return any result to store in ``context.results``."""
        ...


class ExperimentService(ABC):
    """Base class for experiment steps (training, evaluation, benchmarking).

    Subclass this and implement :meth:`execute` to define an experiment step.
    """

    @property
    def name(self) -> str:
        return self.__class__.__name__

    @property
    def step_type(self) -> str:
        return "experiment"

    @abstractmethod
    def execute(self, context: PipelineContext) -> Any:
        """Run the experiment step. Return any result to store in ``context.results``."""
        ...


class DeployService(ABC):
    """Base class for deployment steps (serving, monitoring, alerts).

    Subclass this and implement :meth:`execute` to deploy a model and
    :meth:`undeploy` to remove a deployment.
    """

    @property
    def name(self) -> str:
        return self.__class__.__name__

    @property
    def step_type(self) -> str:
        return "deployment"

    @abstractmethod
    def execute(self, context: PipelineContext) -> Any:
        """Deploy a model. Return deployment info to store in ``context.results``."""
        ...

    @abstractmethod
    def undeploy(self, context: PipelineContext) -> Any:
        """Remove / stop a deployment. Return status info."""
        ...


class PreparationService(ABC):
    """Base class for data preparation steps (splitting, sampling, etc.).

    Subclass this and implement :meth:`execute` to define a preparation method.
    The framework provides default implementations for common split strategies.
    Users can create custom implementations in their project's ``pipeline/`` directory.
    """

    @property
    def name(self) -> str:
        return self.__class__.__name__

    @property
    def step_type(self) -> str:
        return "preparation"

    @abstractmethod
    def execute(self, context: PipelineContext) -> Any:
        """Run the preparation step. Return any result to store in ``context.results``."""
        ...
