#!/usr/bin/env python3
"""
Build paste-ready GoHighLevel code from the source site.

WHY THIS EXISTS
    The site is being rebuilt as GHL pages. GHL cannot take a whole HTML
    document — you paste <head> code once at site level, footer code once at
    site level, and each page's body markup into that page's Custom Code
    element. Doing that by hand across 9 pages would rot the moment a form or
    a URL changes, so it is mechanical instead. Re-run it after ANY content
    change.

    Output: <project folder>/GHL PASTE CODE/

WHAT IT CHANGES, AND WHY
    1. The CSS reset is scoped.  `* { margin:0; padding:0 }` is fine on our own
       site but on a GHL page it would also strip GHL's own wrappers. It gets
       scoped to `.ootc *`, and every page's markup is wrapped in `.ootc`.
    2. `body {...}` becomes `body, .ootc {...}` so the page background stays
       black even where GHL's own container shows through.
    3. main.js's DOMContentLoaded wrapper is swapped for a readyState check.
       GHL may inject footer code AFTER that event has already fired, in which
       case the listener would never run and the whole site would look dead.
    4. Asset paths become __IMG_*__ tokens. GHL media library gives every file
       its own unguessable URL, so there is no shared base path to swap — each
       one has to be pasted in individually. See the READ ME.
    5. The placeholder signup form is replaced by the real GHL embed.

USAGE
    python3 tools/build-ghl.py
"""

import os
import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
# Inside the project folder, NOT loose on the Desktop — the user keeps
# everything for this job in one place and looked for it here first.
OUT = ROOT / "GHL PASTE CODE"

# ---------------------------------------------------------------- form embeds
# The real GHL email-list form, supplied by the user 2026-08-16.
# height is a real px value, NOT the 100% GHL ships: a percentage height needs
# a parent with a definite height, and ours has none, so it collapses until
# form_embed.js loads. data-height stays as the resizer's target.
SIGNUP_EMBED = """      <!-- GoHighLevel — "Email List Submission form" (id bHcI16KOWaqUd54CzsEj).
           Styled INSIDE the GHL form builder; our stylesheet cannot reach
           across the iframe boundary. The resizer script (form_embed.js) is
           further down this same page block, once. -->
      <div class="ghl-form">
        <iframe
          src="https://api.leadconnectorhq.com/widget/form/bHcI16KOWaqUd54CzsEj"
          style="width:100%;height:610px;border:none;border-radius:0"
          id="inline-bHcI16KOWaqUd54CzsEj"
          data-layout="{'id':'INLINE'}"
          data-trigger-type="alwaysShow"
          data-activation-type="alwaysActivated"
          data-deactivation-type="neverDeactivate"
          data-form-name="Email List Submission form"
          data-height="610"
          data-layout-iframe-id="inline-bHcI16KOWaqUd54CzsEj"
          data-form-id="bHcI16KOWaqUd54CzsEj"
          title="Email List Submission form"></iframe>
      </div>"""

# ------------------------------------------------------------- asset tokens
# GHL media library URLs are per-file and unguessable, so a single base-path
# swap is impossible. Each file gets its own token to paste a URL over.
ASSETS = {
    "assets/dead-man-album-art.jpg":        "__IMG_ALBUM_ART__",
    "assets/chris-kreutz.jpg":              "__IMG_ARTIST_PHOTO__",
    "assets/releases/dead-man.jpg":         "__IMG_RELEASE_DEAD_MAN__",
    "assets/releases/start-a-fever.jpg":    "__IMG_RELEASE_START_A_FEVER__",
    "assets/releases/scarecrows.jpg":       "__IMG_RELEASE_SCARECROWS__",
    "assets/releases/crystal-mirrors.jpg":  "__IMG_RELEASE_CRYSTAL_MIRRORS__",
    "assets/releases/my-love-is-lightning.jpg": "__IMG_RELEASE_MY_LOVE_IS_LIGHTNING__",
    "assets/releases/the-fall.jpg":         "__IMG_RELEASE_THE_FALL__",
}

# ------------------------------------------------------------- internal links
# GHL serves pages at a slug ("/music"), never at "/music.html", so every
# internal link in the source would 404 if pasted across untouched. These are
# the conventional slugs — CHANGE THEM HERE if the GHL pages end up named
# differently, then re-run. Anchors are preserved ("index.html#video" -> "/#video").
PAGE_URLS = {
    "index.html":     "/",
    "music.html":     "/music",
    "about.html":     "/about",
    "merch.html":     "/merch",
    "community.html": "/the-cult",
    "contact.html":   "/contact",
    "terms.html":     "/terms",
    "privacy.html":   "/privacy",
    "cookies.html":   "/cookies",
}


