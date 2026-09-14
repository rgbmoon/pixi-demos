import { beforeAll, vi } from 'vitest'

beforeAll(() => {
  // trace-функции живут в DEV-режиме, а тесты идут именно в нём
  vi.spyOn(console, 'debug').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
