#!/usr/bin/env python3
"""Regression guards: only a checked, immutable artifact may reach Pages."""
import re
import json
import unittest
import subprocess
import sys
import tempfile
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
                        "python scripts/browser-ci.py functional"]:
            require(text.count(command) == 1, f"exactly one canonical step required: {command}")
        require(text.find("bash scripts/run-data-build.sh") < text.find("bash scripts/run-quality-gates.sh") <
                text.find("python scripts/package-site.py") < text.find("python scripts/browser-ci.py functional"),
                "build, validation, packaging and browser checks must stay ordered")
        require("pnpm install --frozen-lockfile --ignore-scripts" in text and
                "python scripts/browser-ci.py prepare" in text,
                "browser dependencies must be locked and available")
        require('playwright install --with-deps' not in text, 'browser CI must not reinstall Ubuntu packages per release')
        require("runs-on: ubuntu-24.04" in text, "visual runner OS must remain pinned")
        require("python scripts/browser-ci.py visual" in text, "visual checks cannot be omitted")
        require(text.find("python scripts/browser-ci.py functional") < text.find("python scripts/browser-ci.py visual"),
                "visual checks must run on the packaged, behavior-tested site")
        require("tests/visual/**" in paths(text), "visual baselines must trigger checks")
        require("--update-snapshots" not in text, "CI must never approve its own screenshots")
        require("cache: pip" in text and "hashFiles('pnpm-lock.yaml')" in text and
                "--prefer-offline" in text, "dependency caches must stay lock-keyed")
        require("timeout-minutes: 11" in text and "timeout-minutes: 12" in text,
                "setup and browser checks must have bounded timeouts")
        require('python scripts/report-release-failure.py' in text, 'failures must distinguish setup from site checks')
    require("needs: build" in pipeline.split("\n  deploy:")[-1], "deployment must wait for all checks")
    require("if: needs.build.outputs.ready == 'true'" in pipeline, "obsolete builds must not publish")
    require("uses: actions/upload-pages-artifact@v5" in pipeline and
            "uses: actions/deploy-pages@v5" in pipeline, "Pages must use the checked artifact")
    require(pipeline.find("python scripts/browser-ci.py functional") < pipeline.find("git push origin HEAD:main") <
            pipeline.find("uses: actions/upload-pages-artifact"), "never commit/upload before tests")
    require(pipeline.find("python scripts/browser-ci.py visual") < pipeline.find("git push origin HEAD:main"),
            "visual failures must block publishing")
    require('test "$CURRENT_SHA" = "$EXPECTED_SHA"' in pipeline and
            'git ls-remote --exit-code origin refs/heads/main | cut -f1' in pipeline and
            'if [ "$CURRENT_SHA" != "$SOURCE_SHA" ]; then' in pipeline,
            "stale revisions must be checked at commit and deployment")
    require('fetch-depth: 1' in pipeline and 'fetch-depth: 0' not in pipeline and
            'git fetch' not in pipeline, "release checkout must not download full history")
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

    def test_browser_environment_guards(self):
        subprocess.run([sys.executable, str(ROOT/'scripts/test-browser-ci.py')], check=True)

    def test_visual_gate_keeps_review_and_coverage_contract(self):
        config = (ROOT / 'tests/visual/playwright.config.cjs').read_text()
        suite = (ROOT / 'tests/visual/site.spec.cjs').read_text()
        package = json.loads((ROOT / 'package.json').read_text())
        self.assertEqual(package['scripts']['test:visual'],
                         'playwright test --config tests/visual/playwright.config.cjs')
        self.assertIn("updateSnapshots: 'none'", config)
        self.assertIn('[1440, 820, 390, 320]', config)
        self.assertIn('maxDiffPixels: 30', config)
        self.assertIn('threshold: 0.15', config)
        self.assertIn('retries: 0', config)
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
            ("fetch-depth: 1", "fetch-depth: 0"),
            ("git ls-remote --exit-code origin refs/heads/main | cut -f1", "git fetch origin main"),
            ('if [ "$CURRENT_SHA" != "$SOURCE_SHA" ]; then', 'if false; then'),
            ("python scripts/browser-ci.py functional", "echo skipped"),
            ("python scripts/browser-ci.py visual", "echo skipped-visual"),
            ("python scripts/browser-ci.py prepare", "echo skipped-setup"),
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

    def test_shallow_publication_preserves_head_and_push_guards(self):
        # Exercise real Git against disposable local repos, never GitHub/main.
        with tempfile.TemporaryDirectory(prefix='tlpt-shallow-release-') as directory:
            root = Path(directory)
            remote, author, release = (root / name for name in ('remote.git', 'author', 'release'))

            def git(cwd, *args, check=True):
                return subprocess.run(['git', '-c', 'user.name=Release Test',
                                       '-c', 'user.email=release-test@example.invalid', *args],
                                      cwd=cwd, text=True, capture_output=True, check=check)

            git(root, 'init', '--bare', str(remote))
            git(root, 'init', '-b', 'main', str(author))
            git(author, 'remote', 'add', 'origin', remote.as_uri())
            for version in range(3):
                (author / 'source.txt').write_text(str(version))
                git(author, 'add', 'source.txt')
                git(author, 'commit', '-m', f'Source {version}')
            git(author, 'push', 'origin', 'HEAD:main')
            source_sha = git(author, 'rev-parse', 'HEAD').stdout.strip()

            git(root, 'init', str(release))
            git(release, 'remote', 'add', 'origin', remote.as_uri())
            git(release, 'fetch', '--no-tags', '--depth=1', 'origin', source_sha)
            git(release, 'checkout', '--detach', 'FETCH_HEAD')
            self.assertEqual(git(release, 'rev-list', '--count', 'HEAD').stdout.strip(), '1')

            def remote_head():
                return git(release, 'ls-remote', '--exit-code', 'origin', 'refs/heads/main').stdout.split()[0]

            self.assertEqual(remote_head(), source_sha)
            (release / 'generated.txt').write_text('tested output')
            git(release, 'add', 'generated.txt')
            git(release, 'commit', '-m', 'Tested generated output')
            git(release, 'push', 'origin', 'HEAD:main')
            tested_sha = git(release, 'rev-parse', 'HEAD').stdout.strip()
            self.assertEqual(remote_head(), tested_sha)
            self.assertNotEqual(remote_head(), source_sha, 'An obsolete source must not publish')

            # A writer arriving after the head check must still defeat our push.
            self.assertEqual(remote_head(), tested_sha)
            git(author, 'pull', '--ff-only', 'origin', 'main')
            (author / 'source.txt').write_text('newer source')
            git(author, 'commit', '-am', 'Concurrent update')
            git(author, 'push', 'origin', 'HEAD:main')
            concurrent_sha = remote_head()
            self.assertNotEqual(concurrent_sha, tested_sha)
            (release / 'generated.txt').write_text('stale output')
            git(release, 'commit', '-am', 'Stale generated output')
            self.assertNotEqual(git(release, 'push', 'origin', 'HEAD:main', check=False).returncode, 0)
            self.assertEqual(remote_head(), concurrent_sha, 'Concurrent work must remain untouched')

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
