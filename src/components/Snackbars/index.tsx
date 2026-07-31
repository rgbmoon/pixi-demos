import { useEffect, useRef, useState } from 'react'

import { type Notice, NoticeSeverity } from 'src/errors/types'
import { onNotice } from 'src/errors/utils'

const AUTO_HIDE_MS = 6000

interface SnackbarEntry extends Notice {
  id: number
}

interface SnackbarProps {
  entry: SnackbarEntry
  onClose: (id: number) => void
}

const Snackbar = ({ entry, onClose }: SnackbarProps) => {
  useEffect(() => {
    const timeoutId = setTimeout(() => onClose(entry.id), AUTO_HIDE_MS)

    return () => clearTimeout(timeoutId)
  }, [entry.id, onClose])

  return (
    <div className="pointer-events-auto flex items-start gap-3 p-3 rounded-md text-sm text-white bg-slate-900/70 backdrop-blur-xl border border-white/15">
      <div className="flex-1 min-w-0">
        <p>{entry.message}</p>
        {entry.detail && <p className="mt-1 text-xs wrap-break-word text-white/60">{entry.detail}</p>}
      </div>
      <button
        type="button"
        aria-label="Закрыть"
        onClick={() => onClose(entry.id)}
        className="shrink-0 leading-none text-white/60 hover:text-white transition-colors"
      >
        ✕
      </button>
    </div>
  )
}

/** Стопка уведомлений об ошибках: слушает шину и показывает всё, кроме фатального (его рисует оверлей страницы). */
export const Snackbars = () => {
  const [entries, setEntries] = useState<SnackbarEntry[]>([])
  const lastId = useRef(0)

  useEffect(
    () =>
      onNotice((notice) => {
        if (notice.severity === NoticeSeverity.fatal) return

        lastId.current += 1

        const entry: SnackbarEntry = { ...notice, id: lastId.current }

        setEntries((current) => {
          // Поток одинаковых ошибок (например, покадровый) не должен выстраивать стопку копий
          const duplicate = current.some((item) => item.message === entry.message && item.detail === entry.detail)

          return duplicate ? current : [...current, entry]
        })
      }),
    []
  )

  const close = (id: number) => {
    setEntries((current) => current.filter((entry) => entry.id !== id))
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed bottom-4 right-4 z-30 flex flex-col gap-2 w-80 max-w-[calc(100vw-2rem)]"
    >
      {entries.map((entry) => (
        <Snackbar key={entry.id} entry={entry} onClose={close} />
      ))}
    </div>
  )
}
