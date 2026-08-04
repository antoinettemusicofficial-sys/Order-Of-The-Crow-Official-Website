/* =========================================================
   ORDER OF THE CROW — main.js (v2)
   - scroll-scale: elements enter small from the bottom and grow
     to full size as they reach the center of the screen (Alan Walker)
   - click-to-decrypt video vault
   - sticky nav, countdown, year, placeholder guards, demo form
   ========================================================= */

document.addEventListener('DOMContentLoaded', () => {

  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

  /* ---- Shared cipher resolve ----
     Scrambles `plain` and resolves it left to right over `ms`. Driven off
     the frame clock rather than a tick count, so it takes the same time on
     every machine. `onFrame` gets each intermediate string; `onDone` fires
     once the text has fully resolved. */
  const CIPHER_NOISE = '█▓▒░#%&@*+=<>/\\|01';
  const noiseChar = () => CIPHER_NOISE[Math.floor(Math.random() * CIPHER_NOISE.length)];
  const scramble = (s) => s.replace(/\S/g, noiseChar);

  const cipherResolve = (plain, ms, onFrame, onDone) => {
    const start = performance.now();
    const step = (now) => {
      const p = Math.min(1, (now - start) / ms);
      const cut = Math.round(p * plain.length);
      onFrame(plain.slice(0, cut) + scramble(plain.slice(cut)));

      if (p < 1) { requestAnimationFrame(step); return; }
      onFrame(plain);
      if (onDone) onDone();
    };
    requestAnimationFrame(step);
  };

  /* ---- Footer year ---- */
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---- Countdown to the DEAD MAN album release ---- */
  const cd = document.getElementById('countdown');
  if (cd) {
    const target = new Date(cd.dataset.release).getTime();
    const fields = {
      days:  cd.querySelector('[data-cd="days"]'),
      hours: cd.querySelector('[data-cd="hours"]'),
      mins:  cd.querySelector('[data-cd="mins"]'),
      secs:  cd.querySelector('[data-cd="secs"]'),
    };
    const pad = (n) => String(n).padStart(2, '0');

    const tickCountdown = () => {
      let diff = target - Date.now();

      if (diff <= 0) {
        // Release day has arrived — show a static "OUT NOW" state.
        cd.classList.add('is-live');
        fields.days.textContent = fields.hours.textContent =
        fields.mins.textContent = fields.secs.textContent = '00';
        return false;
      }

      const secs = Math.floor(diff / 1000);
      fields.days.textContent  = pad(Math.floor(secs / 86400));
      fields.hours.textContent = pad(Math.floor(secs / 3600) % 24);
      fields.mins.textContent  = pad(Math.floor(secs / 60) % 60);
      fields.secs.textContent  = pad(secs % 60);
      return true;
    };

    if (tickCountdown()) {
      const timer = setInterval(() => {
        if (!tickCountdown()) clearInterval(timer);
      }, 1000);
    }
  }

  /* ---- Scroll-scale (grow from bottom to center) ---- */
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const items = Array.from(document.querySelectorAll('.scale-in'));

  if (reduceMotion) {
    items.forEach((el) => { el.style.opacity = 1; el.style.transform = 'none'; });
  } else {
    let ticking = false;

    const update = () => {
      const vh = window.innerHeight;
      for (const el of items) {
        const rect = el.getBoundingClientRect();
        const elCenter = rect.top + rect.height / 2;

        // progress 0 -> 1 as the element's center travels from the
        // bottom of the viewport up to the vertical middle.
        let p = (vh - elCenter) / (vh * 0.5);
        p = clamp(p, 0, 1);

        const scale = 0.82 + 0.18 * p;   // 0.82 -> 1
        const y = (1 - p) * 60;          // 60px -> 0
        el.style.opacity = p;
        el.style.transform = `translateY(${y}px) scale(${scale})`;
      }
      ticking = false;
    };

    const onScroll = () => {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    update(); // initial paint
  }

  /* ---- Nav background on scroll ---- */
  const nav = document.getElementById('nav');
  const onNavScroll = () => nav.classList.toggle('scrolled', window.scrollY > 40);
  onNavScroll();
  window.addEventListener('scroll', onNavScroll, { passive: true });

  /* ---- Click-to-decrypt video vault ----
     Click the lock -> the cipher line scrambles for a beat -> the panel
     "resolves" and whatever video is configured starts playing.
     Configure via the #vault element's data-youtube or data-src attribute. */
  const vault = document.getElementById('vault');
  const vaultLock = document.getElementById('vaultLock');
  const vaultCipher = document.getElementById('vaultCipher');

  if (vault && vaultLock) {
    const PLAIN = 'ORDER OF THE CROW';

    const mountVideo = () => {
      const stage = document.getElementById('vaultStage');
      const yt = vault.dataset.youtube?.trim();
      const src = vault.dataset.src?.trim();
      if (!stage || (!yt && !src)) return;   // no video yet — keep the standby panel

      if (yt) {
        const frame = document.createElement('iframe');
        frame.src = `https://www.youtube-nocookie.com/embed/${yt}?autoplay=1&rel=0&modestbranding=1`;
        frame.title = 'Order of the Crow — video';
        frame.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
        frame.allowFullscreen = true;
        stage.replaceChildren(frame);
      } else {
        const vid = document.createElement('video');
        vid.src = src;
        vid.controls = vid.autoplay = vid.playsInline = true;
        stage.replaceChildren(vid);
      }
    };

    const action = vaultLock.querySelector('.vault__action');

    const decrypt = () => {
      if (vault.classList.contains('is-open')) return;
      vault.classList.add('is-decrypting');
      vaultLock.disabled = true;
      if (action) action.textContent = 'DECRYPTING…';

      cipherResolve(PLAIN, 1400,
        (txt) => { vaultCipher.textContent = txt; },
        () => {
          if (action) action.textContent = 'DECRYPTED';
          vault.classList.remove('is-decrypting');
          vault.classList.add('is-open');
          mountVideo();
        });
    };

    vaultLock.addEventListener('click', decrypt);
  }

  /* ---- Encrypted panel (the DEAD MAN block on music.html) ----
     The panel arrives locked: art blurred out, title showing as noise. It
     resolves itself when it reaches the middle of the viewport — art
     unblurs behind a scan sweep, the title decodes character by character,
     the copy staggers in. The DECRYPT button above just triggers it early.

     The markup ships the REAL title, so with JS off (or reduced motion on)
     the panel simply renders normally and never locks. */
  const panel = document.getElementById('albumPanel');
  let revealPanel = () => {};

  if (panel) {
    const title = panel.querySelector('[data-cipher]');
    const plainTitle = title ? title.textContent.trim() : '';

    if (reduceMotion) {
      panel.classList.remove('enc');
    } else {
      if (title) {
        const noise = scramble(plainTitle);
        title.textContent = noise;
        title.dataset.text = noise;   // the glitch ghosts read from data-text
      }

      let spent = false;
      revealPanel = () => {
        if (spent) return;
        spent = true;

        panel.querySelectorAll('.enc__fade').forEach((el, i) => {
          el.style.transitionDelay = `${220 + i * 90}ms`;
        });
        panel.classList.add('is-decrypting');
        panel.classList.remove('enc');

        if (title) {
          cipherResolve(plainTitle, 1000, (txt) => {
            title.textContent = txt;
            title.dataset.text = txt;
          });
        }
        setTimeout(() => panel.classList.remove('is-decrypting'), 1400);
      };

      // rootMargin rather than a threshold: the panel is taller than the
      // viewport on phones, where a ratio threshold may never be reached.
      const io = new IntersectionObserver((entries) => {
        if (entries.some((e) => e.isIntersecting)) { revealPanel(); io.disconnect(); }
      }, { rootMargin: '-15% 0px -15% 0px' });
      io.observe(panel);
    }
  }

  /* ---- Decrypt-and-scroll buttons ----
     Same cipher language as the video vault, but as a way IN to a section:
     the label scrambles for a beat, resolves, then the page glides down to
     the target and sets it decrypting. A real anchor underneath, so with JS
     off (or reduced motion on) the browser just jumps there normally. */
  document.querySelectorAll('[data-decrypt-to]').forEach((btn) => {
    const label = btn.querySelector('.decrypt__label') || btn;
    const PLAIN = label.textContent;

    btn.addEventListener('click', (e) => {
      const target = document.querySelector(btn.dataset.decryptTo);
      if (!target || reduceMotion || btn.dataset.busy) return;  // let the anchor do it
      e.preventDefault();
      btn.dataset.busy = '1';

      cipherResolve(PLAIN, 700,
        (txt) => { label.textContent = txt; },
        () => {
          delete btn.dataset.busy;
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
          // Let the scroll get underway before the panel starts resolving,
          // so the reveal happens in front of you rather than off-screen.
          setTimeout(revealPanel, 450);
        });
    });
  });

  /* ---- The Gate (community.html) ----
     The page arrives locked behind a CLASSIFIED panel with the content
     blurred out. Clicking runs an access sequence — a terminal readout
     ticking through checks, a progress bar, the title decoding out of
     noise — and then the gate blows apart and the page resolves.

     Everything here is additive: the lock only exists once JS adds
     .is-gated, so with JS off the page just renders normally. */
  const gate = document.getElementById('gate');

  if (gate) {
    const gateBtn    = document.getElementById('gateBtn');
    const gateCipher = document.getElementById('gateCipher');
    const gateLog    = document.getElementById('gateLog');
    const PLAIN      = 'CULT OF THE CROW';

    const CHECKS = [
      'ESTABLISHING SECURE CHANNEL',
      'VERIFYING THE MARK',
      'BYPASSING THE OUTER SEAL',
      'DECRYPTING MANIFEST',
    ];

    document.body.classList.add('is-gated');

    const unlock = () => {
      document.body.classList.remove('is-gated');
      gate.setAttribute('hidden', '');
    };

    if (reduceMotion) {
      // No theatrics, but still a deliberate click to get in.
      gateCipher.textContent = PLAIN;
      gateBtn.addEventListener('click', unlock, { once: true });
    } else {
      // Idle state: the title churns as unreadable noise.
      gateCipher.textContent = scramble(PLAIN);
      const churn = setInterval(() => { gateCipher.textContent = scramble(PLAIN); }, 90);

      const addLine = (text, granted) => {
        const line = document.createElement('p');
        line.className = 'gate__line' + (granted ? ' gate__line--grant' : '');
        line.innerHTML = granted
          ? `&gt; ${text}`
          : `<span>&gt; ${text}</span><span class="ok">OK</span>`;
        gateLog.appendChild(line);
      };

      gateBtn.addEventListener('click', () => {
        clearInterval(churn);
        gate.classList.add('is-working');
        gateBtn.disabled = true;
        gateBtn.textContent = 'DECRYPTING…';

        const STEP = 420;
        CHECKS.forEach((check, i) => setTimeout(() => addLine(check), i * STEP));

        // The title resolves while the last checks are still landing.
        setTimeout(() => {
          cipherResolve(PLAIN, 900, (txt) => { gateCipher.textContent = txt; });
        }, CHECKS.length * STEP - 500);

        setTimeout(() => {
          addLine('ACCESS GRANTED', true);
          gate.classList.remove('is-working');
          gateBtn.textContent = 'WELCOME IN';
        }, CHECKS.length * STEP + 500);

        setTimeout(() => gate.classList.add('is-open'), CHECKS.length * STEP + 1000);
        setTimeout(unlock, CHECKS.length * STEP + 1800);
      }, { once: true });
    }

    gateBtn.focus({ preventScroll: true });
  }

  /* ---- Placeholder link guard ---- */
  document.querySelectorAll('a[data-placeholder]').forEach((a) => {
    a.addEventListener('click', (e) => {
      if (a.getAttribute('href') === '#') {
        e.preventDefault();
        console.log(`[placeholder] "${a.dataset.placeholder}" — needs a real URL.`);
      }
    });
  });

  /* ---- Demo signup (no backend yet) ---- */
  const form = document.getElementById('signupForm');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      console.log('[placeholder] signup submitted — connect Mailchimp / ConvertKit.');
      const btn = form.querySelector('button');
      const original = btn.textContent;
      btn.textContent = '✔ TRANSMITTED (demo)';
      setTimeout(() => (btn.textContent = original), 2500);
    });
  }
});
