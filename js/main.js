/* =========================================================
   ORDER OF THE CROW — main.js (v2)
   - scroll-scale: elements enter small from the bottom and grow
     to full size as they reach the center of the screen (Alan Walker)
   - click-to-decrypt vault (audio transport / video)
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

  /* ---- Scroll-scale (grow from bottom to center) ----
     Every section reveals to the SAME beat: the chapter number first, then the
     title, then the content. Two rules make that hold everywhere.

     1. Progress is anchored to each element's TOP edge, not its center. Anchored
        to the center, a tall content block and a one-line label sitting right
        next to each other cross the trigger at different scroll positions purely
        because of their height — which is why the reveals used to look like they
        fired in a different order from section to section.
     2. Each element is then held back by a fixed scroll distance based on its
        order within its own section, so the cascade is deliberate rather than
        whatever the natural spacing happened to produce. Items sharing a row
        cascade left-to-right for the same reason.

     Anything with .scale-in participates; see the note in style.css about
     keeping .scale-in on the CHILDREN of .section__inner, never the wrapper. */
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const REVEAL_WINDOW = 0.5;   // plays over the bottom half of the viewport
  const STAGGER_PX    = 40;    // scroll distance between beats
  const STAGGER_MAX   = 4;     // cap so long sections don't over-delay their tails

  const nodes = Array.from(document.querySelectorAll('.scale-in'));

  if (reduceMotion) {
    nodes.forEach((el) => { el.style.opacity = 1; el.style.transform = 'none'; });
  } else {
    // Stagger index = position among .scale-in siblings within the same section.
    const seen = new Map();
    const items = nodes.map((el) => {
      // Match the TAG, not .section — the hero and the gate are <section> elements
      // that don't carry the .section class, and anything falling through to
      // <body> would share one ever-growing stagger with the whole page.
      const group = el.closest('section, footer') || document.body;
      const n = seen.get(group) || 0;
      seen.set(group, n + 1);
      return { el, hold: Math.min(n, STAGGER_MAX) * STAGGER_PX };
    });

    let ticking = false;

    const update = () => {
      const vh = window.innerHeight;
      for (const { el, hold } of items) {
        // progress 0 -> 1 as the element's top travels from the bottom of the
        // viewport up to the vertical middle, delayed by its beat in the section.
        const top = el.getBoundingClientRect().top + hold;
        const p = clamp((vh - top) / (vh * REVEAL_WINDOW), 0, 1);

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

  /* ---- Click-to-decrypt vault ----
     Click the lock -> the cipher line scrambles for a beat -> the panel
     "resolves" and whatever media is configured starts playing.
     Configure via the #vault element's data-audio (an audio file, which is
     what the client supplied), data-youtube (a YouTube ID) or data-src (a
     local video file). Checked in that order; all empty keeps the standby
     panel. */
  const vault = document.getElementById('vault');
  const vaultLock = document.getElementById('vaultLock');
  const vaultCipher = document.getElementById('vaultCipher');

  if (vault && vaultLock) {
    const PLAIN = 'ORDER OF THE CROW';

    const el = (tag, cls) => {
      const n = document.createElement(tag);
      if (cls) n.className = cls;
      return n;
    };

    const clock = (secs) => {
      if (!isFinite(secs) || secs < 0) secs = 0;
      return `${Math.floor(secs / 60)}:${String(Math.floor(secs % 60)).padStart(2, '0')}`;
    };

    /* Live spectrum behind the transport. Kept entirely optional: if WebAudio
       is missing, blocked, or the file can't be read cross-origin, we bail and
       the track still plays — never let the decoration take the audio down.
       The rAF loop only runs while the track is actually playing, so this
       can't sit and burn the main thread the way liquid-hero.js once did. */
    const wireVisualiser = (audio, canvas) => {
      const AC = window.AudioContext || window.webkitAudioContext;
      const g = canvas.getContext && canvas.getContext('2d');
      if (!AC || !g) return () => {};

      let ctx, source, analyser;
      try {
        ctx = new AC();
        source = ctx.createMediaElementSource(audio);
      } catch (e) {
        return () => {};             // element never rerouted — plays normally
      }
      try {
        analyser = ctx.createAnalyser();
        analyser.fftSize = 128;
        analyser.smoothingTimeConstant = 0.75;
        source.connect(analyser);
        analyser.connect(ctx.destination);
      } catch (e) {
        // the source IS rerouted now, so it must reach the speakers somehow
        try { source.connect(ctx.destination); } catch (e2) { /* nothing left to try */ }
        return () => {};
      }

      const size = () => {
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        canvas.width  = Math.max(1, Math.round(canvas.clientWidth  * dpr));
        canvas.height = Math.max(1, Math.round(canvas.clientHeight * dpr));
      };
      size();
      window.addEventListener('resize', size, { passive: true });

      const bins = new Uint8Array(analyser.frequencyBinCount);
      const GAP = 2;               // device px between bars
      let raf = 0;

      const draw = () => {
        const w = canvas.width, h = canvas.height;
        g.clearRect(0, 0, w, h);
        analyser.getByteFrequencyData(bins);

        const n = bins.length;
        const bw = w / n;
        for (let i = 0; i < n; i++) {
          const bh = (bins[i] / 255) * h * 0.82;
          // every seventh bar in cyan, the same two-channel language as .glitch
          g.fillStyle = i % 7 === 0 ? 'rgba(100,230,255,.5)' : 'rgba(79,139,255,.34)';
          g.fillRect(i * bw, h - bh, Math.max(1, bw - GAP), bh);
        }
        raf = requestAnimationFrame(draw);
      };

      return (on) => {
        if (on) {
          if (ctx.state === 'suspended') ctx.resume().catch(() => {});
          if (reduceMotion) return;  // player works, the bars just stay still
          if (!raf) { size(); raf = requestAnimationFrame(draw); }
        } else {
          if (raf) { cancelAnimationFrame(raf); raf = 0; }
          // don't leave the bars frozen mid-height — a paused panel goes quiet
          g.clearRect(0, 0, canvas.width, canvas.height);
        }
      };
    };

    /* The audio transport. Deliberately NOT <audio controls>: the native
       chrome is an unstyleable light pill and there is no way to make it read
       as part of this panel. */
    const mountAudio = (stage, src) => {
      const audio = new Audio();
      /* Same-origin today (assets/), so this is a no-op — it's here so the
         analyser still works if data-audio is ever pointed back at the GHL
         media CDN, which does send access-control-allow-origin: *. */
      audio.crossOrigin = 'anonymous';
      audio.preload = 'auto';
      audio.src = src;
      audio.hidden = true;

      const wrap = el('div', 'vaudio');
      const viz  = el('canvas', 'vaudio__viz');
      viz.setAttribute('aria-hidden', 'true');

      const ui    = el('div', 'vaudio__ui');
      const title = el('p', 'vaudio__title mono');
      const eye   = el('span', 'vaudio__eye');
      eye.textContent = '◈';
      eye.setAttribute('aria-hidden', 'true');
      title.append(eye, vault.dataset.audioTitle?.trim() || 'TRANSMISSION 001');

      const bar  = el('div', 'vaudio__transport');
      const play = el('button', 'vaudio__play');
      play.type = 'button';
      play.setAttribute('aria-label', 'Play');

      const seek = el('input', 'vaudio__seek');
      seek.type = 'range';
      seek.min = '0'; seek.max = '1000'; seek.step = '1'; seek.value = '0';
      seek.setAttribute('aria-label', 'Seek through the transmission');

      const time = el('span', 'vaudio__time mono');
      time.textContent = '0:00 / 0:00';

      bar.append(play, seek, time);
      ui.append(title, bar);
      wrap.append(viz, ui, audio);
      stage.replaceChildren(wrap);

      const setViz = wireVisualiser(audio, viz);

      const setPlaying = (on) => {
        wrap.classList.toggle('is-playing', on);
        play.setAttribute('aria-label', on ? 'Pause' : 'Play');
        setViz(on);
      };

      audio.addEventListener('play',  () => setPlaying(true));
      audio.addEventListener('pause', () => setPlaying(false));
      audio.addEventListener('ended', () => {
        setPlaying(false);
        seek.value = '0';
        time.textContent = `0:00 / ${clock(audio.duration)}`;
      });
      audio.addEventListener('error', () => {
        title.textContent = '// TRANSMISSION UNAVAILABLE';
        bar.remove();
      });

      audio.addEventListener('loadedmetadata', () => {
        time.textContent = `${clock(0)} / ${clock(audio.duration)}`;
      });
      audio.addEventListener('timeupdate', () => {
        time.textContent = `${clock(audio.currentTime)} / ${clock(audio.duration)}`;
        if (audio.duration) seek.value = String((audio.currentTime / audio.duration) * 1000);
      });

      play.addEventListener('click', () => {
        if (audio.paused) audio.play().catch(() => {}); else audio.pause();
      });
      seek.addEventListener('input', () => {
        if (audio.duration) audio.currentTime = (Number(seek.value) / 1000) * audio.duration;
      });

      /* The decrypt click is ~1.4s back, but user activation is sticky, so this
         is normally allowed. If a browser refuses we simply sit on the play
         button rather than showing an error. */
      audio.play().catch(() => {});
    };

    const mountMedia = () => {
      const stage = document.getElementById('vaultStage');
      const aud = vault.dataset.audio?.trim();
      const yt  = vault.dataset.youtube?.trim();
      const src = vault.dataset.src?.trim();
      if (!stage || (!aud && !yt && !src)) return;   // nothing yet — keep standby

      if (aud) {
        mountAudio(stage, aud);
      } else if (yt) {
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
          mountMedia();
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

  /* ---- Demo forms (no backend yet) ----
     Both the mailing-list signup and the contact form are placeholders until a
     backend is picked (Mailchimp / ConvertKit / GoHighLevel). They intercept the
     submit so nothing silently posts to "#", and the visitor still gets feedback.
     TO GO LIVE: point the form's action= at the real handler and delete its
     wireDemoForm(...) call below. */
  const wireDemoForm = (id, note, doneLabel) => {
    const form = document.getElementById(id);
    if (!form) return;
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      console.log(`[placeholder] ${note}`);
      const btn = form.querySelector('button');
      const original = btn.textContent;
      btn.textContent = doneLabel;
      setTimeout(() => (btn.textContent = original), 2500);
    });
  };

  wireDemoForm('signupForm', 'signup submitted — connect Mailchimp / ConvertKit.', '✔ TRANSMITTED (demo)');
  wireDemoForm('contactForm', 'contact form submitted — connect a form backend / inbox.', '✔ MESSAGE SENT (demo)');
});
