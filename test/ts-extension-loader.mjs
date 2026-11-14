import { extname } from 'node:path'

export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'cloudflare:sockets') {
    return {
      url: 'data:text/javascript,export%20const%20connect%20%3D%20globalThis.__uptimeflareSocketsConnect',
      shortCircuit: true,
    }
  }
  if (specifier.startsWith('.') && !extname(specifier)) {
    try {
      return await nextResolve(`${specifier}.ts`, context)
    } catch {
      // Let Node's normal resolver produce the useful error for non-TS imports.
    }
  }
  return nextResolve(specifier, context)
}
