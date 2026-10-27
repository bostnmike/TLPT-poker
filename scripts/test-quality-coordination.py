#!/usr/bin/env python3
"""Regression guards: only a checked, immutable artifact may reach Pages."""
import re
import json
import unittest
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]


def coordination_errors(pipeline, quality):
    errors = []
    def require(ok, message):
        if not ok:
            errors.append(message)
    require("\n  push:" not in quality, "PR checks must not race the main publisher")
    require("\n  pull_request:" in quality and "\n  workflow_dispatch:" in quality,
            "independent PR/manual checks are required")
    require("branches: [main]" in pipeline and "if: github.ref == 'refs/heads/main'" in pipeline,
            "only main can publish")
    require("cancel-in-progress: false" in pipeline, "release order must be serialized")
    paths = lambda text: set(re.findall(r'^      - "([^"]+)"$', text, re.M))
    require(paths(pipeline) == paths(quality), "main and PR path coverage must match")
    for path in ["images/**", "media/**", "audio/**", "fonts/**", "data/events.json", "pnpm-lock.yaml", "templates/site/**", "site-src/**"]:
        require(path in paths(pipeline), f"missing release input: {path}")
    require('!images/fw/gallery-manifest.json' in paths(pipeline),
            "generated manifest must not trigger a publication loop")
    for text in (pipeline, quality):
        require("ref: ${{ github.sha }}" in text, "checkout must pin source, never moving main")
        for command in ["bash scripts/run-data-build.sh", "bash scripts/run-quality-gates.sh",
                        "node scripts/build-gallery-manifest.mjs", "python scripts/package-site.py",
                        "node scripts/run-browser-gates.cjs"]:
            require(text.count(command) == 1, f"exactly one canonical step required: {command}")
        require(text.find("bash scripts/run-data-build.sh") < text.find("bash scripts/run-quality-gates.sh") <
                text.find("python scripts/package-site.py") < text.find("node scripts/run-browser-gates.cjs"),
                "build, validation, packaging and browser checks must stay ordered")
        require("pnpm install --frozen-lockfile --ignore-scripts" in text and
                "pnpm exec playwright install --with-deps --only-shell chromium" in text,
                "browser dependencies must be locked and available")
        require("runs-on: ubuntu-24.04" in text, "visual runner OS must remain pinned")
        require("pnpm test:visual" in text, "visual checks cannot be omitted")
        require(text.find("node scripts/run-browser-gates.cjs") < text.find("pnpm test:visual"),
                "visual checks must run on the packaged, behavior-tested site")
        require("tests/visual/**" in paths(text), "visual baselines must trigger checks")
        require("--update-snapshots" not in text, "CI must never approve its own screenshots")
        require("cache: pip" in text and "hashFiles('pnpm-lock.yaml')" in text and
                "--prefer-offline" in text, "dependency caches must stay lock-keyed")
        require("timeout-minutes: 6" in text and "timeout-minutes: 12" in text,
                "setup and browser checks must have bounded timeouts")
    require("needs: build" in pipeline.split("\n  deploy:")[-1], "deployment must wait for all checks")
    require("if: needs.build.outputs.ready == 'true'" in pipeline, "obsolete builds must not publish")
    require("uses: actions/upload-pages-artifact@v5" in pipeline and
            "uses: actions/deploy-pages@v5" in pipeline, "Pages must use the checked artifact")
    require(pipeline.find("node scripts/run-browser-gates.cjs") < pipeline.find("git push origin HEAD:main") <
            pipeline.find("uses: actions/upload-pages-artifact"), "never commit/upload before tests")
    require(pipeline.find("pnpm test:visual") < pipeline.find("git push origin HEAD:main"),
            "visual failures must block publishing")
    require('test "$CURRENT_SHA" = "$EXPECTED_SHA"' in pipeline and
            'git rev-parse origin/main' in pipeline, "stale revisions must be checked at commit and deployment")
    require("needs.build.outputs.built_sha" in pipeline, "deployment head guard must use tested generated commit")
    require("release.json?revision=$SOURCE_SHA" in pipeline, "production release must be verified")
    require(not any(x in pipeline + quality for x in
                    ["continue-on-error:", "always()", "|| true", "git reset --hard", "--force", "git rebase"]),
            "failures cannot be hidden and checked content cannot be rebased/replaced")
    return errors


class ReleaseTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.pipeline = (ROOT / ".github/workflows/tlpt-update.yml").read_text()
        cls.quality = (ROOT / ".github/workflows/site-quality.yml").read_text()

    def test_current_contract(self):
        self.assertEqual(coordination_errors(self.pipeline, self.quality), [])

    def test_visual_gate_keeps_review_and_coverage_contract(self):
        config = (ROOT / 'tests/visual/playwright.config.cjs').read_text()
        suite = (ROOT / 'tests/visual/site.spec.cjs').read_text()
        package = json.loads((ROOT / 'package.json').read_text())
        self.assertEqual(package['scripts']['test:visual'],
                         'playwright test --config tests/visual/playwright.config.cjs')
        self.assertIn("updateSnapshots: 'none'", config)
        self.assertIn('[1440, 820, 390, 320]', config)
        self.assertIn('maxDiffPixels: 30', config)
        self.assertIn("mask: [target.locator('audio')]", suite)
        self.assertIn('test.info().outputPath', suite)
        self.assertNotIn('writeFile', suite)
        for scene in ['rules badges and avatars', 'trophy dropdown above artwork',
                      'form lab axis dropdown', 'dashboard help dialog',
                      'Norm inline player and read-me', 'shared navigation expanded and footer']:
            self.assertIn(scene, suite)
        self.assertIn("return route.abort()", suite)
        self.assertIn("page.clock.setFixedTime", suite)
        self.assertNotIn('addStyleTag', suite)

    def test_regression_guards(self):
        for before, after in [
            ("needs: build", "needs: missing"),
            ("ref: ${{ github.sha }}", "ref: main"),
            ("node scripts/run-browser-gates.cjs", "echo skipped"),
            ("pnpm test:visual", "echo skipped-visual"),
            ("runs-on: ubuntu-24.04", "runs-on: ubuntu-latest"),
            ("bash scripts/run-quality-gates.sh", "echo skipped"),
            ('test "$CURRENT_SHA" = "$EXPECTED_SHA"', 'echo unchecked'),
            ("cancel-in-progress: false", "cancel-in-progress: true"),
            ("actions/deploy-pages@v5", "echo skipped"),
            ('      - "media/**"\n', ""),
            ("git push origin HEAD:main", "git push --force origin HEAD:main"),
        ]:
            with self.subTest(regression=before):
                self.assertTrue(coordination_errors(self.pipeline.replace(before, after), self.quality))

    def test_single_manifest_writer(self):
        diagnostic = (ROOT / ".github/workflows/build-gallery-manifest.yml").read_text()
        self.assertNotIn("\n  push:", diagnostic)
        self.assertNotIn("git push", diagnostic)
        self.assertIn("git diff --exit-code", diagnostic)

    def test_product_isolation(self):
        cashier = (ROOT / ".github/workflows/cashier-checks.yml").read_text()
        self.assertNotIn("bash scripts/run-quality-gates.sh", cashier)
        for command in ("pnpm check", "pnpm test:integration", "scripts/test-recovery.py --product cashier"):
            self.assertIn(command, cashier)
        for source in (ROOT / "rsvp/scripts").glob("*.mjs"):
            self.assertNotIn("../cashier/", source.read_text(), str(source))
        self.assertIn("working-directory: rsvp", (ROOT / ".github/workflows/rsvp-checks.yml").read_text())

    def test_generated_shell_uses_single_guarded_publisher(self):
        runner = (ROOT / 'scripts/run-data-build.sh').read_text()
        self.assertEqual(runner.count('scripts/build-site-shell.py'), 1)
        self.assertIn('from scripts.site_components import PAGES', self.pipeline)
        self.assertIn('git add app.js style.css', self.pipeline)
        self.assertIn('synchronize(check=True)', (ROOT / 'scripts/package-site.py').read_text())
        diagnostic = (ROOT / '.github/workflows/rotate-shared-css-cache.yml').read_text()
        self.assertNotIn('git push', diagnostic)
        self.assertNotIn('contents: write', diagnostic)
        registration = (ROOT / '.github/workflows/registration-checks.yml').read_text()
        self.assertEqual(registration.count("'templates/site/**'"), 2)
        self.assertEqual(registration.count("'site-src/**'"), 2)
        self.assertIn('canonicalSource()', (ROOT / 'registration-domain/build.mjs').read_text())


if __name__ == "__main__":
    unittest.main()
