#!/usr/bin/env python3
"""Regression tests for deterministic, scoped, build-time shared markup."""
import hashlib
import json
from pathlib import Path
import shutil
import tempfile
import unittest
from site_components import ROOT, PAGES, asset_version, navigation, render_page, synchronize, version_assets


class ComponentsTests(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.addCleanup(self.folder.cleanup)
        self.root = Path(self.folder.name)
        shutil.copytree(ROOT / 'templates', self.root / 'templates')
        self.source = '<header class="site-header">legacy</header><main>Keep this body.</main><footer class="site-footer">legacy</footer><script src="unit.js?v=old"></script>'
        for name in PAGES:
            (self.root / name).write_text(self.source)
        (self.root / 'unit.js').write_text('first content')

    def test_one_source_all_pages_and_idempotence(self):
        self.assertEqual(len(synchronize(self.root)), len(PAGES))
        self.assertEqual(synchronize(self.root, check=True), [])
        self.assertEqual(synchronize(self.root), [])
        for name in PAGES:
            text = (self.root / name).read_text()
            self.assertIn('<main>Keep this body.</main>', text)
            self.assertEqual(text.count('<!-- TLPT GENERATED HEADER:'), 1)

    def test_automatic_versions_follow_bytes_not_time(self):
        synchronize(self.root)
        first = asset_version('unit.js', self.root)
        self.assertEqual(first, hashlib.sha256(b'first content').hexdigest()[:16])
        (self.root / 'unit.js').touch()
        self.assertEqual(synchronize(self.root, check=True), [])
        (self.root / 'unit.js').write_text('second content')
        self.assertNotEqual(first, asset_version('unit.js', self.root))
        self.assertEqual(len(synchronize(self.root, check=True)), len(PAGES))
        # Check mode never writes.
        self.assertIn('?v=' + first, (self.root / 'index.html').read_text())

    def test_query_fragments_absolute_paths_and_external_urls(self):
        source = '<script src="/unit.js?lang=en&amp;v=old#module"></script><script src="https://cdn.example/a.js?v=old"></script>'
        result = version_assets(source, self.root)
        self.assertIn('/unit.js?v=' + asset_version('unit.js', self.root) + '&amp;lang=en#module', result)
        self.assertIn('https://cdn.example/a.js?v=old', result)
        self.assertEqual(version_assets(result, self.root), result)

    def test_unknown_assets_and_duplicate_regions_fail_closed(self):
        with self.assertRaises(ValueError):
            version_assets('<script src="missing.js"></script>', self.root)
        with self.assertRaises(ValueError):
            render_page('index.html', self.source + '<header class="site-header">duplicate</header>', self.root)
        with self.assertRaises(ValueError):
            asset_version('../outside.js', self.root)
        (self.root / PAGES[-1]).write_text(self.source + '<script src="missing.js"></script>')
        with self.assertRaises(ValueError):
            synchronize(self.root)
        self.assertEqual((self.root / PAGES[0]).read_text(), self.source,
                         'Failed render must not partially rewrite other pages')

    def test_only_changed_assets_receive_new_versions(self):
        (self.root / 'other.css').write_text('body { color: white; }')
        source = '<link href="other.css"><script src="unit.js"></script>'
        first = version_assets(source, self.root)
        other_hash = asset_version('other.css', self.root)
        (self.root / 'unit.js').write_text('new content')
        second = version_assets(source, self.root)
        self.assertNotEqual(first, second)
        self.assertIn('other.css?v=' + other_hash, second)

    def test_unowned_products_are_untouched(self):
        for name in ['lily.html', 'marchand.html', 'cashier.html']:
            (self.root / name).write_text('Independent product')
            with self.assertRaises(ValueError):
                render_page(name, root=self.root)
        synchronize(self.root)
        for name in ['lily.html', 'marchand.html', 'cashier.html']:
            self.assertEqual((self.root / name).read_text(), 'Independent product')

    def test_navigation_changes_propagate_and_hidden_pages_stay_hidden(self):
        file = self.root / 'templates/site/navigation.json'
        data = json.loads(file.read_text())
        data[0]['label'] = 'New Home Label'
        file.write_text(json.dumps(data))
        synchronize(self.root)
        for name in PAGES:
            self.assertIn('New Home Label', (self.root / name).read_text())
        self.assertNotIn('href="register.html"', navigation('index.html', self.root))
        self.assertIn('href="/index.html"', navigation('404.html', self.root))
        self.assertIn('class="is-active" aria-current="page">Player Profiles', navigation('player.html', self.root))

    def test_published_inputs_are_generated_and_current(self):
        self.assertEqual(synchronize(ROOT, check=True), [])


if __name__ == '__main__':
    unittest.main()
