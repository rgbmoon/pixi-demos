import { Point } from 'pixi.js'

import type { GameTicker } from '../game-ticker'
import { SpineAnimation } from '../ui/spine-animation'

const SKELETON_URL = '/src/assets/game/animations/glider/glider.json'
const ATLAS_URL = '/src/assets/game/animations/glider/1/glider.atlas'

// ширина скелета из glider.json; origin арта — в его центре
const NATIVE_WIDTH = 496.25

const TRACK_MAIN = 0
const TRACK_FACE = 1

type GliderState = 'fly' | 'idle' | 'hit'

export class GliderAnimation extends SpineAnimation {
  private width = 0
  private height = 0
  private state: GliderState = 'fly'

  constructor(ticker: GameTicker) {
    super(ticker)

    void this.load(SKELETON_URL, ATLAS_URL)
  }

  protected override onLoaded(): void {
    this.play(TRACK_MAIN, 'fly')
    this.applySize()
  }

  /** Вписывает ковёр в зону: масштаб по ширине, центр скелета — в центр зоны. */
  resize(width: number, height: number): void {
    this.width = width
    this.height = height

    this.applySize()
  }

  /** Разворачивает ковёр вправо. */
  right(): void {
    this.play(TRACK_FACE, 'right')
  }

  /** Разворачивает ковёр влево. */
  left(): void {
    this.play(TRACK_FACE, 'left')
  }

  /** Переводит ковёр в полёт: из простоя или из попадания. */
  async fly(signal?: AbortSignal): Promise<void> {
    if (this.state === 'fly') return

    await this.playOnce(TRACK_MAIN, this.state === 'idle' ? 'transition_out_1' : 'transition_out_2', signal)
    this.state = 'fly'
    this.play(TRACK_MAIN, 'fly')
  }

  /** Переводит ковёр в простой: ковёр "оглядывается", дразнит Джинна. Только из полёта. */
  async idle(signal?: AbortSignal): Promise<void> {
    if (this.state === 'idle') return

    await this.playOnce(TRACK_MAIN, 'transition_in_1', signal)
    this.state = 'idle'
    this.play(TRACK_MAIN, 'idle')
  }

  /** Отображает попадание прожектайла: переход в статичный кадр с количеством очков. Только из простоя. */
  async hit(signal?: AbortSignal): Promise<void> {
    await this.playOnce(TRACK_MAIN, 'transition_in_2', signal)
    this.state = 'hit'
    this.play(TRACK_MAIN, 'hit', false)
  }

  /** Точка на ковре для попадания выстрела и спауна эффекта попадания, в координатах `view`. */
  getHitPoint(): Point {
    return this.getBonePoint('hit')
  }

  /** Точка на ковре для отображения количества очков при попадании, в координатах `view`. */
  getNumbersPoint(): Point {
    return this.getBonePoint('numbers')
  }

  private getBonePoint(boneName: string): Point {
    const bone = this.spine?.skeleton.findBone(boneName)

    if (!this.spine || !bone) return new Point()

    return this.view.toLocal({ x: bone.worldX, y: bone.worldY }, this.spine)
  }

  private applySize(): void {
    if (!this.spine || this.width === 0) return

    this.spine.scale.set(this.width / NATIVE_WIDTH)
    this.spine.position.set(this.width / 2, this.height / 2)
  }
}
