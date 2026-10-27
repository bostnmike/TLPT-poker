"""Offline checks for immutable setup, bounded retries, and failure classification."""
import importlib.util
from pathlib import Path
import subprocess
import unittest
from unittest.mock import Mock, patch


def module(name, file):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).with_name(file))
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result


ci = module('browser_ci', 'browser-ci.py')
report = module('report_failure', 'report-release-failure.py')


class BrowserCITests(unittest.TestCase):
    def setUp(self):
        # Simulated failed downloads must not emit real GitHub warning annotations.
        self.print_patch = patch('builtins.print')
        self.print_patch.start()
        self.addCleanup(self.print_patch.stop)

    def test_image_is_digest_pinned_and_version_matched(self):
        self.assertIn('@sha256:', ci.environment()['image'])

    def test_reference_fonts_are_checksum_verified(self):
        with patch.object(Path, 'read_bytes', return_value=b'changed font'):
            with self.assertRaisesRegex(ValueError, 'font checksum mismatch'):
                ci.environment()

    def test_pull_success_needs_one_attempt(self):
        run = Mock(return_value=Mock(returncode=0)); sleep = Mock()
        ci.pull(ci.environment(), run, sleep)
        self.assertEqual(run.call_count, 1); sleep.assert_not_called()

    def test_temporary_pull_failure_retries_same_image(self):
        run = Mock(side_effect=[Mock(returncode=1), Mock(returncode=0)]); sleep = Mock()
        ci.pull(ci.environment(), run, sleep)
        self.assertEqual(run.call_args_list[0], run.call_args_list[1])
        sleep.assert_called_once_with(10)

    def test_timeout_is_bounded_and_blocks_after_three(self):
        run = Mock(side_effect=subprocess.TimeoutExpired('docker', 180)); sleep = Mock()
        with self.assertRaises(RuntimeError): ci.pull(ci.environment(), run, sleep)
        self.assertEqual(run.call_count, 3)
        self.assertEqual(sleep.call_count, 2)

    def test_functional_and_visual_failures_never_retry(self):
        for mode in ('functional', 'visual'):
            run = Mock(return_value=Mock(returncode=1))
            self.assertEqual(ci.execute(mode, ci.environment(), run), 1)
            self.assertEqual(run.call_count, 1)

    def test_soak_runs_are_repetition_not_retry_or_baseline_update(self):
        run = Mock(return_value=Mock(returncode=0))
        ci.execute('visual', ci.environment(), run, repeats=3)
        command = run.call_args.args[0]
        self.assertEqual(command[-2:], ['--repeat-each', '3'])
        self.assertNotIn('--update-snapshots', command)
        self.assertNotIn('--retries', command)

    def test_container_receives_no_secrets_or_docker_socket(self):
        command = ci.container_command(ci.environment(), ['node', 'script.cjs'])
        self.assertNotIn('--privileged', command)
        self.assertFalse(any('docker.sock' in s or 'GITHUB_TOKEN' in s for s in command))
        self.assertIn('--user', command)
        self.assertIn(f'{ci.ROOT}/tests/visual/fonts:/usr/local/share/fonts/tlpt-reference:ro', command)

    def test_failures_have_distinct_categories(self):
        self.assertEqual(report.classify({'BROWSER_ENVIRONMENT':'failure'})[0], 'TEST ENVIRONMENT UNAVAILABLE')
        self.assertEqual(report.classify({'BROWSER_ENVIRONMENT':'success'})[0], 'SITE BUILD OR CHECK FAILED')


if __name__ == '__main__': unittest.main()
