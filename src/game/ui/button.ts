import { Assets, Rectangle, Sprite, type Texture } from 'pixi.js'

import { LiveContainer } from './live-container'

export const ButtonSize = {
  md: 'md',
  lg: 'lg',
} as const

export type ButtonSize = (typeof ButtonSize)[keyof typeof ButtonSize]

export const ButtonVariant = {
  romb: 'romb',
  circle: 'circle',
} as const

export type ButtonVariant = (typeof ButtonVariant)[keyof typeof ButtonVariant]

interface BaseButtonOptions {
  variant: ButtonVariant
  size: ButtonSize
  icon: string
  iconRatio?: number
}

const ASSETS_DIR = '/src/assets/game/graphic/AL_Gamble_buttons'

const SIZE_PRESETS: Record<
  ButtonSize,
  {
    px: number
    [ButtonVariant.romb]: {
      normal: string
      active: string
    }
    [ButtonVariant.circle]: {
      normal: string
      active: string
    }
  }
> = {
  md: {
    px: 65,
    [ButtonVariant.romb]: {
      normal: `${ASSETS_DIR}/button-romb-bg.svg`,
      active: `${ASSETS_DIR}/button-romb-bg-active.svg`,
    },
    [ButtonVariant.circle]: {
      normal: `${ASSETS_DIR}/button-circle-bg.svg`,
      active: `${ASSETS_DIR}/button-circle-bg-active.svg`,
    },
  },
  lg: {
    px: 130,
    [ButtonVariant.romb]: {
      normal: `${ASSETS_DIR}/button-romb-bg-lg.svg`,
      active: `${ASSETS_DIR}/button-romb-bg-active-lg.svg`,
    },
    [ButtonVariant.circle]: {
      normal: `${ASSETS_DIR}/button-circle-bg-lg.svg`,
      active: `${ASSETS_DIR}/button-circle-bg-active-lg.svg`,
    },
  },
}

// Доля стороны подложки, которую занимает иконка
const ICON_RATIO = 0.5

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

    void this.loadBackgrounds(preset[options.variant].normal, preset[options.variant].active)
    void this.setIcon(options.icon, options.iconRatio)
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
  protected async setIcon(src: string, iconRatio?: number): Promise<void> {
    this.iconSrc = src

    const texture = await Assets.load<Texture>(src)

    if (this.destroyed || this.iconSrc !== src) return

    this.icon.texture = texture
    this.icon.setSize(this.sizePx * (iconRatio ?? ICON_RATIO))
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
