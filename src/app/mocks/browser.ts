import { WebSocketInterceptor } from '@mswjs/interceptors/WebSocket'
import { defineNetwork, InterceptorSource } from 'msw/experimental'
import { createHandlers } from 'src/games/slot/mocks/handlers'
import { parseMockOptions } from 'src/games/slot/mocks/utils'

// Моки только WebSocket, поэтому сеть собрана без Service Worker: во встроенных браузерах (WKWebView)
// его нет, а фолбэк setupWorker в msw 2.15 перехватчик WebSocket не ставит.
// Каст повторяет setupWorker: типы Interceptor в @mswjs/interceptors объявлены раздельно для node и browser
const interceptor = new WebSocketInterceptor() as unknown as ConstructorParameters<
  typeof InterceptorSource
>[0]['interceptors'][number]

// Сценарий и сид приходят строкой запуска: /slot?scenario=bigwin&seed=1
export const network = defineNetwork({
  sources: [new InterceptorSource({ interceptors: [interceptor] })],
  handlers: createHandlers(parseMockOptions(window.location.search)),
  onUnhandledFrame: 'bypass',
})
