#!/usr/bin/env python3
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
import subprocess
import sys
from stable_generated import preserve_timestamp

spec = importlib.util.spec_from_file_location("package_site", Path(__file__).with_name("package-site.py"))
package = importlib.util.module_from_spec(spec)
spec.loader.exec_module(package)


class ReleaseToolsTests(unittest.TestCase):
    def test_root_compatibility_audit_resolves_shared_build_helpers(self):
        result = subprocess.run([sys.executable, 'audit-code-hygiene.py'],
                                cwd=package.ROOT, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_private_and_source_files_never_publish(self):
        for name in ["cashier/worker.ts", "cashier/private/backup.json", ".git/config",
                     "rsvp/owner.local.json", "registration-domain/worker.js",
                     "data/raw/events/Event Report.html", "scripts/test.js",
                     "maintenance-baseline.json", "lily-site/build.py",
                     "templates/site/header.html", "templates/site/navigation.json"]:
            self.assertFalse(package.public_path(name), name)

    def test_public_products_and_media_stay_available(self):
        for name in ["index.html", "register.html", "cashier.html", "lily.html",
                     "lily-site/index.html", "lily-site/mascots/hello.svg",
                     "marchand-vault/index.html", "data/marchand-pucks.json",
                     "data/generated/site-data.json", "data/parsed/events/index.json",
                     "media/norm-narrates/norm-form-lab.mp3", "vendor/pdfjs/pdf.mjs"]:
            self.assertTrue(package.public_path(name), name)

    def test_no_op_build_preserves_timestamp_but_change_updates_it(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "data.json"
            path.write_text(json.dumps({"generatedAt":"old","players":[1]}))
            self.assertEqual(preserve_timestamp(path, {"generatedAt":"new","players":[1]})["generatedAt"], "old")
            self.assertEqual(preserve_timestamp(path, {"generatedAt":"new","players":[2]})["generatedAt"], "new")


if __name__ == "__main__":
    unittest.main()
