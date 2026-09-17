import { useSearchParams } from 'react-router-dom'

import { toyboxGame } from '@pixi-demos/toybox'
import { createGameContainer, destroyGameContainer } from 'src/app/container'
import { GameCanvas } from 'src/components/GameCanvas'

const boot = async (element: HTMLElement, signal: AbortSignal): Promise<void> => {
  await toyboxGame.preload()

  if (signal.aborted) return

  await toyboxGame.start(createGameContainer(toyboxGame.bind), element, signal)
}

export const ToyboxPage = () => {
  const [searchParams] = useSearchParams()

  // Игра в разработке: канвас поднимается в dev и по флагу ?play, прод-сборка показывает заглушку
  const canPlay = import.meta.env.DEV || searchParams.has('play')

  if (!canPlay) {
    return (
      <p className="grid h-full place-items-center px-6 text-center text-lg font-extralight text-slate-300">
        The game is under development. Stay tuned
      </p>
    )
  }

  return <GameCanvas boot={boot} dispose={destroyGameContainer} />
}
