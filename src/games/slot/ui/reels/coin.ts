import { Assets, Sprite } from 'pixi.js'
import type { CellView } from 'src/engine/reels/types'
import { SpineAnimation } from 'src/engine/spine-animation'
import type { SpinePool } from 'src/engine/spine-pool'
import { SYMBOL_SPRITES } from 'src/games/slot/assets'
import {
  COIN_VALUE_FONT_SIZE,
  COIN_VALUE_STROKE,
  HOLD_WIN_EMPTY_SYMBOL_ALPHA,
  SYMBOL_ART_HEIGHT,
  SYMBOL_SCALE,
  SYMBOL_SKELETONS,
} from 'src/games/slot/constants'
import { type HoldWinCell, LabelColor, SymbolKey } from 'src/games/slot/types'
import { Label } from 'src/games/slot/ui/hud/label'
import { formatAmount, getRandomEmptyCellSymbolKey } from 'src/games/slot/utils'

const TRACK_MAIN = 0

/**
 * Ячейка Hold & Win: монета — спрайт скаттера с номиналом, пустая ячейка — приглушённый случайный символ
 * игры, символ наполнения — спрайт символа на прокрутке. Номинал виден только в покое; выигрышную позу
 * держит скелет скаттера из пула.
 */
export class Coin extends SpineAnimation implements CellView<HoldWinCell> {
  private readonly artSprite = new Sprite()
  private readonly valueLabel = new Label({ color: LabelColor.white, fontSize: COIN_VALUE_FONT_SIZE })

  private value: HoldWinCell = null
  /** Символ пустой ячейки: выбирается заново на каждой посадке в пустоту и держится до следующей. */
  private emptyKey: SymbolKey = getRandomEmptyCellSymbolKey()
  private isMoving = false
  private isWin = false

  constructor(pool: SpinePool) {
    super(pool)

    this.artSprite.anchor.set(0.5)

    this.valueLabel.anchor.set(0.5)
    // Номинал ложится на подпись SCATTER в нижней трети арта и перекрывает её
    this.valueLabel.y = SYMBOL_ART_HEIGHT / 3
    this.valueLabel.style.stroke = { color: 0x000000, width: COIN_VALUE_STROKE }

    this.scale.set(SYMBOL_SCALE)
    this.addChild(this.artSprite, this.valueLabel)

    this.render()
  }

  setValue(value: HoldWinCell): void {
    if (value === this.value) return

    this.value = value

    if (typeof value === 'number') this.valueLabel.text = formatAmount(value)

    if (value === null) this.emptyKey = getRandomEmptyCellSymbolKey()

    this.render()
  }

  /** Ведёт позу движения. Выигрышную позу не трогает: её ставит и снимает сбор. */
  setMoving(moving: boolean): void {
    if (this.isWin || moving === this.isMoving) return

    this.isMoving = moving

    this.render()
  }

  /** Номинал монеты; у пустой ячейки и символа наполнения его нет. */
  getValue(): number {
    return typeof this.value === 'number' ? this.value : 0
  }

  win(): void {
    if (this.isWin || typeof this.value !== 'number') return

    this.isWin = true

    this.attach(SYMBOL_SKELETONS[SymbolKey.S])
    // Скелет встаёт последним ребёнком: номинал поднимается над ним
    this.addChild(this.valueLabel)
    this.play(TRACK_MAIN, 'win')

    this.render()
  }

  idle(): void {
    if (!this.isWin) return

    this.isWin = false

    this.detach()

    this.render()
  }

  /** Приводит спрайт и номинал к текущей тройке «значение + движение + выигрыш». */
  private render(): void {
    const { value } = this

    this.artSprite.visible = !this.isWin
    this.artSprite.texture = Assets.get(SYMBOL_SPRITES[this.getArtKey()][this.isMoving ? 'blur' : 'idle'])
    this.artSprite.alpha = value === null && !this.isMoving ? HOLD_WIN_EMPTY_SYMBOL_ALPHA : 1
    this.valueLabel.visible = typeof value === 'number' && !this.isMoving
  }

  /** Символ арта: наполнение показывает себя, монета — скаттер, пустая ячейка — свой случайный символ. */
  private getArtKey(): SymbolKey {
    if (typeof this.value === 'string') return this.value

    return this.value === null ? this.emptyKey : SymbolKey.S
  }
}
