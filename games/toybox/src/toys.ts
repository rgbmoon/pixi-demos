import { TOY_SPECS } from '#src/toy-specs'
import type { ToyKey } from '#src/types'

/**
 * Ключи каталога игрушек для перебора при наполнении. Сечение, глубину в срезах и вес каждой игрушки пишет по её арту
 * `pnpm toys` в `TOY_SPECS`.
 */
export const TOY_KEYS = Object.keys(TOY_SPECS) as ToyKey[]
