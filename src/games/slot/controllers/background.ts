import { inject, injectable } from 'inversify'
import type { GameTicker } from 'src/engine/game-ticker'
import { LiveContainer } from 'src/engine/live-container'
import { ENGINE_TOKENS } from 'src/engine/tokens'
import type { SlotStore } from 'src/games/slot/stores/slot'
import { SLOT_TOKENS } from 'src/games/slot/tokens'
import { Background } from 'src/games/slot/ui/background'

/**
 * Контроллер фона: стоит первым ребёнком сцены и по режиму игры переключает вариант фона fade-ом.
 */
@injectable()
export class BackgroundController extends LiveContainer {
  private readonly animation: Background

  constructor(@inject(ENGINE_TOKENS.GameTicker) ticker: GameTicker, @inject(SLOT_TOKENS.SlotStore) slotStore: SlotStore) {
    super()

    // Фриспиновый фон закреплён за последним режимом списка: отдельного признака у режима нет
    const isFs = () => slotStore.gameMode === slotStore.gameModes.at(-1)?.gameMode

    this.animation = new Background(ticker, isFs())
    this.addChild(this.animation)

    this.watch(isFs, (value) => this.animation.fadeTo(value))
  }
}
