import type { ServiceIdentifier } from 'inversify'

import type { GameEmitter } from '@pixi-demos/core/events/game-emitter'

import type { GameEvents } from './events'
import type { ToyboxStore } from './stores/toybox'

export const TOYBOX_TOKENS = {
  GameEmitter: Symbol('GameEmitter') as ServiceIdentifier<GameEmitter<GameEvents>>,
  ToyboxStore: Symbol('ToyboxStore') as ServiceIdentifier<ToyboxStore>,
} as const