def swap_links(text: str) -> str:
    for filename, url in PAGE_URLS.items():
        # href="music.html#foo" -> href="/music#foo"   and   href="index.html#x" -> href="/#x"
        text = re.sub(
            r'href="' + re.escape(filename) + r'(#[^"]*)?"',
            lambda m: 'href="' + url + (m.group(1) or "") + '"',
            text,
        )
    return text


PAGES = [
    ("index.html",     "HOME"),
    ("music.html",     "MUSIC"),
    ("about.html",     "ABOUT"),
    ("merch.html",     "MERCH"),
    ("community.html", "THE CULT"),
    ("contact.html",   "CONTACT"),
    ("terms.html",     "TERMS AND CONDITIONS"),
    ("privacy.html",   "PRIVACY POLICY"),
    ("cookies.html",   "COOKIE POLICY"),
]


def swap_assets(text: str) -> str:
    """Longest path first, so assets/releases/x.jpg is not eaten by assets/."""
    for path in sorted(ASSETS, key=len, reverse=True):
        text = text.replace("../" + path, ASSETS[path])
        text = text.replace(path, ASSETS[path])
    return text


def build_head() -> str:
    css = (ROOT / "css" / "style.css").read_text(encoding="utf-8")

    # 1. Scope the reset so it cannot strip GHL's own wrappers.
    css = css.replace(
        "* { box-sizing: border-box; margin: 0; padding: 0; }",
        ".ootc, .ootc *, .ootc *::before, .ootc *::after "
        "{ box-sizing: border-box; margin: 0; padding: 0; }",
        1,
    )
    # 2. Keep the black background on the real body too, or GHL's own
    #    container shows a white band above and below our content.
    css = css.replace("\nbody {\n", "\nbody, .ootc {\n", 1)

    css = swap_assets(css)

    neutraliser = """/* ===== GHL CONTAINER NEUTRALISER =========================================
   GHL wraps every Custom Code element in its own section/row/column, each
   with a max-width and horizontal padding. Our sections are full-bleed and
   do their own centring via .section__inner (max-width 1160px), so the
   builder's container has to be let out of the way or every page renders in
   a narrow strip with double padding.

   FIRST try GHL's own controls: set the section to Full Width and zero the
   row padding in the builder panel. This block is the fallback for what that
   does not reach. If the page still looks boxed in, screenshot it and the
   selectors below can be widened to match your GHL version.

   The nav is position:fixed. If a GHL ancestor ever sets a transform or a
   filter it creates a containing block and the nav will scroll away with the
   page — that is the first thing to check if the bar misbehaves.
   ======================================================================= */
.ootc { width: 100%; }
.ootc .section, .ootc .pagehead, .ootc .footer { width: 100%; max-width: 100%; }

/* GHL builder wrappers — full-bleed our block, leave everything else alone. */
.c-section:has(> .c-row .ootc),
.c-row:has(.ootc),
.c-column:has(.ootc),
.hl_page-preview--content .c-column:has(.ootc) {
  max-width: 100% !important;
  padding-left: 0 !important;
  padding-right: 0 !important;
}

/* The GHL form iframes. Our CSS cannot style the form INSIDE the iframe —
   that has to be done in the GHL form builder — but the box it sits in is
   ours. Capped to the same 640px measure the old form used. */
.ghl-form { width: 100%; max-width: 640px; margin: 1.6rem auto 0; }
.ghl-form iframe { display: block; width: 100%; }
"""

    # Returns the CSS payload only. It is wrapped in <style> by build_page,
    # because every page carries its own copy — see SELF-CONTAINED below.
    # @import MUST be the first thing in the stylesheet: an @import that comes
    # after any rule is ignored by the browser, and the whole site would
    # silently fall back to system fonts.
    return (
        "@import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;500;600;700"
        "&family=Share+Tech+Mono&family=Inter:wght@300;400;500&display=swap');\n\n"
        + neutraliser + "\n" + css
    )


def build_footer() -> str:
    js = (ROOT / "js" / "main.js").read_text(encoding="utf-8")

    # GHL may inject footer code after DOMContentLoaded has already fired, in
    # which case a plain listener never runs and every animation, the nav, the
    # countdown and the gate all stay dead. Swap it for a readyState check.
    old_open = "document.addEventListener('DOMContentLoaded', () => {"
    if old_open not in js:
        raise SystemExit("main.js boot wrapper not found — check js/main.js")
    js = js.replace(old_open, "(function () {\nconst __ootcBoot = () => {", 1)

    idx = js.rstrip().rfind("});")
    if idx == -1:
        raise SystemExit("main.js closing wrapper not found")
    js = js[:idx] + (
        "};\n"
        "if (document.readyState === 'loading') {\n"
        "  document.addEventListener('DOMContentLoaded', __ootcBoot);\n"
        "} else {\n"
        "  __ootcBoot();\n"
        "}\n"
        "})();\n"
    )

    # Returns the JS payload only; build_page wraps it in <script>.
    return swap_assets(js)


