import { afterEach, describe, expect, it, vi } from 'vitest'

import { IdbStorage } from '../src/idb-storage'

const OPTIONS = { dbName: 'test', storeName: 'values', key: 'current' }

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('IdbStorage', () => {
  it('отдаёт undefined там, где IndexedDB нет вовсе', async () => {
    const storage = new IdbStorage<number>(OPTIONS)

    await expect(storage.read()).resolves.toBeUndefined()
  })

  it('не роняет запись на окружении без IndexedDB', async () => {
    const storage = new IdbStorage<number>(OPTIONS)

    await expect(storage.write(1)).resolves.toBeUndefined()
  })

  it('переживает хранилище, которое отказывает на открытии', async () => {
    const open = vi.fn(() => {
      throw new DOMException('Access denied', 'SecurityError')
    })

    vi.stubGlobal('indexedDB', { open })

    const storage = new IdbStorage<number>(OPTIONS)

    await expect(storage.read()).resolves.toBeUndefined()
    await expect(storage.write(1)).resolves.toBeUndefined()

    // Отказавшее открытие кэшируется: база не дёргается заново на каждое обращение
    expect(open).toHaveBeenCalledTimes(1)
  })
})
