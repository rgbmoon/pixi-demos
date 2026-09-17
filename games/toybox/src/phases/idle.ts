import { injectable } from 'inversify'

import { PhaseName } from '#src/types'
import type { Phase } from '@pixi-demos/core/fsm/types'

/**
 * Фаза покоя: ввода игрока у игры пока нет, поэтому фаза длится до остановки автомата.
 * Реджект по `signal` петля автомата отсеивает и завершается без уведомления.
 */
@injectable()
export class IdlePhase implements Phase<PhaseName> {
  readonly name = PhaseName.idle

  enter(signal: AbortSignal): Promise<never> {
    return new Promise<never>((_resolve, reject) => {
      if (signal.aborted) {
        reject(signal.reason as Error)

        return
      }

      signal.addEventListener('abort', () => reject(signal.reason as Error), { once: true })
    })
  }
}
