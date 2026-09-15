#!/usr/bin/env python
"""Check that an app-produced metadata filename groups with the sample recording in the REAL
trodes_to_nwb scanner.

Run from the trodes_to_nwb virtualenv (it imports `trodes_to_nwb.data_scanner`), e.g.

    /Users/edeno/Documents/GitHub/trodes_to_nwb/.venv/bin/python scripts/check-scanner-grouping.py \
        --rec-dir /Users/edeno/Downloads/trodes_to_nwb_test_data \
        20230622_sample_metadata.yml

It copies the sample `.rec` names (empty files — only the NAMES matter to the scanner) plus the
given metadata filename(s) into a temp directory, runs `get_file_info`, and prints the
`(date, animal)` group of every file. Exit status 1 if any metadata file is not in the same group as
at least one `.rec`.
"""

from __future__ import annotations

import argparse
import sys
import tempfile
from pathlib import Path

from trodes_to_nwb.data_scanner import get_file_info


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--rec-dir", required=True, help="Folder holding the sample .rec files")
    parser.add_argument("metadata", nargs="+", help="Metadata filename(s) as the app would download them")
    args = parser.parse_args()

    rec_names = sorted(p.name for p in Path(args.rec_dir).glob("*.rec"))
    if not rec_names:
        print(f"no .rec files under {args.rec_dir}", file=sys.stderr)
        return 2

    ok = True
    # One temp dir PER metadata name: macOS temp filesystems are case-insensitive, so two names that
    # differ only by case would collide on disk and hide the scanner's (case-sensitive) behavior.
    for name in args.metadata:
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp)
            for rec in rec_names + [name]:
                (folder / rec).write_bytes(b"")
            info = get_file_info(folder)

        groups: dict[tuple[int, str], list[str]] = {}
        for row in info.itertuples():
            groups.setdefault((int(row.date), row.animal), []).append(Path(row.full_path).name)
        scanned = {Path(p).name for p in info.full_path}
        print(f"--- {name}")
        if name not in scanned:
            print(f"!! {name}: skipped by the scanner (not a {{date}}_{{animal}}_metadata.yml stem)")
            ok = False
        for key, names in sorted(groups.items()):
            has_rec = any(n.endswith(".rec") for n in names)
            has_yml = any(n.endswith(".yml") for n in names)
            marker = "OK " if (has_rec and has_yml) or not has_yml else "!! "
            print(f"{marker}{key}: {', '.join(sorted(names))}")
            if has_yml and not has_rec:
                ok = False
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
