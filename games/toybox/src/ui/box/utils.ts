import { TOY_ANGLE_STEP } from '#src/constants'
import type { ScreenPoint, ShapeKey } from '#src/types'
import { getPrismOutline, getSection, getVariant } from '#src/utils/shapes'

/** Число шагов угла на полный оборот. */
const ANGLE_STEPS = Math.round((2 * Math.PI) / TOY_ANGLE_STEP)

/** Номер шага угла, ближайшего к крену: по нему выбирается кэшированный силуэт. */
export const getAngleStep = (angle: number): number =>
  ((Math.round(angle / TOY_ANGLE_STEP) % ANGLE_STEPS) + ANGLE_STEPS) % ANGLE_STEPS

/** Экранный силуэт игрушки относительно её центра на шаге угла `step`: проекция призмы тела. */
export const getShapeOutline = (shape: ShapeKey, variant: number, step: number): ScreenPoint[] =>
  getPrismOutline(getSection(shape, variant), getVariant(shape, variant).depth, step * TOY_ANGLE_STEP)
