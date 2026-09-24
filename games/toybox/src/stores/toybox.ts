import { injectable } from 'inversify'
import { action, computed, makeObservable, observable } from 'mobx'

import { HEAP_SNAPSHOT_VERSION, INITIAL_PHASE } from '#src/constants'
import { type GroundPoint, type HeapSnapshot, type HeapSnapshotBody, PhaseName, type ScreenPoint } from '#src/types'
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

  /** Доступно ли опускание клешни: цикл идёт целиком, прервать его нечем. */
  @computed get canDrop(): boolean {
    return this.isIdle
  }

  /** Доступен ли сброс кучи: новая игра начинается только из покоя. */
  @computed get canReset(): boolean {
    return this.isIdle
  }

  @action setPhase(phase: PhaseName) {
    this.phase = phase
  }

  /** Засчитывает приз перед его показом в окне выдачи. */
  @action recordCollection(): void {
    this.collected += 1
  }

  /** Публикует после завершения цикла снимок из поз покоя кучи и текущего счёта. */
  @action publishCheckpoint(bodies: HeapSnapshotBody[]): void {
    this.checkpoint = { version: HEAP_SNAPSHOT_VERSION, collected: this.collected, bodies }
  }

  /** Поднимает счётчик из снимка: его зовёт стартовая фаза после восстановления кучи. */
  @action applyCollected(collected: number) {
    this.collected = collected
  }
}
