"""Ordered, byte-preserving assembly of TLPT's classic script and stylesheet."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUTS = {'app.js': ('app', '.js'), 'style.css': ('styles', '.css')}


def bundle_manifest(root=ROOT):
    if (root / 'site-src').is_symlink() or (root / 'site-src/manifest.json').is_symlink():
        raise ValueError('Refusing symlink source manifest')
    manifest = json.loads((root / 'site-src/manifest.json').read_text())
    if manifest.get('schemaVersion') != 1 or set(manifest.get('bundles', {})) != set(OUTPUTS):
        raise ValueError('Expected exactly the app.js and style.css source bundles')
    for output, (folder, suffix) in OUTPUTS.items():
        files = manifest['bundles'][output]
        if (not isinstance(files, list) or not files
                or any(not isinstance(name, str) for name in files) or len(files) != len(set(files))):
            raise ValueError(f'{output}: source list must be nonempty and unique')
        source_root = root / 'site-src' / folder
        if source_root.is_symlink():
            raise ValueError(f'Refusing symlink source directory: {folder}')
        for name in files:
            relative = Path(name)
            source = root / relative
            if (relative.parts[:2] != ('site-src', folder) or len(relative.parts) != 3
                    or relative.suffix != suffix or source.is_symlink()
                    or not source.resolve().is_relative_to(source_root.resolve())
                    or not source.is_file()):
                raise ValueError(f'{output}: missing or unsafe source {name}')
        actual = {str(p.relative_to(root)) for p in source_root.rglob('*') if p.is_file() and p.suffix == suffix}
        if set(files) != actual:
            raise ValueError(f'{output}: unlisted or missing source sections: {sorted(actual.symmetric_difference(files))}')
    return manifest


def render_bundles(root=ROOT):
    manifest = bundle_manifest(root)
    # No wrappers, separators, minification, imports or reordering. In particular,
    # CSS URLs stay relative to style.css and script globals keep classic scope.
    return {output: b''.join((root / name).read_bytes() for name in files)
            for output, files in manifest['bundles'].items()}


def synchronize_bundles(root=ROOT, check=False):
    rendered = render_bundles(root)
    for output in rendered:
        if (root / output).is_symlink():
            raise ValueError(f'Refusing symlink output: {output}')
    changed = [name for name, content in rendered.items()
               if not (root / name).is_file() or (root / name).read_bytes() != content]
    if not check:
        for name in changed:
            (root / name).write_bytes(rendered[name])
    return changed
