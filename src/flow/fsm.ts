import { inject, injectable, multiInject } from 'inversify'
import { TOKENS } from 'src/constants/tokens'
import type { FlowStore } from 'src/stores/flow-store'
import { PhaseName } from 'src/types/game'

import { INITIAL_PHASE } from './constants'
import type { Phase } from './types'
import { tracePhase } from './utils'

/**
 * Движок конечного автомата: крутит петлю фаз, публикует активную фазу и фатальную
 * ошибку в FlowStore. Граф переходов держат сами фазы — движок не знает их порядка.
 */
@injectable()
export class Fsm {
  private readonly phases: ReadonlyMap<PhaseName, Phase>
  private readonly flowStore: FlowStore
  private readonly controller = new AbortController()

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
      throw new Error(`Fsm: отсутствует биндинг фазы ${name}`)
    }

    return phase
  }

  /**
   * Запускает петлю фаз со стартовой фазы и крутит её, пока автомат не остановят.
   */
  async start(): Promise<void> {
    let next = INITIAL_PHASE

    while (!this.controller.signal.aborted) {
      const phase = this.getPhase(next)

      this.flowStore.setPhase(phase.name)
      tracePhase?.(phase.name)

      try {
        next = await phase.enter(this.controller.signal)
      } catch (error) {
        if (this.controller.signal.aborted) {
          return
        }

        this.flowStore.setFatalError(error)

        return
      } finally {
        phase.exit?.()
      }
    }
  }

  /**
   * Останавливает автомат: абортит `signal` фаз, из-за чего реджектятся все ожидания
   * внутри них (события, анимации, запросы), а петля останавливается, не начав следующую фазу.
   */
  dispose(): void {
    this.controller.abort(new Error('Игровой автомат остановлен'))
  }
}
