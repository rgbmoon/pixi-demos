import { inject, injectable, multiInject } from 'inversify'
import { TOKENS } from 'src/constants/tokens'
import { FATAL_MESSAGE } from 'src/errors/constants'
import { createAbortError, notifyFatal } from 'src/errors/utils'
import type { FlowStore } from 'src/stores/flow-store'
import { PhaseName } from 'src/types/game'

import { INITIAL_PHASE } from './constants'
import type { Phase } from './types'
import { tracePhase } from './utils'

/**
 * Движок конечного автомата: крутит петлю фаз, публикует активную фазу в FlowStore,
 * а фатальную ошибку — уведомлением. Граф переходов держат сами фазы — движок не знает их порядка.
 */
@injectable()
export class Fsm {
  private readonly phases: ReadonlyMap<PhaseName, Phase>
  private readonly flowStore: FlowStore
  private readonly abortController = new AbortController()

  constructor(@multiInject(TOKENS.Phase) phases: Phase[], @inject(TOKENS.FlowStore) flowStore: FlowStore) {
    this.flowStore = flowStore
    this.phases = new Map(phases.map((phase) => [phase.name, phase]))

    // Полнота набора проверяется при сборке: забытый биндинг фазы падает на маунте, а не посреди раунда
    for (const name of Object.values(PhaseName)) {
      this.getPhase(name)
    }
  }

  private getPhase(name: PhaseName): Phase {
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
    let next = INITIAL_PHASE

    while (!this.abortController.signal.aborted) {
      // getPhase внутри try: неизвестное имя фазы — такая же фатальная ошибка, петля не должна реджектиться
      let phase: Phase | undefined

      try {
        phase = this.getPhase(next)

        this.flowStore.setPhase(phase.name)
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
