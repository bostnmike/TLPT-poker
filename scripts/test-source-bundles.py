#!/usr/bin/env python3
"""Protect byte order, classic-script scope, CSS groups and deterministic output."""
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from source_bundles import ROOT, bundle_manifest, render_bundles, synchronize_bundles
from site_components import asset_version


def css_balanced(data):
    # Fragment boundaries must be outside strings, comments and complete CSS
    # blocks (including media queries). Do not parse/rewrite selector contents.
    text = data.decode('utf-8')
    depth = 0
    quote = None
    comment = False
    i = 0
    while i < len(text):
        pair = text[i:i+2]
        ch = text[i]
        if comment:
            if pair == '*/':
                comment = False
                i += 2
                continue
        elif quote:
            if ch == '\\':
                i += 2
                continue
            if ch == quote:
                quote = None
        elif pair == '/*':
            comment = True
            i += 2
            continue
        elif ch in ('"', "'"):
            quote = ch
        elif ch == '{':
            depth += 1
        elif ch == '}':
            depth -= 1
            if depth < 0:
                return False
        i += 1
    return depth == 0 and quote is None and not comment


class SourceBundleTests(unittest.TestCase):
    def test_publisher_can_import_components_from_repository_root(self):
        result = subprocess.run([sys.executable, '-c',
            'from scripts.site_components import PAGES, asset_version; '
            'assert len(PAGES) == 22; assert len(asset_version("style.css")) == 16'],
            cwd=ROOT, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        for folder in ['app', 'styles']:
            (self.root / 'site-src' / folder).mkdir(parents=True)
        self.manifest = {'schemaVersion':1, 'bundles':{
            'app.js':['site-src/app/01.js', 'site-src/app/02.js'],
            'style.css':['site-src/styles/01.css', 'site-src/styles/02.css']}}
        for name, content in [('app/01.js',b'const value = 1;\n'), ('app/02.js',b'function read(){return value;}\n'),
                              ('styles/01.css',b'.card {color:red;}\n'), ('styles/02.css',b'.card {color:gold;}\n')]:
            (self.root / 'site-src' / name).write_bytes(content)
        self.save()

    def save(self):
        (self.root / 'site-src/manifest.json').write_text(json.dumps(self.manifest))

    def test_exact_concatenation_and_idempotence(self):
        self.assertEqual(synchronize_bundles(self.root), ['app.js', 'style.css'])
        self.assertEqual((self.root/'app.js').read_bytes(), b'const value = 1;\nfunction read(){return value;}\n')
        self.assertEqual((self.root/'style.css').read_bytes(), b'.card {color:red;}\n.card {color:gold;}\n')
        before = (self.root/'app.js').stat().st_mtime_ns
        self.assertEqual(synchronize_bundles(self.root), [])
        self.assertEqual((self.root/'app.js').stat().st_mtime_ns, before)

    def test_source_change_is_detected_without_mutating_delivery(self):
        synchronize_bundles(self.root)
        before = (self.root/'style.css').read_bytes()
        (self.root/'site-src/styles/02.css').write_bytes(b'.card {color:green;}\n')
        self.assertEqual(synchronize_bundles(self.root, check=True), ['style.css'])
        self.assertEqual((self.root/'style.css').read_bytes(), before)
        # Registration can derive the correct new version before a bot commits
        # the generated delivery file, without changing that file itself.
        expected = hashlib.sha256(render_bundles(self.root)['style.css']).hexdigest()[:16]
        self.assertEqual(asset_version('style.css', self.root), expected)
        self.assertEqual((self.root/'style.css').read_bytes(), before)

    def test_order_is_explicit_never_sorted_or_deduplicated(self):
        first = render_bundles(self.root)['style.css']
        self.manifest['bundles']['style.css'].reverse()
        self.save()
        self.assertNotEqual(render_bundles(self.root)['style.css'], first)

    def test_missing_duplicate_unlisted_and_unsafe_inputs_fail(self):
        original = json.loads(json.dumps(self.manifest))
        for files in [[], ['site-src/app/01.js']*2, ['../app.js'], ['site-src/app/missing.js']]:
            self.manifest['bundles']['app.js'] = files
            self.save()
            with self.assertRaises(ValueError):
                synchronize_bundles(self.root)
            self.assertFalse((self.root/'style.css').exists())
        self.manifest = original
        self.save()
        (self.root/'site-src/app/unlisted.js').write_text('ignored?')
        with self.assertRaises(ValueError):
            render_bundles(self.root)

    def test_only_owned_delivery_targets_and_no_symlinks(self):
        self.manifest['bundles']['lily.js'] = []
        self.save()
        with self.assertRaises(ValueError):
            render_bundles(self.root)
        del self.manifest['bundles']['lily.js']
        self.save()
        (self.root/'style.css').symlink_to(self.root/'site-src/styles/01.css')
        with self.assertRaises(ValueError):
            synchronize_bundles(self.root)

    def test_real_sections_are_complete_and_bundles_are_current(self):
        manifest = bundle_manifest(ROOT)
        self.assertEqual(synchronize_bundles(ROOT, check=True), [])
        for name in manifest['bundles']['app.js']:
            result = subprocess.run(['node', '--check', str(ROOT/name)], capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, name + '\n' + result.stderr)
        for name in manifest['bundles']['style.css']:
            self.assertTrue(css_balanced((ROOT/name).read_bytes()), name)
        result = subprocess.run(['node', '--check', str(ROOT/'app.js')], capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_css_boundary_checker_rejects_partial_groups(self):
        self.assertTrue(css_balanced(b'@media (min-width:1px){.x{content:"}";}}'))
        self.assertFalse(css_balanced(b'@media (min-width:1px){.x{color:red;}'))
        self.assertFalse(css_balanced(b'/* unfinished'))


if __name__ == '__main__':
    unittest.main()
