#!/usr/bin/env python3
"""Build existing public assets from smaller ordered source sections."""
import argparse
from source_bundles import synchronize_bundles


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='Fail on stale bundles without writing')
    args = parser.parse_args()
    changed = synchronize_bundles(check=args.check)
    if args.check and changed:
        print('FAIL: rebuild with python3 scripts/build-site-shell.py; stale bundles: ' + ', '.join(changed))
        return 1
    print(f'PASS: ordered app/style bundles ({len(changed)} updated).')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
