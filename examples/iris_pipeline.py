"""Example pipeline: Iris classification with dataset versioning,
k-fold CV, and model training using pipelab APIs.

Run:  python examples/iris_pipeline.py
  or: pipelab run-pipeline examples/iris_pipeline.py
"""
from __future__ import annotations

import os

from sklearn.datasets import load_iris
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import KFold
from sklearn.metrics import accuracy_score

import mlflow

from pipelab.infrastructure.mlflow_client import configure
from pipelab.services.mlflow_dataset_service import MlflowDatasetService
from pipelab.services.mlflow_experiment_service import MlflowExperimentService
from pipelab.pipelines.engine import PipelineStep, PipelineEngine


# ── Pipeline Steps ────────────────────────────────────────────────────────────

class RegisterDatasetStep(PipelineStep):
    """Register Iris dataset with versioning."""

    def execute(self, context):
        print("📥 Registering Iris dataset…")
        ds_svc = MlflowDatasetService()
        ds = ds_svc.create_dataset("iris", "Iris flower dataset (sklearn)")
        ver = ds_svc.create_version(
            ds.id, "v1.0", uri="sklearn://iris",
            metadata={"source": "sklearn.datasets.load_iris", "n_samples": 150},
        )
        split = ds_svc.create_split(ds.id, "kfold_5", method="kfold",
                                     params={"n_splits": 5, "shuffle": True, "random_state": 42})
        print(f"   Dataset '{ds.label}' id={ds.id}, version={ver.version}, split={split.name}")
        return {"dataset_id": ds.id}


class TrainEvaluateStep(PipelineStep):
    """Train RandomForest with 5-fold CV, log to MLflow."""

    def execute(self, context):
        print("🧪 Training Random Forest with 5-Fold CV…")
        iris = load_iris()
        X, y = iris.data, iris.target
        kf = KFold(n_splits=5, shuffle=True, random_state=42)

        accuracies = []
        for fold, (train_idx, test_idx) in enumerate(kf.split(X)):
            X_train, X_test = X[train_idx], X[test_idx]
            y_train, y_test = y[train_idx], y[test_idx]

            with mlflow.start_run(run_name=f"rf_fold_{fold}"):
                model = RandomForestClassifier(n_estimators=100, random_state=42)
                mlflow.log_param("n_estimators", 100)
                mlflow.log_param("fold", fold)
                mlflow.log_param("dataset_version", "v1.0")

                model.fit(X_train, y_train)
                preds = model.predict(X_test)
                acc = accuracy_score(y_test, preds)
                accuracies.append(acc)

                mlflow.log_metric("accuracy", acc)
                mlflow.sklearn.log_model(model, "model")
                print(f"   Fold {fold} accuracy: {acc:.4f}")

        mean_acc = sum(accuracies) / len(accuracies)
        print(f"   Mean CV Accuracy: {mean_acc:.4f}")
        return {"mean_accuracy": mean_acc, "accuracies": accuracies}


# ── Main ──────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    configure("mlruns")
    mlflow.set_experiment("Iris_Classification_Pipeline")

    engine = PipelineEngine([RegisterDatasetStep(), TrainEvaluateStep()])
    result = engine.run()

    print("\n✅ Pipeline executed successfully!")
    print(f"   Results: {result.get('__pipeline_results__')}")
