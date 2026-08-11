#!/usr/bin/env bash
# Zips the playable build for itch.io. Docs and tools are excluded.
set -e
cd "$(dirname "$0")/.."
mkdir -p build
rm -f build/dfmc-jam06.zip
zip -q -r build/dfmc-jam06.zip index.html src data
echo "build/dfmc-jam06.zip"
unzip -l build/dfmc-jam06.zip
