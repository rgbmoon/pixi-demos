import { inject, injectable } from 'inversify'
import { TOKENS } from 'src/constants/tokens'
import { BackgroundAnimation } from 'src/game/animations/background-animation'
import { BACKGROUND_FRONT_ANIMATION } from 'src/game/constants'
import type { SpinePool } from 'src/game/spine-pool'
import { LiveContainer } from 'src/game/ui/live-container'

/**
 * Контроллер переднего слоя фона: стоит последним ребёнком сцены и перекрывает машину барабанов.
 * Трансформ считает тем же cover, что и задний слой, поэтому слои совпадают.
 */
@injectable()
export class ForegroundController extends LiveContainer {
  private readonly animation: BackgroundAnimation

  constructor(@inject(TOKENS.SpinePool) pool: SpinePool) {
    super()

    this.animation = new BackgroundAnimation(pool, BACKGROUND_FRONT_ANIMATION)
    this.addChild(this.animation.view)
  }

  layout(width: number, height: number): void {
    this.animation.resize(width, height)
  }
}
