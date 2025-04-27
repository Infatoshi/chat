interface ImportMetaEnv {
  readonly VITE_OPENROUTER_API_KEY: string
  readonly VITE_SITE_URL: string
  readonly VITE_SITE_NAME: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

export const env = {
  OPENROUTER_API_KEY: import.meta.env.VITE_OPENROUTER_API_KEY,
  SITE_URL: import.meta.env.VITE_SITE_URL || 'http://localhost:1420',
  SITE_NAME: import.meta.env.VITE_SITE_NAME || 'Tauri Chat'
}; 