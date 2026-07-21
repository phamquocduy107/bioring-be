"""Shared placement defaults / helpers for fingerprint + soundwave."""

from __future__ import annotations

from typing import Any

from .artifact_groups import DEFAULT_SURFACE, TYPE_FINGERPRINT
from .schemas import PlacementTransform


def default_placement_dict() -> dict[str, Any]:
    return PlacementTransform().model_dump()


def default_surface(artifact_type: str) -> str:
    return DEFAULT_SURFACE.get(artifact_type, DEFAULT_SURFACE[TYPE_FINGERPRINT])


def placement_from_raw(raw: Any) -> PlacementTransform:
    if isinstance(raw, PlacementTransform):
        return raw
    if isinstance(raw, dict):
        # Nested placement payload from placement.json
        if "offsetX" in raw:
            return PlacementTransform(**raw)
        nested = raw.get("placement")
        if isinstance(nested, dict):
            return PlacementTransform(**nested)
    return PlacementTransform()
