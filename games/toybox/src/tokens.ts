import type { ServiceIdentifier } from 'inversify'

import type { GameEmitter } from '@pixi-demos/core/events/game-emitter'
import type { IdbStorage } from '@pixi-demos/core/idb-storage'

import type { ClawRig } from './claw/claw-rig'
import type { CubeController } from './controllers/box/cube'
import type { MarqueeController } from './controllers/box/marquee'
import type { PrizeOutputController } from './controllers/box/prize-output'
import type { DropButtonController } from './controllers/hud/drop-button'
import type { JoystickController } from './controllers/hud/joystick'
import type { ResetButtonController } from './controllers/hud/reset-button'
import type { KeyboardController } from './controllers/keyboard'
import type { PersistenceController } from './controllers/persistence'
import type { GameEvents } from './events'
import type { Heap } from './heap/heap'
import type { ToyboxStore } from './stores/toybox'
import type { HeapSnapshot } from './types'

export const TOYBOX_TOKENS = {
  GameEmitter: Symbol('GameEmitter') as ServiceIdentifier<GameEmitter<GameEvents>>,
  ToyboxStore: Symbol('ToyboxStore') as ServiceIdentifier<ToyboxStore>,
  Heap: Symbol('Heap') as ServiceIdentifier<Heap>,
  HeapStorage: Symbol('HeapStorage') as ServiceIdentifier<IdbStorage<HeapSnapshot>>,
  ClawRig: Symbol('ClawRig') as ServiceIdentifier<ClawRig>,
  CubeController: Symbol('CubeController') as ServiceIdentifier<CubeController>,
  MarqueeController: Symbol('MarqueeController') as ServiceIdentifier<MarqueeController>,
  PrizeOutputController: Symbol('PrizeOutputController') as ServiceIdentifier<PrizeOutputController>,
  JoystickController: Symbol('JoystickController') as ServiceIdentifier<JoystickController>,
  DropButtonController: Symbol('DropButtonController') as ServiceIdentifier<DropButtonController>,
  ResetButtonController: Symbol('ResetButtonController') as ServiceIdentifier<ResetButtonController>,
  KeyboardController: Symbol('KeyboardController') as ServiceIdentifier<KeyboardController>,
  PersistenceController: Symbol('PersistenceController') as ServiceIdentifier<PersistenceController>,
} as const
