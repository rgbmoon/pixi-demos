import { Assets, Sprite } from 'pixi.js'
import { SpineAnimation } from 'src/engine/spine-animation'
import type { SpinePool } from 'src/engine/spine-pool'
import { SYMBOL_SPRITES } from 'src/games/slot/assets'
import { SYMBOL_SCALE, SYMBOL_SKELETONS } from 'src/games/slot/constants'
import type { SymbolKey } from 'src/games/slot/types'

const TRACK_MAIN = 0

/** Символ барабана: спрайт нужной позы плюс скелет из пула на выигрышной анимации. */
export class ReelSymbol extends SpineAnimation {
  private readonly artSprite = new Sprite()

  private key: SymbolKey | null = null
  private pose: 'idle' | 'blur' | 'win' = 'idle'
  private attachedKey: SymbolKey | null = null

  constructor(pool: SpinePool) {
    super(pool)

    this.artSprite.anchor.set(0.5)

    this.scale.set(SYMBOL_SCALE)
    this.addChild(this.artSprite)
  }

  setKey(key: SymbolKey): void {
    if (key === this.key) return

    this.key = key

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

  /** Приводит спрайт и скелет к текущей паре «ключ + поза». */
  private applyPose(): void {
    const { key, pose } = this

    if (!key) return

    if (pose !== 'win') {
      if (this.attachedKey) {
        this.detach()
        this.attachedKey = null
      }

      this.artSprite.visible = true
      this.artSprite.texture = Assets.get(SYMBOL_SPRITES[key][pose])

      return
    }

    // Выигрышную позу держит скелет: он рисует тот же арт и лежит в тех же единицах ячейки
    this.artSprite.visible = false

    if (this.attachedKey !== key) {
      this.attach(SYMBOL_SKELETONS[key])
      this.attachedKey = key
    }

    this.play(TRACK_MAIN, 'win')
  }
}
