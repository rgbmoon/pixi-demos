import { configDefaults, defineConfig } from 'vitest/config'

// Тестовый пайплайн намеренно не наследует vite.config.ts: @rolldown/plugin-babel (React Compiler)
// объявлен rollup-несовместимым, а трансформ vitest — rollup-образный. Tailwind в тестах не нужен.
/** Общая часть конфигов vitest: пакет добавляет к ней свои setupFiles. */
export const sharedTestConfig = defineConfig({
  // .env общий для приложения и тестов пакетов, поэтому лежит в корне репозитория
  envDir: import.meta.dirname,
  test: {
    include: ['tests/**/*.test.ts'],
    exclude: [...configDefaults.exclude],
    // По умолчанию тесты идут в node; файл, которому нужен браузерный API, объявляет это сам
    // докблоком `// @vitest-environment jsdom` в первой строке
    environment: 'node',
    testTimeout: 10_000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/types.ts', 'src/**/tokens.ts', 'src/**/constants.ts', 'src/**/mocks/**'],
    },
  },
})
