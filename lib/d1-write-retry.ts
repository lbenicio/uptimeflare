const MAX_ATTEMPTS = 5
const RETRYABLE_ERRORS = [
  'Network connection lost',
  'storage caused object to be reset',
  'reset because its code was updated',
  'Cannot resolve D1 DB due to transient issue on remote node',
  'D1 DB is overloaded',
]

function isRetryableError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return RETRYABLE_ERRORS.some((retryableMessage) => message.includes(retryableMessage))
}

function retryDelayMs(retryNumber: number): number {
  const exponentialDelay = Math.min(100 * 2 ** (retryNumber - 1), 1600)
  return exponentialDelay + Math.floor(Math.random() * 100)
}

export async function retryD1Write<T>(operation: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await operation()
    } catch (error) {
      if (attempt >= MAX_ATTEMPTS || !isRetryableError(error)) throw error

      const delayMs = retryDelayMs(attempt)
      console.warn(
        `Transient D1 state write failure; retrying attempt ${attempt + 1}/${MAX_ATTEMPTS} in ${delayMs}ms.`
      )
      await new Promise<void>((resolve) => setTimeout(resolve, delayMs))
    }
  }
}
