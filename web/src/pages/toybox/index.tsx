import { toyboxGame } from '@pixi-demos/toybox'
import { createGameContainer, destroyGameContainer } from 'src/app/container'
import { GameCanvas } from 'src/components/GameCanvas'

const boot = async (element: HTMLElement, signal: AbortSignal): Promise<void> => {
  await toyboxGame.preload()

  if (signal.aborted) return

  await toyboxGame.start(createGameContainer(toyboxGame.bind), element, signal)
}

export const ToyboxPage = () => <GameCanvas boot={boot} dispose={destroyGameContainer} />
