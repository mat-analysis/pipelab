"""Experiment pipeline steps: model training using context.data.

Both classes consume prepared data from ``context.data`` which is
populated by the engine from a dataset config (DataService + PreparationService).

Supported data formats:
    - ``context.data.method == "KFoldCV"`` → ``context.data.folds`` is a list of
      (train_idx, test_idx) tuples; ``context.data.X`` / ``context.data.y`` are
      the full arrays.
    - ``context.data.method == "TrainTestSplit"`` → ``context.data.X_train``,
      ``context.data.X_test``, ``context.data.y_train``, ``context.data.y_test``.
    - Fallback: ``context.results["X"]`` / ``context.results["y"]``.
"""
from __future__ import annotations

from sklearn.ensemble import RandomForestClassifier
from sklearn.svm import SVC
from sklearn.tree import DecisionTreeClassifier
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score

import mlflow

from pipelab.pipeline import ExperimentService


# ── Helpers ───────────────────────────────────────────────────────────────────

def _score(y_true, y_pred):
    """Compute common classification metrics."""
    avg = "weighted"
    return {
        "accuracy": accuracy_score(y_true, y_pred),
        "precision": precision_score(y_true, y_pred, average=avg, zero_division=0),
        "recall": recall_score(y_true, y_pred, average=avg, zero_division=0),
        "f1": f1_score(y_true, y_pred, average=avg, zero_division=0),
    }


def _train_and_log(model, model_name, X_train, y_train, X_test, y_test,
                   fold=None, params=None, dataset_name=None):
    """Fit a model, evaluate, and log to the active MLflow experiment."""
    run_name = f"{model_name}_fold_{fold}" if fold is not None else model_name
    with mlflow.start_run(run_name=run_name):
        # Log params
        if params:
            mlflow.log_params(params)
        if fold is not None:
            mlflow.log_param("fold", fold)

        # Log dataset name as a tag
        if dataset_name:
            mlflow.set_tag("pipelab.dataset_name", dataset_name)

        model.fit(X_train, y_train)
        preds = model.predict(X_test)
        metrics = _score(y_test, preds)

        for k, v in metrics.items():
            mlflow.log_metric(k, v)

        mlflow.sklearn.log_model(model, "model")
        acc = metrics["accuracy"]
        fold_str = f"fold {fold}" if fold is not None else "single"
        print(f"   {run_name} ({fold_str}) → accuracy={acc:.4f}")
        return metrics


def _run_experiment(context, experiment_name, models_spec):
    """Generic experiment runner.

    Args:
        context: PipelineContext with context.data populated.
        experiment_name: MLflow experiment name to log under.
        models_spec: list of (model_name, model_instance, params_dict).

    Returns:
        dict with per-model metric summaries.
    """
    data = context.data
    # Use engine-generated experiment name if available, else fall back to provided name
    exp_name = getattr(context, "experiment_name", "") or experiment_name
    mlflow.set_experiment(exp_name)

    X = data.X #if data.X is not None else context.results.get("X")
    y = data.y #if data.y is not None else context.results.get("y")

    if X is None or y is None:
        raise ValueError("No dataset in context. Run a DatasetService first.")

    # Get dataset name from context for logging
    dataset_name = getattr(data, "dataset_name", "") or ""

    all_results = {}

    for model_name, model_fn, params in models_spec:
        print(f"🧪 Training {model_name}…")
        fold_metrics = []

        if data.method == "KFoldCV" and data.folds:
            # K-Fold cross-validation
            for fold_idx, (train_idx, test_idx) in enumerate(data.folds):
                model = model_fn()  # fresh instance per fold
                m = _train_and_log(
                    model, model_name,
                    X[train_idx], y[train_idx], X[test_idx], y[test_idx],
                    fold=fold_idx, params=params, dataset_name=dataset_name,
                )
                fold_metrics.append(m)

            # Summary
            mean_acc = sum(m["accuracy"] for m in fold_metrics) / len(fold_metrics)
            print(f"   {model_name} mean accuracy: {mean_acc:.4f}")
            all_results[model_name] = {
                "mean_accuracy": mean_acc,
                "folds": fold_metrics,
            }

        elif data.method == "TrainTestSplit" and data.X_train is not None:
            # Single train/test split
            model = model_fn()
            m = _train_and_log(
                model, model_name,
                data.X_train, data.y_train, data.X_test, data.y_test,
                params=params, dataset_name=dataset_name,
            )
            all_results[model_name] = m

        else:
            # Fallback: use raw X/y with a default 80/20 split
            from sklearn.model_selection import train_test_split
            X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.2, random_state=42)
            model = model_fn()
            m = _train_and_log(model, model_name, X_tr, y_tr, X_te, y_te,
                               params=params, dataset_name=dataset_name)
            all_results[model_name] = m

    return all_results


# ── Experiment Services ───────────────────────────────────────────────────────

class TrainEvaluateStep(ExperimentService):
    """Train RandomForest with the prepared data, log to MLflow."""

    def execute(self, context):
        models = [
            ("rf", lambda: RandomForestClassifier(n_estimators=100, random_state=42),
             {"n_estimators": "100", "algorithm": "RandomForest"}),
        ]
        return _run_experiment(context, "Exp01-Iris-5fold-CV", models)


class Train_XB_SVM_DT(ExperimentService):
    """Train XGBoost, SVM, and Decision Tree, log to MLflow."""

    def execute(self, context):
        try:
            from xgboost import XGBClassifier
            xgb_fn = lambda: XGBClassifier(
                n_estimators=100, max_depth=6, learning_rate=0.1,
                use_label_encoder=False, eval_metric="mlogloss", random_state=42,
            )
        except Exception:
            # Fallback if xgboost not installed — use GradientBoosting
            from sklearn.ensemble import GradientBoostingClassifier
            xgb_fn = lambda: GradientBoostingClassifier(
                n_estimators=100, max_depth=6, learning_rate=0.1, random_state=42,
            )

        models = [
            ("xgboost", xgb_fn,
             {"n_estimators": "100", "max_depth": "6", "learning_rate": "0.1",
              "algorithm": "XGBoost"}),
            ("svm", lambda: SVC(kernel="rbf", C=1.0, random_state=42),
             {"kernel": "rbf", "C": "1.0", "algorithm": "SVM"}),
            ("decision_tree", lambda: DecisionTreeClassifier(max_depth=10, random_state=42),
             {"max_depth": "10", "algorithm": "DecisionTree"}),
        ]

        # Use a dedicated experiment name
        exp_name = "Exp-XB-SVM-DT"
        return _run_experiment(context, exp_name, models)
