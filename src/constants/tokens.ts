import type { Container, ServiceIdentifier } from 'inversify'
import type { Application, Ticker } from 'pixi.js'
import type { RootApi } from 'src/api/root-api'
import type { WsTransport } from 'src/api/service'
import type { GameRoot } from 'src/app/game-root'
import type { GameEmitter } from 'src/events/game-emitter'
import type { GameEvents } from 'src/events/types'
import type { Fsm } from 'src/flow/fsm'
import type { ReelsController } from 'src/game/controllers/reels-controller'
import type { SpinButton } from 'src/game/controllers/spin-button'
import type { SpinStore } from 'src/stores/spin-store'

/**
 * Словарь DI-токенов — аналог карты `GameEvents` для событий: все идентификаторы
 * зависимостей объявлены в одном месте и типизированы. `ServiceIdentifier<T>` привязывает
 * к токену тип: `get`/`@inject` по нему возвращают и требуют именно `T`, а не `unknown`.
 *
 * В рантайме файл обязан оставаться листом графа импортов: только `Symbol(...)`,
 * все импорты — строго `import type` (они стираются при компиляции). Благодаря этому
 * слои могут импортировать `TOKENS`, не создавая циклов с композицией.
 */
export const TOKENS = {
  // app-уровень — живут всё время работы вкладки
  WsTransport: Symbol('WsTransport') as ServiceIdentifier<WsTransport>,
  RootApi: Symbol('RootApi') as ServiceIdentifier<RootApi>,
  GameEmitter: Symbol('GameEmitter') as ServiceIdentifier<GameEmitter<GameEvents>>,
  SpinStore: Symbol('SpinStore') as ServiceIdentifier<SpinStore>,
  GameRoot: Symbol('GameRoot') as ServiceIdentifier<GameRoot>,
  GameContainerFactory: Symbol('GameContainerFactory') as ServiceIdentifier<(app: Application) => Container>,
  // game-уровень — пересоздаются на каждый маунт страницы игры
  Application: Symbol('Application') as ServiceIdentifier<Application>,
  Ticker: Symbol('Ticker') as ServiceIdentifier<Ticker>,
  ReelsController: Symbol('ReelsController') as ServiceIdentifier<ReelsController>,
  SpinButton: Symbol('SpinButton') as ServiceIdentifier<SpinButton>,
  Fsm: Symbol('Fsm') as ServiceIdentifier<Fsm>,
} as const
