import { Button } from 'src/components/Button'

export const MainPage = () => {
  return (
    <div className="relative isolate h-[calc(100vh-var(--header-height))] flex flex-col items-center justify-center p-6 gap-20">
      <div className="flex flex-col items-center gap-4">
        <h1 className="text-6xl text-center font-extralight">
          Добро пожаловать в <span className="text-brand-primary">Pixi</span> <span className="text-brand-accent">Game</span>
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
