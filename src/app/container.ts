import { Container } from 'inversify'
import type { Application } from 'pixi.js'
import { RootApi } from 'src/api/root-api'
import { WsTransport } from 'src/api/service'
import { WS_URL } from 'src/constants/environment'
import { TOKENS } from 'src/constants/tokens'
import { GameEmitter } from 'src/events/game-emitter'
import type { GameEvents } from 'src/events/types'
import { traceEvent } from 'src/events/utils'
import { SpinStore } from 'src/stores/spin-store'

import { createGameContainer } from './game-container'
import { GameRoot } from './game-root'

/**
 * App-контейнер — composition root приложения. Его биндинги живут всё время работы вкладки;
 * скоуп по умолчанию — Singleton, transient задаётся явно.
 */
export const appContainer = new Container({ defaultScope: 'Singleton' })

appContainer
  .bind(TOKENS.WsTransport)
  .toDynamicValue(() => new WsTransport({ url: WS_URL }))
  .onDeactivation((transport) => transport.disconnect())

appContainer.bind(TOKENS.RootApi).to(RootApi)

appContainer.bind(TOKENS.GameEmitter).toDynamicValue(() => new GameEmitter<GameEvents>(traceEvent))

appContainer.bind(TOKENS.SpinStore).to(SpinStore)

// Transient: каждый маунт страницы получает свой экземпляр хоста
appContainer.bind(TOKENS.GameRoot).to(GameRoot).inTransientScope()

// GameRoot получает фабрику через токен: прямой импорт этого модуля из game-root.ts создал бы цикл
appContainer
  .bind(TOKENS.GameContainerFactory)
  .toConstantValue((app: Application) => createGameContainer(app, appContainer))
