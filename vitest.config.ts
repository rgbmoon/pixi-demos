import { fileURLToPath } from 'node:url'

import { configDefaults, defineConfig } from 'vitest/config'

// Тестовый пайплайн намеренно не наследует vite.config.ts: @rolldown/plugin-babel (React Compiler)
// объявлен rollup-несовместимым, а трансформ vitest — rollup-образный. Tailwind в тестах не нужен.
export default defineConfig({
  resolve: {
    alias: { src: fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    // Спеки Playwright (*.spec.ts) лежат рядом, но выполняются отдельным раннером
    include: ['tests/**/*.test.ts'],
    exclude: [...configDefaults.exclude],
    // По умолчанию тесты идут в node; файл, которому нужен браузерный API, объявляет это сам
    // докблоком `// @vitest-environment jsdom` в первой строке
    environment: 'node',
    setupFiles: ['./tests/setup/hooks.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/types.ts', 'src/**/tokens.ts', 'src/**/constants.ts', 'src/main.tsx'],
    },
  },
})
