/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_INDEX_API_URL?: string;
  readonly VITE_USE_DEV_SAME_ORIGIN_PROXY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
