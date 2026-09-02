"""Data pipeline step: Register and load the Iris dataset."""
from __future__ import annotations

from sklearn.datasets import load_iris, load_wine

from pipelab.pipeline import DatasetService


class RegisterDatasetIris(DatasetService):
    """Register Iris dataset with versioning and load it."""

    def execute(self, context):
        print("📥 Loading Iris dataset…")
        iris = load_iris()
        X, y = iris.data, iris.target
        context.results["X"] = X
        context.results["y"] = y
        return {"n_samples": len(X), "n_features": X.shape[1]}

class RegisterDatasetWine(DatasetService):
    """Register Wine dataset with versioning and load it."""

    def execute(self, context):
        print("📥 Loading Wine dataset…")
        wine = load_wine()
        X, y = wine.data, wine.target
        context.results["X"] = X
        context.results["y"] = y
        return {"n_samples": len(X), "n_features": X.shape[1]}