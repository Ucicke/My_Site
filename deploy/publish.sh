#!/usr/bin/env bash
# Publish this site's two public entries; keep backups and all other content.
set -eu
RELEASE=$(readlink -f "$1")
DOCROOT=$(readlink -f "$2")
test -d "$DOCROOT"
test -f "$RELEASE/index.html"
test -f "$RELEASE/site-assets/styles.css"
test -f "$RELEASE/site-assets/favicon.svg"

# The game publisher uses the same lock outside the swapped docroot.
exec 9>"$DOCROOT.deploy.lock"
flock -x 9
BACKUP="$RELEASE/previous-public-files"
mkdir -p "$BACKUP"
for name in index.html site-assets; do
  if [ -e "$DOCROOT/$name" ] || [ -L "$DOCROOT/$name" ]; then
    cp -a "$DOCROOT/$name" "$BACKUP/$name"
  fi
done

restore_previous() {
  set +e
  for name in index.html site-assets; do
    if [ -e "$DOCROOT/$name" ] || [ -L "$DOCROOT/$name" ]; then
      mv "$DOCROOT/$name" "$BACKUP/failed-$name"
    fi
    if [ -e "$BACKUP/$name" ] || [ -L "$BACKUP/$name" ]; then
      cp -a "$BACKUP/$name" "$DOCROOT/$name"
    fi
  done
}
trap 'code=$?; if [ "$code" -ne 0 ]; then restore_previous; fi; exit "$code"' EXIT

if [ -d "$DOCROOT/site-assets" ] && [ ! -L "$DOCROOT/site-assets" ]; then
  mv "$DOCROOT/site-assets" "$BACKUP/previous-assets-directory"
fi
NEXT_ID=$(basename "$RELEASE")
ln -s "$RELEASE/site-assets" "$DOCROOT/.site-assets-$NEXT_ID"
mv -Tf "$DOCROOT/.site-assets-$NEXT_ID" "$DOCROOT/site-assets"
ln -s "$RELEASE/index.html" "$DOCROOT/.site-index-$NEXT_ID"
mv -Tf "$DOCROOT/.site-index-$NEXT_ID" "$DOCROOT/index.html"
test -s "$DOCROOT/index.html"
test -s "$DOCROOT/site-assets/styles.css"
echo "Website published from $RELEASE"
echo "Previous public files: $BACKUP"
