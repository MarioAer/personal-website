// Variant claude-opus-5.5. Drawing readouts and a fallback for scroll-driven animations.
// Everything here is decorative: the page reads the same without it.

const root = document.documentElement
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
const scrollTimelines = window.CSS?.supports?.('animation-timeline: scroll()') ?? false

/** @param {number} value */
const pad = (value) => String(Math.max(0, Math.round(value))).padStart(4, '0')

if (!scrollTimelines) root.classList.add('no-scroll-timeline')

const rulerReadout = document.querySelector('[data-ruler-y]')
const coordinates = document.querySelector('[data-coords]')

let scrollQueued = false

function onScrollFrame() {
  scrollQueued = false
  if (rulerReadout) rulerReadout.textContent = `Y ${pad(window.scrollY)}`
  if (scrollTimelines || reducedMotion.matches) return
  const range = root.scrollHeight - root.clientHeight
  root.style.setProperty('--scroll', range > 0 ? (window.scrollY / range).toFixed(4) : '0')
}

window.addEventListener('scroll', () => {
  if (scrollQueued) return
  scrollQueued = true
  window.requestAnimationFrame(onScrollFrame)
}, { passive: true })

onScrollFrame()

if (coordinates && window.matchMedia('(pointer: fine)').matches) {
  let pointer = { x: 0, y: 0 }
  let pointerQueued = false
  window.addEventListener('pointermove', (event) => {
    pointer = { x: event.pageX, y: event.pageY }
    if (pointerQueued) return
    pointerQueued = true
    window.requestAnimationFrame(() => {
      pointerQueued = false
      coordinates.textContent = `X ${pad(pointer.x)} · Y ${pad(pointer.y)}`
    })
  }, { passive: true })
}
