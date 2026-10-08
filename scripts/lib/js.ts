import { parse, tokTypes } from 'acorn'
import type { Token } from 'acorn'

/**
 * JavaScript is read with a JavaScript parser, never with regular expressions. A pattern cannot tell
 * a string from the same characters in a comment or a regular expression, and it reads an escape
 * such as `/` as text instead of as the character it stands for.
 */

export type StringsResult = { strings: string[]; error?: undefined } | { strings?: undefined; error: string }

/** The cooked value of a string or template chunk, or `undefined` for any other token. */
function stringOf(token: Token): string | undefined {
  if (token.type !== tokTypes.string && token.type !== tokTypes.template) return undefined
  // acorn's Token type omits `value`, which holds the decoded text of a string or template chunk.
  if (!('value' in token)) return undefined
  const value: unknown = token.value
  return typeof value === 'string' ? value : undefined
}

function collect(text: string, sourceType: 'module' | 'script'): string[] {
  const strings: string[] = []
  parse(text, {
    ecmaVersion: 'latest',
    sourceType,
    allowHashBang: true,
    allowAwaitOutsideFunction: sourceType === 'module',
    onToken: (token) => {
      const value = stringOf(token)
      if (value !== undefined) strings.push(value)
    },
  })
  return strings
}

/**
 * Every string literal and template chunk in the program, decoded. A program is tried as a module
 * and then as a classic script, because both are valid in a browser.
 */
export function jsStrings(text: string): StringsResult {
  try {
    return { strings: collect(text, 'module') }
  } catch {
    try {
      return { strings: collect(text, 'script') }
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) }
    }
  }
}

/** Every string value in a JSON document such as an import map, at any depth. */
export function jsonStrings(text: string): StringsResult {
  const strings: string[] = []
  const visit = (value: unknown): void => {
    if (typeof value === 'string') strings.push(value)
    else if (Array.isArray(value)) value.forEach(visit)
    else if (typeof value === 'object' && value !== null) Object.values(value).forEach(visit)
  }
  try {
    visit(JSON.parse(text))
    return { strings }
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) }
  }
}
