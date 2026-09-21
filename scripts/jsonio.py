"""Shared JSON I/O for data scripts.

Writes files in exactly the same style as `npm run format` (Prettier,
2-space indent, short arrays collapsed) by piping through the Prettier
binary from node_modules (--stdin-filepath gives parser inference and
config resolution).

Writes are atomic: the document is staged as <name>.tmp next to the target
and moved into place with os.replace, so an interrupted run can never leave
a truncated data file behind.

Falls back to plain json.dumps(indent=2) when Prettier is unavailable.
"""

import json
import os
import shutil
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PRETTIER_BIN = ROOT / "node_modules" / ".bin" / "prettier"


def load_json(path: Path):
    with Path(path).open(encoding="utf-8") as f:
        return json.load(f)


def save_json(path: Path, data) -> None:
    path = Path(path)
    text = json.dumps(data, ensure_ascii=False, indent=2) + "\n"

    if PRETTIER_BIN.exists() and shutil.which("node"):
        try:
            result = subprocess.run(
                [
                    str(PRETTIER_BIN),
                    "--stdin-filepath",
                    str(path),
                ],
                input=text,
                text=True,
                capture_output=True,
                check=True,
            )
            text = result.stdout
        except (subprocess.CalledProcessError, OSError):
            pass

    tmp = path.with_name(path.name + ".tmp")
    tmp.write_text(text, encoding="utf-8")
    os.replace(tmp, path)
