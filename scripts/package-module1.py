#!/usr/bin/env python3
"""Package the native Module 1 reference sources, without generated binaries.

Usage: python3 scripts/package-module1.py /path/to/complete-guide-module1
The separate public/course/module-1.img download is never modified.
"""

import argparse
import gzip
import io
from pathlib import Path
import tarfile
import tempfile


SOURCE_FILES = (
    "Makefile",
    "disk.inc",
    "entry.asm",
    "kernel.c",
    "linker.ld",
    "mkimage.py",
    "smoke.py",
    "stage1.asm",
    "stage2.asm",
    "verify.py",
)
ARCHIVE_ROOT = "complete-guide-module1"


def package_sources(source, output):
    # An explicit source list prevents a developer's build directory, objects,
    # or disk images from making a fresh learner build silently do no work.
    contents = {}
    for name in SOURCE_FILES:
        path = source / name
        if path.is_symlink() or not path.is_file():
            raise ValueError("Missing regular source file: {}".format(path))
        contents[name] = path.read_bytes()

    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(dir=output.parent, delete=False) as raw:
            temporary = Path(raw.name)
            # Fixed timestamps, modes and ownership make repeated packaging
            # reproducible regardless of local build times or user accounts.
            with gzip.GzipFile(filename="", fileobj=raw, mode="wb", mtime=0) as compressed:
                with tarfile.open(fileobj=compressed, mode="w", format=tarfile.USTAR_FORMAT) as archive:
                    directory = tarfile.TarInfo(ARCHIVE_ROOT + "/")
                    directory.type = tarfile.DIRTYPE
                    directory.mode = 0o755
                    archive.addfile(directory)
                    for name, data in contents.items():
                        member = tarfile.TarInfo(ARCHIVE_ROOT + "/" + name)
                        member.size = len(data)
                        member.mode = 0o644
                        archive.addfile(member, io.BytesIO(data))
        temporary.chmod(0o644)
        temporary.replace(output)
        temporary = None
    finally:
        if temporary is not None:
            temporary.unlink()
    return len(contents)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path, help="Directory containing the native reference sources")
    parser.add_argument("--output", type=Path, default=Path(__file__).resolve().parents[1] / "public/course/module-1-source.tar.gz")
    args = parser.parse_args()
    try:
        count = package_sources(args.source, args.output)
    except (OSError, ValueError) as error:
        parser.exit(1, "Could not package Module 1 sources: {}\n".format(error))
    print("Packaged {} source files into {} (no generated artifacts)".format(count, args.output))


if __name__ == "__main__":
    main()
