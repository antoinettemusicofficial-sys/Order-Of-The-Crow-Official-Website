#!/bin/bash
# Puts one of the Order of the Crow emails straight onto the clipboard.
# Double-click this, pick a number, then paste into GoHighLevel with Command-V.

cd "$(dirname "$0")" || exit 1

clear
echo ""
echo "  ============================================================"
echo "   ORDER OF THE CROW  —  EMAIL CODE"
echo "  ============================================================"
echo ""
echo "   1.  CULT WELCOME       community-welcome.html"
echo "       Sent when someone JOINS THE COMMUNITY."
echo "       Sealed dossier + CLICK TO DECRYPT button."
echo ""
echo "   2.  MAILING-LIST WELCOME   welcome.html"
echo "       Sent when someone joins the EMAIL LIST."
echo "       Transmission 001 / Access Granted."
echo ""
read -r -p "   Which one? (1 or 2)  " choice
echo ""

case "$choice" in
  1) FILE="community-welcome.html"; NAME="CULT WELCOME" ;;
  2) FILE="welcome.html";           NAME="MAILING-LIST WELCOME" ;;
  *) echo "   Not a valid choice — run it again and press 1 or 2."
     echo ""
     read -r -p "   Press return to close. " _
     exit 1 ;;
esac

if [ ! -f "$FILE" ]; then
  echo "   Could not find '$FILE' next to this launcher."
  echo ""
  read -r -p "   Press return to close. " _
  exit 1
fi

pbcopy < "$FILE"
chars=$(wc -c < "$FILE" | tr -d ' ')

echo "   COPIED — $NAME, $chars characters, on your clipboard."
echo ""
echo "   ------------------------------------------------------------"
echo "   WHERE TO PASTE IT"
echo "   ------------------------------------------------------------"
echo ""
echo "   1.  GoHighLevel  >  Marketing  >  Emails  >  the template,"
echo "       or the email step inside your Workflow."
echo "   2.  Add a CUSTOM HTML / CODE block  (not a text block --"
echo "       a text block will show the code instead of running it)."
echo "   3.  Click into it and press Command-V."
echo "   4.  Save, then send yourself a test."
echo ""
echo "   Paste the WHOLE file, including the <html> and <head> lines."
echo ""
echo "   ------------------------------------------------------------"
echo "   BEFORE IT GOES TO ANYONE REAL"
echo "   ------------------------------------------------------------"
echo ""
echo "   * The footer still says [[ POSTAL ADDRESS REQUIRED ]]."
echo "     A real postal address is required by law in marketing"
echo "     email, and filters check that it is there. Fill it in."
echo ""
echo "   * Check {{contact.first_name}} actually renders in the test."
echo "     A blank there reads as a mistake to the reader."
echo ""
echo "   * If GoHighLevel adds its own unsubscribe line at the bottom,"
echo "     delete ours so there are not two."
echo ""
echo "   * Read the test in Gmail AND on your phone before sending."
echo ""
echo "   ------------------------------------------------------------"
echo "   TO SEE WHAT IT LOOKS LIKE FIRST"
echo "   ------------------------------------------------------------"
echo ""
echo "   Drag the .html file onto your browser icon in the Dock."
echo "   That opens it as a page instead of as code."
echo ""
read -r -p "   Press return to close. " _
