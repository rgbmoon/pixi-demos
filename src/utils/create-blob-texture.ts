import { Texture } from 'pixi.js'

export const createBlobTexture = (): Texture => {
  const blobTextureSize = 512
  const canvas = document.createElement('canvas')

  canvas.width = blobTextureSize
  canvas.height = blobTextureSize

  const ctx = canvas.getContext('2d')

  if (!ctx) {
    throw new Error('createBlobTexture: 2d context недоступен')
  }

  const radius = blobTextureSize / 2
  const gradient = ctx.createRadialGradient(radius, radius, 0, radius, radius, radius)

  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)')
  gradient.addColorStop(0.25, 'rgba(255, 255, 255, 0.72)')
  gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.34)')
  gradient.addColorStop(0.75, 'rgba(255, 255, 255, 0.09)')
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)')

  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, blobTextureSize, blobTextureSize)

  return Texture.from(canvas)
}
