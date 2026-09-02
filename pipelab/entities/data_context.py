# Copyright (c) 2026 Tarlis Portela <tarlis@tarlis.com.br>
# Licensed under the Apache License, Version 2.0.

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class DataContext:
    """Prepared data passed from DataService → PreparationService → ExperimentService.

    Attributes:
        X: Full feature matrix (before preparation).
        y: Full target vector (before preparation).
        method: Name of the preparation method class (e.g. "KFoldCV", "TrainTestSplit").
        method_params: Parameters used by the preparation method.
        folds: List of (train_idx, test_idx) tuples when method is KFoldCV.
        X_train / X_test / y_train / y_test: Split data when method is TrainTestSplit.
    """
    X: Any = None
    y: Any = None
    method: str = ""
    method_params: dict[str, Any] = field(default_factory=dict)
    dataset_name: str = ""
    # K-Fold data
    folds: list | None = None
    # Train/Test split data
    X_train: Any = None
    X_test: Any = None
    y_train: Any = None
    y_test: Any = None
