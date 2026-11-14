import { extname } from 'node:path'

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('.') && !extname(specifier)) {
    try {
      return await nextResolve(`${specifier}.ts`, context)
    } catch {
      // Let Node's normal resolver produce the useful error for non-TS imports.
    }
  }
  return nextResolve(specifier, context)
}
