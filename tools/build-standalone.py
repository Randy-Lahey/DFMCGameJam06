#!/usr/bin/env python3
"""Inline data/ and src/ scripts into a single self-contained HTML file.

    python3 tools/build-standalone.py

Writes daemonware-standalone.html next to index.html. Run after any code change.
"""
import re
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SCRIPTS = ['data/floor01.js', 'data/balance.js', 'src/sprites.js', 'src/game.js']

html = (ROOT / 'index.html').read_text()

block = "\n".join(
    "<script>\n{}\n</script>".format((ROOT / f).read_text()) for f in SCRIPTS
)

pattern = re.compile(
    r'\s*'.join(re.escape('<script src="{}"></script>'.format(f)) for f in SCRIPTS)
)

html, n = pattern.subn(lambda m: block, html)
if n != 1:
    sys.exit("could not find the script tag block in index.html")

out = ROOT / 'daemonware-standalone.html'
out.write_text(html)
print("wrote {} ({:,} bytes)".format(out.name, len(html)))
