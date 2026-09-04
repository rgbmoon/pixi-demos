import type { ServiceIdentifier } from 'inversify'

import type { WsTransport } from './ws-transport'

/**
 * Токены сетевого слоя. `ServiceIdentifier<T>` привязывает к токену тип: `get`/`@inject`
 * по нему возвращают и требуют именно `T`, а не `unknown`.
 *
 * В рантайме файл обязан оставаться листом графа импортов: только `Symbol(...)`,
 * все импорты — строго `import type`.
 */
export const NET_TOKENS = {
  WsTransport: Symbol('WsTransport') as ServiceIdentifier<WsTransport>,
} as const
