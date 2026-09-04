import { createGameContainer, destroyGameContainer } from 'src/app/container'
import { GameCanvas } from 'src/components/GameCanvas'
import { slotGame } from 'src/games/slot'

/**
 * Ассеты грузятся до сборки графа: конструкторы сцены читают их из кэша синхронно.
 * Эта страница — единственный модуль приложения, знающий про игру.
 */
const boot = async (element: HTMLElement, signal: AbortSignal): Promise<void> => {
  await slotGame.preload()

  if (signal.aborted) return

  await slotGame.start(createGameContainer(slotGame.bind), element, signal)
}

export const SlotPage = () => <GameCanvas boot={boot} dispose={destroyGameContainer} />
