// Pointer-driven polish for the Claude Sonnet 5.5 variant. The page is complete without this file:
// it only feeds pointer coordinates to CSS custom properties.
(() => {
  'use strict'

  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)')
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')

  let frame = 0
  let latest = null

  /** Writes the pointer position, relative to the element, for the radial light behind cards and rows. */
  const spot = (element, event) => {
    const box = element.getBoundingClientRect()
    element.style.setProperty('--mx', `${Math.round(event.clientX - box.left)}px`)
    element.style.setProperty('--my', `${Math.round(event.clientY - box.top)}px`)
  }

  const hero = document.querySelector('.hero')

  /** Moves the hero graphic a few pixels against the pointer, from -1 to 1 on each axis. */
  const parallax = (event) => {
    if (!hero || reducedMotion.matches) return
    const box = hero.getBoundingClientRect()
    const x = ((event.clientX - box.left) / box.width - 0.5) * 2
    const y = ((event.clientY - box.top) / box.height - 0.5) * 2
    hero.style.setProperty('--px', x.toFixed(3))
    hero.style.setProperty('--py', y.toFixed(3))
  }

  const flush = () => {
    frame = 0
    if (!latest) return
    const event = latest
    latest = null
    const target = event.target instanceof Element ? event.target : null
    const host = target ? target.closest('[data-spot]') : null
    if (host) spot(host, event)
    if (hero && target && hero.contains(target)) parallax(event)
  }

  document.addEventListener('pointermove', (event) => {
    if (event.pointerType === 'touch' || !finePointer.matches) return
    latest = event
    if (!frame) frame = window.requestAnimationFrame(flush)
  }, { passive: true })

  if (hero) {
    hero.addEventListener('pointerleave', () => {
      hero.style.setProperty('--px', '0')
      hero.style.setProperty('--py', '0')
    })
  }
})()
