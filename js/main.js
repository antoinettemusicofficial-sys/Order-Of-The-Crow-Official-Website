/* =========================================================
   ORDER OF THE CROW — main.js (v2)
   - scroll-scale: elements enter small from the bottom and grow
     to full size as they reach the center of the screen (Alan Walker)
   - sticky nav, mobile menu, year, placeholder guards, demo form
   ========================================================= */

document.addEventListener('DOMContentLoaded', () => {

  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

  /* ---- Footer year ---- */
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

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

  /* ---- Mobile menu ---- */
  const toggle = document.getElementById('navToggle');
  const links = document.getElementById('navLinks');
  if (toggle && nav) {
    toggle.addEventListener('click', () => nav.classList.toggle('open'));
    if (links) links.querySelectorAll('a').forEach((a) =>
      a.addEventListener('click', () => nav.classList.remove('open'))
    );
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
