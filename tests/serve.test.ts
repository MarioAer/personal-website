import test from 'node:test'
import assert from 'node:assert/strict'
import { request } from 'node:http'
import type { AddressInfo } from 'node:net'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createStaticServer } from '../scripts/serve.ts'

interface Reply {
  status: number
  body: string
  location: string | undefined
}

/** Sends the path exactly as given: `fetch` would normalise `..` and hide the attack. */
function get(port: number, path: string): Promise<Reply> {
  return new Promise((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port, path, method: 'GET' }, (res) => {
      let body = ''
      res.setEncoding('utf8')
      res.on('data', (chunk: string) => (body += chunk))
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body, location: res.headers.location }))
    })
    req.setTimeout(2000, () => req.destroy(new Error(`no reply to ${path} within 2 s`)))
    req.on('error', reject)
    req.end()
  })
}

/** A site root with a secret one level above it, which no request may reach. */
async function withServer(t: test.TestContext, basePath = '/site/'): Promise<number> {
  const parent = await mkdtemp(join(tmpdir(), 'pw-serve-'))
  const root = join(parent, 'dist')
  await mkdir(join(root, 'sub'), { recursive: true })
  await writeFile(join(parent, 'secret.txt'), 'TOP-SECRET')
  await writeFile(join(root, 'index.html'), '<h1>home</h1>')
  await writeFile(join(root, '404.html'), '<h1>missing</h1>')
  await writeFile(join(root, 'sub', 'index.html'), '<h1>sub</h1>')
  await writeFile(join(root, 'app.js'), 'export {}')
  const server = createStaticServer({ root, basePath })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  t.after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()))
    await rm(parent, { recursive: true, force: true })
  })
  const address = server.address()
  assert.ok(address !== null && typeof address === 'object')
  return (address as AddressInfo).port
}

test('files and directory indexes are served under the base path', async (t) => {
  const port = await withServer(t)
  assert.equal((await get(port, '/site/')).body, '<h1>home</h1>')
  assert.equal((await get(port, '/site/sub/')).body, '<h1>sub</h1>')
  assert.equal((await get(port, '/site/app.js')).status, 200)
})

test('a path outside the base path redirects to it', async (t) => {
  const port = await withServer(t)
  const reply = await get(port, '/elsewhere')
  assert.equal(reply.status, 302)
  assert.equal(reply.location, '/site/')
})

test('a missing file answers with the 404 page', async (t) => {
  const port = await withServer(t)
  const reply = await get(port, '/site/nope.html')
  assert.equal(reply.status, 404)
  assert.equal(reply.body, '<h1>missing</h1>')
})

for (const [name, path] of [
  ['plain dot segments', '/site/../secret.txt'],
  ['encoded slashes', '/site/..%2fsecret.txt'],
  ['encoded dots and slashes', '/site/%2e%2e%2fsecret.txt'],
  ['deeper encoded traversal', '/site/sub/..%2f..%2fsecret.txt'],
  ['an encoded backslash', '/site/..%5csecret.txt'],
  ['a double-encoded slash', '/site/..%252fsecret.txt'],
  ['an absolute path after the base', '/site//etc/hosts'],
  ['a null byte', '/site/app.js%00.png'],
] as const) {
  test(`${name} cannot reach a file outside the root`, async (t) => {
    const port = await withServer(t)
    const reply = await get(port, path)
    assert.ok(!reply.body.includes('TOP-SECRET'), `${path} leaked the secret`)
    assert.ok(!reply.body.includes('127.0.0.1'), `${path} leaked a system file`)
    assert.ok(reply.status === 404 || reply.status === 302 || reply.status === 400, `${path} answered ${reply.status}`)
  })
}

test('a malformed percent sequence is answered and does not stop the server', async (t) => {
  const port = await withServer(t)
  const bad = await get(port, '/site/%E0%A4%A')
  assert.equal(bad.status, 400)
  assert.equal((await get(port, '/site/')).status, 200, 'the server must still answer afterwards')
})
