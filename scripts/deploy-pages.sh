#!/usr/bin/env bash
# Redeploy the app to GitHub Pages at https://rorymclark-prog.github.io/rorys-english/
# Run after editing content (students/units/homework) or code:  npm run deploy
set -euo pipefail

REPO="https://github.com/rorymclark-prog/rorys-english"
BASE_PATH="/rorys-english"

cd "$(dirname "$0")/.."

echo "→ Building static site (basePath=$BASE_PATH)…"
NEXT_PUBLIC_BASE_PATH="$BASE_PATH" npm run build

# Stamp the service-worker cache version so each deploy invalidates the last
# (public/sw.js keeps the literal __BUILD__ placeholder for local dev).
BUILD_ID="$(date +%Y%m%d%H%M%S)"
sed -i '' "s/__BUILD__/$BUILD_ID/" out/sw.js
echo "→ SW cache version: rorys-english-$BUILD_ID"

echo "→ Publishing out/ to gh-pages…"
cd out
touch .nojekyll
rm -rf .git
git init -q -b gh-pages
git add -A
git -c user.name="Rory Clark" -c user.email="rorymclark@gmail.com" commit -q -m "Deploy $(date +%Y-%m-%d)"
git push -f "$REPO" gh-pages
rm -rf .git

echo "✓ Deployed. Live in ~1 min at https://rorymclark-prog.github.io/rorys-english/"
