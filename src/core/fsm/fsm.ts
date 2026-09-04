import { inject, injectable, multiInject } from 'inversify'
import { FATAL_MESSAGE } from 'src/core/errors/constants'
import { createAbortError, notifyFatal } from 'src/core/errors/utils'
import { CORE_TOKENS } from 'src/core/tokens'

import type { FsmConfig, Phase, PhaseSink } from './types'
import { tracePhase } from './utils'

/**
 * Движок конечного автомата: крутит петлю фаз, публикует активную фазу в `PhaseSink`,
 * а фатальную ошибку — уведомлением. Граф переходов держат сами фазы — движок не знает их порядка.
 */
@injectable()
export class Fsm {
  private readonly phases: ReadonlyMap<string, Phase>
  private readonly phaseSink: PhaseSink
  private readonly initial: string
  private readonly abortController = new AbortController()

  constructor(
    @multiInject(CORE_TOKENS.Phase) phases: Phase[],
    @inject(CORE_TOKENS.PhaseSink) phaseSink: PhaseSink,
    @inject(CORE_TOKENS.FsmConfig) config: FsmConfig
  ) {
    this.phaseSink = phaseSink
    this.initial = config.initial
    this.phases = new Map(phases.map((phase) => [phase.name, phase]))

    // Полнота набора проверяется при сборке: забытый биндинг фазы падает на маунте, а не посреди раунда
    for (const name of config.names) {
      this.getPhase(name)
    }
  }

  private getPhase(name: string): Phase {
    const phase = this.phases.get(name)

    if (!phase) {
      throw new Error(`Fsm: missing binding for phase ${name}`)
    }

    return phase
  }

  /**
   * Запускает петлю фаз со стартовой фазы и крутит её, пока автомат не остановят.
   */
  async start(): Promise<void> {
    let next = this.initial

    while (!this.abortController.signal.aborted) {
      // getPhase внутри try: неизвестное имя фазы — такая же фатальная ошибка, петля не должна реджектиться
      let phase: Phase | undefined

      try {
        phase = this.getPhase(next)

        this.phaseSink.setPhase(phase.name)
        tracePhase?.(phase.name)

        next = await phase.enter(this.abortController.signal)
      } catch (error) {
        if (this.abortController.signal.aborted) {
          return
        }

        notifyFatal(error, FATAL_MESSAGE)

        return
      } finally {
        phase?.exit?.()
      }
    }
  }

  /**
   * Останавливает автомат: абортит `signal` фаз, из-за чего реджектятся все ожидания
   * внутри них (события, анимации, запросы), а петля останавливается, не начав следующую фазу.
   */
  dispose(): void {
    this.abortController.abort(createAbortError('Game state machine stopped'))
  }
}
