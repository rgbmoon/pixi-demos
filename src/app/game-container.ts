import { Container } from 'inversify'
import type { Application } from 'pixi.js'
import { TOKENS } from 'src/constants/tokens'
import { createGameFsm } from 'src/flow/helpers'
import { ReelsController } from 'src/game/controllers/reels-controller'
import { SpinButton } from 'src/game/controllers/spin-button'

/**
 * Создаёт контейнер игрового графа на один маунт страницы: константы PIXI, контроллеры и автомат.
 * Деактивации биндингов уничтожают объекты; порядок unbind задаёт GameRoot.unmount().
 */
export const createGameContainer = (app: Application, parent: Container): Container => {
  const container = new Container({ parent, defaultScope: 'Singleton' })

  // Application и Ticker созданы в GameRoot; контейнер ими не владеет и не уничтожает
  container.bind(TOKENS.Application).toConstantValue(app)
  container.bind(TOKENS.Ticker).toConstantValue(app.ticker)

  container
    .bind(TOKENS.ReelsController)
    .to(ReelsController)
    .onDeactivation((reels) => reels.destroy({ children: true }))

  container
    .bind(TOKENS.SpinButton)
    .to(SpinButton)
    .onDeactivation((button) => button.destroy({ children: true }))

  // Фабричный биндинг собирает автомат и комплектует контекст фаз;
  // колбэки движка записывают фазу и фатальную ошибку в стор
  container
    .bind(TOKENS.Fsm)
    .toDynamicValue((ctx) => {
      const spinStore = ctx.get(TOKENS.SpinStore)

      return createGameFsm({
        context: {
          emitter: ctx.get(TOKENS.GameEmitter),
          reels: ctx.get(TOKENS.ReelsController),
          spinStore,
          api: ctx.get(TOKENS.RootApi),
        },
        onPhaseChange: (phase) => spinStore.setPhase(phase),
        onError: (error) => spinStore.setFatalError(error),
      })
    })
    .onDeactivation((fsm) => fsm.dispose())

  return container
}
