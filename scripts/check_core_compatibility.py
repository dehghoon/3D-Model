#!/usr/bin/env python3
"""Fail CI when this consumer is not aligned with the canonical Core registry."""
import json
from pathlib import Path

root = Path(__file__).resolve().parents[1]
local = json.loads((root / "core-compatibility.json").read_text())
core = root / "_canonical_core"
manifest = json.loads((core / "releases/compatibility-manifest.json").read_text())
registry = json.loads((core / "registry/components.json").read_text())
assert manifest["coreSchemaVersion"] == registry["authority"]["coreSchemaVersion"], "Core registry and manifest disagree"
assert local["coreSchemaVersion"] == manifest["coreSchemaVersion"], "Core schema upgrade required: update and verify this consumer"
matches = [c for c in registry["components"] if c["id"] == local["componentId"]]
assert len(matches) == 1, "Consumer missing or duplicated in canonical registry"
assert matches[0]["coreSchemaVersion"] == local["coreSchemaVersion"], "Consumer registration version mismatch"
print(f"Core compatibility PASS: {local['componentId']} / {local['coreSchemaVersion']}")
