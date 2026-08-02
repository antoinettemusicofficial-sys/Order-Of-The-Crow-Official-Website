# Order of the Crow — Official Website

Custom-coded (HTML / CSS / vanilla JS) site for the musical artist **Order of the Crow**.

## Run it
Just open `index.html` in a browser. No build step, no dependencies.

## Structure
```
index.html        Single-page site (all sections)
css/style.css     Palette, layout, animations
js/main.js        Scroll reveals, nav, placeholder guards
assets/           Images (Dead Man album art)
```

## Design references (each drives a specific aspect)
- **Sons of Legion** — overall layout & funnel (merch, album, email, community)
- **Ghost** — dark, cryptic, cinematic color/mood
- **Linkin Park** — color-shifting hero background
- **Green Day** — stacked layout + email signup near the bottom
- **Alan Walker** — reveal-on-scroll animations

## Palette
Black / dark blue / white, with a luminous blue accent. An optional muted **gold**
(Ghost-style) accent is defined in `:root` — set `--accent: var(--gold)` in
`css/style.css` to switch the whole accent tone.

## Placeholders still to wire up
Search the code for `PLACEHOLDER` / `data-placeholder` / `.placeholder-note`:
- Streaming & buy links (Spotify / Apple / YouTube / Bandcamp)
- Merch store (Shopify or Snipcart)
- Community platform (Circle / Discord / custom)
- Email signup backend (Mailchimp / ConvertKit)
- Social links
- Real bio/lore text in the About section