SIGNUP_RE = re.compile(
    r'[ \t]*<!-- PLACEHOLDER form.*?-->\s*'
    r'<form[^>]*id="signupForm".*?</form>\s*'
    r'<p class="placeholder-note[^>]*>.*?</p>',
    re.S,
)


def build_page(filename: str, label: str, css: str, js: str) -> tuple[str, int]:
    """SELF-CONTAINED page block.

    Everything the page needs — look, movement and content — lives in this one
    string, so it goes into ONE Custom Code element and nothing goes into GHL's
    Settings at all. The user asked for this on 2026-08-16 after getting lost
    between GHL's three different code boxes; the tidy split (site-wide CSS +
    site-wide footer + page markup) was correct but unusable for them.

    The cost is real and worth remembering: the ~58KB stylesheet is repeated on
    every page instead of being set once, so pages are heavier and a change to
    the site's look means re-pasting all nine rather than one. Re-run this
    script and re-paste; never hand-edit the output.
    """
    html = (ROOT / filename).read_text(encoding="utf-8")

    body = re.search(r"<body>(.*)</body>", html, re.S)
    if not body:
        raise SystemExit(f"no <body> in {filename}")
    content = body.group(1)

    # The <script src> tags are replaced by the inlined JS at the end.
    content = re.sub(r'[ \t]*<script src="js/[^"]+"></script>\s*', "", content)

    content, swapped = SIGNUP_RE.subn(SIGNUP_EMBED, content)

    content = swap_assets(content)
    content = swap_links(content)
    content = content.strip("\n")

    # The GHL form resizer, only on pages that actually carry a GHL form.
    # Keyed on the embed URL, not on `swapped` — so it picks up the contact
    # form too once that embed exists. #contactForm is the OLD placeholder and
    # must NOT count; it would pull in the script for nothing.
    resizer = ""
    if "leadconnectorhq.com/widget/form" in content:
        resizer = '<script src="https://link.msgsndr.com/js/form_embed.js"></script>\n\n'

    # The homepage owns the WebGL hero. It has no ready-guard of its own, so it
    # must run AFTER the hero markup — hence last, not with main.js.
    hero = ""
    if filename == "index.html":
        src = swap_assets((ROOT / "js" / "liquid-hero.js").read_text(encoding="utf-8"))
        hero = (
            "\n\n<!-- Homepage only: the WebGL liquid hero. Must stay AFTER the\n"
            "     hero markup above — it queries the DOM as soon as it runs. -->\n"
            "<script>\n" + src + "</script>"
        )

    header = (
        f"<!-- ===================================================================\n"
        f"     ORDER OF THE CROW — {label}\n"
        f"     Source: {filename}\n\n"
        f"     This block is COMPLETE. It contains the look, the movement and\n"
        f"     the content of this page. Paste the WHOLE thing into ONE Custom\n"
        f"     Code / HTML element on this page, and put nothing anywhere else.\n"
        f"     ================================================================ -->\n\n"
    )

    return (
        header
        + "<style>\n" + css + "\n</style>\n\n"
        + '<div class="ootc">\n' + content + "\n</div>\n\n"
        + BREAKOUT_JS
        + resizer
        + "<script>\n" + js + "</script>"
        + hero
        + "\n"
    ), swapped


# --------------------------------------------------------------- full-bleed
# GHL nests our block inside its own section/row/column, each carrying a
# max-width and side padding — that is the white margin down both edges the
# user reported 2026-08-16.
#
# The CSS neutraliser above GUESSES at GHL's class names (.c-section etc.) and
# those differ between GHL versions, so it cannot be relied on. This walks up
# from our own wrapper instead and clears the constraint on whatever the
# ancestors actually are, which needs no knowledge of their names.
#
# Re-run on load and resize because the builder re-applies inline styles after
# its own layout passes.
BREAKOUT_JS = """<script>
/* Clears GHL's container padding from around this block — see build-ghl.py. */
(function () {
  var openUp = function () {
    var el = document.querySelector('.ootc');
    if (!el) return;
    var n = el.parentElement;
    /* Includes <body> — the padding is sometimes there, and this site is
       full-bleed by design so there is nothing else on the page to disturb. */
    while (n && n !== document.documentElement) {
      var s = n.style;
      s.setProperty('max-width', 'none', 'important');
      s.setProperty('width', '100%', 'important');
      s.setProperty('padding-left', '0', 'important');
      s.setProperty('padding-right', '0', 'important');
      s.setProperty('margin-left', '0', 'important');
      s.setProperty('margin-right', '0', 'important');
      n = n.parentElement;
    }
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', openUp);
  } else {
    openUp();
  }
  window.addEventListener('load', openUp);
  window.addEventListener('resize', openUp);
})();
</script>

"""

