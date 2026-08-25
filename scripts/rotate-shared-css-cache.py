\
#!/usr/bin/env python3
"""Safely rotate the shared site-tail.css cache key across every public HTML page."""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ASSET = "site-tail.css"
REF_RE = re.compile(r'(?P<prefix>/?site-tail\.css\?v=)(?P<version>[^"\']+)')
VERSION_RE = re.compile(r"^[A-Za-z0-9._-]+$")


def public_pages() -> list[Path]:
    return sorted(ROOT.glob("*.html"))


def page_versions(page: Path) -> list[str]:
    return [m.group("version") for m in REF_RE.finditer(page.read_text(encoding="utf-8"))]


def inspect_pages() -> tuple[list[Path], list[str]]:
    pages = public_pages()
    errors: list[str] = []
    if not pages:
        return pages, ["No public HTML pages were found."]

    for page in pages:
        versions = page_versions(page)
        if len(versions) != 1:
            errors.append(
                f"{page.name}: expected exactly one {ASSET} cache-key reference, found {len(versions)}"
            )
    return pages, errors


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Rotate the shared site-tail.css cache key on every public HTML page."
    )
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--version", help="New cache key to write, e.g. 20260825-5")
    group.add_argument("--check", metavar="VERSION", help="Verify every page already uses VERSION")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would change without writing files (valid only with --version).",
    )
    args = parser.parse_args()

    requested = args.version or args.check
    if not VERSION_RE.fullmatch(requested or ""):
        print("ERROR: cache key may contain only letters, numbers, dot, underscore, and hyphen.", file=sys.stderr)
        return 2
    if args.dry_run and not args.version:
        print("ERROR: --dry-run requires --version.", file=sys.stderr)
        return 2

    pages, errors = inspect_pages()
    if errors:
        for error in errors:
            print(f"ERROR: {error}", file=sys.stderr)
        return 1

    if args.check:
        mismatches = [
            f"{page.name}: {page_versions(page)[0]}"
            for page in pages
            if page_versions(page)[0] != requested
        ]
        if mismatches:
            print(f"ERROR: not every public page uses {ASSET}?v={requested}:", file=sys.stderr)
            for mismatch in mismatches:
                print(f" - {mismatch}", file=sys.stderr)
            return 1
        print(f"PASS: {len(pages)} public pages use {ASSET}?v={requested}")
        return 0

    changed: list[str] = []
    for page in pages:
        text = page.read_text(encoding="utf-8")
        updated, count = REF_RE.subn(lambda m: f'{m.group("prefix")}{requested}', text)
        if count != 1:
            print(f"ERROR: {page.name}: cache-key replacement count was {count}", file=sys.stderr)
            return 1
        if updated != text:
            changed.append(page.name)
            if not args.dry_run:
                page.write_text(updated, encoding="utf-8")

    action = "Would update" if args.dry_run else "Updated"
    print(f"{action} {len(changed)} of {len(pages)} public pages to {ASSET}?v={requested}")
    if changed:
        print("Pages: " + ", ".join(changed))

    if not args.dry_run:
        verify = [
            page.name for page in pages
            if page_versions(page) != [requested]
        ]
        if verify:
            print("ERROR: post-write verification failed: " + ", ".join(verify), file=sys.stderr)
            return 1
        print(f"PASS: all {len(pages)} public pages now use one shared cache key.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
