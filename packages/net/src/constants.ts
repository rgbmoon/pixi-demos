/** Адрес игрового WebSocket: приходит из окружения сборки. */
// Тип указан явно: в программе пакета-потребителя декларации ImportMetaEnv из net нет, и без аннотации
// значение имело бы тип any
export const WS_URL: string = import.meta.env.VITE_WS_URL
