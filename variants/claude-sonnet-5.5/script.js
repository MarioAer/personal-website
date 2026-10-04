// Pointer response: the hero strands and the trunk drift in opposite directions.
(() => {
  const fig = document.querySelector('.hero-fig');
  const hero = document.querySelector('.hero');
  if (!fig || !hero || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  hero.addEventListener('pointermove', (e) => {
    const r = hero.getBoundingClientRect();
    fig.style.setProperty('--px', ((e.clientX - r.left) / r.width - 0.5).toFixed(3));
    fig.style.setProperty('--py', ((e.clientY - r.top) / r.height - 0.5).toFixed(3));
  });
  hero.addEventListener('pointerleave', () => {
    fig.style.setProperty('--px', '0');
    fig.style.setProperty('--py', '0');
  });
})();
