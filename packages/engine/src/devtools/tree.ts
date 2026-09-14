import type { TreeExtension } from '@pixi/devtools'

import { getBatchBreakReason, isOwnRenderPass } from './utils'

/**
 * Расширение дерева сцены: подписывает узлы, на которых рендерер разрывает батч.
 * Счётчик из панели Stats говорит сколько, суффикс в дереве — кто и почему.
 */
export const createGpuTree = (): TreeExtension => ({
  extension: { type: 'sceneTree', name: 'gpu-tree' },

  updateNodeMetadata(node, metadata) {
    const reason = getBatchBreakReason(node) ?? (isOwnRenderPass(node) ? 'render pass' : undefined)

    return reason ? { ...metadata, suffix: reason } : metadata
  },
})
