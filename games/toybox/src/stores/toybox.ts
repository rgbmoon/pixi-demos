import { injectable } from 'inversify'
import { action, computed, makeObservable, observable } from 'mobx'

import { INITIAL_PHASE } from '#src/constants'
import { type CellAddress, type GroundPoint, type HeapSnapshot, PhaseName, type ScreenPoint } from '#src/types'
import { toGroundDirection } from '#src/utils/projection'

/** Состояние фазы, управления и количества доставленных игрушек. */
@injectable()
export class ToyboxStore {
  constructor() {
    makeObservable(this)
  }

  /** Активная фаза. Единственный писатель — движок автомата через `setPhase`. */
  @observable phase: PhaseName = INITIAL_PHASE

  @computed get isIdle(): boolean {
    return this.phase === PhaseName.idle
  }

  /** Сколько игрушек попало в лоток за сессию. */
  @observable collected = 0

  /** Последний завершённый цикл, единственный источник для сохранения. */
  @observable.ref checkpoint: HeapSnapshot | undefined = undefined

  @observable.ref private keyboard: ScreenPoint = { x: 0, y: 0 }
  @observable.ref private joystick: ScreenPoint = { x: 0, y: 0 }

  /** Ненулевая команда клавиатуры имеет приоритет над джойстиком. */
  @computed get direction(): GroundPoint {
    if (!this.canDrop) return { x: 0, y: 0 }

    return toGroundDirection(this.keyboard.x || this.keyboard.y ? this.keyboard : this.joystick)
  }

  @action setKeyboardDirection(vector: ScreenPoint): void {
    this.keyboard = vector
  }

  @action setJoystickDirection(vector: ScreenPoint): void {
    this.joystick = vector
  }

  /** Ячейка под клешнёй. Единственный писатель — контроллер клешни. */
  @observable.ref clawCell: CellAddress | undefined = undefined

  /** Доступно ли опускание клешни: цикл идёт целиком, прервать его нечем. */
  @computed get canDrop(): boolean {
    return this.isIdle
  }

  /** Доступен ли сброс кучи: новая игра начинается только из покоя. */
  @computed get canReset(): boolean {
    return this.isIdle
  }

  /**
   * Ячейка, которую игрок выбирает сейчас: по ней сцена подсвечивает игрушку.
   * Подсветка идёт только в покое, пока игрок ищет игрушку джойстиком.
   */
  @computed get targetCell(): CellAddress | undefined {
    return this.canDrop ? this.clawCell : undefined
  }

  @action setPhase(phase: PhaseName) {
    this.phase = phase
  }

  /** Засчитывает игрушку, дошедшую до дна лотка. */
  @action recordCollection(): void {
    this.collected += 1
  }

  /** Публикует согласованные размещение и счёт после завершения цикла. */
  @action publishCheckpoint(snapshot: HeapSnapshot): void {
    this.checkpoint = snapshot
  }

  /** Поднимает счётчик из снимка: его зовёт стартовая фаза после восстановления кучи. */
  @action applyCollected(collected: number) {
    this.collected = collected
  }

  @action setClawCell(cell: CellAddress) {
    this.clawCell = cell
  }
}
