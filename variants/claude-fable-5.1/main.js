// Variant claude-fable-5.1. One enhancement; the page reads the same without this script.
//
// The strip map. CSS scroll-driven animations move the carriage; this script marks the current
// station for assistive technology and, in browsers without scroll timelines, moves the carriage
// itself by writing the same custom properties the CSS animates.

const strip = document.querySelector('.strip')
const stations = strip ? [...strip.querySelectorAll('.strip__station')] : []
const targets = stations
  .slice(1)
  .map((link) => document.querySelector(link.getAttribute('href') ?? ''))
const cssDrives =
  typeof CSS !== 'undefined' &&
  CSS.supports('animation-timeline: view()') &&
  CSS.supports('animation-range: cover 0% cover 60vh')

/** Progress of one strip segment, 0 before the next section approaches, 1 once it has arrived. */
function progress(target, isLast) {
  if (!(target instanceof HTMLElement)) return 0
  const rect = target.getBoundingClientRect()
  const viewport = window.innerHeight
  const travelled = viewport - rect.top
  const distance = isLast ? Math.max(rect.height, 1) : viewport * 0.6
  return Math.min(1, Math.max(0, travelled / distance))
}

let scheduled = false
function update() {
  scheduled = false
  if (!strip) return
  let sum = 0
  targets.forEach((target, index) => {
    const value = progress(target, index === targets.length - 1)
    sum += value
    if (!cssDrives) strip.style.setProperty(`--p${index + 1}`, value.toFixed(4))
  })
  const current = Math.min(stations.length - 1, Math.round(sum))
  stations.forEach((link, index) => {
    if (index === current) link.setAttribute('aria-current', 'location')
    else link.removeAttribute('aria-current')
  })
}

function schedule() {
  if (scheduled) return
  scheduled = true
  requestAnimationFrame(update)
}

if (strip && stations.length > 1) {
  window.addEventListener('scroll', schedule, { passive: true })
  window.addEventListener('resize', schedule)
  update()
}
