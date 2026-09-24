import type { Container } from 'inversify'

import { bindFsm } from '@pixi-demos/core/bindings'
import { GameEmitter } from '@pixi-demos/core/events/game-emitter'
import { traceEvent } from '@pixi-demos/core/events/utils'
import { CORE_TOKENS } from '@pixi-demos/core/tokens'
import { bindAudioSynth, bindEngine, bindSceneNode, bindSpinePool } from '@pixi-demos/engine/bindings'
import { ENGINE_TOKENS } from '@pixi-demos/engine/tokens'

import { SlotApi } from './api/slot'
import {
  CANVAS_FILL_MAX_WIDTH,
  GAME_ASPECT_RATIO,
  INITIAL_PHASE,
  SOUND_MASTER_GAIN,
  SOUND_SESSION_TYPE,
  SPINE_WARM_UP,
} from './constants'
import { BackgroundController } from './controllers/background'
import { BetPanelController } from './controllers/hud/bet-panel'
import { CreditLabelController } from './controllers/hud/credit-label'
import { SettingsButtonController } from './controllers/hud/settings-button'
import { SettingsModalController } from './controllers/hud/settings-modal'
import { SoundToggleButtonController } from './controllers/hud/sound-toggle-button'
import { SpinButtonController } from './controllers/hud/spin-button'
import { WinLabelController } from './controllers/hud/win-label'
import { HoldWinMachineController } from './controllers/reels/hold-win-machine'
import { ReelsMachineController } from './controllers/reels/reels-machine'
import { SoundController } from './controllers/sound'
import type { GameEvents } from './events'
import { BootingPhase } from './phases/booting'
import { CascadePhase } from './phases/cascade'
import { HoldWinCollectPhase } from './phases/hold-win-collect'
import { HoldWinIntroPhase } from './phases/hold-win-intro'
import { HoldWinSpinPhase } from './phases/hold-win-spin'
import { IdlePhase } from './phases/idle'
import { RespinPhase } from './phases/respin'
import { ResultPhase } from './phases/result'
import { SpinningPhase } from './phases/spinning'
import { GameScene } from './scenes/game'
import { STUB_SKELETONS } from './skeletons'
import { SlotStore } from './stores/slot'
import { SLOT_TOKENS } from './tokens'
import { PhaseName } from './types'

/**
 * Автомат раунда: эндпоинты, эмиттер, состояние, конфиг набора фаз и сами фазы на общем токене.
 * Самодостаточен и не тянет сцену: этим же составом раунд собирается в тестах.
 */
export const bindFlow = (container: Container): void => {
  container.bind(SLOT_TOKENS.SlotApi).to(SlotApi)

  container.bind(SLOT_TOKENS.SlotStore).to(SlotStore)

  // Автомат публикует активную фазу в стор игры: он один её пишет, вью читают через него же
  container.bind(CORE_TOKENS.PhaseSink).toDynamicValue(({ get }) => get(SLOT_TOKENS.SlotStore))

  // События игры живут один маунт: контейнер уносит эмиттер вместе с подписчиками
  container.bind(SLOT_TOKENS.GameEmitter).toDynamicValue(() => new GameEmitter<GameEvents>(traceEvent))

  // Имена фаз — знание игры, движок берёт их отсюда
  container
    .bind(CORE_TOKENS.FsmConfig)
    .toDynamicValue(() => ({ initial: INITIAL_PHASE, names: Object.values(PhaseName) }))

  container.bind(CORE_TOKENS.Phase).to(BootingPhase)
  container.bind(CORE_TOKENS.Phase).to(IdlePhase)
  container.bind(CORE_TOKENS.Phase).to(SpinningPhase)
  container.bind(CORE_TOKENS.Phase).to(ResultPhase)
  container.bind(CORE_TOKENS.Phase).to(RespinPhase)
  container.bind(CORE_TOKENS.Phase).to(HoldWinIntroPhase)
  container.bind(CORE_TOKENS.Phase).to(HoldWinSpinPhase)
  container.bind(CORE_TOKENS.Phase).to(HoldWinCollectPhase)
  container.bind(CORE_TOKENS.Phase).to(CascadePhase)
}

/** Картинка и звук: контроллеры и собирающая их сцена. */
const bindScene = (container: Container): void => {
  // Пропорции макета и порог заполнения — знание игры: по ним общий хост считает размер канваса
  container
    .bind(ENGINE_TOKENS.CanvasConfig)
    .toDynamicValue(() => ({ aspectRatio: GAME_ASPECT_RATIO, fillMaxWidth: CANVAS_FILL_MAX_WIDTH }))

  // Состав скелетов игры для общего пула
  container
    .bind(ENGINE_TOKENS.SpinePoolConfig)
    .toDynamicValue(() => ({ warmUp: SPINE_WARM_UP, skeletons: STUB_SKELETONS }))

  // Громкость и категория аудиосессии — знание игры, синтезатор движка берёт их отсюда
  container
    .bind(ENGINE_TOKENS.AudioConfig)
    .toDynamicValue(() => ({ masterGain: SOUND_MASTER_GAIN, sessionType: SOUND_SESSION_TYPE }))

  bindSceneNode(container, ENGINE_TOKENS.Scene, GameScene)
  bindSceneNode(container, SLOT_TOKENS.BackgroundController, BackgroundController)
  bindSceneNode(container, SLOT_TOKENS.ReelsMachineController, ReelsMachineController)
  bindSceneNode(container, SLOT_TOKENS.HoldWinMachineController, HoldWinMachineController)
  bindSceneNode(container, SLOT_TOKENS.SpinButtonController, SpinButtonController)
  bindSceneNode(container, SLOT_TOKENS.SoundToggleButtonController, SoundToggleButtonController)
  bindSceneNode(container, SLOT_TOKENS.BetPanelController, BetPanelController)
  bindSceneNode(container, SLOT_TOKENS.SettingsButtonController, SettingsButtonController)
  bindSceneNode(container, SLOT_TOKENS.SettingsModalController, SettingsModalController)
  bindSceneNode(container, SLOT_TOKENS.WinLabelController, WinLabelController)
  bindSceneNode(container, SLOT_TOKENS.CreditLabelController, CreditLabelController)
  bindSceneNode(container, SLOT_TOKENS.SoundController, SoundController)
}

/** Манифест слота: состав графа читается по доменным функциям. */
export const bindSlot = (container: Container): void => {
  bindFsm(container)
  bindEngine(container)
  bindSpinePool(container)
  bindAudioSynth(container)
  bindFlow(container)
  bindScene(container)
}
