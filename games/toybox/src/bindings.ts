import type { Container } from 'inversify'

import { bindFsm, bindKeyboardInput } from '@pixi-demos/core/bindings'
import { GameEmitter } from '@pixi-demos/core/events/game-emitter'
import { traceEvent } from '@pixi-demos/core/events/utils'
import { IdbStorage } from '@pixi-demos/core/idb-storage'
import { CORE_TOKENS } from '@pixi-demos/core/tokens'
import { bindEngine, bindSceneNode } from '@pixi-demos/engine/bindings'
import { ENGINE_TOKENS } from '@pixi-demos/engine/tokens'

import { ClawRig } from './claw/claw-rig'
import { CANVAS_MAX_RESOLUTION, HEAP_DB_NAME, HEAP_SNAPSHOT_KEY, HEAP_STORE_NAME, INITIAL_PHASE } from './constants'
import { CubeController } from './controllers/box/cube'
import { MarqueeController } from './controllers/box/marquee'
import { PrizeOutputController } from './controllers/box/prize-output'
import { DropButtonController } from './controllers/hud/drop-button'
import { JoystickController } from './controllers/hud/joystick'
import { ResetButtonController } from './controllers/hud/reset-button'
import { KeyboardController } from './controllers/keyboard'
import { PersistenceController } from './controllers/persistence'
import type { GameEvents } from './events'
import { Heap } from './heap/heap'
import { AscendingPhase } from './phases/ascending'
import { BootingPhase } from './phases/booting'
import { DeliveringPhase } from './phases/delivering'
import { DescendingPhase } from './phases/descending'
import { GrabbingPhase } from './phases/grabbing'
import { IdlePhase } from './phases/idle'
import { PresentingPhase } from './phases/presenting'
import { ReleasingPhase } from './phases/releasing'
import { ReturningPhase } from './phases/returning'
import { GameScene } from './scenes/game'
import { ToyboxStore } from './stores/toybox'
import { TOYBOX_TOKENS } from './tokens'
import { type HeapSnapshot, PhaseName } from './types'

export const bindFlow = (container: Container): void => {
  container.bind(TOYBOX_TOKENS.ToyboxStore).to(ToyboxStore)
  container.bind(TOYBOX_TOKENS.Heap).to(Heap)
  container.bind(TOYBOX_TOKENS.ClawRig).to(ClawRig)
  container
    .bind(TOYBOX_TOKENS.HeapStorage)
    .toDynamicValue(
      () => new IdbStorage<HeapSnapshot>({ dbName: HEAP_DB_NAME, storeName: HEAP_STORE_NAME, key: HEAP_SNAPSHOT_KEY })
    )
  container.bind(CORE_TOKENS.PhaseSink).toDynamicValue(({ get }) => get(TOYBOX_TOKENS.ToyboxStore))
  container.bind(TOYBOX_TOKENS.GameEmitter).toDynamicValue(() => new GameEmitter<GameEvents>(traceEvent))
  container
    .bind(CORE_TOKENS.FsmConfig)
    .toDynamicValue(() => ({ initial: INITIAL_PHASE, names: Object.values(PhaseName) }))

  container.bind(CORE_TOKENS.Phase).to(BootingPhase)
  container.bind(CORE_TOKENS.Phase).to(IdlePhase)
  container.bind(CORE_TOKENS.Phase).to(DescendingPhase)
  container.bind(CORE_TOKENS.Phase).to(GrabbingPhase)
  container.bind(CORE_TOKENS.Phase).to(AscendingPhase)
  container.bind(CORE_TOKENS.Phase).to(DeliveringPhase)
  container.bind(CORE_TOKENS.Phase).to(ReleasingPhase)
  container.bind(CORE_TOKENS.Phase).to(PresentingPhase)
  container.bind(CORE_TOKENS.Phase).to(ReturningPhase)
}

const bindScene = (container: Container): void => {
  container
    .bind(ENGINE_TOKENS.CanvasConfig)
    .toDynamicValue(() => ({ maxResolution: CANVAS_MAX_RESOLUTION, roundPixels: true }))

  bindSceneNode(container, ENGINE_TOKENS.Scene, GameScene)
  bindSceneNode(container, TOYBOX_TOKENS.CubeController, CubeController)
  bindSceneNode(container, TOYBOX_TOKENS.MarqueeController, MarqueeController)
  bindSceneNode(container, TOYBOX_TOKENS.PrizeOutputController, PrizeOutputController)
  bindSceneNode(container, TOYBOX_TOKENS.JoystickController, JoystickController)
  bindSceneNode(container, TOYBOX_TOKENS.DropButtonController, DropButtonController)
  bindSceneNode(container, TOYBOX_TOKENS.ResetButtonController, ResetButtonController)
  bindSceneNode(container, TOYBOX_TOKENS.KeyboardController, KeyboardController)
  bindSceneNode(container, TOYBOX_TOKENS.PersistenceController, PersistenceController)
}

/** Манифест toybox: состав графа читается по доменным функциям. */
export const bindToybox = (container: Container): void => {
  bindFsm(container)
  bindKeyboardInput(container)
  bindEngine(container)
  bindFlow(container)
  bindScene(container)
}
