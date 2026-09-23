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

it.each(['complete', 'abort'] as const)('завершает запись по событию транзакции %s', async (event) => {
  const request = { onsuccess: undefined as (() => void) | undefined, result: undefined as unknown }
  const put = vi.fn()
  const transaction = {
    objectStore: () => ({ put }),
    oncomplete: undefined as (() => void) | undefined,
    onabort: undefined as (() => void) | undefined,
    error: new DOMException('Transaction aborted', 'AbortError'),
  }
  request.result = { transaction: () => transaction }
  vi.stubGlobal('indexedDB', { open: () => request })
  const storage = new IdbStorage<number>(OPTIONS)
  let finished = false
  const write = async () => { await storage.write(1); finished = true }
  const pending = write()
  request.onsuccess?.()
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()

  expect(put).toHaveBeenCalledWith(1, OPTIONS.key)
  expect(finished).toBe(false)
  if (event === 'complete') transaction.oncomplete?.()
  else transaction.onabort?.()
  await pending
  expect(finished).toBe(true)
})
