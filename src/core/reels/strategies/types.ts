/** Настройки равномерной прокрутки. Скорость — на кадр приведённой частоты (deltaFrames = 1 при 60 fps). */
export type LinearSpinOptions = {
  readonly speed: number
}

/** Настройки трёхучасткового расписания посадки: разгонный участок, линейное торможение, отскок. */
export type PlannedLandingOptions = {
  /** Скорость ленты на равномерном участке, единиц/кадр. */
  readonly speed: number
  /** На столько падает скорость ленты за кадр торможения, единиц/кадр². */
  readonly deceleration: number
  /** Скорость, до которой торможение доводит ленту перед отскоком, единиц/кадр. */
  readonly handoverSpeed: number
  /** Хвост посадки, который лента проходит отскоком, в долях ячейки. */
  readonly easeCells: number
  /** Сила отскока в терминах `easeOutBack`. */
  readonly backStrength: number
  /** Лесенка остановки: на столько ячеек каждый следующий барабан крутится дольше предыдущего. */
  readonly staggerCells: number
  /** Минимум кадров вращения до начала торможения, считая кадры до посадки; по умолчанию 0. */
  readonly minSpinFrames?: number
  /** Дополнительный путь на каждую паузу anticipation, в ячейках; по умолчанию 0. */
  readonly anticipationCells?: number
}

/** Настройки падения каскада под постоянным ускорением. */
export type GravityFallOptions = {
  /** Ускорение падения, единиц/кадр². */
  readonly gravity: number
  /** Лесенка: на столько кадров каждый следующий падающий барабан стартует позже предыдущего. */
  readonly staggerFrames: number
  /** Внутри барабана нижний слот стартует первым, каждый ряд выше — на столько кадров позже. */
  readonly rowStaggerFrames: number
  /** Высота отскока после касания ряда, в долях ячейки; по умолчанию 0. */
  readonly bounceCells?: number
  /** Длительность отскока в кадрах; по умолчанию 0. */
  readonly bounceFrames?: number
}
