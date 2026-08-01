import { Assets, Sprite } from 'pixi.js'
import type { SymbolKey } from 'src/types/game'

import { SYMBOL_ASSETS, SYMBOL_BG_BLUR_SRC, SYMBOL_BG_SRC, SYMBOL_SPRITES } from '../assets'
import { SYMBOL_SCALE } from '../constants'
import type { SpinePool } from '../spine-pool'
import type { SymbolFit } from '../types'
import { SpineAnimation } from '../ui/spine-animation'
import { getSymbolFit } from '../utils'

const TRACK_MAIN = 0

export class SymbolAnimation extends SpineAnimation {
  private readonly bgSprite = new Sprite()
  private readonly artSprite = new Sprite()

  private key: SymbolKey | null = null
  private pose: 'idle' | 'blur' | 'win' = 'idle'
  private attachedKey: SymbolKey | null = null
  private fit: SymbolFit = { scale: 1, offsetX: 0, offsetY: 0 }

  constructor(pool: SpinePool) {
    super(pool)

    this.bgSprite.anchor.set(0.5)
    this.artSprite.anchor.set(0.5)

    this.view.scale.set(SYMBOL_SCALE)
    this.view.addChild(this.bgSprite, this.artSprite)
  }

  setKey(key: SymbolKey): void {
    if (key === this.key) return

    this.key = key
    this.fit = getSymbolFit(key)

    this.artSprite.scale.set(this.fit.scale)
    // Сдвиг ставит центр контента спрайта в центр ячейки: холсты артов отцентрованы по-разному
    this.artSprite.position.set(this.fit.offsetX, this.fit.offsetY)

    this.applyPose()
  }

  blur(): void {
    this.pose = 'blur'

    this.applyPose()
  }

  idle(): void {
    this.pose = 'idle'

    this.applyPose()
  }

  win(): void {
    this.pose = 'win'

    this.applyPose()
  }

  /** Приводит подложку, спрайт и скелет к текущей паре «ключ + поза». */
  private applyPose(): void {
    const { key, pose } = this

    if (!key) return

    this.bgSprite.texture = Assets.get(pose === 'blur' ? SYMBOL_BG_BLUR_SRC : SYMBOL_BG_SRC)

    const spriteSrc = pose === 'win' ? undefined : SYMBOL_SPRITES[key][pose]

    if (spriteSrc) {
      if (this.attachedKey) {
        this.detach()
        this.attachedKey = null
      }

      this.artSprite.visible = true
      this.artSprite.texture = Assets.get(spriteSrc)

      return
    }

    // Позу держит скелет: выигрышная анимация либо setup-поза у символа без спрайта покоя
    this.artSprite.visible = false

    // attach добавляет скелет последним ребёнком: он идёт поверх подложки
    if (this.attachedKey !== key) {
      this.attach(SYMBOL_ASSETS[key])
      this.attachedKey = key

      this.spine?.scale.set(this.fit.scale)

      // Поправка нужна скелету, только когда он же рисует покой: у остальных символов бокс
      // замерен по холсту спрайта, а выигрышная анимация строится вокруг origin скелета
      if (!SYMBOL_SPRITES[key].idle) {
        this.spine?.position.set(this.fit.offsetX, this.fit.offsetY)
      }
    }

    if (pose === 'win') {
      this.play(TRACK_MAIN, 'win')

      return
    }

    this.clearTrack(TRACK_MAIN)
  }
}
