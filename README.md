# PipeLab — ML Pipeline Management Platform

A Python platform for managing end-to-end Machine Learning pipelines, backed by **MLflow** for experiment tracking and model registry, with a **FastAPI** backend and **React + TailwindCSS** frontend.

---

## Getting Started

### Quick Start

From a clean machine to a running ML pipeline in 5 commands.

#### Prerequisites

- **Python** ≥ 3.10 — check with `python3 --version`
- (Optional) **Node.js** ≥ 20 — only needed for frontend development

#### Step 1 — Create a working directory and virtual environment

```bash
mkdir workdir && cd workdir
python3 -m venv .venv
source .venv/bin/activate        # Linux / macOS
# .venv\Scripts\activate         # Windows
```

#### Step 2 — Install PipeLab from PyPI

```bash
pip install pipelab
```

This installs PipeLab and all dependencies (FastAPI, MLflow, scikit-learn, pandas, etc.).

#### Step 3 — Initialize your first project

```bash
pipelab init my-project --description "My first ML project"
```

This creates the project structure:

```
workdir/
└── my-project/
    ├── pipelab.yaml      # Project configuration
    ├── pipeline/         # Place your pipeline service classes here
    ├── notebooks/        # Jupyter notebooks
    └── mlruns/           # Local MLflow tracking store
```

#### Step 4 — Start the MLflow tracking server (separate terminal)

```bash
cd workdir
source .venv/bin/activate
python -m mlflow ui --host 127.0.0.1 --port 5000 --backend-store-uri ./my-project/mlruns
```

Open http://localhost:5000 to view the MLflow dashboard.

#### Step 5 — Start the PipeLab server

```bash
pipelab serve --workdir . --port 8000
```

Open http://localhost:8000 in your browser. You should see the PipeLab dashboard with your project listed.

> **Tip:** Run `pipelab serve --help` to see all options (`--host`, `--port`, `--reload`, `--workdir`).

---

### Development installation (from source)

If you want to contribute or modify PipeLab itself:

```bash
git clone https://github.com/tarlisportela/pipelab.git
cd pipelab
python3 -m venv .venv
source .venv/bin/activate
pip install -e .
```

For frontend development, also run:

```bash
cd pipelab/frontend
npm install
npm run dev      # Dev server with API proxy to :8000
npm run build    # Build production bundle to ../static/
```

---

## Features

- **Project Workspaces** — Organize experiments by project with `pipelab.yaml` config
- **Dataset Versioning** — Track dataset versions with metadata
- **Data Split Management** — K-fold CV, train/test, custom splits
- **Experiment Tracking** — Register experiments and runs via MLflow
- **Benchmark & Comparison** — Compare runs side-by-side with charts
- **Model Registry** — Register, version, and manage model lifecycle stages
- **Pipeline Engine** — Define and execute sequential ML pipelines (data → preparation → experiment → deploy)
- **Model Deployment** — Deploy models as REST endpoints
- **Monitoring & Alerts** — Track prediction stats and drift indicators
- **Plugin Architecture** — Extend with custom modules
- **CLI** — `pipelab serve`, `pipelab init`, `pipelab run-pipeline`

---

## Architecture

```
pipelab/
├── entities/        # Domain dataclasses + pipeline ABCs
├── services/        # Abstract interfaces + MLflow implementations
├── infrastructure/  # MLflow client wrapper
├── pipelines/       # Pipeline execution engine
├── plugins/         # Plugin base class
├── api/             # FastAPI app + REST routers
│   └── routers/     # projects, datasets, experiments, models, ...
├── static/          # Built React frontend (served by FastAPI)
└── cli.py           # Typer CLI commands
```

### Clean Architecture Layers

| Layer | Location | Purpose |
|-------|----------|---------|
| Domain | `entities/` | Dataclasses, pipeline ABCs — the core data model |
| Services | `services/interfaces.py` | Abstract contracts (ABCs) |
| Infrastructure | `services/mlflow_*.py` | Concrete MLflow implementations |
| API | `api/` | HTTP interface (FastAPI routers + Pydantic schemas) |
| UI | `frontend/` → `static/` | React + TailwindCSS SPA |

---

## CLI Commands

```bash
# Start the web server (defaults to current directory as workdir)
pipelab serve --host 0.0.0.0 --port 8000 --workdir ~/pipelab-workdir

# Initialize a new project
pipelab init my-project --description "My ML Project" --workdir ~/pipelab-workdir

# Run all discovered pipeline services for a project
pipelab run-pipeline ~/pipelab-workdir/my-project
```

---

## Writing Pipeline Services

Create Python files in your project's `pipeline/` directory. pipelab autodiscovers subclasses of the pipeline ABCs:

```python
# ~/pipelab-workdir/my-project/pipeline/data.py
from pipelab.pipeline import DatasetService, PipelineContext

class IrisLoader(DatasetService):
    """Load the Iris dataset."""
    def execute(self, context: PipelineContext):
        from sklearn.datasets import load_iris
        data = load_iris()
        context.results["X"] = data.data
        context.results["y"] = data.target
        return {"samples": len(data.data)}
```

```python
# ~/pipelab-workdir/my-project/pipeline/train.py
from pipelab.pipeline import ExperimentService, PipelineContext

class RandomForestTrainer(ExperimentService):
    """Train a Random Forest classifier."""
    def execute(self, context: PipelineContext):
        from sklearn.ensemble import RandomForestClassifier
        from sklearn.metrics import accuracy_score
        import mlflow

        X_train = context.data.X_train
        y_train = context.data.y_train
        X_test = context.data.X_test
        y_test = context.data.y_test

        clf = RandomForestClassifier(n_estimators=100, random_state=42)
        clf.fit(X_train, y_train)
        acc = accuracy_score(y_test, clf.predict(X_test))

        with mlflow.start_run(experiment_id=context.experiment_name):
            mlflow.log_metric("accuracy", acc)
            mlflow.sklearn.log_model(clf, "model")

        return {"accuracy": acc}
```

Configure preparation in `pipelab.yaml`:

```yaml
name: my-project
datasets:
  - name: iris
    data_service: IrisLoader
    preparation_method: TrainTestSplit
    preparation_params:
      test_size: 0.2
      random_state: 42
```

Then run from the web UI or CLI:

```bash
pipelab run-pipeline ~/pipelab-workdir/my-project
```

---

## Extending the Framework

### Custom Services

Implement any abstract interface from `pipelab.services.interfaces`:

```python
from pipelab.services.interfaces import DatasetService

class MyDatasetService(DatasetService):
    def list_datasets(self, project_id=None):
        ...
```

### Plugins

```python
from pipelab.plugins import PipelabPlugin
from fastapi import APIRouter

class MyPlugin(PipelabPlugin):
    @property
    def name(self):
        return "my-plugin"

    def get_routes(self):
        router = APIRouter()
        @router.get("/hello")
        async def hello():
            return {"msg": "Hello from plugin!"}
        return [router]
```

---

## API Endpoints

| Endpoint | Methods | Description |
|----------|---------|-------------|
| `/api/v1/projects/` | GET, POST, PUT | Project management |
| `/api/v1/datasets/` | GET, POST, DELETE | Dataset CRUD + versions + splits |
| `/api/v1/experiments/` | GET, POST, DELETE | Experiment management |
| `/api/v1/experiments/{name}/runs` | GET | List experiment runs |
| `/api/v1/experiments/runs/compare` | POST | Compare multiple runs |
| `/api/v1/models/` | GET, POST, DELETE | Model registry |
| `/api/v1/models/register` | POST | Register a model from a run |
| `/api/v1/pipelines/services` | GET | List autodiscovered services |
| `/api/v1/pipelines/run` | POST | Execute a pipeline |
| `/api/v1/pipelines/dataset-configs` | GET, POST, DELETE | Dataset configurations |
| `/api/v1/pipelines/eda/load` | POST | Load dataset for EDA |
| `/api/v1/deployments/` | GET, POST, DELETE | Model deployments |
| `/api/v1/monitoring/` | GET, POST | Prediction stats + alerts |
| `/api/v1/settings/` | GET, PUT | Configuration |

---

## Requirements

All Python dependencies are managed via `pyproject.toml` and installed automatically:

| Package | Purpose |
|---------|---------|
| `fastapi` | REST API framework |
| `uvicorn[standard]` | ASGI server |
| `mlflow` | Experiment tracking & model registry |
| `scikit-learn` | ML utilities & default preparation methods |
| `pandas` | Data manipulation |
| `pyyaml` | Project configuration parsing |
| `typer` | CLI framework |
| `pydantic` | Request/response validation |

---

## Building & Publishing to PyPI

### 1. Build the frontend (bundles into `pipelab/static/`)

```bash
cd pipelab/frontend
npm install
npm run build
cd ../..
```

### 2. Build the Python package

```bash
pip install build
python -m build
```

This creates `dist/pipelab-X.Y.Z.tar.gz` and `dist/pipelab-X.Y.Z-py3-none-any.whl`.

### 3. Upload to PyPI

```bash
pip install twine
python -m twine upload dist/*
```

> **Tip:** For test uploads, use TestPyPI first:
> ```bash
> twine upload --repository testpypi dist/*
> pip install --index-url https://test.pypi.org/simple/ pipelab
> ```

### 4. Version bumps

Update the version in `pyproject.toml`:

```toml
[project]
version = "0.2.0"
```

Then rebuild and upload.

---

## License

Apache License 2.0 — see [LICENSE](LICENSE) and [NOTICE](NOTICE) for details.

Copyright (c) 2026 Tarlis Portela <tarlis@tarlis.com.br>
