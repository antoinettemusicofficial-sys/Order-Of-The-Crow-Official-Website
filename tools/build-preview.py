#!/usr/bin/env python3
"""
Build a single self-contained page from the Order of the Crow site so it can be
published as a shareable Artifact.

The Artifact CSP blocks every external host, so anything the live site fetches
over the network has to be inlined or replaced:
  - Google Fonts  -> @font-face with base64 woff2
  - images        -> data: URIs (downscaled first, they're 1000-1600px masters)
  - Spotify embed -> a styled link card (an iframe to open.spotify.com is blocked)
"""
import base64, os, re, shutil, subprocess, sys, urllib.request

SITE = "/Users/antoinettegentempo/Desktop/OrderOfTheCrowWebsite"
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "crow-demo.html")
OUT_STANDALONE = os.path.join(HERE, "crow-demo-standalone.html")
TMP = os.path.join(HERE, "img")

UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/120.0 Safari/537.36")


def read(p):
    with open(os.path.join(SITE, p), encoding="utf-8") as f:
        return f.read()


# ---------------------------------------------------------------- fonts
def build_fonts():
    """Inline the latin + latin-ext subsets. latin-ext matters here: the credits
    line has 'Jakub Štefkovič' and the plain latin subset would drop those."""
    url = ("https://fonts.googleapis.com/css2?family=Rajdhani:wght@600;700"
           "&family=Share+Tech+Mono&family=Inter:wght@300;400&display=swap")
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    css = urllib.request.urlopen(req).read().decode()

    blocks = re.findall(r"/\*\s*([a-z-]+)\s*\*/\s*(@font-face\s*\{.*?\})", css, re.S)
    out, kept = [], 0
    for subset, block in blocks:
        if subset not in ("latin", "latin-ext"):
            continue
        m = re.search(r"url\((https://[^)]+\.woff2)\)", block)
        if not m:
            continue
        data = urllib.request.urlopen(
            urllib.request.Request(m.group(1), headers={"User-Agent": UA})).read()
        b64 = base64.b64encode(data).decode()
        out.append(block.replace(m.group(1), f"data:font/woff2;base64,{b64}"))
        kept += 1
    print(f"  fonts: inlined {kept} faces")
    return "\n".join(out)


# ---------------------------------------------------------------- images
def data_uri(src_rel, max_px, quality):
    """Downscale a master image and return it as a data: URI."""
    os.makedirs(TMP, exist_ok=True)
    src = os.path.join(SITE, src_rel)
    dst = os.path.join(TMP, os.path.basename(src_rel))
    subprocess.run(["sips", "-Z", str(max_px), "-s", "format", "jpeg",
                    "-s", "formatOptions", str(quality), src, "--out", dst],
                   check=True, capture_output=True)
    raw = open(dst, "rb").read()
    print(f"  {src_rel}: {os.path.getsize(src)//1024}K -> {len(raw)//1024}K")
    return "data:image/jpeg;base64," + base64.b64encode(raw).decode()


