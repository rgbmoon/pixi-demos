import { traceError } from './errors/utils'
import type { IdbStorageOptions } from './types'

/** Версия схемы базы: растёт, когда меняется состав её сторов. */
const DB_VERSION = 1

/**
 * Хранилище одного значения в IndexedDB. Адрес приходит опциями, схему значения знает вызывающий:
 * `read` отдаёт `unknown`.
 *
 * Недоступное хранилище (приватный режим, квота, окружение без IndexedDB) не считается сбоем:
 * чтение возвращает `undefined`, запись пропускается, ошибка передаётся только в `traceError`.
 */
export class IdbStorage<T> {
  private readonly options: IdbStorageOptions
  private connection?: Promise<IDBDatabase | undefined>

  constructor(options: IdbStorageOptions) {
    this.options = options
  }

  /** Читает значение; `undefined` означает и пустое хранилище, и недоступное. */
  async read(): Promise<unknown> {
    const database = await this.open()

    if (!database) return undefined

    try {
      // Транзакция и запрос создаются одним синхронным ходом: await между ними дал бы ей закрыться
      return await this.toPromise(this.getStore(database, 'readonly').get(this.options.key))
    } catch (error) {
      traceError?.(error, `Failed to read "${this.options.key}" from IndexedDB`)

      return undefined
    }
  }

  /** Пишет значение поверх прежнего. */
  async write(value: T): Promise<void> {
    const database = await this.open()

    if (!database) return

    try {
      await this.toPromise(this.getStore(database, 'readwrite').put(value, this.options.key))
    } catch (error) {
      traceError?.(error, `Failed to write "${this.options.key}" to IndexedDB`)
    }
  }

  private getStore(database: IDBDatabase, mode: IDBTransactionMode): IDBObjectStore {
    return database.transaction(this.options.storeName, mode).objectStore(this.options.storeName)
  }

  private open(): Promise<IDBDatabase | undefined> {
    this.connection ??= this.connect()

    return this.connection
  }

  private async connect(): Promise<IDBDatabase | undefined> {
    const { indexedDB } = globalThis

    if (!indexedDB) return undefined

    try {
      const request = indexedDB.open(this.options.dbName, DB_VERSION)

      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(this.options.storeName)) {
          request.result.createObjectStore(this.options.storeName)
        }
      }

      return await this.toPromise(request)
    } catch (error) {
      traceError?.(error, `Failed to open IndexedDB "${this.options.dbName}"`)

      return undefined
    }
  }

  private toPromise<R>(request: IDBRequest<R>): Promise<R> {
    return new Promise<R>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'))
    })
  }
}
