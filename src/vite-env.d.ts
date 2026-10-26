/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base do proxy dos dados do TSE; vazio = direto no TSE. */
  readonly VITE_TSE_PROXY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
