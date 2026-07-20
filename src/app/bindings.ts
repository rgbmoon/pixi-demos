import type { Container } from 'inversify'
import { RootApi } from 'src/api/root-api'
import { WsTransport } from 'src/api/service'
import { WS_URL } from 'src/constants/environment'
import { TOKENS } from 'src/constants/tokens'
import { GameEmitter } from 'src/events/game-emitter'
import type { GameEvents } from 'src/events/types'
import { traceEvent } from 'src/events/utils'
import { Fsm } from 'src/flow/fsm'
import { IdlePhase } from 'src/flow/phases/idle-phase'
import { ResultPhase } from 'src/flow/phases/result-phase'
import { SpinningPhase } from 'src/flow/phases/spinning-phase'
import { AutospinToggleButton } from 'src/game/controllers/autospin-toggle-button'
import { BackgroundController } from 'src/game/controllers/background'
import { BetMinusButton } from 'src/game/controllers/bet-minus-button'
import { BetPanel } from 'src/game/controllers/bet-panel'
import { BetPlusButton } from 'src/game/controllers/bet-plus-button'
import { CreditLabel } from 'src/game/controllers/credit-label'
import { ReelsMachineController } from 'src/game/controllers/reels-machine'
import { SoundToggleButton } from 'src/game/controllers/sound-toggle-button'
import { SpinButton } from 'src/game/controllers/spin-button'
import { WinLabel } from 'src/game/controllers/win-label'
import { GameRoot } from 'src/game/game-root'
import { GameTicker } from 'src/game/game-ticker'
import { GameScene } from 'src/game/scenes/game-scene'
import { FlowStore } from 'src/stores/flow-store'
import { SceneStore } from 'src/stores/scene-store'
import { SpinStore } from 'src/stores/spin-store'

/** Биндинги app-уровня: сервисы, живущие всё время работы вкладки. */
export const bindApp = (container: Container): void => {
  container
    .bind(TOKENS.WsTransport)
    .toDynamicValue(() => new WsTransport({ url: WS_URL }))
    .onDeactivation((transport) => transport.disconnect())

  container.bind(TOKENS.RootApi).to(RootApi)

  container.bind(TOKENS.GameEmitter).toDynamicValue(() => new GameEmitter<GameEvents>(traceEvent))
}

/** Общие сущности игры: игровой тикер и стор раунда. */
const bindCore = (container: Container): void => {
  // Игровой тикер создаётся до PIXI-init (app.ticker появляется только внутри него);
  // GameRoot после init переводит на него рендер, и умирает он вместе с приложением
  container.bind(TOKENS.GameTicker).to(GameTicker)

  // Состояние раунда живёт один маунт — каждый заход начинается со свежих сторов
  container.bind(TOKENS.FlowStore).to(FlowStore)
}

/** Автомат раунда: фазы на общем токене + движок. */
const bindFlow = (container: Container): void => {
  container.bind(TOKENS.Phase).to(IdlePhase)
  container.bind(TOKENS.Phase).to(SpinningPhase)
  container.bind(TOKENS.Phase).to(ResultPhase)

  container
    .bind(TOKENS.Fsm)
    .to(Fsm)
    .onDeactivation((fsm) => fsm.dispose())
}

/** Картинка: контроллеры и собирающая их сцена. А так-же сторы сцены */
const bindScene = (container: Container): void => {
  container.bind(TOKENS.SceneStore).to(SceneStore)
  container.bind(TOKENS.SpinStore).to(SpinStore)

  container
    .bind(TOKENS.GameScene)
    .to(GameScene)
    .onDeactivation((scene) => {
      if (!scene.destroyed) scene.destroy()
    })

  container
    .bind(TOKENS.BackgroundController)
    .to(BackgroundController)
    .onDeactivation((background) => {
      if (!background.destroyed) background.destroy({ children: true })
    })

  container
    .bind(TOKENS.ReelsMachineController)
    .to(ReelsMachineController)
    .onDeactivation((reels) => {
      if (!reels.destroyed) reels.destroy({ children: true })
    })

  container
    .bind(TOKENS.SpinButton)
    .to(SpinButton)
    .onDeactivation((button) => {
      if (!button.destroyed) button.destroy({ children: true })
    })

  container
    .bind(TOKENS.SoundToggleButton)
    .to(SoundToggleButton)
    .onDeactivation((button) => {
      if (!button.destroyed) button.destroy({ children: true })
    })

  container
    .bind(TOKENS.AutospinToggleButton)
    .to(AutospinToggleButton)
    .onDeactivation((button) => {
      if (!button.destroyed) button.destroy({ children: true })
    })

  container
    .bind(TOKENS.BetPlusButton)
    .to(BetPlusButton)
    .onDeactivation((button) => {
      if (!button.destroyed) button.destroy({ children: true })
    })

  container
    .bind(TOKENS.BetMinusButton)
    .to(BetMinusButton)
    .onDeactivation((button) => {
      if (!button.destroyed) button.destroy({ children: true })
    })

  container
    .bind(TOKENS.BetPanel)
    .to(BetPanel)
    .onDeactivation((panel) => {
      if (!panel.destroyed) panel.destroy({ children: true })
    })

  container
    .bind(TOKENS.WinLabel)
    .to(WinLabel)
    .onDeactivation((label) => {
      if (!label.destroyed) label.destroy({ children: true })
    })

  container
    .bind(TOKENS.CreditLabel)
    .to(CreditLabel)
    .onDeactivation((label) => {
      if (!label.destroyed) label.destroy({ children: true })
    })
}
/** Хост жизненного цикла игры. */
const bindHost = (container: Container): void => {
  container
    .bind(TOKENS.GameRoot)
    .to(GameRoot)
    .onDeactivation((root) => root.unmount())
}

/** Биндинги game-уровня — манифест игры: состав графа читается по доменным функциям. */
export const bindGame = (container: Container): void => {
  bindCore(container)
  bindFlow(container)
  bindScene(container)
  bindHost(container)
}
