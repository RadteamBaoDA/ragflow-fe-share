/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BASE_URL?: string;
  readonly VITE_EXTERNAL_TRACE_API_URL?: string;
  readonly VITE_EXTERNAL_TRACE_URL?: string;
  readonly VITE_EXTERNAL_TRACE_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
