#!/usr/bin/env python3
"""Pack dist/ so index.html is at the archive root, not dist/index.html."""

import sys
import tarfile
from pathlib import Path

root = Path("dist")
out = Path(sys.argv[1] if len(sys.argv) > 1 else "release.tar.gz")

if not (root / "index.html").is_file():
    raise SystemExit("dist/index.html is missing")
if not (root / "version.json").is_file():
    raise SystemExit("dist/version.json is missing")

with tarfile.open(out, "w:gz") as tar:
    for path in sorted(root.rglob("*")):
        tar.add(path, arcname=path.relative_to(root).as_posix(), recursive=False)

print(out)
