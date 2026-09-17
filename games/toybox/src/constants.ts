import { PhaseName } from './types'

/** Пропорции игрового поля: выше CANVAS_FILL_MAX_WIDTH канвас повторяет их. */
export const GAME_ASPECT_RATIO = 941 / 1672

/** Ширина контейнера, до которой канвас занимает его целиком. */
export const CANVAS_FILL_MAX_WIDTH = 640

/** Фаза, с которой автомат начинает петлю после запуска. */
export const INITIAL_PHASE: PhaseName = PhaseName.booting
