import { Point, Rectangle } from 'pixi.js'

import type { GameTicker } from '../game-ticker'
import { SpineAnimation } from '../ui/spine-animation'

const SKELETON_URL = '/src/assets/game/animations/reels_frame/frame.json'
const ATLAS_URL = '/src/assets/game/animations/reels_frame/1/frame.atlas'

// ширина скелета из frame.json; origin арта — в его центре
const NATIVE_WIDTH = 1074.93

// зона символов внутри рамки: пять шагов между divider_center и высота разделителя, обе величины из frame.json
const NATIVE_ZONE_WIDTH = 1006.7
const NATIVE_ZONE_HEIGHT = 589

const TRACK_MAIN = 0
const TRACK_TINT = 1

export class ReelsFrameAnimation extends SpineAnimation {
  private width = 0
  private height = 0

  constructor(ticker: GameTicker) {
    super(ticker)

    void this.load(SKELETON_URL, ATLAS_URL)
  }

  protected override onLoaded(): void {
    this.play(TRACK_MAIN, 'idle')
    this.applySize()
  }

  /** Вписывает рамку в зону барабанов: масштаб по ширине, центр скелета — в центр зоны. */
  resize(width: number, height: number): void {
    this.width = width
    this.height = height

    this.applySize()
  }

  /** Показывает затемнение символов и держит его до `hideTint`. */
  async showTint(signal?: AbortSignal): Promise<void> {
    await this.playOnce(TRACK_TINT, 'tint_show', signal)

    this.play(TRACK_TINT, 'tint_idle')
  }

  /** Прячет затемнение символов. */
  async hideTint(signal?: AbortSignal): Promise<void> {
    await this.playOnce(TRACK_TINT, 'tint_hide', signal)

    this.clearTrack(TRACK_TINT)
  }

  /** Зона символов внутри рамки, в координатах `view`: рамка вписана по ширине, зона стоит в её центре. */
  getSymbolsZone(): Rectangle {
    const scale = this.width / NATIVE_WIDTH
    const zoneWidth = NATIVE_ZONE_WIDTH * scale
    const zoneHeight = NATIVE_ZONE_HEIGHT * scale

    return new Rectangle((this.width - zoneWidth) / 2, (this.height - zoneHeight) / 2, zoneWidth, zoneHeight)
  }

  /** Точка размещения символов под тинтом, в координатах `view`. */
  getSymbolsPoint(): Point {
    return this.getSlotPoint('symbols_placeholder')
  }

  /** Точка для вин-анимаций символов, в координатах `view`. */
  getSymbolsWinPoint(): Point {
    return this.getSlotPoint('symbols_win_placeholder')
  }

  /** Точка для текстовых попапов, в координатах `view`. */
  getPopupPoint(): Point {
    return this.getSlotPoint('popup_placeholder')
  }

  private getSlotPoint(slotName: string): Point {
    const bone = this.spine?.skeleton.findSlot(slotName)?.bone

    if (!this.spine || !bone) return new Point()

    return this.view.toLocal({ x: bone.worldX, y: bone.worldY }, this.spine)
  }

  private applySize(): void {
    if (!this.spine || this.width === 0) return

    this.spine.scale.set(this.width / NATIVE_WIDTH)
    this.spine.position.set(this.width / 2, this.height / 2)
  }
}
