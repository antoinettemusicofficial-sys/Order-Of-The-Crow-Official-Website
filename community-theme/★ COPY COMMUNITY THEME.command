#!/bin/bash
# Puts the Cult of the Crow community theme straight onto the clipboard.
# Double-click this, then paste into GoHighLevel with Command-V.

cd "$(dirname "$0")" || exit 1

FILE="COMMUNITY DARK THEME.css"

clear
echo ""
echo "  ============================================================"
echo "   THE CULT OF THE CROW  —  COMMUNITY DARK THEME"
echo "  ============================================================"
echo ""

if [ ! -f "$FILE" ]; then
  echo "   Could not find '$FILE' next to this launcher."
  echo ""
  read -r -p "   Press return to close. " _
  exit 1
fi

pbcopy < "$FILE"
chars=$(wc -c < "$FILE" | tr -d ' ')

echo "   COPIED — $chars characters are on your clipboard."
echo ""
echo "   ------------------------------------------------------------"
echo "   WHERE TO PASTE IT"
echo "   ------------------------------------------------------------"
echo ""
echo "   1.  Open GoHighLevel and go to the Community group."
echo "   2.  Look for:   Settings  >  Customize  >  Custom CSS"
echo "       If there is no Custom CSS box on the group itself, use"
echo "       the account-level one instead:"
echo "               Settings  >  Company  >  Custom CSS"
echo "   3.  Click into the box and press Command-V."
echo "   4.  Save, then reload the community in a new tab to see it."
echo ""
echo "   ------------------------------------------------------------"
echo "   IF SOMETHING STAYS WHITE"
echo "   ------------------------------------------------------------"
echo ""
echo "   Right-click the stubborn element in Chrome, choose Inspect,"
echo "   and screenshot the panel showing its class names. Send that"
echo "   over and it becomes a targeted rule in a couple of minutes."
echo ""
echo "   Anything GoHighLevel draws inside an iframe cannot be reached"
echo "   by this stylesheet at all — that is a browser rule, not a gap"
echo "   in the CSS. Those parts get themed in GHL's own settings."
echo ""
read -r -p "   Press return to close. " _
