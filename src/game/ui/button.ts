import { Assets, Rectangle, Sprite, type Texture } from 'pixi.js'

import { LiveContainer } from './live-container'

export const ButtonSize = {
  md: 'md',
  lg: 'lg',
} as const

export type ButtonSize = (typeof ButtonSize)[keyof typeof ButtonSize]

interface BaseButtonOptions {
  size: ButtonSize
  icon: string
}

const ASSETS_DIR = '/src/assets/game/graphic/AL_Gamble_buttons'

const SIZE_PRESETS: Record<ButtonSize, { px: number; normal: string; active: string }> = {
  md: {
    px: 61,
    normal: `${ASSETS_DIR}/button-bg.png`,
    active: `${ASSETS_DIR}/button-bg-active.png`,
  },
  lg: {
    px: 91.5,
    normal: `${ASSETS_DIR}/button-bg-lg.png`,
    active: `${ASSETS_DIR}/button-bg-active-lg.png`,
  },
}

// Доля стороны подложки, которую занимает иконка
const ICON_RATIO = 0.6

/**
 * База кнопок сцены: спрайт-подложка с обычным и active-состоянием,
 * размер задаётся пресетом, SVG-иконка по центру.
 * Наследники добавляют содержимое и поведение.
 */
export class Button extends LiveContainer {
  readonly sizePx: number

  private readonly background = new Sprite()
  private readonly icon = new Sprite()
  private textures: { normal: Texture; active: Texture } | null = null
  private isActive = false
  private iconSrc: string | null = null

  constructor(options: BaseButtonOptions) {
    super()

    const preset = SIZE_PRESETS[options.size]

    this.sizePx = preset.px
    this.boundsArea = new Rectangle(0, 0, preset.px, preset.px)

    this.icon.anchor.set(0.5)
    this.icon.position.set(preset.px / 2, preset.px / 2)

    this.addChild(this.background, this.icon)

    this.eventMode = 'static'
    this.cursor = 'pointer'

    void this.loadBackgrounds(preset.normal, preset.active)
    void this.setIcon(options.icon)
  }

  /** Переключает подложку между обычным и active-состоянием. */
  get active(): boolean {
    return this.isActive
  }

  set active(value: boolean) {
    if (this.isActive === value) return

    this.isActive = value
    this.applyBackground()
  }

  /** Меняет иконку кнопки; из параллельных вызовов применяется последний. */
  protected async setIcon(src: string): Promise<void> {
    this.iconSrc = src

    const texture = await Assets.load<Texture>(src)

    if (this.destroyed || this.iconSrc !== src) return

    this.icon.texture = texture
    this.icon.setSize(this.sizePx * ICON_RATIO)
  }

  private async loadBackgrounds(normalSrc: string, activeSrc: string): Promise<void> {
    const [normal, active] = await Promise.all([Assets.load<Texture>(normalSrc), Assets.load<Texture>(activeSrc)])

    if (this.destroyed) return

    this.textures = { normal, active }
    this.applyBackground()
  }

  private applyBackground(): void {
    if (!this.textures) return

    this.background.texture = this.isActive ? this.textures.active : this.textures.normal
    this.background.setSize(this.sizePx, this.sizePx)
  }
}
