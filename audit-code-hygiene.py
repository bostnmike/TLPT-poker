#!/usr/bin/env python3
"""Compatibility launcher for the authoritative hygiene audit in scripts/."""

from __future__ import annotations

import runpy
from pathlib import Path

AUDIT = Path(__file__).resolve().parent / "scripts" / "audit-code-hygiene.py"

if not AUDIT.is_file():
    raise SystemExit(f"Authoritative hygiene audit is missing: {AUDIT}")

runpy.run_path(str(AUDIT), run_name="__main__")
