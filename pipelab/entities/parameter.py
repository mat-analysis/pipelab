# Copyright (c) 2026 Tarlis Portela <tarlis@tarlis.com.br>
# Licensed under the Apache License, Version 2.0.

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class Parameter:
    name: str
    value: Any
