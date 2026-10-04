// Variant claude-fable-5.1. One small control: highlight the "before" or the "after" stops of the
// evidence journeys. Everything stays visible; the other state is only dimmed. The page reads the
// same without this script.

const section = document.querySelector('#expertise')
const buttons = section ? [...section.querySelectorAll('.view__btn')] : []

for (const button of buttons) {
  button.addEventListener('click', () => {
    const view = button.dataset.view ?? 'both'
    if (section) section.dataset.view = view
    for (const other of buttons) other.setAttribute('aria-pressed', String(other === button))
  })
}
