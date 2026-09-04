import { Container } from 'pixi.js'
import { PAYLINES } from 'src/games/slot/constants'

import { WinLine } from './win-line'

/** Набор линий выплат поля: показывает переданные линии, остальные гасит. */
export class Paylines extends Container {
  private readonly lines = new Map<string, WinLine>()

  constructor() {
    super()

    Object.keys(PAYLINES).forEach((lineId) => {
      const line = new WinLine(lineId)

      this.lines.set(lineId, line)
      this.addChild(line)
    })
  }

  show(lineIds: string[]): void {
    const visible = new Set(lineIds)

    this.lines.forEach((line, lineId) => (visible.has(lineId) ? line.show() : line.hide()))
  }

  hide(): void {
    this.lines.forEach((line) => line.hide())
  }
}
