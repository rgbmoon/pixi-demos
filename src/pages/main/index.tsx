import { Button } from 'src/components/Button'

import { BackgroundCanvas } from './BackgroundCanvas'

export const MainPage = () => {
  return (
    <div className="relative isolate h-[calc(100vh-var(--header-height))] flex flex-col items-center justify-center p-6 gap-20">
      <div className="fixed inset-0 -z-10">
        <BackgroundCanvas />
      </div>
      <div className="flex flex-col items-center gap-4">
        <h1 className="text-6xl text-center font-extralight">
          Добро пожаловать в <span className="text-[#a98fc3]">Pixi</span> <span className="text-[#6ec3a7]">Game</span>
        </h1>
        <p className="text-xl text-center font-extralight">
          Выиграть тут в принципе невозможно, но зато можно весело провести время
        </p>
      </div>
      <Button link href="/game">
        Играть
      </Button>
    </div>
  )
}
