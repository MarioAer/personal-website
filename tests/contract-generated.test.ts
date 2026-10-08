import test from 'node:test'
import assert from 'node:assert/strict'
import { checkVariant } from '../scripts/lib/contract.ts'

/**
 * Invariant: an external reference in live markup is reported, whatever well-formed markup precedes it.
 * Every fragment below is closed by the HTML specification's rules, so the planted `<img>` that follows
 * is a real element in a browser. A checker that reads markup differently from a browser loses
 * a reference in some combination of these fragments.
 */

const SCRIPT_END = ['</script>', '</script >', '</script\n>', '</SCRIPT>', '</script foo="bar">', '</script/>', '</Script\t>']
const STYLE_END = ['</style>', '</style >', '</style\n>', '</STYLE>', '</style foo="bar">', '</style/>']

const FRAGMENTS: readonly ((pick: <T>(items: readonly T[]) => T) => string)[] = [
  (pick) => `<script>var a = 1;${pick(SCRIPT_END)}`,
  (pick) => `<script>var s = "<!--";${pick(SCRIPT_END)}`,
  (pick) => `<script>var s = "<style>";${pick(SCRIPT_END)}`,
  (pick) => `<script>var s = "<img src='https://decoy.example/s.png'>";${pick(SCRIPT_END)}`,
  (pick) => `<style>a { color: red }${pick(STYLE_END)}`,
  (pick) => `<style>/* <script> */${pick(STYLE_END)}`,
  () => '<!-- a comment -->',
  () => '<!-- <script> -->',
  () => '<!-- <img src="https://decoy.example/c.png"> -->',
  () => '<p title="a>b">text</p>',
  () => "<p title='<script>'>text</p>",
  () => '<p data-x="</script>">text</p>',
  () => '<textarea></script><img src="https://decoy.example/t.png"></textarea>',
  () => '<title>&lt;script&gt;</title>',
  () => '<template><b>inert</b></template>',
  () => '<svg viewBox="0 0 1 1"><title>x</title></svg>',
  () => '<noscript>text</noscript>',
]

/** A small seeded generator, so a failure names a seed that reproduces it. */
function generator(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 2 ** 32
  }
}

test('an external reference is reported after any sequence of well-formed fragments', () => {
  for (let seed = 1; seed <= 600; seed++) {
    const next = generator(seed)
    const pick = <T>(items: readonly T[]): T => items[Math.floor(next() * items.length)] as T
    const before = Array.from({ length: Math.floor(next() * 5) }, () => pick(FRAGMENTS)(pick)).join('')
    const after = Array.from({ length: Math.floor(next() * 4) }, () => pick(FRAGMENTS)(pick)).join('')
    const html =
      '<!doctype html><html><head><meta name="variant" content="demo"><script type="module" src="/shell/shell.js"></script></head>' +
      `<body>${before}<img src="https://planted.example/${seed}.png" alt="">${after}</body></html>`
    const { errors } = checkVariant({ id: 'demo', files: new Map([['index.html', html]]) })
    assert.ok(errors.some((e) => e.includes(`planted.example/${seed}.png`)), `seed ${seed} lost the planted reference in: ${html}`)
    assert.ok(!errors.some((e) => e.includes('decoy.example')), `seed ${seed} reported a reference that is not live in: ${html}`)
    assert.ok(!errors.some((e) => /exactly one script tag/.test(e)), `seed ${seed} lost the shell tag in: ${html}`)
  }
})
