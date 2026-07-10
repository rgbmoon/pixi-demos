import { Sprite, type Texture, Application, BlurFilter, Container, type Ticker } from 'pixi.js'
import { BG_BLOBS } from 'src/constants/bg-blobs'
import { createBlobTexture } from 'src/utils/create-blob-texture'

export const mountBackground = (container: HTMLElement): (() => void) => {
  const app = new Application()

  let disposed = false
  let teardown: (() => void) | null = null

  void app
    .init({
      background: '#1e293b',
      resizeTo: container,
      antialias: false,
      resolution: 1,
      powerPreference: 'low-power',
    })
    .then(() => {
      if (disposed) {
        app.destroy(true, { children: true })

        return
      }

      container.appendChild(app.canvas)

      const texture: Texture = createBlobTexture()

      const sprites = BG_BLOBS.map((blob) => {
        const sprite = new Sprite(texture)

        sprite.anchor.set(0.5)
        sprite.tint = blob.color
        sprite.alpha = blob.alpha

        return sprite
      })

      const blobs = new Container()

      blobs.addChild(...sprites)
      blobs.filters = [new BlurFilter({ strength: 40, quality: 3, resolution: 0.5 })]

      app.stage.addChild(blobs)

      let elapsed = 0

      const layout = () => {
        const { width, height } = app.screen
        const base = Math.max(width, height)

        sprites.forEach((sprite, index) => {
          const blob = BG_BLOBS[index]

          const x = (blob.cx + blob.ax * Math.sin(elapsed * blob.sx + blob.phaseX)) * width
          const y = (blob.cy + blob.ay * Math.sin(elapsed * blob.sy + blob.phaseY)) * height
          const pulse = 1 + 0.12 * Math.sin(elapsed * blob.pulseSpeed + blob.phasePulse)
          const size = base * blob.size * pulse

          sprite.position.set(x, y)
          sprite.setSize(size, size)
        })
      }

      layout()

      const loop = (ticker: Ticker) => {
        elapsed += ticker.deltaMS / 1000
        layout()
      }

      const animate = !window.matchMedia('(prefers-reduced-motion: reduce)').matches

      if (animate) {
        app.ticker.add(loop)
      }

      teardown = () => {
        app.ticker.remove(loop)
        app.destroy(true, { children: true })
        texture.destroy(true)
      }
    })

  return () => {
    disposed = true
    teardown?.()
  }
}
