import { useEffect } from 'react'

import { isRouteErrorResponse, useRouteError } from 'react-router-dom'
import { Button } from 'src/components/Button'
import { describeError, traceError } from 'src/core/errors/utils'

const toDetail = (error: unknown): string =>
  isRouteErrorResponse(error) ? `${error.status} ${error.statusText}` : describeError(error)

/**
 * Граница ошибок роутера: показывается вместо страницы, когда упал её рендер или не загрузился ленивый чанк.
 */
export const RouteError = () => {
  const error = useRouteError()

  useEffect(() => {
    traceError?.(error, 'Page error')
  }, [error])

  return (
    <div className="h-full flex flex-col items-center justify-center gap-4 px-6 text-center">
      <h2 className="text-2xl font-light">This page failed to open</h2>
      <p className="max-w-xl text-sm wrap-break-word text-white/60">{toDetail(error)}</p>
      <div className="flex gap-3">
        <Button onClick={() => window.location.reload()}>Reload</Button>
        <Button link href="/">
          Home
        </Button>
      </div>
    </div>
  )
}
