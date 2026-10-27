#!/usr/bin/env python3
"""Compatibility entry point: manual cache keys are retired; content owns versions."""
import runpy
from pathlib import Path

# Supports --check or regeneration with no arguments through the canonical tool.
# Old --version requests fail instead of writing a second, conflicting cache key.
if __name__ == '__main__':
    runpy.run_path(str(Path(__file__).with_name('build-site-shell.py')), run_name='__main__')
