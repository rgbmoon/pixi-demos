import path from 'node:path'

import { defineConfig, devices, type PlaywrightTestConfig } from '@playwright/test'

const isCI = !!process.env.CI

/** Каталог приложения: e2e всех пакетов запускаются на его сборке. */
const WEB_DIR = path.resolve(import.meta.dirname, 'web')

/**
 * Конфиг Playwright для пакета со спеками в `e2e/`. Порт у каждого пакета свой: при одном запуске
 * turbo задачи e2e нескольких пакетов запускают отдельные серверы превью.
 */
export const createE2eConfig = (port: number): PlaywrightTestConfig => {
  const baseURL = `http://localhost:${port}`

  return defineConfig({
    testDir: './e2e',
    testMatch: '**/*.spec.ts',
    // Бутстрап игры и раунд ждут до 30 с каждый: дефолтные 30 с на тест не вмещают их вместе
    timeout: 60_000,
    fullyParallel: true,
    forbidOnly: isCI,
    retries: isCI ? 2 : 0,
    // На CI прогон последовательный: каждый тест держит свой WebGL-контекст на программном рендерере
    workers: isCI ? 1 : undefined,
    reporter: isCI ? [['github'], ['html', { open: 'never' }]] : [['list']],
    use: {
      baseURL,
      trace: 'retain-on-failure',
      // На runner'е нет GPU: Chrome сам на программный SwiftShader не переключается, а без WebGL
      // не поднимается PIXI. Флаг --enable-unsafe-swiftshader ослабляет защиту от кода страницы; для тестов это безопасно.
      launchOptions: isCI ? { args: ['--enable-unsafe-swiftshader'] } : {},
    },
    projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
    // Сборку перед e2e запускает `pnpm e2e`. В графе turbo задача e2e от сборки не зависит: хэш
    // сборки меняется при правке любой игры
    webServer: {
      command: `pnpm exec vite preview --port ${port} --strictPort`,
      cwd: WEB_DIR,
      url: baseURL,
      reuseExistingServer: !isCI,
      timeout: 120_000,
    },
  })
}
