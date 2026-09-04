import { Assets, Rectangle, Sprite, type Texture } from 'pixi.js'
import { LiveContainer } from 'src/engine/live-container'
import { BUTTON_BACKINGS } from 'src/games/slot/assets'
import { BUTTON_SIZE_UNITS, ICON_RATIO, DISABLED_ALPHA } from 'src/games/slot/constants'
import type { ButtonOptions } from 'src/games/slot/types'

/**
 * Кнопка сцены: спрайт-подложка с обычным и active-состоянием, SVG-иконка по центру.
 * Размер задаётся пресетом, арт берётся из манифеста игры.
 */
export class Button extends LiveContainer {
  /** Сторона кнопки в дизайн-единицах: по ней сцена расставляет ряд управления. */
  readonly sizeUnits: number

  private readonly background = new Sprite()
  private readonly icon = new Sprite()
  private readonly textures: { normal: Texture; active: Texture }
  private isActive = false

  constructor(options: ButtonOptions) {
    super()

    const sizeUnits = BUTTON_SIZE_UNITS[options.size]
    const backing = BUTTON_BACKINGS[options.size][options.variant]

    this.sizeUnits = sizeUnits
    this.boundsArea = new Rectangle(0, 0, sizeUnits, sizeUnits)

    this.icon.anchor.set(0.5)
    this.icon.position.set(sizeUnits / 2, sizeUnits / 2)

    this.addChild(this.background, this.icon)

    this.eventMode = 'static'
    this.cursor = 'pointer'

    if (options.onTap) {
      this.on('pointertap', options.onTap)
    }

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
  setEnabled(enabled: boolean): void {
    this.eventMode = enabled ? 'static' : 'none'
    this.cursor = enabled ? 'pointer' : 'default'
    this.alpha = enabled ? 1 : DISABLED_ALPHA
  }

  /** Меняет иконку кнопки из кэша Assets. */
  setIcon(src: string, iconRatio?: number): void {
    this.icon.texture = Assets.get(src)
    this.icon.setSize(this.sizeUnits * (iconRatio ?? ICON_RATIO))
  }

  private applyBackground(): void {
    this.background.texture = this.isActive ? this.textures.active : this.textures.normal
    this.background.setSize(this.sizeUnits, this.sizeUnits)
  }
}
