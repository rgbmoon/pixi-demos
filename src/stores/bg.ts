import { makeAutoObservable, runInAction } from 'mobx'
import { Sprite, type Texture, Application, BlurFilter, Container, type Ticker } from 'pixi.js'
import { BG_BLOBS } from 'src/constants/bg-blobs'
import { createBlobTexture } from 'src/utils/create-blob-texture'

export class BgStore {
  isReady = false

  private app: Application | null = null
  private texture: Texture | null = null
  private sprites: Sprite[] = []
  private elapsed = 0
  private pending: Application | null = null

  constructor() {
    makeAutoObservable<this, 'app' | 'texture' | 'sprites' | 'elapsed' | 'pending'>(this, {
      app: false,
      texture: false,
      sprites: false,
      elapsed: false,
      pending: false,
    })
  }

  private loop = (ticker: Ticker) => {
    this.elapsed += ticker.deltaMS / 1000
    this.layout()
  }

  private layout() {
    if (!this.app) return

    const { width, height } = this.app.screen
    const base = Math.max(width, height)
    const time = this.elapsed

    this.sprites.forEach((sprite, index) => {
      const blob = BG_BLOBS[index]

      const x = (blob.cx + blob.ax * Math.sin(time * blob.sx + blob.phaseX)) * width
      const y = (blob.cy + blob.ay * Math.sin(time * blob.sy + blob.phaseY)) * height
      const pulse = 1 + 0.12 * Math.sin(time * blob.pulseSpeed + blob.phasePulse)
      const size = base * blob.size * pulse

      sprite.position.set(x, y)
      sprite.setSize(size, size)
    })
  }

  async mount(container: HTMLElement) {
    if (this.pending) {
      return
    }

    const app = new Application()

    this.pending = app

    await app.init({
      background: '#1e293b',
      resizeTo: container,
      antialias: false,
      resolution: 1,
      powerPreference: 'low-power',
    })

    if (this.pending !== app) {
      app.destroy(true, { children: true })

      return
    }

    container.appendChild(app.canvas)

    const texture = createBlobTexture()

    this.app = app
    this.texture = texture
    this.sprites = BG_BLOBS.map((blob) => {
      const sprite = new Sprite(texture)

      sprite.anchor.set(0.5)
      sprite.tint = blob.color
      sprite.alpha = blob.alpha

      return sprite
    })

    const blobs = new Container()

    blobs.addChild(...this.sprites)
    blobs.filters = [new BlurFilter({ strength: 40, quality: 3, resolution: 0.5 })]

    app.stage.addChild(blobs)

    this.layout()

    runInAction(() => {
      this.isReady = true
    })

    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      app.ticker.add(this.loop)
    }
  }

  unmount() {
    this.pending = null
    this.isReady = false

    if (this.app) {
      this.app.ticker.remove(this.loop)
      this.app.destroy(true, { children: true })
      this.app = null
    }

    this.texture?.destroy(true)
    this.texture = null
    this.sprites = []
    this.elapsed = 0
  }
}

export const bgStore = new BgStore()
