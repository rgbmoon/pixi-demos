import { readFile } from 'node:fs/promises'

/** Является ли значение объектом: не примитивом и не `null`. */
export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

/** Есть ли у объекта числовые поля с заданными именами. */
export const hasNumbers = (value: unknown, keys: readonly string[]): boolean =>
  isRecord(value) && keys.every((key) => typeof value[key] === 'number')

/** Читает JSON; нет файла — `undefined`. */
export const readJson = async (filePath: string): Promise<unknown> => {
  try {
    return JSON.parse(await readFile(filePath, 'utf8'))
  } catch (error) {
    if (isRecord(error) && error.code === 'ENOENT') return undefined

    throw error
  }
}
