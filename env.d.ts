declare global {
  namespace NodeJS {
    interface ProcessEnv {
      UPTIMEFLARE_DB: D1Database
    }
  }
}

export {}
