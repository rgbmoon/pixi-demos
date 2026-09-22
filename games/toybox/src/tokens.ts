import type { ServiceIdentifier } from 'inversify'

import type { GameEmitter } from '@pixi-demos/core/events/game-emitter'
import type { IdbStorage } from '@pixi-demos/core/idb-storage'

import type { ClawController } from './controllers/box/claw'
import type { ContentsController } from './controllers/box/contents'
import type { PrizeOutputController } from './controllers/box/prize-output'
import type { PersistenceController } from './controllers/persistence'
import type { GameEvents } from './events'
import type { HeapStore } from './stores/heap'
import type { ToyboxStore } from './stores/toybox'
import type { HeapSnapshot } from './types'

export const TOYBOX_TOKENS = {
  GameEmitter: Symbol('GameEmitter') as ServiceIdentifier<GameEmitter<GameEvents>>,
  ToyboxStore: Symbol('ToyboxStore') as ServiceIdentifier<ToyboxStore>,
  HeapStore: Symbol('HeapStore') as ServiceIdentifier<HeapStore>,
  HeapStorage: Symbol('HeapStorage') as ServiceIdentifier<IdbStorage<HeapSnapshot>>,
  ClawController: Symbol('ClawController') as ServiceIdentifier<ClawController>,
  ContentsController: Symbol('ContentsController') as ServiceIdentifier<ContentsController>,
  PersistenceController: Symbol('PersistenceController') as ServiceIdentifier<PersistenceController>,
  PrizeOutputController: Symbol('PrizeOutputController') as ServiceIdentifier<PrizeOutputController>,
} as const
