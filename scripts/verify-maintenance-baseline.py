#!/usr/bin/env python3
"""Verify the frozen TLPT maintenance architecture and shared-cache baseline."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASELINE_PATH = ROOT / "maintenance-baseline.json"


def fail(errors: list[str]) -> int:
    print(f"FAIL: maintenance baseline drifted with {len(errors)} issue(s):")
    for error in errors:
        print(f" - {error}")
    return 1


def main() -> int:
    errors: list[str] = []

    if not BASELINE_PATH.is_file():
        return fail(["maintenance-baseline.json is missing"])

    baseline = json.loads(BASELINE_PATH.read_text(encoding="utf-8"))

    if baseline.get("schemaVersion") != 1:
        errors.append("maintenance-baseline.json: unsupported schemaVersion")

    authoritative = baseline.get("authoritative", {})
    maintenance_paths = baseline.get("maintenancePaths", {})

    expected_files = [
        "MAINTENANCE-RUNBOOK.md",
        *authoritative.values(),
        *maintenance_paths.values(),
    ]
    for rel in expected_files:
        if not (ROOT / rel).is_file():
            errors.append(f"required maintenance file is missing: {rel}")

    # Audit compatibility launcher must stay a launcher, not a second implementation.
    root_audit = ROOT / authoritative.get("codeHygieneCompatibilityLauncher", "")
    if root_audit.is_file():
        text = root_audit.read_text(encoding="utf-8")
        if "runpy.run_path" not in text or "audit-code-hygiene.py" not in text:
            errors.append("root audit must remain a compatibility launcher")

    # Data build sequence stays centralized.
    data_runner = ROOT / authoritative.get("dataBuild", "")
    build_tokens = (
        "scripts/parse-event-reports.py",
        "scripts/generate-event-index.js",
        "scripts/build-site-data.py",
        "scripts/build-knockouts.py",
    )
    if data_runner.is_file():
        data_text = data_runner.read_text(encoding="utf-8")
        for token in build_tokens:
            if data_text.count(token) != 1:
                errors.append(f"data build runner must contain exactly one `{token}`")

    weekly = ROOT / maintenance_paths.get("weeklyUpdate", "")
    pipeline = ROOT / maintenance_paths.get("dataPipelineWorkflow", "")
    if weekly.is_file():
        text = weekly.read_text(encoding="utf-8")
        if text.count("bash scripts/run-data-build.sh") != 1:
            errors.append("weekly update must call run-data-build.sh exactly once")
        for token in build_tokens:
            if token in text:
                errors.append(f"weekly update bypasses data runner with `{token}`")
    if pipeline.is_file():
        text = pipeline.read_text(encoding="utf-8")
        if text.count("bash scripts/run-data-build.sh") != 2:
            errors.append("data pipeline must call run-data-build.sh exactly twice")
        for token in build_tokens:
            if token in text:
                errors.append(f"data pipeline bypasses data runner with `{token}`")

    # Complete quality suite stays centralized.
    quality_runner = ROOT / authoritative.get("qualityGates", "")
    if quality_runner.is_file():
        quality_text = quality_runner.read_text(encoding="utf-8")
        for gate in baseline.get("requiredQualityGates", []):
            if quality_text.count(gate) != 1:
                errors.append(f"quality runner must contain exactly one `{gate}`")

    # Maintenance-contract changes must trigger the site-quality workflow.
    site_quality = ROOT / maintenance_paths.get("siteQualityWorkflow", "")
    if site_quality.is_file():
        quality_workflow_text = site_quality.read_text(encoding="utf-8")
        for rel in baseline.get("qualityTriggerPaths", []):
            expected = f'"{rel}"'
            actual = quality_workflow_text.count(expected)
            if actual != 2:
                errors.append(
                    f"{site_quality.relative_to(ROOT)}: expected `{rel}` in both push and "
                    f"pull_request path filters, found {actual} occurrence(s)"
                )
        for command in baseline.get("requiredQualityWorkflowCommands", []):
            actual = quality_workflow_text.count(command)
            if actual != 1:
                errors.append(
                    f"{site_quality.relative_to(ROOT)}: expected command `{command}` "
                    f"exactly once, found {actual} occurrence(s)"
                )

    # Component-specific suites stay independently wired to every file that can
    # affect their behavior. Their commands are intentionally not duplicated in
    # the root runner because the cashier owns a separate dependency toolchain.
    satellite_gates = baseline.get("satelliteQualityGates", {})
    if not isinstance(satellite_gates, dict):
        errors.append("maintenance-baseline.json: satelliteQualityGates must be an object")
        satellite_gates = {}
    for name, contract in satellite_gates.items():
        if not isinstance(contract, dict):
            errors.append(f"satellite quality gate `{name}` must be an object")
            continue
        workflow_rel = contract.get("workflow", "")
        workflow = ROOT / workflow_rel
        if not workflow.is_file():
            errors.append(f"satellite quality workflow is missing: {workflow_rel}")
            continue
        workflow_text = workflow.read_text(encoding="utf-8")
        for rel in contract.get("triggerPaths", []):
            actual = len(re.findall(rf'["\']{re.escape(rel)}["\']', workflow_text))
            if actual != 2:
                errors.append(
                    f"{workflow_rel}: expected `{rel}` in both push and pull_request path "
                    f"filters, found {actual} occurrence(s)"
                )
        for command in contract.get("requiredCommands", []):
            actual = workflow_text.count(command)
            if actual != 1:
                errors.append(
                    f"{workflow_rel}: expected command `{command}` exactly once, "
                    f"found {actual} occurrence(s)"
                )

    # Public pages must remain one shared CSS generation.
    # Lily owns its microsite; the unlisted cashier redirect owns no shared CSS.
    # Its redirect and discovery policy are validated by the hygiene audit.
    pages = sorted(page for page in ROOT.glob("*.html") if page.name not in {"lily.html", "cashier.html"})
    expected_page_count = baseline.get("publicPageCount")
    if len(pages) != expected_page_count:
        errors.append(
            f"public page count changed: expected {expected_page_count}, found {len(pages)}"
        )

    asset = baseline.get("sharedCssAsset")
    version = baseline.get("sharedCssVersion")
    ref_re = re.compile(
        rf'(?:/)?{re.escape(asset)}\?v=([^"\']+)'
    )
    for page in pages:
        versions = ref_re.findall(page.read_text(encoding="utf-8"))
        if versions != [version]:
            errors.append(
                f"{page.name}: expected exactly `{asset}?v={version}`, found {versions}"
            )

    if errors:
        return fail(errors)

    print(
        f"PASS: maintenance baseline verified — {len(pages)} public pages, "
        f"{len(baseline.get('requiredQualityGates', []))} quality gates, "
        f"{len(satellite_gates)} satellite suites, "
        f"{len(baseline.get('qualityTriggerPaths', []))} protected maintenance paths, "
        f"shared CSS {asset}?v={version}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
