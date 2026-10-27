#!/usr/bin/env python3
"""Stage only public assets; never deploy repository internals or private apps."""
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
from site_components import synchronize

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / ".site-release"
ASSETS = {"images", "audio", "media", "fonts", "downloads", "vendor",
          "lily-site", "marchand-vault"}
EXTENSIONS = {".html", ".css", ".js", ".json", ".png", ".jpg", ".jpeg", ".svg",
              ".webp", ".avif", ".gif", ".ico", ".mp3", ".mp4", ".webm", ".ogg",
              ".wav", ".m4a", ".vtt", ".srt", ".woff", ".woff2", ".ttf", ".otf",
              ".pdf", ".mjs", ".bcmap", ".pfb", ".wasm"}
ROOT_JSON = {"news-data.json", "knockouts.json", "knockout-events-full.json",
             "knockout-name-map-full.json"}


def public_path(name):
    p = Path(name)
    if any(part.startswith(".") for part in p.parts):
        return name == ".nojekyll"
    if len(p.parts) == 1:
        return (p.suffix in {".html", ".css", ".js", ".png"} or
                name in ROOT_JSON | {"CNAME", "robots.txt", "sitemap.xml"})
    if p.parts[0] in ASSETS:
        return p.suffix.lower() in EXTENSIONS or p.name in {"LICENSE", "LICENSE.txt"}
    if p.parts[0] == "data":
        return p.suffix == ".json" and (len(p.parts) == 2 or p.parts[1] in {"generated", "parsed"})
    return False


def main():
    stale = synchronize(check=True)
    if stale:
        raise RuntimeError('Build the shared shell before packaging: ' + ', '.join(stale))
    # Only this generated staging directory may be replaced.
    if DEST.is_symlink():
        raise RuntimeError("Refusing a symlink staging directory")
    if DEST.exists():
        shutil.rmtree(DEST)
    DEST.mkdir()
    tracked = subprocess.check_output(["git", "ls-files", "-z"], cwd=ROOT).decode().split("\0")
    names = sorted(n for n in tracked if n and public_path(n))
    digest = hashlib.sha256()
    for name in names:
        source = ROOT / name
        if source.is_symlink():
            raise RuntimeError(f"Public symlinks are not allowed: {name}")
        target = DEST / name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, target)
        digest.update(name.encode() + b"\0" + hashlib.sha256(source.read_bytes()).digest())
    for required in ("index.html", "register.html", "lily-site/index.html",
                     "marchand.html", "marchand-vault/index.html", "cashier.html",
                     "data/generated/site-data.json", "images/fw/gallery-manifest.json"):
        if not (DEST / required).is_file():
            raise RuntimeError(f"Required public route or data omitted: {required}")
    receipt = {
        "sourceRevision": os.environ.get("GITHUB_SHA") or subprocess.check_output(
            ["git", "rev-parse", "HEAD"], cwd=ROOT).decode().strip(),
        "publicFileCount": len(names), "contentSha256": digest.hexdigest()
    }
    (DEST / "release.json").write_text(json.dumps(receipt, indent=2) + "\n")
    print(f"Staged {len(names)} public files; server code, raw imports and private files excluded.")


if __name__ == "__main__":
    main()
