import type { ServiceIdentifier } from 'inversify'
import type { RootApi } from 'src/api/root-api'
import type { WsTransport } from 'src/api/service'
import type { GameEmitter } from 'src/events/game-emitter'
import type { GameEvents } from 'src/events/types'
import type { Fsm } from 'src/flow/fsm'
import type { Phase } from 'src/flow/types'
import type { BackgroundController } from 'src/game/controllers/background'
import type { BetMinusButton } from 'src/game/controllers/bet-minus-button'
import type { BetPanel } from 'src/game/controllers/bet-panel'
import type { BetPlusButton } from 'src/game/controllers/bet-plus-button'
import type { CreditLabel } from 'src/game/controllers/credit-label'
import type { GameModeMinusButton } from 'src/game/controllers/game-mode-minus-button'
import type { GameModePanel } from 'src/game/controllers/game-mode-panel'
import type { GameModePlusButton } from 'src/game/controllers/game-mode-plus-button'
import type { ReelsMachineController } from 'src/game/controllers/reels-machine'
import type { SoundToggleButton } from 'src/game/controllers/sound-toggle-button'
import type { SpinButton } from 'src/game/controllers/spin-button'
import type { WinLabel } from 'src/game/controllers/win-label'
import type { GameRoot } from 'src/game/game-root'
import type { GameTicker } from 'src/game/game-ticker'
import type { GameScene } from 'src/game/scenes/game-scene'
import type { SpinePool } from 'src/game/spine-pool'
import type { FlowStore } from 'src/stores/flow-store'
import type { SceneStore } from 'src/stores/scene-store'

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
  SpinePool: Symbol('SpinePool') as ServiceIdentifier<SpinePool>,
  Fsm: Symbol('Fsm') as ServiceIdentifier<Fsm>,
  Phase: Symbol('Phase') as ServiceIdentifier<Phase>,
  // Сторы
  FlowStore: Symbol('FlowStore') as ServiceIdentifier<FlowStore>,
  SceneStore: Symbol('SceneStore') as ServiceIdentifier<SceneStore>,
  // Контроллеры
  BackgroundController: Symbol('BackgroundController') as ServiceIdentifier<BackgroundController>,
  ReelsMachineController: Symbol('ReelsMachineController') as ServiceIdentifier<ReelsMachineController>,
  SpinButton: Symbol('SpinButton') as ServiceIdentifier<SpinButton>,
  SoundToggleButton: Symbol('SoundToggleButton') as ServiceIdentifier<SoundToggleButton>,
  BetPlusButton: Symbol('BetPlusButton') as ServiceIdentifier<BetPlusButton>,
  BetMinusButton: Symbol('BetMinusButton') as ServiceIdentifier<BetMinusButton>,
  BetPanel: Symbol('BetPanel') as ServiceIdentifier<BetPanel>,
  GameModePlusButton: Symbol('GameModePlusButton') as ServiceIdentifier<GameModePlusButton>,
  GameModeMinusButton: Symbol('GameModeMinusButton') as ServiceIdentifier<GameModeMinusButton>,
  GameModePanel: Symbol('GameModePanel') as ServiceIdentifier<GameModePanel>,
  WinLabel: Symbol('WinLabel') as ServiceIdentifier<WinLabel>,
  CreditLabel: Symbol('CreditLabel') as ServiceIdentifier<CreditLabel>,
} as const
