// Pauses the endless dash animation of any SVG that is scrolled out of view.
// Without this file, or without IntersectionObserver, the animation simply keeps running.
(() => {
  if (!('IntersectionObserver' in window)) return;
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      entry.target.toggleAttribute('data-offscreen', !entry.isIntersecting);
    }
  });
  for (const svg of document.querySelectorAll('svg.scene, svg.mini')) {
    observer.observe(svg);
  }
})();
