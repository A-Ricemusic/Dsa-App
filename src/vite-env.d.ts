/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly CONVEX_URL?: string;
  readonly WORKOS_CLIENT_ID?: string;
  readonly WORKOS_REDIRECT_URI?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
