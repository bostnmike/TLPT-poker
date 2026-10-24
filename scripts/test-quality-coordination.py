#!/usr/bin/env python3
"""Regression guards for the rebuild -> immutable-revision quality gate contract."""

import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def coordination_errors(pipeline, quality):
    errors = []

    def require(condition, message):
        if not condition:
            errors.append(message)

    require("\n  push:" not in quality, "standalone push check would race the rebuild")
    require("\n  workflow_call:" in quality, "quality gate must be reusable")
    require("\n  pull_request:" in quality and "\n  workflow_dispatch:" in quality,
            "independent PR and manual checks must remain available")
    require("branches: [main]" in pipeline and "if: github.ref == 'refs/heads/main'" in pipeline,
            "publication must be restricted to main")
    require("cancel-in-progress: false" in pipeline, "publishing rebuilds must not cancel one another")
    paths = lambda text: set(re.findall(r'^      - "([^"]+)"$', text, re.M))
    require(paths(pipeline) == paths(quality), "main and PR trigger coverage must match")
    require(not any(path.startswith("data/generated/") for path in paths(pipeline)),
            "generated output must not cause rebuild loops")
    final_job = pipeline.split("\n  quality:\n")[-1]
    require("    needs: build\n" in final_job, "final quality gate must wait for successful build")
    require("    uses: ./.github/workflows/site-quality.yml\n" in final_job,
            "final job must call the canonical quality workflow")
    require("built_sha: ${{ needs.build.outputs.built_sha }}" in final_job,
            "caller must pass the published commit")
    require("built_sha: ${{ steps.publish.outputs.built_sha }}" in pipeline and
            "        id: publish\n" in pipeline, "published SHA output must be wired")
    publish = pipeline.split("        id: publish\n")[-1].split("\n  quality:\n")[0]
    output = 'echo "built_sha=$(git rev-parse HEAD)" >> "$GITHUB_OUTPUT"'
    require(publish.count(output) == 2, "both unchanged and published branches must output their SHA")
    require(publish.find(output) < publish.find("exit 0") and
            publish.rfind(output) > publish.find("git push origin HEAD:main"),
            "success output must follow the successful push or the no-change branch")
    require("ref: ${{ inputs.built_sha || github.sha }}" in quality,
            "checkout must pin the built SHA, never moving main")
    require("group: tlpt-site-quality-${{ inputs.built_sha || github.ref }}" in quality,
            "quality concurrency must not collide with the publishing workflow")
    require("if: ${{ inputs.built_sha == '' }}" in quality and
            "run: bash scripts/run-data-build.sh" in quality and
            quality.find("run: bash scripts/run-data-build.sh") <
            quality.find("run: bash scripts/run-quality-gates.sh"),
            "independent checks must rebuild before auditing")
    require(not any(token in pipeline + quality for token in ("continue-on-error:", "always()", "|| true")),
            "genuine failures must not be suppressed")
    return errors


class QualityCoordinationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.pipeline = (ROOT / ".github/workflows/tlpt-update.yml").read_text()
        cls.quality = (ROOT / ".github/workflows/site-quality.yml").read_text()

    def test_current_contract(self):
        self.assertEqual(coordination_errors(self.pipeline, self.quality), [])

    def test_regression_guards(self):
        mutations = [
            (self.pipeline, self.quality.replace("  workflow_call:", "  push:\n  workflow_call:")),
            (self.pipeline.replace("    needs: build\n", ""), self.quality),
            (self.pipeline, self.quality.replace("inputs.built_sha || github.sha", "'main'")),
            (self.pipeline.replace("needs.build.outputs.built_sha", "github.sha"), self.quality),
            (self.pipeline.replace('      - "data/events.json"\n', ""), self.quality),
            (self.pipeline, self.quality.replace("run: bash scripts/run-data-build.sh", "run: echo skipped")),
            (self.pipeline.replace("cancel-in-progress: false", "cancel-in-progress: true"), self.quality),
            (self.pipeline.replace("    needs: build", "    if: always()\n    needs: build"), self.quality),
            (self.pipeline.replace('            echo "built_sha=$(git rev-parse HEAD)" >> "$GITHUB_OUTPUT"\n', ""), self.quality),
        ]
        for index, (pipeline, quality) in enumerate(mutations):
            with self.subTest(regression=index):
                self.assertTrue(coordination_errors(pipeline, quality))


if __name__ == "__main__":
    unittest.main()
