// Pointer response: hovering a role highlights its span on the time strip, and the other way round.
(() => {
  const root = document.querySelector('[data-timeline]');
  if (!root) return;
  const segs = root.querySelectorAll('.seg');
  const recs = root.querySelectorAll('.rec');
  const set = (i, on) => {
    segs.forEach((s) => s.classList.toggle('is-on', on && s.dataset.i === i));
    recs.forEach((r) => r.classList.toggle('is-on', on && r.dataset.i === i));
  };
  [...segs, ...recs].forEach((el) => {
    el.addEventListener('pointerenter', () => set(el.dataset.i, true));
    el.addEventListener('pointerleave', () => set(el.dataset.i, false));
  });
})();
