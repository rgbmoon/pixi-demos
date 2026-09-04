import type { Container } from 'inversify'
import { WS_URL } from 'src/net/constants'
import { NET_TOKENS } from 'src/net/tokens'
import { WsTransport } from 'src/net/ws-transport'

/**
 * Биндинги app-уровня: сервисы, живущие всё время работы вкладки.
 */
export const bindApp = (container: Container): void => {
  container
    .bind(NET_TOKENS.WsTransport)
    .toDynamicValue(() => new WsTransport({ url: WS_URL }))
    .onDeactivation((transport) => transport.disconnect())
}
