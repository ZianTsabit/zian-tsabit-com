/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Base URL of the Django API, including the /api prefix. Falls back to
   * http://localhost:8000/api when unset.
   */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
