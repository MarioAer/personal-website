import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { join, extname, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { normaliseBasePath } from './build.mjs'

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.webp': 'image/webp', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8',
}

export function createStaticServer({ root, basePath }) {
  const base = normaliseBasePath(basePath)
  return createServer(async (request, response) => {
    const url = new URL(request.url, 'http://localhost')
    if (!url.pathname.startsWith(base)) {
      response.writeHead(302, { location: base })
      response.end()
      return
    }
    let relativePath = normalize(decodeURIComponent(url.pathname.slice(base.length))).replace(/^(\.\.(\/|$))+/, '')
    let filePath = join(root, relativePath)
    try {
      if ((await stat(filePath)).isDirectory()) filePath = join(filePath, 'index.html')
    } catch {
      // fall through to the 404 handler
    }
    try {
      const body = await readFile(filePath)
      response.writeHead(200, { 'content-type': TYPES[extname(filePath)] ?? 'application/octet-stream', 'cache-control': 'no-store' })
      response.end(body)
    } catch {
      try {
        response.writeHead(404, { 'content-type': 'text/html; charset=utf-8' })
        response.end(await readFile(join(root, '404.html')))
      } catch {
        response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
        response.end('Not found')
      }
    }
  })
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (invokedDirectly) {
  const port = Number(process.env.PORT ?? 4173)
  const root = join(fileURLToPath(new URL('..', import.meta.url)), 'dist')
  const base = normaliseBasePath(process.env.BASE_PATH)
  createStaticServer({ root, basePath: base }).listen(port, () => {
    console.log(`Serving dist at http://localhost:${port}${base}`)
  })
}
