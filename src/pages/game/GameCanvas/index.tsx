import { rootStore } from 'src/stores/root'

export const GameCanvas = () => {
  return (
    <div
      ref={(element: HTMLDivElement | null) => {
        if (element) {
          rootStore.mount(element)
        }
      }}
      className="w-full h-full"
    />
  )
}
