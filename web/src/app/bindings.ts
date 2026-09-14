import type { Container } from 'inversify'

import { bindNet } from '@pixi-demos/net/bindings'
import { WS_URL } from '@pixi-demos/net/constants'

/**
 * Биндинги app-уровня: сервисы, живущие всё время работы вкладки.
 */
export const bindApp = (container: Container): void => {
  bindNet(container, { url: WS_URL })
}
