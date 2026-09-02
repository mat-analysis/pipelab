-- OK
Use subfolder @beautifulMention/mllab to Create a Python package that provides a web interface for managing Machine Learning pipelines.
The package must expose a web application for experiment and pipeline management, using the ML Flow experimentation platform.
Implement the backend using FastAPI and structure the project as a modular Python package that can be installed with pip.
Use a React + TailwindCSS frontend integrated with the backend API to provide a clean and modern interface.
Design the system around the core ML workflow: Projects, Dashboard, Data (Ingestion, Preparation, EDA), Experiment (Train, Benchmark), Governance (Selection, Model Registry, Deployment, Monitoring, Alerts), Settings.
Use the provided entity classes in @beautifulMention/mllab/entities/*.
Implement dataset versioning, allowing datasets to have multiple versions and metadata.
Implement data split management, supporting k-fold cross-validation, train/test splits, and custom splits.
Provide a project-based workspace so users can organize experiments by project.
Provide functionality to register experiments and training runs under a Project, including parameters, metrics, artifacts, and logs using MLflow as the experiment tracking backend.
Integrate with MLflow as the experiment tracking backend while allowing extensions through plugins.
Implement a pipeline abstraction dashboard where each pipeline consists of steps such as data_preparation, training, evaluation, selection, and deployment. Provide a visual dashboard that allows users to explore experiments, compare runs, and visualize metrics.
Provide a pipeline execution engine capable of running pipelines sequentially and recording results.
Implement a model registry with ML Flow that stores trained models, versions, metadata, and status (candidate, approved, production).
Implement charts for experiment comparison, including training metrics, validation curves, and confusion matrices.
Implement artifact storage from ML Flow for models, plots, and intermediate results.
Provide a plugin architecture so additional modules (e.g., monitoring, deployment, data validation) can extend the platform.
Implement a deployment interface allowing models to be exported as REST services using ML Flow.
Add monitoring capabilities for deployed models, tracking prediction statistics and drift indicators.
Ensure the package follows clean architecture principles, separating domain, services, infrastructure, and UI layers.
Provide an interface similar to ChatGPT with drawable menu.
Provide CLI commands to start the server, initialize projects, and run pipelines.
Include an example pipeline using the Iris dataset demonstrating dataset versioning, k-fold splits, model training, and evaluation.
Include documentation and usage examples for developers to extend and integrate the framework.
Implement abstract classes to allow extension of the framework.
---------
Consider workdir/example_project/iris_use_example.py as a reference for how to use the framework.
The framework will consider que directory where it is run as the workdir directory.
Inside the workdir, the framework will look for a *.yaml file that will contain the configuration of the project. For example structure:
example_project/
│
├── mllab.yaml
│
├── mlruns/
│
├── pipeline/
│   ├── dataset.py
│   ├── training.py
│   └── deploy.py
│
└── notebooks/
Dashboard should list the projects available and allow the user to select a project to view its experiments, datasets, models, and pipelines.
Pipelines should list the pipelines defined by the user composed by the services created by the user in 3 categories: data, experiment, and deployment. 
The framework should provide the 3 abstract classes: DatasetService, ExperimentService, and DeployService (from mllab.pipeline import DatasetService, ExperimentService, DeployService).
Each abstract service class should be autodiscovered by the framework.
- DatasetService: autodiscovered classes are listed in the data ingestion page.
- ExperimentService: autodiscovered classes are listed in the train page.
- DeployService: autodiscovered classes are listed in the deployment page.
Each sevice class should have an execute method that takes a context object as an argument and returns a result object. The context is a class representing a pipeline the user defined.
The context object should contain the following attributes, instances of abstract services implemented by the user:
- dataset: The dataset to be used for the experiment.
- experiment: The experiment to be used for the experiment.
- deploy: The deployment to be used for the experiment.

--- 1 (continuar 19/03/2026) - OK
The project selection should be done by the user in the dashboard.
When the user selects a project, all pages should be filtered to show only the data related to that project.
The project selection should be persisted in cookies, so that when the user refreshes the page, the project is still selected.
The project list should have a button to create a new project and to edit metadata of the project.
When the user clicks the button to create a new project, a modal should open with a form to create a new project or edit the project.
The form should have the following fields:
- name: The name of the project.
- description: The description of the project.
- path: The path to the project (relative to the workdir, not editable).

--- 1b - OK
Rename Dashboard into a "Projects" page that will list all the projects available in the workdir (as it does now).
Create a new Dashboard page under the projects menu option that will list all the experiments of the selected project and show statistics about the experiments.
For all pages, subpages or details about the records should be opened in a drawer panel from the right.
Associate the project with the experiments, datasets, models, and pipelines created in the selected project, saving the associations in the project yaml file.

--- 2 OK
Associate test-project with the pipeline services and mlflow experiments available in the workdir and save the associations in the project yaml file.

Data Ingestion Page:
- Should list all DatasetService autodiscovered classes and have a button to edit the metadata of each service (saved in the project yaml file).
- Should display the data service details (name, description, and attributes).

--- 2b 2nd try ok
For Dashboard Page display the information and statistics on experiments set in the selected project yaml file. Avoid the final verification steps, just start the server running to me.

--- 2.1b 2nd try ok
For Data Preparation Page:
The user will select the DatasetService class to be used for data preparation, then  open a from to create a dataset configuration containing the DatasetService selection, dataset configuration name, description, and preparation method selection (when the user selects a preparation method, the framework should display the parameters of the preparation method). The preparation method is implemented by the user in the pipeline directory as instance of PreparationService (with autodiscovery), the  TrainTestSplit and KFoldCV are included in the list of preparation methods as the defult implementations from the platform.

Avoid the final verification steps, just start the server running to me.

--- 2d ok
For Data EDA Page:
The page will list all dataset configurations available in the selected project yaml file. When the user selects a dataset configuration, the framework should load the data fom the DatasetService and display the head of the dataset, its shape, columns, and data types. Also the page should display the pairwise scatter plot of the dataset and the descriptive statistics of the dataset.

--- 2e ok
Remove the Data EDA page and add the EDA functionality to the Data Ingestion page (load the data fom the DatasetService and display the head of the dataset, its shape, columns with data types, the pairwise scatter plot of the dataset and the descriptive statistics of the dataset).

--- 3a continue 21/03/2026 ok
For Experiment Train Page:
Should allow the  user to edit the metadata of each ExperimentService autodiscovered (from the project yaml file). In the edit form also should allow the user to list all ml flow experiments and select the experiments that are associated with the ExperimentService.
The bottom of the page should display the list of experiments associated with the all the ExperimentService autodiscovered each with the service related. Also show resumed information about the experiment (e.g. number of runs, best run, etc.).

--- 3a.2 ok

In Experiment Train Page, when clicked on a experiment in the list, the framework should display the experiment details (e.g. Models, metrics, parameters, artifacts, etc.), runs details individually (marking the best run). Should allow the user to select a model and view its details and version history. Should allow to show ML Flow artifacts (e.g., plots, tables, files, etc.) of a selected model.

--- 3b continue 26/03/2026 14h OK
For Experiment Benchmark Page:
The user should be able to list the models from the experiments associated with the project and select one or more models to compare. When the models are selected, the framework should display the details (e.g. metrics, parameters, etc.) of the selected models, if the model have multiple k-fold runs, the framework should display the mean values of each metric for each model and the standard deviation of each metric for each model. Also the framework should display the comparison results in charts by selecting one or more models (e.g., training curves, confusion matrices, etc.).
--- 3b V2 OK-
For Experiment Benchmark Page:
The user select the ml flow experiment (one or more) to load the benchmark. The page should list only the experiments associated with the project from the yaml file.
The user should be able to list the models from the experiment selected and select one or more models to compare. When the models are selected, the framework should display the details (e.g. metrics, parameters, etc.) of the selected models, if the model have multiple k-fold runs, the framework should display the mean values of each metric and the standard deviation of each metric. Also the framework should display the comparison results in charts by selecting one or more models (e.g., training curves, confusion matrices, etc.).
Avoid the final verification steps, just start the server running to me.

--- 3b V3 - OK
The Experiment Benchmark Page does not have the benchmark I need.
Are you able to make a great benchmark page?
It should display the ml flow experiments in a list like in data ingestion page. The user select the ml flow experiment (one or more) to load the benchmark, and only the experiments configured in the selected project.
For each experiment, display statistics for the models, the ones with multiple k-fold runs (mean and std) and the ones with a single run (individual metrics).
The graphics metrics should be for each model name.
Avoid the final verification steps, just start the server running to me.

--- 3c - OK
Fix errors in the Experiment Benchmark and page Experiment Train page, both are not displaying the data from the experiment.
Avoid the final verification steps, just start the server running to me.

--- 3d - OK???
Make a new ExperimentService class called Train_XB_SVM_DT in @beautifulMention pipeline for training with XGboost, SVM, and Decision Tree. Consider that the X and y data comes from the context parameter, example: X = context.data.X. The data can be an array of folds. context.data.method gives the preparation method class. Fix the TrainEvaluateStep also to this pipeline format. In the Automation Pipelines page, the user selects one of each service (Data and Experiment) and run the pipeline that executes the classes with the context selected. The deploy service is not part of this pipeline automation.

--- 3e - ok
After executing a pipeline, the experiment created should be a new experiment with the composition of the pipeline name (date yyyy-MM-dd-HH-mm-ss, dataset name, and experiment name). The experiment should be associated with the project in the project yaml file, and should be listed in the dashboard page (ML Flow related experiments).

--- 3f - ok
Dashboard - experiment details: each run should display the dataset used in the run (the experiment service must log the dataset name in the run metadata).

--- 3g - ok
After executing a pipeline, the experiment created should be associated with the project in the project yaml file, and should be listed in the dashboard page (ML Flow related experiments). Running a pipeline reloads the selected project data. 
Organize the first section of the dashborad page to display the project stats (number of experiments, number of runs, etc.) in a compact way, add project name and the project description.
The best run section must display the best run for each experiment, ranked by date descending or by another column selected by the user.

--- 3h - ok
In dashboard page, the best run section is not loading the run date.

--- 4a - Cancelled
For Governance Selection Page:
Should rank the models from the experiment by a metric selected by the user, display aggregated metrics for models with many runs (mean and std), and individual metrics for models with a single run, group models by experiment associated with the projec. Should display the model details (name, version, metadata, status). In the drawer page of the model details, display the artifacts of the model from ml flow (e.g., plots, tables, files, etc.).

--- 4b - ok
For Governance Model Registry Page: should have a button to add a new model to the registry, open the drawer from the right side of the screen, the user select a model from the list of available models in the project, add a name and description and click on the button to add the model to the registry. The model is added as Version 1, next versions can be added by the user when editing the model registry entry. When selecting a model registry entry, the user should be able to view its details and version history.

--- ok
check the @mllab application for unused code, and check if the @entities classes are used in the code as model classes. Reorganize the entities from @discovery.py and @pipeline.py into @entities folder (all app entities goes in this folder). Provide a README.md file with the description of those model classes, and a diagram if possible.

--- 4b.2 ok
Make a pipeline run progress bar and make it more informative. When the experiment run finishes, associate the mlflow experiment to the respective Experiment Provider.

--- 4c ok
Governance Deployment Page:
- Should allow the user to select a model from registry to deployment.
- Should enable the user to select a deployment method (from discovered deploy services).
- Should list the active deployments and allow the user to undeploy a model.
- DeployService must have an execute method to deploy and a undeploy method.
- Deployment Providers should should have a default provider implemented to use the mlflow serve model.

- Add a governance page to test the deployed model service, send payloads and display responses.

--- 4d
Governance Monitoring Page:
- Should have placeholders for future implementation of: 
    - Should list all active deployments and allow the user to select one to view its details.
    - Should display the monitoring metrics.
    - Should display the monitoring drift indicators.
    - Should display the monitoring logs.

--- 5a
API to recover data ***
Adapters to export data ***
