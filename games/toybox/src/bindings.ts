import type { Container } from 'inversify'

import { bindFsm } from '@pixi-demos/core/bindings'
import { GameEmitter } from '@pixi-demos/core/events/game-emitter'
import { traceEvent } from '@pixi-demos/core/events/utils'
import { IdbStorage } from '@pixi-demos/core/idb-storage'
import { CORE_TOKENS } from '@pixi-demos/core/tokens'
import { bindEngine } from '@pixi-demos/engine/bindings'
import { ENGINE_TOKENS } from '@pixi-demos/engine/tokens'

import {
  CANVAS_FILL_MAX_WIDTH,
  GAME_ASPECT_RATIO,
  HEAP_DB_NAME,
  HEAP_SNAPSHOT_KEY,
  HEAP_STORE_NAME,
  INITIAL_PHASE,
} from './constants'
import { ClawController } from './controllers/box/claw'
import { ContentsController } from './controllers/box/contents'
import { PersistenceController } from './controllers/persistence'
import type { GameEvents } from './events'
import { AscendingPhase } from './phases/ascending'
import { BootingPhase } from './phases/booting'
import { DeliveringPhase } from './phases/delivering'
import { DescendingPhase } from './phases/descending'
import { GrabbingPhase } from './phases/grabbing'
import { IdlePhase } from './phases/idle'
import { ReleasingPhase } from './phases/releasing'
import { ReturningPhase } from './phases/returning'
import { GameScene } from './scenes/game'
import { HeapStore } from './stores/heap'
import { ToyboxStore } from './stores/toybox'
import { TOYBOX_TOKENS } from './tokens'
import { type HeapSnapshot, PhaseName } from './types'

export const bindFlow = (container: Container): void => {
  container.bind(TOYBOX_TOKENS.ToyboxStore).to(ToyboxStore)
  container.bind(TOYBOX_TOKENS.HeapStore).to(HeapStore)
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
  container.bind(CORE_TOKENS.Phase).to(ReturningPhase)
}

const bindScene = (container: Container): void => {
  container
    .bind(ENGINE_TOKENS.CanvasConfig)
    .toDynamicValue(() => ({ aspectRatio: GAME_ASPECT_RATIO, fillMaxWidth: CANVAS_FILL_MAX_WIDTH }))

  container
    .bind(ENGINE_TOKENS.Scene)
    .to(GameScene)
    .onDeactivation((scene) => {
      if (!scene.destroyed) scene.destroy({ children: true })
    })

  container
    .bind(TOYBOX_TOKENS.ClawController)
    .to(ClawController)
    .onDeactivation((claw) => {
      if (!claw.destroyed) claw.destroy({ children: true })
    })

  container
    .bind(TOYBOX_TOKENS.ContentsController)
    .to(ContentsController)
    .onDeactivation((contents) => {
      if (!contents.destroyed) contents.destroy({ children: true })
    })

  container
    .bind(TOYBOX_TOKENS.PersistenceController)
    .to(PersistenceController)
    .onDeactivation((persistence) => {
      if (!persistence.destroyed) persistence.destroy({ children: true })
    })
}

/** Манифест toybox: состав графа читается по доменным функциям. */
export const bindToybox = (container: Container): void => {
  bindFsm(container)
  bindEngine(container)
  bindFlow(container)
  bindScene(container)
}
