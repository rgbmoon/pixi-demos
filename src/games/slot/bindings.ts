import type { Container } from 'inversify'
import { bindFsm } from 'src/core/bindings'
import { GameEmitter } from 'src/core/events/game-emitter'
import { traceEvent } from 'src/core/events/utils'
import { CORE_TOKENS } from 'src/core/tokens'
import { bindEngine } from 'src/engine/bindings'
import { ENGINE_TOKENS } from 'src/engine/tokens'

import { SlotApi } from './api/slot'
import { GAME_ASPECT_RATIO, INITIAL_PHASE, SPINE_WARM_UP } from './constants'
import { BackgroundController } from './controllers/background'
import { BetMinusButtonController } from './controllers/hud/bet-minus-button'
import { BetPanelController } from './controllers/hud/bet-panel'
import { BetPlusButtonController } from './controllers/hud/bet-plus-button'
import { CreditLabelController } from './controllers/hud/credit-label'
import { GameModeMinusButtonController } from './controllers/hud/game-mode-minus-button'
import { GameModePanelController } from './controllers/hud/game-mode-panel'
import { GameModePlusButtonController } from './controllers/hud/game-mode-plus-button'
import { SoundToggleButtonController } from './controllers/hud/sound-toggle-button'
import { SpinButtonController } from './controllers/hud/spin-button'
import { WinLabelController } from './controllers/hud/win-label'
import { ReelsMachineController } from './controllers/reels/reels-machine'
import type { GameEvents } from './events'
import { BootingPhase } from './phases/booting'
import { IdlePhase } from './phases/idle'
import { ResultPhase } from './phases/result'
import { SpinningPhase } from './phases/spinning'
import { GameScene } from './scenes/game'
import { STUB_SKELETONS } from './skeletons'
import { SlotStore } from './stores/slot'
import { SLOT_TOKENS } from './tokens'
import { PhaseName } from './types'

/** Автомат раунда: эндпоинты, эмиттер, конфиг набора фаз и сами фазы на общем токене. */
const bindFlow = (container: Container): void => {
  container.bind(SLOT_TOKENS.SlotApi).to(SlotApi)

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

}

/** Картинка: контроллеры и собирающая их сцена. А так-же сторы сцены */
const bindScene = (container: Container): void => {
  // Пропорции макета — знание игры: по ним общий хост считает размер канваса
  container.bind(ENGINE_TOKENS.CanvasConfig).toDynamicValue(() => ({ aspectRatio: GAME_ASPECT_RATIO }))

  // Состав скелетов игры для общего пула
  container
    .bind(ENGINE_TOKENS.SpinePoolConfig)
    .toDynamicValue(() => ({ warmUp: SPINE_WARM_UP, skeletons: STUB_SKELETONS }))

  container.bind(SLOT_TOKENS.SlotStore).to(SlotStore)

  // Автомат публикует активную фазу в стор игры: он один её пишет, вью читают через него же
  container.bind(CORE_TOKENS.PhaseSink).toDynamicValue(({ get }) => get(SLOT_TOKENS.SlotStore))

  container
    .bind(ENGINE_TOKENS.Scene)
    .to(GameScene)
    .onDeactivation((scene) => {
      if (!scene.destroyed) scene.destroy()
    })

  container
    .bind(SLOT_TOKENS.BackgroundController)
    .to(BackgroundController)
    .onDeactivation((background) => {
      if (!background.destroyed) background.destroy({ children: true })
    })

  container
    .bind(SLOT_TOKENS.ReelsMachineController)
    .to(ReelsMachineController)
    .onDeactivation((reels) => {
      if (!reels.destroyed) reels.destroy({ children: true })
    })

  container
    .bind(SLOT_TOKENS.SpinButtonController)
    .to(SpinButtonController)
    .onDeactivation((button) => {
      if (!button.destroyed) button.destroy({ children: true })
    })

  container
    .bind(SLOT_TOKENS.SoundToggleButtonController)
    .to(SoundToggleButtonController)
    .onDeactivation((button) => {
      if (!button.destroyed) button.destroy({ children: true })
    })

  container
    .bind(SLOT_TOKENS.BetPlusButtonController)
    .to(BetPlusButtonController)
    .onDeactivation((button) => {
      if (!button.destroyed) button.destroy({ children: true })
    })

  container
    .bind(SLOT_TOKENS.BetMinusButtonController)
    .to(BetMinusButtonController)
    .onDeactivation((button) => {
      if (!button.destroyed) button.destroy({ children: true })
    })

  container
    .bind(SLOT_TOKENS.BetPanelController)
    .to(BetPanelController)
    .onDeactivation((panel) => {
      if (!panel.destroyed) panel.destroy({ children: true })
    })

  container
    .bind(SLOT_TOKENS.GameModePlusButtonController)
    .to(GameModePlusButtonController)
    .onDeactivation((button) => {
      if (!button.destroyed) button.destroy({ children: true })
    })

  container
    .bind(SLOT_TOKENS.GameModeMinusButtonController)
    .to(GameModeMinusButtonController)
    .onDeactivation((button) => {
      if (!button.destroyed) button.destroy({ children: true })
    })

  container
    .bind(SLOT_TOKENS.GameModePanelController)
    .to(GameModePanelController)
    .onDeactivation((panel) => {
      if (!panel.destroyed) panel.destroy({ children: true })
    })

  container
    .bind(SLOT_TOKENS.WinLabelController)
    .to(WinLabelController)
    .onDeactivation((label) => {
      if (!label.destroyed) label.destroy({ children: true })
    })

  container
    .bind(SLOT_TOKENS.CreditLabelController)
    .to(CreditLabelController)
    .onDeactivation((label) => {
      if (!label.destroyed) label.destroy({ children: true })
    })
}

/** Манифест слота: состав графа читается по доменным функциям. */
export const bindSlot = (container: Container): void => {
  bindFsm(container)
  bindEngine(container)
  bindFlow(container)
  bindScene(container)
}
