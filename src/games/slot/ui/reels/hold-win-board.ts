import { Container, Graphics } from 'pixi.js'
import { PALETTE } from 'src/core/palette'
import type { ReelsMachine } from 'src/core/reels/reels-machine'
import type { GameTicker } from 'src/engine/game-ticker'
import { ReelsView } from 'src/engine/reels/reels-view'
import type { SpinePool } from 'src/engine/spine-pool'
import {
  CELL_HEIGHT,
  CELL_WIDTH,
  CELLS_ORIGIN_X,
  CELLS_ORIGIN_Y,
  HOLD_WIN_COIN_FRAME_THICKNESS,
  HOLD_WIN_GRAND_FONT_SIZE,
  HOLD_WIN_GRID_ALPHA,
  HOLD_WIN_GRID_THICKNESS,
  REELS_COUNT,
  VISIBLE_SYMBOLS_COUNT,
} from 'src/games/slot/constants'
import type { HoldWinReelsData } from 'src/games/slot/reels'
import { type HoldWinCell, LabelColor } from 'src/games/slot/types'
import { Label } from 'src/games/slot/ui/hud/label'
import { getHoldWinReelPosition } from 'src/games/slot/utils'

import { Coin } from './coin'
import { ReelsFrame } from './reels-frame'

/**
 * Поле Hold & Win: та же рамка, что у барабанов, ячейки-ленты по сетке 5×3 над моделью машины бонуса,
 * неподвижная полупрозрачная сетка по границам ячеек и циан-рамки ячеек с монетами.
 * Надпись Grand лежит в popup-слоте рамки поверх ячеек.
 */
export class HoldWinBoard extends Container {
  private readonly frame: ReelsFrame
  private readonly reelsView: ReelsView<HoldWinReelsData, HoldWinCell, Coin>
  private readonly grid = new Graphics()
  private readonly coinFrames = new Graphics()
  private readonly grandLabel = new Label({ color: LabelColor.cyan, fontSize: HOLD_WIN_GRAND_FONT_SIZE })

  constructor(ticker: GameTicker, machine: ReelsMachine<HoldWinReelsData, HoldWinCell>, pool: SpinePool) {
    super()

    this.reelsView = new ReelsView(ticker, machine, {
      cellWidth: CELL_WIDTH,
      cellHeight: CELL_HEIGHT,
      getReelPosition: getHoldWinReelPosition,
      createCellView: () => new Coin(pool),
    })

    this.reelsView.position.set(CELLS_ORIGIN_X, CELLS_ORIGIN_Y)

    this.drawGrid()

    this.grid.position.set(CELLS_ORIGIN_X, CELLS_ORIGIN_Y)
    this.coinFrames.position.set(CELLS_ORIGIN_X, CELLS_ORIGIN_Y)

    this.grandLabel.anchor.set(0.5)
    this.grandLabel.style.align = 'center'
    this.grandLabel.style.stroke = { color: 0x000000, width: HOLD_WIN_GRAND_FONT_SIZE / 8 }
    this.grandLabel.visible = false

    this.frame = new ReelsFrame(ticker)
    this.frame.addChildToSymbolsSlot(this.reelsView)
    // Сетка над лентами: символы прокрутки проезжают под ней
    this.frame.addChildToSymbolsSlot(this.grid)
    this.frame.addChildToSymbolsSlot(this.coinFrames)
    this.frame.addChildToPopupSlot(this.grandLabel)

    this.addChild(this.frame)
  }

  /** Монеты по лентам бонуса: у каждой ленты одна видимая ячейка. */
  getCoins(): (Coin | undefined)[] {
    return this.reelsView.getGridViews().map(([coin]) => coin)
  }

  /** Обводит циан-рамкой ячейки из списка; остальные рамки снимает. */
  setCoinCells(cells: readonly number[]): void {
    const width = CELL_WIDTH - HOLD_WIN_COIN_FRAME_THICKNESS
    const height = CELL_HEIGHT - HOLD_WIN_COIN_FRAME_THICKNESS

    this.coinFrames.clear()

    if (cells.length === 0) return

    // Контур отступает на половину обводки: рамка целиком лежит внутри своей ячейки
    for (const index of cells) {
      const { x, y } = getHoldWinReelPosition(index)

      this.coinFrames.rect(x - width / 2, y - height / 2, width, height)
    }

    this.coinFrames.stroke({ width: HOLD_WIN_COIN_FRAME_THICKNESS, color: PALETTE.cyan })
  }

  showGrand(amount: string): void {
    this.grandLabel.text = `GRAND\n${amount}`
    this.grandLabel.visible = true
  }

  hideGrand(): void {
    this.grandLabel.visible = false
  }

  /**
   * Рисует сетку по границам ячеек прямоугольниками без нахлёста: у полупрозрачных линий нахлёст
   * на пересечениях дал бы яркие точки. Вертикали идут на всю высоту, горизонтали — между ними.
   */
  private drawGrid(): void {
    const thickness = HOLD_WIN_GRID_THICKNESS
    const left = -CELL_WIDTH / 2
    const top = -CELL_HEIGHT / 2
    const height = CELL_HEIGHT * VISIBLE_SYMBOLS_COUNT

    for (let column = 0; column <= REELS_COUNT; column++) {
      this.grid.rect(left + CELL_WIDTH * column - thickness / 2, top - thickness / 2, thickness, height + thickness)
    }

    for (let row = 0; row <= VISIBLE_SYMBOLS_COUNT; row++) {
      for (let column = 0; column < REELS_COUNT; column++) {
        this.grid.rect(
          left + CELL_WIDTH * column + thickness / 2,
          top + CELL_HEIGHT * row - thickness / 2,
          CELL_WIDTH - thickness,
          thickness
        )
      }
    }

    this.grid.fill({ color: PALETTE.white, alpha: HOLD_WIN_GRID_ALPHA })
  }
}
