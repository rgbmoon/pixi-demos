import { Assets, Container, Graphics, NineSliceSprite } from 'pixi.js'
import { MODAL_BG_SRC } from 'src/games/slot/assets'
import {
  MODAL_BACKDROP_ALPHA,
  MODAL_BORDER_ALPHA,
  MODAL_BORDER_COLOR,
  MODAL_DIVIDER_THICKNESS,
  MODAL_HEADER_HEIGHT,
  MODAL_NINE_SLICE,
  MODAL_PADDING,
  SCREEN_MARGIN,
} from 'src/games/slot/constants'
import { LabelColor } from 'src/games/slot/types'

import { Label } from './label'

const TITLE_SIZE = 64

/**
 * Окно поверх сцены: затемнение во всю видимую область и модальное окно с полями от её краёв.
 * Модальное окно разделено на шапку с заголовком и область содержимого; содержимое добавляется через addContent.
 */
export class Modal extends Container {
  private readonly backdrop = new Graphics()
  private readonly plate: NineSliceSprite
  private readonly divider = new Graphics()
  private readonly title: Label
  private readonly content = new Container()

  constructor(title: string) {
    super()

    // Затемнение перехватывает события указателя, HUD под модалкой их не получает
    this.backdrop.eventMode = 'static'

    this.plate = new NineSliceSprite({
      texture: Assets.get(MODAL_BG_SRC),
      leftWidth: MODAL_NINE_SLICE,
      topHeight: MODAL_NINE_SLICE,
      rightWidth: MODAL_NINE_SLICE,
      bottomHeight: MODAL_NINE_SLICE,
    })

    this.title = new Label({ color: LabelColor.white, fontSize: TITLE_SIZE, text: title })
    this.title.anchor.set(0, 0.5)

    this.addChild(this.backdrop, this.plate, this.divider, this.title, this.content)
  }

  /** Ширина плашки в дизайн-единицах; от неё считается раскладка содержимого. */
  get plateWidth(): number {
    return this.plate.width
  }

  get plateHeight(): number {
    return this.plate.height
  }

  addContent(child: Container): void {
    this.content.addChild(child)
  }

  /** Растягивает затемнение на всю видимую область, плашку — на неё же за вычетом полей. */
  layout(viewWidth: number, viewHeight: number): void {
    this.backdrop.clear().rect(0, 0, viewWidth, viewHeight).fill({ color: 0x000000, alpha: MODAL_BACKDROP_ALPHA })

    this.plate.position.set(SCREEN_MARGIN, SCREEN_MARGIN)
    this.plate.width = viewWidth - 2 * SCREEN_MARGIN
    this.plate.height = viewHeight - 2 * SCREEN_MARGIN

    this.divider
      .clear()
      .rect(this.plate.x, this.plate.y + MODAL_HEADER_HEIGHT, this.plate.width, MODAL_DIVIDER_THICKNESS)
      .fill({ color: MODAL_BORDER_COLOR, alpha: MODAL_BORDER_ALPHA })

    this.title.position.set(this.plate.x + MODAL_PADDING, this.plate.y + MODAL_HEADER_HEIGHT / 2)

    this.content.position.set(this.plate.x, this.plate.y)
  }
}
