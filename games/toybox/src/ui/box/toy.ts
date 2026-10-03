import { Assets, Container, Graphics, Sprite, type Spritesheet, type Texture } from 'pixi.js'

import { TOY_SEQUENCES, TOYS_ATLAS } from '#src/assets'
import { ART_PIXEL } from '#src/constants'
import type { ShapeKey, WorldPoint } from '#src/types'
import type { ToyShapes } from '#src/ui/box/toy-shapes'
import { snapToArtPixel, worldToScreen } from '#src/utils/projection'
import { getAngleStep } from '#src/utils/shapes'

/**
 * Игрушка в куче. Форма с кадрами в атласе игрушек рисуется спрайтом кадра крена, подсветка — обводкой той же позы;
 * остальные формы — силуэтом из общих кэшированных контекстов геометрии. Крен выбирает кадр или контекст ближайшего
 * шага угла.
 *
 * Силуэт повторяет коллайдер формы из каталога.
 * TODO Когда форма получит спрайт, коллайдер можно строить по
 * выпуклой оболочке непрозрачных пикселей спрайта: силуэт и физика совпадут без ручной подгонки.
 *
 * Методы не меняют PIXI-объекты при повторе прежних значений.
 */
export class Toy extends Container {
  private readonly shapes: ToyShapes
  private readonly body = new Graphics()
  private readonly sprite = new Sprite()
  private readonly outline = new Sprite()
  private shape: ShapeKey
  private variant: number
  /** Кадры крена формы и обводка подсветки тех же поз; у формы без арта — `undefined`. */
  private frames: readonly Texture[] | undefined
  private outlineFrames: readonly Texture[] | undefined
  private step = 0
  private highlighted = false

  constructor(shapes: ToyShapes, shape: ShapeKey, variant: number, color: number) {
    super()

    this.shapes = shapes
    this.shape = shape
    this.variant = variant
    this.body.tint = color
    this.sprite.scale.set(ART_PIXEL)
    this.outline.scale.set(ART_PIXEL)

    this.addChild(this.body, this.outline, this.sprite)
    this.loadFrames()
    this.refresh()
  }

  /** Переиспользует экземпляр для другой формы и цвета, без крена. Цвет получает только силуэт. */
  setAppearance(shape: ShapeKey, variant: number, color: number): void {
    this.shape = shape
    this.variant = variant
    this.step = 0
    this.body.tint = color
    this.loadFrames()
    this.refresh()
  }

  /** Ставит центр в мировую точку и поворачивает игрушку на крен. */
  setPose(point: WorldPoint, angle: number): void {
    const screen = snapToArtPixel(worldToScreen(point))
    const step = getAngleStep(angle)

    this.position.set(screen.x, screen.y)
    if (step !== this.step) {
      this.step = step
      this.refresh()
    }
  }

  /** Помечает игрушку как цель клешни. */
  setHighlighted(highlighted: boolean): void {
    if (highlighted === this.highlighted) return

    this.highlighted = highlighted
    this.refresh()
  }

  private refresh(): void {
    const { frames, outlineFrames, step, highlighted } = this

    this.body.visible = !frames
    this.sprite.visible = frames !== undefined
    this.outline.visible = frames !== undefined && highlighted

    if (!frames) {
      this.body.context = this.shapes.get(this.shape, this.variant, step, highlighted)

      return
    }

    Toy.showFrame(this.sprite, frames[step])
    if (highlighted && outlineFrames) Toy.showFrame(this.outline, outlineFrames[step])
  }

  /** Берёт из атласа игрушек кадры текущей формы в её положении. */
  private loadFrames(): void {
    const sequences = TOY_SEQUENCES[this.shape]?.[this.variant]

    if (!sequences) {
      this.frames = undefined
      this.outlineFrames = undefined

      return
    }

    const { animations } = Assets.get<Spritesheet>(TOYS_ATLAS)

    this.frames = animations[sequences.body]
    this.outlineFrames = animations[sequences.outline]
  }

  /** Ставит спрайту кадр и якорь кадра: у кадров одной последовательности якоря разные. */
  private static showFrame(sprite: Sprite, texture: Texture): void {
    sprite.texture = texture
    if (texture.defaultAnchor) sprite.anchor.copyFrom(texture.defaultAnchor)
  }
}
