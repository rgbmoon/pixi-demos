import { Assets, Sprite } from 'pixi.js'
import type { CellView } from 'src/engine/reels/types'
import { SpineAnimation } from 'src/engine/spine-animation'
import type { SpinePool } from 'src/engine/spine-pool'
import { SYMBOL_SPRITES } from 'src/games/slot/assets'
import { SYMBOL_SCALE, SYMBOL_SKELETONS } from 'src/games/slot/constants'
import type { SymbolKey } from 'src/games/slot/types'

const TRACK_MAIN = 0

/** Символ барабана: спрайт нужной позы плюс скелет из пула на выигрышной анимации и взрыве. */
export class ReelSymbol extends SpineAnimation implements CellView<SymbolKey> {
  private readonly artSprite = new Sprite()

  private key: SymbolKey | null = null
  private pose: 'idle' | 'blur' | 'win' | 'explode' = 'idle'
  private attachedKey: SymbolKey | null = null

  constructor(pool: SpinePool) {
    super(pool)

    this.artSprite.anchor.set(0.5)

    this.scale.set(SYMBOL_SCALE)
    this.addChild(this.artSprite)
  }

  setValue(key: SymbolKey): void {
    if (key === this.key) return

    this.key = key

    this.applyPose()
  }

  /** Ведёт позу движения. Выигрышную позу и взрыв не трогает: их ставит и снимает владелец. */
  setMoving(moving: boolean): void {
    if (this.pose === 'win' || this.pose === 'explode') return

    this.setPose(moving ? 'blur' : 'idle')
  }

  idle(): void {
    this.setPose('idle')
  }

  win(): void {
    this.setPose('win')
  }

  /** Проигрывает взрыв символа; после него ячейка пуста, пока `idle` не вернёт арт. */
  explode(signal?: AbortSignal): Promise<void> {
    this.setPose('explode')

    return this.playOnce(TRACK_MAIN, 'explode', signal)
  }

  /** Единственная точка смены позы. */
  private setPose(pose: ReelSymbol['pose']): void {
    if (pose === this.pose) return

    this.pose = pose

    this.applyPose()
  }

  /** Приводит спрайт и скелет к текущей паре «ключ + поза». */
  private applyPose(): void {
    const { key, pose } = this

    if (!key) return

    if (pose === 'idle' || pose === 'blur') {
      if (this.attachedKey) {
        this.detach()
        this.attachedKey = null
      }

      this.artSprite.visible = true
      this.artSprite.texture = Assets.get(SYMBOL_SPRITES[key][pose])

      return
    }

    // Выигрышную позу и взрыв держит скелет: он рисует тот же арт и лежит в тех же единицах ячейки
    this.artSprite.visible = false

    if (this.attachedKey !== key) {
      this.attach(SYMBOL_SKELETONS[key])
      this.attachedKey = key
    }

    // Взрыв запускает сам explode: ему нужен промис конца клипа
    if (pose === 'win') this.play(TRACK_MAIN, 'win')
  }
}
