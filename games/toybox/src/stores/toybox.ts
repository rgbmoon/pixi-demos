import { injectable } from 'inversify'
import { action, computed, makeObservable, observable } from 'mobx'

import { INITIAL_PHASE } from '#src/constants'
import { type CellAddress, PhaseName } from '#src/types'

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

  // TODO у нас не может быть больше одной выдчи за раз. Эта логика лишняя
  /** Число подтверждённых выдач, для которых дверца ещё не закрылась. */
  @observable pendingPrizes = 0

  /** Ячейка под клешнёй. Единственный писатель — контроллер клешни. */
  @observable.ref clawCell: CellAddress | undefined = undefined

  /** Доступно ли опускание клешни: цикл идёт целиком, прервать его нечем. */
  @computed get canDrop(): boolean {
    return this.isIdle && this.pendingPrizes === 0
  }

  /** Доступен ли сброс кучи: новая игра начинается только из покоя. */
  @computed get canReset(): boolean {
    return this.isIdle && this.pendingPrizes === 0
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

  @action recordCollection(): number {
    this.collected += 1

    return this.collected
  }

  @action beginPrize(): void {
    this.pendingPrizes += 1
  }

  @action finishPrize(): void {
    this.pendingPrizes = Math.max(0, this.pendingPrizes - 1)
  }

  /** Поднимает счётчик из снимка: его зовёт стартовая фаза после восстановления кучи. */
  @action applyCollected(collected: number) {
    this.collected = collected
  }

  @action setClawCell(cell: CellAddress) {
    this.clawCell = cell
  }
}
