/* =========================================================
   ORDER OF THE CROW — main.js (v2)
   - scroll-scale: elements enter small from the bottom and grow
     to full size as they reach the center of the screen (Alan Walker)
   - click-to-decrypt video vault
   - sticky nav, countdown, year, placeholder guards, demo form
   ========================================================= */

document.addEventListener('DOMContentLoaded', () => {

  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

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
    const NOISE = '█▓▒░#%&@*+=<>/\\|01';
    const rand = () => NOISE[Math.floor(Math.random() * NOISE.length)];

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

      // Resolve the cipher left to right. Driven off the frame clock rather
      // than a tick count so the reveal takes the same ~1.4s on every machine.
      const DURATION = 1400;
      const start = performance.now();

      const step = (now) => {
        const done = Math.min(
          PLAIN.length,
          Math.round(((now - start) / DURATION) * PLAIN.length)
        );
        vaultCipher.textContent =
          PLAIN.slice(0, done) + PLAIN.slice(done).replace(/\S/g, rand);

        if (done < PLAIN.length) { requestAnimationFrame(step); return; }

        vaultCipher.textContent = PLAIN;
        if (action) action.textContent = 'DECRYPTED';
        vault.classList.remove('is-decrypting');
        vault.classList.add('is-open');
        mountVideo();
      };

      requestAnimationFrame(step);
    };

    vaultLock.addEventListener('click', decrypt);
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
