import { inject, injectable } from 'inversify'
import type { GameTicker } from 'src/engine/game-ticker'
import { LiveContainer } from 'src/engine/live-container'
import { ENGINE_TOKENS } from 'src/engine/tokens'
import { tweenAlpha } from 'src/engine/utils'
import { BUTTON_ICONS } from 'src/games/slot/assets'
import {
  CHECKBOX_SIZE,
  MODAL_FADE_MS,
  MODAL_HEADER_HEIGHT,
  MODAL_PADDING,
  MODAL_ROW_GAP,
  PANEL_HEIGHT,
} from 'src/games/slot/constants'
import type { SlotStore } from 'src/games/slot/stores/slot'
import { SLOT_TOKENS } from 'src/games/slot/tokens'
import { ButtonSize, ButtonVariant } from 'src/games/slot/types'
import { Button } from 'src/games/slot/ui/hud/button'
import { Modal } from 'src/games/slot/ui/hud/modal'

import type { GameModePanelController } from './game-mode-panel'
import type { TurboCheckboxController } from './turbo-checkbox'

/**
 * Модальное окно настроек.
 */
@injectable()
export class SettingsModalController extends LiveContainer {
  private readonly ticker: GameTicker
  private readonly modal = new Modal('Settings')
  private readonly closeButton: Button
  private readonly gameModePanel: GameModePanelController
  private readonly turboCheckbox: TurboCheckboxController
  private fadeAbort?: AbortController

  constructor(
    @inject(ENGINE_TOKENS.GameTicker) ticker: GameTicker,
    @inject(SLOT_TOKENS.SlotStore) slotStore: SlotStore,
    @inject(SLOT_TOKENS.GameModePanelController) gameModePanel: GameModePanelController,
    @inject(SLOT_TOKENS.TurboCheckboxController) turboCheckbox: TurboCheckboxController
  ) {
    super()

    this.ticker = ticker
    this.gameModePanel = gameModePanel
    this.turboCheckbox = turboCheckbox

    this.closeButton = new Button({
      variant: ButtonVariant.circle,
      size: ButtonSize.md,
      icon: BUTTON_ICONS.close,
      label: 'Close settings',
      onTap: () => slotStore.closeSettings(),
    })

    this.modal.addContent(gameModePanel)
    this.modal.addContent(turboCheckbox)
    this.modal.addContent(this.closeButton)

    this.addChild(this.modal)

    // Модалка создаётся скрытой, иначе первая реакция запустит видимый твин alpha от 1 к 0
    this.alpha = 0
    this.visible = false

    this.watch(
      () => slotStore.isSettingsOpen,
      (isOpen) => void this.toggle(isOpen),
      { fireImmediately: true }
    )
  }

  /** Ставит модалку на видимую область экрана и расставляет содержимое по плашке. */
  layout(left: number, top: number, width: number, height: number): void {
    this.position.set(left, top)

    this.modal.layout(width, height)

    // Кнопка закрытия — в шапке, содержимое — под разделителем
    this.closeButton.position.set(
      this.modal.plateWidth - MODAL_PADDING - this.closeButton.sizeUnits,
      (MODAL_HEADER_HEIGHT - this.closeButton.sizeUnits) / 2
    )
    this.gameModePanel.position.set(this.modal.plateWidth / 2, MODAL_HEADER_HEIGHT + MODAL_PADDING + PANEL_HEIGHT / 2)
    this.turboCheckbox.position.set(
      this.modal.plateWidth / 2,
      MODAL_HEADER_HEIGHT + MODAL_PADDING + PANEL_HEIGHT + MODAL_ROW_GAP + CHECKBOX_SIZE / 2
    )
  }

  /**
   * Показывает или прячет модалку. Закрытой выставляется `visible = false`:
   * слой доступности PIXI обходит только видимые объекты.
   */
  private async toggle(isOpen: boolean): Promise<void> {
    this.fadeAbort?.abort()

    const abort = new AbortController()

    this.fadeAbort = abort

    if (isOpen) this.visible = true

    try {
      await tweenAlpha(this.ticker, this, isOpen ? 1 : 0, MODAL_FADE_MS, abort.signal)

      this.visible = isOpen
    } catch {
      // Твин прерван следующим вызовом toggle; alpha изменяет твин этого вызова
    } finally {
      if (this.fadeAbort === abort) this.fadeAbort = undefined
    }
  }
}
