import { Sprite, Application, Container, Texture, type Ticker } from 'pixi.js'
import { BG_BLOBS, BG_SPAWN_DURATION } from 'src/constants/bg-blobs'

const PULSE_AMPLITUDE = 0.25

const wander = (elapsed: number, speed: number, phase: number): number =>
  0.7 * Math.sin(elapsed * speed + phase) + 0.3 * Math.sin(elapsed * speed * 1.7 + phase * 2)

const spawnFinishedAt = BG_SPAWN_DURATION + Math.max(...BG_BLOBS.map((blob) => blob.spawnDelay))

const easeOutCubic = (t: number): number => 1 - (1 - t) ** 3

const easeOutBack = (t: number): number => {
  const c1 = 1.70158
  const c3 = c1 + 1

  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2
}

const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max)

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

export const mountBackground = (container: HTMLElement): (() => void) => {
  const app = new Application()

  let disposed = false
  let teardown: (() => void) | null = null

  const setup = async (): Promise<void> => {
    await app.init({
      background: '#1e293b',
      resizeTo: container,
      antialias: false,
      resolution: 1,
      powerPreference: 'low-power',
    })

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
      sprite.alpha = 0

      return sprite
    })

    const blobs = new Container()

    blobs.addChild(...sprites)

    app.stage.addChild(blobs)

    let elapsed = 0

    const layout = (time: number) => {
      const { width, height } = app.screen
      const base = Math.max(width, height)

      sprites.forEach((sprite, index) => {
        const blob = BG_BLOBS[index]

        const spawn = clamp((time - blob.spawnDelay) / BG_SPAWN_DURATION, 0, 1)

        const x = (blob.cx + blob.ax * wander(time, blob.sx, blob.phaseX)) * width
        const y = (blob.cy + blob.ay * wander(time, blob.sy, blob.phaseY)) * height
        const pulse = 1 + PULSE_AMPLITUDE * Math.sin(time * blob.pulseSpeed + blob.phasePulse)
        const size = base * blob.size * pulse * easeOutBack(spawn)

        sprite.position.set(x, y)
        sprite.setSize(size, size)
        sprite.alpha = blob.alpha * easeOutCubic(spawn)
      })
    }

    const loop = (ticker: Ticker) => {
      elapsed += ticker.deltaMS / 1000
      layout(elapsed)
    }

    const animate = !window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (animate) {
      layout(0)
      app.ticker.add(loop)
    } else {
      layout(spawnFinishedAt)
    }

    teardown = () => {
      app.ticker.remove(loop)
      app.destroy(true, { children: true })
      texture.destroy(true)
    }
  }

  void setup()

  return () => {
    disposed = true
    teardown?.()
  }
}
