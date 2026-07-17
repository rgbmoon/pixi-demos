import type { ServiceIdentifier } from 'inversify'
import type { RootApi } from 'src/api/root-api'
import type { WsTransport } from 'src/api/service'
import type { GameEmitter } from 'src/events/game-emitter'
import type { GameEvents } from 'src/events/types'
import type { Fsm } from 'src/flow/fsm'
import type { Phase } from 'src/flow/types'
import type { AutospinToggleButton } from 'src/game/controllers/autospin-toggle-button'
import type { BackgroundController } from 'src/game/controllers/background-controller'
import type { ReelsController } from 'src/game/controllers/reels-controller'
import type { SoundToggleButton } from 'src/game/controllers/sound-toggle-button'
import type { SpinButton } from 'src/game/controllers/spin-button'
import type { GameRoot } from 'src/game/game-root'
import type { GameTicker } from 'src/game/game-ticker'
import type { GameScene } from 'src/game/scenes/game-scene'
import type { FlowStore } from 'src/stores/flow-store'
import type { SceneStore } from 'src/stores/scene-store'
import type { SpinStore } from 'src/stores/spin-store'

/**
 * Словарь DI-токенов. `ServiceIdentifier<T>` привязывает
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
  // game-уровень — пересоздаются на каждый маунт страницы игры
  GameRoot: Symbol('GameRoot') as ServiceIdentifier<GameRoot>,
  GameScene: Symbol('GameScene') as ServiceIdentifier<GameScene>,
  GameTicker: Symbol('GameTicker') as ServiceIdentifier<GameTicker>,
  Fsm: Symbol('Fsm') as ServiceIdentifier<Fsm>,
  Phase: Symbol('Phase') as ServiceIdentifier<Phase>,
  // Сторы
  FlowStore: Symbol('FlowStore') as ServiceIdentifier<FlowStore>,
  SpinStore: Symbol('SpinStore') as ServiceIdentifier<SpinStore>,
  SceneStore: Symbol('SceneStore') as ServiceIdentifier<SceneStore>,
  // Контроллеры
  BackgroundController: Symbol('BackgroundController') as ServiceIdentifier<BackgroundController>,
  ReelsController: Symbol('ReelsController') as ServiceIdentifier<ReelsController>,
  SpinButton: Symbol('SpinButton') as ServiceIdentifier<SpinButton>,
  SoundToggleButton: Symbol('SoundToggleButton') as ServiceIdentifier<SoundToggleButton>,
  AutospinToggleButton: Symbol('AutospinToggleButton') as ServiceIdentifier<AutospinToggleButton>,
} as const
