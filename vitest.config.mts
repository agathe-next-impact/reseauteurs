import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  // Alias explicites : `tsconfig.json` exclut `tests/` (pour tenir `tests/` hors du
  // périmètre de `tsc --noEmit` / `next build`), ce qui empêche vite-tsconfig-paths
  // d'appliquer les mappings `@/*` aux fichiers de test → les specs échouaient à
  // l'import. On restaure la résolution ici, côté runner uniquement.
  resolve: {
    alias: {
      '@payload-config': fileURLToPath(new URL('./src/payload.config.ts', import.meta.url)),
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['tests/int/**/*.int.spec.ts'],
  },
})
