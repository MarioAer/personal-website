# Manual edits

AGENTS.md asks for every fix to come from the model first; manual edits are a last resort and are
listed here.

- 2026-10-30, `style.css`: the three `transition: all 0.3s ease` rules (`.expertise-card`,
  `.principle`, `.timeline-marker::after`) now name only the properties their hover states change
  (border colour, box shadow, transform; border colour, box shadow; width, height, top, box shadow).
  `all` also animated unrelated properties, such as the background on a theme switch. Made by hand
  because the generating model, `claude-haiku-4-5-20251001`, was not available to the session that
  reviewed the variant. Hover effects are unchanged.
