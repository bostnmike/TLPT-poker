#!/usr/bin/env python3
"""Generate shared HTML regions and deterministic local JS/CSS cache versions."""
import argparse
from site_components import PAGES, render_page, synchronize
from source_bundles import synchronize_bundles


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='Fail on generated-region or asset-version drift; do not write')
    parser.add_argument('--page', choices=PAGES, help='Render one page to stdout without modifying files')
    args = parser.parse_args()
    if args.page:
        print(render_page(args.page), end='')
        return 0
    assets = synchronize_bundles(check=args.check)
    if args.check and assets:
        print('FAIL: rebuild source bundles before checking markup: ' + ', '.join(assets))
        return 1
    changed = synchronize(check=args.check)
    if args.check and changed:
        print('FAIL: run python3 scripts/build-site-shell.py; stale pages: ' + ', '.join(changed))
        return 1
    print(f'PASS: shared shell and content hashes for {len(PAGES)} TLPT pages ({len(changed)} updated).')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
