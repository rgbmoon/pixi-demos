import { PhaseName } from 'src/types/game'

/** Фаза, с которой автомат начинает петлю после запуска. */
export const INITIAL_PHASE: PhaseName = PhaseName.idle

/** Сколько сумма выигрыша висит в WinLabel после анимаций, прежде чем уйти в кредит. */
export const WIN_DISPLAY_MS = 1000
