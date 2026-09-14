import type { Container } from 'inversify'

import { NET_TOKENS } from './tokens'
import type { WsTransportOptions } from './types'
import { WsTransport } from './ws-transport'

/**
 * Биндит транспорт игрового WebSocket. Адрес и таймауты передаются опциями из композиции.
 */
export const bindNet = (container: Container, options: WsTransportOptions): void => {
  container
    .bind(NET_TOKENS.WsTransport)
    .toDynamicValue(() => new WsTransport(options))
    .onDeactivation((transport) => transport.disconnect())
}
