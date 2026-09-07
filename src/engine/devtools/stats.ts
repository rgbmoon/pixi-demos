import type { StatsExtension } from '@pixi/devtools'
import type { Container, TextureSource } from 'pixi.js'

import { GPU_STATS } from './constants'
import { getBatchBreakReason, getTextureSource, isOwnRenderPass } from './utils'

/**
 * Расширение панели Stats: считает по сцене то, из чего рендерер собирает дроуколлы —
 * уникальные источники текстур, узлы с разрывом батча и отдельные проходы рендера.
 */
export const createGpuStats = (): StatsExtension => {
  // Уникальность источников нужна на весь обход сцены, а track зовётся по узлу за раз
  const sources = new Set<TextureSource>()

  return {
    extension: { type: 'stats', name: 'gpu-stats' },

    track(node: Container, state: Record<string, number>) {
      // Панель заводит новый state на каждый обход: незаполненный ключ и есть его начало
      if (state[GPU_STATS.textures] === undefined) {
        sources.clear()

        state[GPU_STATS.textures] = 0
        state[GPU_STATS.batchBreaks] = 0
        state[GPU_STATS.renderPasses] = 0
      }

      // Флаги проверяются у самого узла: скрытый родитель здесь не виден, счёт будет с запасом
      if (!node.visible || !node.renderable) {
        return
      }

      const source = getTextureSource(node)

      if (source) {
        sources.add(source)

        state[GPU_STATS.textures] = sources.size
      }

      if (getBatchBreakReason(node)) {
        state[GPU_STATS.batchBreaks] += 1
      }

      if (isOwnRenderPass(node)) {
        state[GPU_STATS.renderPasses] += 1
      }
    },

    getKeys: () => [GPU_STATS.textures, GPU_STATS.batchBreaks, GPU_STATS.renderPasses],
  }
}
