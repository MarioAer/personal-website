// Variant claude-fable-5.2. Two enhancements; the page reads and navigates the same without them.
//
// Strip map: the CSS moves the carriage in proportion to the whole scroll. This script measures
// where each section actually starts, places the carriage on the exact stretch between two
// stations, and marks the current station for assistive technology.
//
// Parking: the network map and the ring loop animate endlessly, so each is paused (class
// `is-parked`) while it is scrolled out of view.

const root = document.documentElement
const track = document.querySelector('.strip__track')
const stops = track ? [...track.querySelectorAll('.strip__stop')] : []
const sections = stops.map((stop) => {
  const id = (stop.getAttribute('href') ?? '').slice(1)
  return id ? document.getElementById(id) : null
})

/** How far the page has travelled towards section `index`: 0 not yet approaching, 1 arrived. */
function arrival(index) {
  const section = sections[index]
  if (!section) return 0
  const viewport = window.innerHeight
  const top = section.getBoundingClientRect().top
  const isLast = index === sections.length - 1
  // The last section is short and can never reach the top, so it arrives as it fills in.
  const line = isLast ? viewport : viewport * 0.62
  const stretch = isLast ? Math.max(1, Math.min(section.offsetHeight, viewport * 0.6)) : viewport * 0.5
  // Nothing has arrived before the page has moved, however tall the viewport is.
  const travelled = Math.min((line - top) / stretch, window.scrollY / stretch)
  return Math.min(1, Math.max(0, travelled))
}

let marked = -1

function placeCarriage() {
  if (!(track instanceof HTMLElement)) return
  let position = 0
  for (let index = 1; index < sections.length; index += 1) position += arrival(index)
  track.style.setProperty('--strip-pos', position.toFixed(3))
  const current = Math.round(position)
  if (current === marked) return
  stops[marked]?.removeAttribute('aria-current')
  stops[current]?.setAttribute('aria-current', 'true')
  marked = current
}

if (track && stops.length > 1) {
  let queued = false
  const schedule = () => {
    if (queued) return
    queued = true
    requestAnimationFrame(() => {
      queued = false
      placeCarriage()
    })
  }
  root.classList.add('strip-live')
  placeCarriage()
  window.addEventListener('scroll', schedule, { passive: true })
  window.addEventListener('resize', schedule)
}

if ('IntersectionObserver' in window) {
  const parking = new IntersectionObserver((entries) => {
    for (const entry of entries) entry.target.classList.toggle('is-parked', !entry.isIntersecting)
  })
  for (const element of document.querySelectorAll('[data-park]')) parking.observe(element)
}
