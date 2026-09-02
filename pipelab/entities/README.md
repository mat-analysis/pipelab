# mllab Domain Entities

This package contains all domain model classes (dataclasses) and pipeline abstract base classes used throughout the mllab platform.

---

## Entity Classes

### Project & Discovery

| Class | File | Description |
|-------|------|-------------|
| `Project` | `project.py` | Lightweight project reference (id, name, description). |
| `ProjectConfig` | `project_config.py` | Full parsed configuration from `mllab.yaml` including datasets, experiments, deployments, and service metadata. |
| `DiscoveredService` | `discovered_service.py` | Metadata about an autodiscovered pipeline service class (class name, module path, step type). |

### Data & Datasets

| Class | File | Description |
|-------|------|-------------|
| `Dataset` | `dataset.py` | A registered dataset with label, version, URI, and metadata. |
| `DatasetVersion` | `dataset_version.py` | A specific version of a dataset including schema info (rows, columns). |
| `DataSplit` | `data_split.py` | A named split strategy applied to a dataset (e.g. kfold, train_test). |
| `DataContext` | `data_context.py` | Runtime data container passed between pipeline steps (features, targets, folds, splits). |

### Experiments & Runs

| Class | File | Description |
|-------|------|-------------|
| `Experiment` | `experiment.py` | An MLflow experiment with associated metrics. |
| `Run` | `run.py` | A single training/evaluation run with parameters, metrics, tags, and artifacts. |
| `Model` | `model.py` | A trained model reference linking to its experiment and run. *(Currently unused — reserved for future use.)* |
| `MetricType` | `metric.py` | Definition of a metric type (key, name, higher_is_better). *(Reserved.)* |
| `Metric` | `metric.py` | A metric value associated with a MetricType. *(Reserved.)* |
| `Parameter` | `parameter.py` | A name-value parameter pair. *(Reserved.)* |

### Model Registry & Deployment

| Class | File | Description |
|-------|------|-------------|
| `ModelRegistry` | `model_registry.py` | A versioned model entry in the registry with lifecycle status (candidate → production → archived). |
| `Deployment` | `deployment.py` | A deployed model endpoint with alias, port, and status. |
| `MonitoringRecord` | `monitoring.py` | A monitoring observation for a deployment (latency, drift, error rate). |
| `Alert` | `alert.py` | A triggered alert for threshold violations. |

### Pipelines

| Class | File | Description |
|-------|------|-------------|
| `Pipeline` | `pipeline.py` | A persisted pipeline definition with ordered steps and execution status. |
| `PipelineStepResult` | `pipeline.py` | Result of a single pipeline step execution (status, duration, output/error). |
| `PipelineContext` | `pipeline_context.py` | Runtime execution context passed to every pipeline service (project info, accumulated results, data). |

### Pipeline Service ABCs

| Class | File | Description |
|-------|------|-------------|
| `DatasetService` | `services.py` | ABC for data ingestion/preparation steps. |
| `ExperimentService` | `services.py` | ABC for training/evaluation steps. |
| `DeployService` | `services.py` | ABC for deployment steps. |
| `PreparationService` | `services.py` | ABC for data splitting/sampling steps. |

---

## Class Diagram

```mermaid
classDiagram
    direction TB

    %% ── Project & Discovery ──
    class Project {
        +str id
        +str name
        +str? description
    }

    class ProjectConfig {
        +str name
        +str path
        +str description
        +str tracking_uri
        +str pipeline_dir
        +list datasets
        +list experiments
        +list deployments
        +dict services
        +dict extra
    }

    class DiscoveredService {
        +str class_name
        +str module_path
        +str step_type
        +str docstring
        +str project_name
    }

    ProjectConfig "1" --> "*" DiscoveredService : discovers

    %% ── Data & Datasets ──
    class Dataset {
        +str id
        +str label
        +str? description
        +str? version
        +str? uri
        +dict metadata
    }

    class DatasetVersion {
        +str dataset_id
        +str version
        +str? uri
        +dict metadata
        +int? num_rows
        +int? num_columns
        +list columns
    }

    class DataSplit {
        +str name
        +str? dataset_id
        +str? split_method
        +dict split_params
        +dict sets
    }

    class DataContext {
        +Any X
        +Any y
        +str method
        +dict method_params
        +str dataset_name
        +list? folds
        +Any X_train
        +Any X_test
        +Any y_train
        +Any y_test
    }

    Dataset "1" --> "*" DatasetVersion : versions
    Dataset "1" --> "*" DataSplit : splits

    %% ── Experiments & Runs ──
    class Experiment {
        +str name
        +str? experiment_id
        +str? description
        +str? project_id
        +list metrics
    }

    class Run {
        +str run_id
        +str experiment_name
        +str? name
        +str status
        +dict parameters
        +dict metrics
        +dict tags
        +list artifacts
        +str? model_uri
    }

    class Model {
        +str name
        +str? model_type
        +str? experiment_name
        +str? run_id
        +dict params
        +dict metrics
    }

    Experiment "1" --> "*" Run : runs
    Run "1" --> "0..1" Model : produces

    %% ── Registry & Deployment ──
    class ModelRegistry {
        +str model_name
        +int|str version
        +str? source
        +str? run_id
        +str status
        +dict tags
    }

    class Deployment {
        +str model_name
        +str version
        +str alias
        +str? endpoint_uri
        +str status
        +int? port
    }

    class MonitoringRecord {
        +str deployment_id
        +float timestamp
        +int prediction_count
        +float? avg_latency_ms
        +float? drift_score
    }

    class Alert {
        +str id
        +str severity
        +str message
        +float? threshold
        +bool resolved
    }

    Model "1" --> "*" ModelRegistry : registered as
    ModelRegistry "1" --> "0..1" Deployment : deployed as
    Deployment "1" --> "*" MonitoringRecord : monitored by
    Deployment "1" --> "*" Alert : triggers

    %% ── Pipeline Execution ──
    class Pipeline {
        +str id
        +str name
        +str? project_id
        +list steps
        +str status
        +list step_results
    }

    class PipelineStepResult {
        +str step_name
        +str step_type
        +str class_name
        +str status
        +float? duration_seconds
        +dict? output
        +str? error
    }

    class PipelineContext {
        +str project_name
        +str project_path
        +dict config
        +dict results
        +DataContext data
        +str experiment_name
    }

    Pipeline "1" --> "*" PipelineStepResult : contains
    PipelineContext "1" --> "1" DataContext : holds

    %% ── Pipeline Service ABCs ──
    class DatasetService {
        <<abstract>>
        +name() str
        +step_type() str
        +execute(context)* Any
    }

    class ExperimentService {
        <<abstract>>
        +name() str
        +step_type() str
        +execute(context)* Any
    }

    class DeployService {
        <<abstract>>
        +name() str
        +step_type() str
        +execute(context)* Any
    }

    class PreparationService {
        <<abstract>>
        +name() str
        +step_type() str
        +execute(context)* Any
    }

    DatasetService ..> PipelineContext : uses
    ExperimentService ..> PipelineContext : uses
    DeployService ..> PipelineContext : uses
    PreparationService ..> PipelineContext : uses
```

---

## Notes

- Classes marked *(Reserved)* (`Model`, `MetricType`, `Metric`, `Parameter`) are defined for future use but not yet consumed by the application services.
- `mllab.pipeline` and `mllab.discovery` re-export entities for backward compatibility — existing user code importing from those modules continues to work unchanged.