# ---------------------------------------------------------------- assemble
def main():
    html = read("index.html")
    css = read("css/style.css")
    main_js = read("js/main.js")
    hero_js = read("js/liquid-hero.js")

    print("Images:")
    album = data_uri("assets/dead-man-album-art.jpg", 1200, 70)
    releases = {}
    for slug in ("start-a-fever", "scarecrows", "crystal-mirrors",
                 "dead-man", "my-love-is-lightning"):
        releases[slug] = data_uri(f"assets/releases/{slug}.jpg", 520, 68)

    print("Fonts:")
    font_css = build_fonts()

    # ---- swap asset paths for data URIs (html, css and the hero's img.src)
    def swap(s):
        # Longest path first. The CSS uses "../assets/..."; replacing the bare
        # "assets/..." first would eat the tail and leave a dangling "../".
        s = s.replace("../assets/dead-man-album-art.jpg", album)
        s = s.replace("assets/dead-man-album-art.jpg", album)
        for slug, uri in releases.items():
            s = s.replace(f"assets/releases/{slug}.jpg", uri)
        return s

    html, css, hero_js = swap(html), swap(css), swap(hero_js)

    # ---- Spotify: the iframe is blocked by CSP, so ship a link card instead
    iframe = re.search(r'<iframe\s+class="player__frame".*?</iframe>', html, re.S)
    if not iframe:
        sys.exit("could not find the Spotify iframe — check index.html")
    html = html.replace(iframe.group(0), '''<a class="player__card" href="https://open.spotify.com/artist/657ETkYc49BzLTSOCnd9Es" target="_blank" rel="noopener">
          <span class="player__play" aria-hidden="true">▶</span>
          <span class="player__meta">
            <span class="player__name">ORDER OF THE CROW</span>
            <span class="player__sub mono">5 SINGLES · PLAY ON SPOTIFY</span>
          </span>
          <span class="player__go mono">OPEN →</span>
        </a>''')
    html = html.replace(
        '<p class="dossier dossier--mini"><span class="dossier__dot"></span> LIVE FEED — PRESS PLAY</p>',
        '<p class="dossier dossier--mini"><span class="dossier__dot"></span> LIVE FEED — PRESS PLAY</p>\n'
        '        <p class="preview-note mono">// preview build — the embedded Spotify player runs on the hosted site</p>')

    css += '''

/* ---------- Spotify stand-in (preview build only) ----------
   The real site embeds Spotify's player here; this preview is sandboxed
   against external frames, so it links out instead. */
.player__card {
  display: flex; align-items: center; gap: 1.1rem;
  padding: 1rem 1.3rem; border: 1px solid var(--line);
  background: rgba(15,27,64,.3);
  clip-path: polygon(0 0, 100% 0, 100% 78%, calc(100% - 16px) 100%, 0 100%);
  transition: transform .4s var(--ease), border-color .4s var(--ease), box-shadow .4s var(--ease);
}
.player__card:hover { transform: translateY(-3px); border-color: var(--glow); box-shadow: 0 24px 60px -34px var(--glow); }
.player__play {
  flex: none; display: grid; place-items: center;
  width: 46px; height: 46px; border-radius: 50%;
  background: var(--glow); color: var(--black); font-size: 1rem;
  box-shadow: 0 0 24px -6px var(--glow);
}
.player__meta { display: flex; flex-direction: column; gap: .25rem; min-width: 0; }
.player__name {
  font-family: "Rajdhani", sans-serif; text-transform: uppercase;
  font-weight: 600; letter-spacing: .14em; font-size: .95rem;
}
.player__sub { font-size: .66rem; letter-spacing: .2em; color: var(--muted); }
.player__go { margin-left: auto; flex: none; font-size: .7rem; letter-spacing: .22em; color: var(--glow); }
.preview-note { font-size: .66rem; letter-spacing: .14em; color: var(--muted); opacity: .5; margin: -.4rem 0 .9rem; }
'''

    # ---- strip the document shell; the Artifact host supplies it
    body = re.search(r"<body>(.*)</body>", html, re.S).group(1)
    body = re.sub(r'<script src="[^"]+"></script>', "", body)
    title = re.search(r"<title>(.*?)</title>", html, re.S).group(1)

    # The <meta charset> lived in the head we just dropped, and a charset
    # declared from inside <body> is too late to be honoured. Rather than rely
    # on the host defaulting to UTF-8, make the whole payload pure ASCII —
    # every ✦ / — / █ becomes an escape that cannot be mis-decoded.
    def esc_html(s):
        return "".join(c if ord(c) < 128 else f"&#{ord(c)};" for c in s)

    def esc_js(s):
        out = []
        for c in s:
            if ord(c) < 128:
                out.append(c)
            elif ord(c) <= 0xFFFF:
                out.append(f"\\u{ord(c):04X}")
            else:                                    # astral -> surrogate pair
                v = ord(c) - 0x10000
                out.append(f"\\u{0xD800 + (v >> 10):04X}\\u{0xDC00 + (v & 0x3FF):04X}")
        return "".join(out)

    # CSS non-ASCII is em-dashes in comments only; plain hyphens are equivalent.
    css_ascii = "".join(c if ord(c) < 128 else "-" for c in css)

    page = f"""<title>{esc_html(title)}</title>
<style>
{font_css}

{css_ascii}
</style>

{esc_html(body)}

<script>
{esc_js(hero_js)}
</script>
<script>
{esc_js(main_js)}
</script>
"""
    non_ascii = [c for c in page if ord(c) > 127]
    if non_ascii:
        sys.exit(f"payload still has non-ASCII: {set(non_ascii)}")

    # Nothing may reference the network: the Artifact CSP blocks it outright,
    # and the double-clickable copy has no server to resolve paths against.
    refs = (re.findall(r'\bsrc\s*=\s*["\']([^"\']+)', page)
            + re.findall(r'url\(\s*["\']?([^"\')]+)', page)
            + re.findall(r'@import\s+["\']([^"\']+)', page)
            + re.findall(r'<link[^>]+href\s*=\s*["\']([^"\']+)', page))
    dangling = [r for r in refs if not r.startswith("data:")]
    if dangling:
        sys.exit("subresources that are not inlined:\n  " +
                 "\n  ".join(r[:100] for r in dangling))
    print(f"  self-contained: {len(refs)} subresources, all inline")
    with open(OUT, "w", encoding="utf-8") as f:
        f.write(page)
    print(f"\nWrote {OUT} — {os.path.getsize(OUT)/1024/1024:.2f} MB  (Artifact body)")

    # Second output: a complete document that works by double-clicking it, with
    # no server and no account. Same payload, just wrapped in the shell the
    # Artifact host would otherwise supply.
    icon = ("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'"
            "%3E%3Crect width='32' height='32' fill='%2304060d'/%3E%3Cpath d='M16 4 L18.6 13.4 "
            "L28 16 L18.6 18.6 L16 28 L13.4 18.6 L4 16 L13.4 13.4 Z' fill='%234f8bff'/%3E%3C/svg%3E")
    standalone = (
        "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n"
        "<meta charset=\"utf-8\" />\n"
        "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\" />\n"
        f"<link rel=\"icon\" href=\"{icon}\" />\n"
        "<style>body{margin:0}</style>\n"
        f"</head>\n<body>\n{page}\n</body>\n</html>\n"
    )
    with open(OUT_STANDALONE, "w", encoding="utf-8") as f:
        f.write(standalone)
    print(f"Wrote {OUT_STANDALONE} — {os.path.getsize(OUT_STANDALONE)/1024/1024:.2f} MB  (double-clickable)")
    shutil.rmtree(TMP, ignore_errors=True)


main()
