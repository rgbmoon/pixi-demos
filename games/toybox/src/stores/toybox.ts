import { injectable } from 'inversify'
import { action, computed, makeObservable, observable } from 'mobx'

import { HEAP_SNAPSHOT_VERSION, INITIAL_PHASE, TOUR_STORAGE_KEY } from '#src/constants'
import { type GroundPoint, type HeapSnapshot, type HeapSnapshotBody, PhaseName, type ScreenPoint } from '#src/types'
import { toGroundDirection } from '#src/utils/projection'
import { readStoredFlag, writeStoredFlag } from '@pixi-demos/core/storage'

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

  /**
   * Игрок прошёл тур по управлению: хоть раз тронул джойстик, Drop или клавиши. Переживает перезагрузку через
   * localStorage.
   */
  @observable isTourDone = readStoredFlag(TOUR_STORAGE_KEY, false)

  /** Стрелки тура видны, пока управление доступно и игрок его не тронул. */
  @computed get isTourShown(): boolean {
    return this.canDrop && !this.isTourDone
  }

  /** Отмечает тур пройденным при первом касании управления. */
  @action completeTour(): void {
    if (this.isTourDone) return

    this.isTourDone = true
    writeStoredFlag(TOUR_STORAGE_KEY, true)
  }

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

  /** Доступно ли опускание клешни: цикл идёт целиком, прервать его нечем; открытый диалог сброса гасит управление. */
  @computed get canDrop(): boolean {
    return this.isIdle && !this.isResetConfirmOpen
  }

  /** Доступен ли сброс кучи: новая игра начинается только из покоя. */
  @computed get canReset(): boolean {
    return this.isIdle
  }

  /** Открыт диалог подтверждения сброса. Пишет контроллер кнопки сброса. */
  @observable isResetConfirmOpen = false

  /** Открывает диалог подтверждения сброса, если сброс доступен. */
  @action openResetConfirm(): void {
    if (this.canReset) this.isResetConfirmOpen = true
  }

  /** Закрывает диалог подтверждения сброса. */
  @action closeResetConfirm(): void {
    this.isResetConfirmOpen = false
  }

  @action setPhase(phase: PhaseName) {
    this.phase = phase
  }

  /** Засчитывает приз перед его показом в окне выдачи. */
  @action recordCollection(): void {
    this.collected += 1
  }

  /** Публикует после завершения цикла снимок из поз покоя кучи в кубе, игрушек на полу и текущего счёта. */
  @action publishCheckpoint(bodies: HeapSnapshotBody[], floor: HeapSnapshotBody[]): void {
    this.checkpoint = { version: HEAP_SNAPSHOT_VERSION, collected: this.collected, bodies, floor }
  }

  /** Поднимает счётчик из снимка: его зовёт стартовая фаза после восстановления кучи. */
  @action applyCollected(collected: number) {
    this.collected = collected
  }
}
