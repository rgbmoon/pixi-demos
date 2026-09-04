import { Assets, Rectangle, Sprite, type Texture } from 'pixi.js'

import { BUTTON_BACKINGS } from '../assets'
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

// Сторона подложки в дизайн-единицах макета
const SIZE_UNITS: Record<ButtonSize, number> = {
  md: 130,
  lg: 260,
}

// Доля стороны подложки, которую занимает иконка
const ICON_RATIO = 0.5

// Прозрачность погашенной кнопки
const DISABLED_ALPHA = 0.7

/**
 * База кнопок сцены: спрайт-подложка с обычным и active-состоянием,
 * размер задаётся пресетом, SVG-иконка по центру.
 * Наследники добавляют содержимое и поведение.
 */
export class Button extends LiveContainer {
  /** Сторона кнопки в дизайн-единицах: по ней сцена расставляет ряд управления. */
  readonly sizeUnits: number

  private readonly background = new Sprite()
  private readonly icon = new Sprite()
  private readonly textures: { normal: Texture; active: Texture }
  private isActive = false

  constructor(options: BaseButtonOptions) {
    super()

    const size = SIZE_UNITS[options.size]

    this.sizeUnits = size
    this.boundsArea = new Rectangle(0, 0, size, size)

    this.icon.anchor.set(0.5)
    this.icon.position.set(size / 2, size / 2)

    this.addChild(this.background, this.icon)

    this.eventMode = 'static'
    this.cursor = 'pointer'

    const backing = BUTTON_BACKINGS[options.size][options.variant]

    this.textures = { normal: Assets.get(backing.normal), active: Assets.get(backing.active) }
    this.applyBackground()
    this.setIcon(options.icon, options.iconRatio)
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

  /** Включает или гасит кнопку: снимает интерактивность и притеняет подложку. */
  protected setEnabled(enabled: boolean): void {
    this.eventMode = enabled ? 'static' : 'none'
    this.cursor = enabled ? 'pointer' : 'default'
    this.alpha = enabled ? 1 : DISABLED_ALPHA
  }

  /** Меняет иконку кнопки из кэша Assets. */
  protected setIcon(src: string, iconRatio?: number): void {
    this.icon.texture = Assets.get(src)
    this.icon.setSize(this.sizeUnits * (iconRatio ?? ICON_RATIO))
  }

  private applyBackground(): void {
    this.background.texture = this.isActive ? this.textures.active : this.textures.normal
    this.background.setSize(this.sizeUnits, this.sizeUnits)
  }
}