README = "0 - READ ME FIRST.txt"
LAUNCHER = "★ COPY CODE TO CLIPBOARD.command"

# The user's Mac opens .txt in Safari, which makes selecting the raw code
# awkward. This puts each file on the clipboard directly so the files never
# have to be opened at all. Written by the build so it survives a rebuild.
LAUNCHER_SRC = r'''#!/bin/bash
# Puts one of the GHL code files straight onto the clipboard.
# Double-click this, type a number, press return, then paste into GoHighLevel.

cd "$(dirname "$0")" || exit 1

while true; do
  clear
  echo ""
  echo "  ============================================================"
  echo "   ORDER OF THE CROW  —  COPY CODE TO CLIPBOARD"
  echo "  ============================================================"
  echo ""
  echo "   Type a number and press return. The code goes onto your"
  echo "   clipboard, then paste it into GoHighLevel with Command-V."
  echo ""

  # Rebuild the list every loop so it always matches what is in the folder.
  # The READ ME is excluded so that menu number N is always file number N.
  IFS=$'\n' read -r -d '' -a FILES < <(ls -1 *.txt 2>/dev/null | grep -v '^0 - ' | sort -V && printf '\0')

  if [ ${#FILES[@]} -eq 0 ]; then
    echo "   No code files found in this folder."
    echo ""
    read -r -p "   Press return to close. " _
    exit 1
  fi

  i=1
  for f in "${FILES[@]}"; do
    printf "     %2d.  %s\n" "$i" "${f%.txt}"
    i=$((i + 1))
  done

  echo ""
  echo "      q.  Quit"
  echo ""
  read -r -p "   Which one? " choice
  echo ""

  case "$choice" in
    q|Q|"") exit 0 ;;
  esac

  if ! [[ "$choice" =~ ^[0-9]+$ ]] || [ "$choice" -lt 1 ] || [ "$choice" -gt ${#FILES[@]} ]; then
    echo "   '$choice' is not one of the numbers above."
    echo ""
    read -r -p "   Press return to try again. " _
    continue
  fi

  picked="${FILES[$((choice - 1))]}"
  pbcopy < "$picked"

  chars=$(wc -c < "$picked" | tr -d ' ')
  echo "   ------------------------------------------------------------"
  echo "   COPIED:  ${picked%.txt}"
  echo "   ($chars characters are now on your clipboard)"
  echo "   ------------------------------------------------------------"
  echo ""
  echo "   Go to GoHighLevel and press Command-V to paste."
  echo ""
  read -r -p "   Press return to copy another, or type q to quit: " again
  case "$again" in
    q|Q) exit 0 ;;
  esac
done
'''


def main() -> None:
    # Clear out the previous build so a renamed page cannot leave an orphan
    # behind — but keep the hand-written README, which is not generated.
    OUT.mkdir(parents=True, exist_ok=True)
    for f in OUT.iterdir():
        if f.name != README and f.is_file():
            f.unlink()

    if not (OUT / README).exists():
        print(f"  WARNING: {README} is missing from {OUT}")

    launcher = OUT / LAUNCHER
    launcher.write_text(LAUNCHER_SRC, encoding="utf-8")
    launcher.chmod(0o755)

    # Built once, then stamped into every page — see build_page's docstring for
    # why each page carries its own copy rather than sharing one site-wide set.
    css = build_head()
    js = build_footer()

    total_forms = 0
    for i, (filename, label) in enumerate(PAGES, start=1):
        text, swapped = build_page(filename, label, css, js)
        total_forms += swapped
        (OUT / f"{i} - {label}.txt").write_text(text, encoding="utf-8")
        print(f"  {i}. {label:22} {len(text):>8,} chars   form: {'yes' if swapped else '-'}")

    print(f"\n  {len(PAGES)} self-contained pages — nothing goes in GHL Settings")
    print(f"  signup embeds placed: {total_forms}")
    print(f"  output: {OUT}")


if __name__ == "__main__":
    main()
