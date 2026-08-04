#!/bin/bash
# ============================================================
#  ORDER OF THE CROW — client demo launcher
#  Double-click this file to open the website in your browser.
#  Use this on your client call.
#  To stop it afterward: close this window and quit the browser
#  tab, or just restart your Mac.
#
#  NOTE: this used to launch TWO versions. The client picked the
#  interactive build on the 2026-08-03 call, so there is only one
#  now. ~/Desktop/OOTC_Demo_1_Original is the retired version and
#  is safe to delete.
# ============================================================

SITE="/Users/antoinettegentempo/Desktop/OOTC_Demo_2_LiquidHero"
PORT=8092

echo "Starting the Order of the Crow demo..."

if [ ! -d "$SITE" ]; then
  echo ""
  echo "  Couldn't find the demo folder at:"
  echo "    $SITE"
  echo "  Ask Claude to re-sync it and try again."
  echo ""
  read -n 1 -s -r -p "  Press any key to close..."
  exit 1
fi

# Start the mini web server only if it isn't already running.
if ! curl -s -o /dev/null "http://localhost:$PORT/" ; then
  nohup python3 -m http.server "$PORT" --directory "$SITE" >/tmp/ootc.log 2>&1 &
  disown
fi

sleep 2
open "http://localhost:$PORT/"

echo ""
echo "  Done! The site is open at http://localhost:$PORT/"
echo ""
echo "  Pages:  Home . Music . Merch . Inner Circle . About"
echo ""
echo "  Things to show off:"
echo "    - Drag your mouse across the homepage image (liquid hero)"
echo "    - Click to decrypt on the homepage video panel"
echo "    - The DECRYPT \"DEAD MAN\" button on the Music page"
echo "    - The CLASSIFIED gate on the Inner Circle page"
echo ""
echo "  You can close this window now — the tab will keep working."
