# Copyright (c) 2026 Tarlis Portela <tarlis@tarlis.com.br>
# Licensed under the Apache License, Version 2.0.

"""Dataset service backed by MLflow artifacts + JSON metadata."""
from __future__ import annotations

import json
import os
import time
import uuid
from typing import Any

from pipelab.entities import Dataset, DatasetVersion, DataSplit
from pipelab.services.interfaces import DatasetService

_DATASETS_DIR = ".pipelab/datasets"


def _ensure_dir(path: str) -> None:
    os.makedirs(path, exist_ok=True)


class MlflowDatasetService(DatasetService):
    """Stores dataset metadata as JSON files under .pipelab/datasets/."""

    def __init__(self, base_dir: str = ".") -> None:
        self._base = os.path.join(base_dir, _DATASETS_DIR)
        _ensure_dir(self._base)

    def _ds_path(self, dataset_id: str) -> str:
        return os.path.join(self._base, dataset_id)

    def _meta_path(self, dataset_id: str) -> str:
        return os.path.join(self._ds_path(dataset_id), "meta.json")

    # --- CRUD -----------------------------------------------------------------

    def list_datasets(self, project_id: str | None = None) -> list[Dataset]:
        if not os.path.isdir(self._base):
            return []
        datasets: list[Dataset] = []
        for name in os.listdir(self._base):
            meta_file = os.path.join(self._base, name, "meta.json")
            if os.path.isfile(meta_file):
                with open(meta_file) as f:
                    d = json.load(f)
                if project_id and d.get("project_id") != project_id:
                    continue
                datasets.append(Dataset(**{k: v for k, v in d.items() if k in Dataset.__dataclass_fields__}))
        return datasets

    def get_dataset(self, dataset_id: str) -> Dataset | None:
        meta_file = self._meta_path(dataset_id)
        if not os.path.isfile(meta_file):
            return None
        with open(meta_file) as f:
            d = json.load(f)
        return Dataset(**{k: v for k, v in d.items() if k in Dataset.__dataclass_fields__})

    def create_dataset(self, label: str, description: str | None = None,
                       project_id: str | None = None) -> Dataset:
        dataset_id = uuid.uuid4().hex[:12]
        ds = Dataset(id=dataset_id, label=label, description=description)
        ds_dir = self._ds_path(dataset_id)
        _ensure_dir(ds_dir)
        _ensure_dir(os.path.join(ds_dir, "versions"))
        _ensure_dir(os.path.join(ds_dir, "splits"))
        meta = {"id": dataset_id, "label": label, "description": description,
                "project_id": project_id}
        with open(self._meta_path(dataset_id), "w") as f:
            json.dump(meta, f, indent=2)
        return ds

    def delete_dataset(self, dataset_id: str) -> bool:
        import shutil
        ds_dir = self._ds_path(dataset_id)
        if os.path.isdir(ds_dir):
            shutil.rmtree(ds_dir)
            return True
        return False

    # --- Versioning -----------------------------------------------------------

    def create_version(self, dataset_id: str, version: str,
                       uri: str | None = None,
                       metadata: dict[str, Any] | None = None) -> DatasetVersion:
        ver_dir = os.path.join(self._ds_path(dataset_id), "versions")
        _ensure_dir(ver_dir)
        ver = DatasetVersion(
            dataset_id=dataset_id, version=version,
            uri=uri, metadata=metadata or {},
            created_at=time.time(),
        )
        ver_file = os.path.join(ver_dir, f"{version}.json")
        with open(ver_file, "w") as f:
            json.dump({
                "dataset_id": dataset_id, "version": version,
                "uri": uri, "metadata": metadata or {},
                "created_at": ver.created_at,
            }, f, indent=2)
        return ver

    def list_versions(self, dataset_id: str) -> list[DatasetVersion]:
        ver_dir = os.path.join(self._ds_path(dataset_id), "versions")
        if not os.path.isdir(ver_dir):
            return []
        versions: list[DatasetVersion] = []
        for fname in sorted(os.listdir(ver_dir)):
            if fname.endswith(".json"):
                with open(os.path.join(ver_dir, fname)) as f:
                    d = json.load(f)
                versions.append(DatasetVersion(**{k: v for k, v in d.items()
                                                  if k in DatasetVersion.__dataclass_fields__}))
        return versions

    # --- Splits ---------------------------------------------------------------

    def create_split(self, dataset_id: str, name: str,
                     method: str = "train_test",
                     params: dict[str, Any] | None = None) -> DataSplit:
        split_dir = os.path.join(self._ds_path(dataset_id), "splits")
        _ensure_dir(split_dir)
        split = DataSplit(name=name, dataset_id=dataset_id,
                          split_method=method, split_params=params or {})
        with open(os.path.join(split_dir, f"{name}.json"), "w") as f:
            json.dump({
                "name": name, "dataset_id": dataset_id,
                "split_method": method, "split_params": params or {},
            }, f, indent=2)
        return split

    def list_splits(self, dataset_id: str) -> list[DataSplit]:
        split_dir = os.path.join(self._ds_path(dataset_id), "splits")
        if not os.path.isdir(split_dir):
            return []
        splits: list[DataSplit] = []
        for fname in sorted(os.listdir(split_dir)):
            if fname.endswith(".json"):
                with open(os.path.join(split_dir, fname)) as f:
                    d = json.load(f)
                splits.append(DataSplit(**{k: v for k, v in d.items()
                                           if k in DataSplit.__dataclass_fields__}))
        return splits
