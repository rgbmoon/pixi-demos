/// <reference types="vite/client" />
/// <reference types="vite-plugin-svgr/client" />

interface ImportMetaEnv {
  readonly VITE_WS_URL: string
  readonly VITE_USE_MOCKS?: string
}
