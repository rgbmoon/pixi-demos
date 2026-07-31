/** Уровень уведомления: `error` показывается снекбаром, `fatal` — оверлеем над канвасом. */
export const NoticeSeverity = {
  error: 'error',
  fatal: 'fatal',
} as const

export type NoticeSeverity = (typeof NoticeSeverity)[keyof typeof NoticeSeverity]

/** Уведомление об ошибке: текст для игрока и техническая деталь исходной ошибки. */
export interface Notice {
  severity: NoticeSeverity
  message: string
  detail?: string
}

// Аугментация даёт типизированные addEventListener/dispatchEvent для события шины без приведений
declare global {
  interface WindowEventMap {
    'app:notice': CustomEvent<Notice>
  }
}
