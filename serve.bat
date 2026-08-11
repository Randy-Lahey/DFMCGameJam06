@echo off
REM Double-click this to preview the site locally the way GitHub Pages will serve it.
REM Needed because the docs fetch .md files, which browsers block on file:// URLs.
cd /d "%~dp0"
where py >nul 2>&1 && (start "" http://localhost:8123/docs/ & py -m http.server 8123 & goto :eof)
where python >nul 2>&1 && (start "" http://localhost:8123/docs/ & python -m http.server 8123 & goto :eof)
where npx >nul 2>&1 && (start "" http://localhost:8123/docs/ & npx --yes http-server -p 8123 & goto :eof)
echo Need Python or Node installed to preview locally.
echo The game itself works fine by just opening index.html - only the docs need a server.
pause
