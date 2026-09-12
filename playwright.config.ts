import { defineConfig, devices } from '@playwright/test'

const PORT = 4173
const BASE_URL = `http://localhost:${PORT}`
const isCI = !!process.env.CI

export default defineConfig({
  testDir: './tests',
  // Только спеки: рядом лежат тесты vitest, и без этого Playwright забрал бы и их
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
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    // На runner'е нет GPU: Chrome сам на программный SwiftShader не переключается, а без WebGL
    // не поднимается PIXI. Флаг --enable-unsafe-swiftshader ослабляет защиту от кода страницы; для тестов это безопасно.
    launchOptions: isCI ? { args: ['--enable-unsafe-swiftshader'] } : {},
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npx vite preview --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: !isCI,
    timeout: 120_000,
  },
})
