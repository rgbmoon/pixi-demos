import type { ServiceIdentifier } from 'inversify'

import type { GameRoot } from './game-root'
import type { GameTicker } from './game-ticker'
import type { SpinePool } from './spine-pool'
import type { CanvasConfig, SceneLike, SpinePoolConfig } from './types'

/**
 * Токены PIXI-рантайма: хост, тикер, пул скелетов и сцена под общим типом.
 * Конфиги (`CanvasConfig`, `SpinePoolConfig`) заполняет игра — их значения живут в её композиции.
 *
 * В рантайме файл обязан оставаться листом графа импортов: только `Symbol(...)`.
 */
export const ENGINE_TOKENS = {
  GameRoot: Symbol('GameRoot') as ServiceIdentifier<GameRoot>,
  GameTicker: Symbol('GameTicker') as ServiceIdentifier<GameTicker>,
  SpinePool: Symbol('SpinePool') as ServiceIdentifier<SpinePool>,
  Scene: Symbol('Scene') as ServiceIdentifier<SceneLike>,
  CanvasConfig: Symbol('CanvasConfig') as ServiceIdentifier<CanvasConfig>,
  SpinePoolConfig: Symbol('SpinePoolConfig') as ServiceIdentifier<SpinePoolConfig>,
} as const
