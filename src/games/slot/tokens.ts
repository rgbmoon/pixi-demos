import type { ServiceIdentifier } from 'inversify'
import type { GameEmitter } from 'src/core/events/game-emitter'

import type { SlotApi } from './api/slot'
import type { BackgroundController } from './controllers/background'
import type { AnticipationCheckboxController } from './controllers/hud/anticipation-checkbox'
import type { BetMinusButtonController } from './controllers/hud/bet-minus-button'
import type { BetPanelController } from './controllers/hud/bet-panel'
import type { BetPlusButtonController } from './controllers/hud/bet-plus-button'
import type { CascadeCheckboxController } from './controllers/hud/cascade-checkbox'
import type { CreditLabelController } from './controllers/hud/credit-label'
import type { GameModeMinusButtonController } from './controllers/hud/game-mode-minus-button'
import type { GameModePanelController } from './controllers/hud/game-mode-panel'
import type { GameModePlusButtonController } from './controllers/hud/game-mode-plus-button'
import type { HoldWinCheckboxController } from './controllers/hud/hold-win-checkbox'
import type { RespinCheckboxController } from './controllers/hud/respin-checkbox'
import type { SettingsButtonController } from './controllers/hud/settings-button'
import type { SettingsModalController } from './controllers/hud/settings-modal'
import type { SoundToggleButtonController } from './controllers/hud/sound-toggle-button'
import type { SpinButtonController } from './controllers/hud/spin-button'
import type { TurboCheckboxController } from './controllers/hud/turbo-checkbox'
import type { WinLabelController } from './controllers/hud/win-label'
import type { HoldWinController } from './controllers/reels/hold-win'
import type { ReelsMachineController } from './controllers/reels/reels-machine'
import type { SoundController } from './controllers/sound'
import type { GameEvents } from './events'
import type { SlotStore } from './stores/slot'

/**
 * Токены слота: эндпоинты, эмиттер с картой событий игры, сторы и контроллеры сцены, включая звук.
 *
 * В рантайме файл обязан оставаться листом графа импортов: только `Symbol(...)`.
 */
export const SLOT_TOKENS = {
  SlotApi: Symbol('SlotApi') as ServiceIdentifier<SlotApi>,
  GameEmitter: Symbol('GameEmitter') as ServiceIdentifier<GameEmitter<GameEvents>>,
  SlotStore: Symbol('SlotStore') as ServiceIdentifier<SlotStore>,
  BackgroundController: Symbol('BackgroundController') as ServiceIdentifier<BackgroundController>,
  ReelsMachineController: Symbol('ReelsMachineController') as ServiceIdentifier<ReelsMachineController>,
  HoldWinController: Symbol('HoldWinController') as ServiceIdentifier<HoldWinController>,
  SpinButtonController: Symbol('SpinButtonController') as ServiceIdentifier<SpinButtonController>,
  SoundToggleButtonController: Symbol('SoundToggleButtonController') as ServiceIdentifier<SoundToggleButtonController>,
  TurboCheckboxController: Symbol('TurboCheckboxController') as ServiceIdentifier<TurboCheckboxController>,
  AnticipationCheckboxController: Symbol(
    'AnticipationCheckboxController'
  ) as ServiceIdentifier<AnticipationCheckboxController>,
  RespinCheckboxController: Symbol('RespinCheckboxController') as ServiceIdentifier<RespinCheckboxController>,
  HoldWinCheckboxController: Symbol('HoldWinCheckboxController') as ServiceIdentifier<HoldWinCheckboxController>,
  CascadeCheckboxController: Symbol('CascadeCheckboxController') as ServiceIdentifier<CascadeCheckboxController>,
  BetPlusButtonController: Symbol('BetPlusButtonController') as ServiceIdentifier<BetPlusButtonController>,
  BetMinusButtonController: Symbol('BetMinusButtonController') as ServiceIdentifier<BetMinusButtonController>,
  BetPanelController: Symbol('BetPanelController') as ServiceIdentifier<BetPanelController>,
  GameModePlusButtonController: Symbol('GameModePlusButtonController') as ServiceIdentifier<GameModePlusButtonController>,
  GameModeMinusButtonController: Symbol('GameModeMinusButtonController') as ServiceIdentifier<GameModeMinusButtonController>,
  GameModePanelController: Symbol('GameModePanelController') as ServiceIdentifier<GameModePanelController>,
  SettingsButtonController: Symbol('SettingsButtonController') as ServiceIdentifier<SettingsButtonController>,
  SettingsModalController: Symbol('SettingsModalController') as ServiceIdentifier<SettingsModalController>,
  WinLabelController: Symbol('WinLabelController') as ServiceIdentifier<WinLabelController>,
  CreditLabelController: Symbol('CreditLabelController') as ServiceIdentifier<CreditLabelController>,
  SoundController: Symbol('SoundController') as ServiceIdentifier<SoundController>,
} as const
