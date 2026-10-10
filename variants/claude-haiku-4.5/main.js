// Minimal variant-specific JavaScript
// The shell handles theme persistence and variant selection.
// This file is reserved for variant-specific enhancements.

document.addEventListener('DOMContentLoaded', () => {
  // Ensure metadata is set
  const metaVariant = document.querySelector('meta[name="variant"]');
  if (!metaVariant || metaVariant.getAttribute('content') !== 'claude-haiku-4.5') {
    console.error('Variant metadata missing or incorrect');
  }
});
