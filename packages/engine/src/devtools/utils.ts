import type { Container, TextureSource } from 'pixi.js'
import { Texture } from 'pixi.js'

/**
 * Источник текстуры узла, если он вообще рисует текстуру: спрайты, тайлы, меши, текст.
 * Источник, а не текстура: батч собирается по загруженному в GPU изображению, а не по кадру атласа.
 */
export const getTextureSource = (node: Container): TextureSource | undefined => {
  if (!('texture' in node)) {
    return undefined
  }

  const { texture } = node

  return texture instanceof Texture ? texture.source : undefined
}

/** Причина, по которой узел разрывает батч: рендерер сбрасывает набранную пачку и начинает новую. */
export const getBatchBreakReason = (node: Container): string | undefined => {
  if (node.filters?.length) {
    return 'filter'
  }

  if (node.mask) {
    return 'mask'
  }

  // blendMode — это localBlendMode: у нетронутого узла он 'inherit', то есть режим родителя
  if (node.blendMode !== 'inherit' && node.blendMode !== 'normal') {
    return node.blendMode
  }

  return undefined
}

/** Узел рисуется отдельным проходом рендерера: своя render-группа или кэш в текстуру. */
export const isOwnRenderPass = (node: Container): boolean => node.isRenderGroup || node.isCachedAsTexture
