#!/usr/bin/env python3
"""Inline data/ and src/ scripts into a single self-contained HTML file.

    python3 tools/build-standalone.py

Writes daemonware-standalone.html next to index.html. Run after any code change.

Encoding and newlines are pinned explicitly. Without `encoding='utf-8'` Python
uses the host locale codec, which on Windows is cp1252 or cp932 and mangles the
em dashes in the source comments. Without `newline=''` the writer translates
\\n to \\r\\n on Windows, producing a file ~1,800 bytes larger than on Linux and
breaking any byte-for-byte comparison across machines. Both are pinned so the
output is identical on every platform.
"""
import hashlib
import re
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SCRIPTS = ['data/floor01.js', 'data/floor02.js', 'data/balance.js', 'data/fxsheets.js', 'src/sprites.js', 'src/combat.js', 'src/game.js']

html = (ROOT / 'index.html').read_text(encoding='utf-8')

# --- cache-bust: stamp every script tag with a hash of the script bytes.
# GitHub Pages serves JS with a 10-minute cache header and mobile browsers
# resurrect tabs without refetching, so players kept seeing stale sprites.
# The stamp changes exactly when any script changes, forcing a refetch; the
# query string is ignored on file:// so local play is unaffected.
stamp = hashlib.md5(
    b''.join((ROOT / f).read_bytes() for f in SCRIPTS)).hexdigest()[:8]
tag_re = re.compile(r'<script src="((?:data|src)/[a-z0-9]+\.js)(?:\?v=[0-9a-z]+)?"></script>')
stamped = tag_re.sub(lambda m: '<script src="{}?v={}"></script>'.format(m.group(1), stamp), html)
if stamped != html:
    (ROOT / 'index.html').write_text(stamped, encoding='utf-8', newline='')
    print("stamped index.html scripts ?v={}".format(stamp))
html = stamped

block = "\n".join(
    "<script>\n{}\n</script>".format((ROOT / f).read_text(encoding='utf-8'))
    for f in SCRIPTS
)

pattern = re.compile(
    r'\s*'.join(
        re.escape('<script src="{}?v={}"></script>'.format(f, stamp)) for f in SCRIPTS
    )
)

html, n = pattern.subn(lambda m: block, html)
if n != 1:
    sys.exit("could not find the script tag block in index.html")

out = ROOT / 'daemonware-standalone.html'
out.write_text(html, encoding='utf-8', newline='')

# Report the real on-disk size, not len(html). len() counts characters, so a
# file with 26 em dashes reports 26 short of its byte count and the number
# never matches `stat`, `ls`, or a manifest.
print("wrote {} ({:,} bytes)".format(out.name, out.stat().st_size))
