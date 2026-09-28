import { inject, injectable } from 'inversify'
import { Container, type DestroyOptions, type Ticker } from 'pixi.js'

import { ROOM_FRAMES } from '#src/assets'
import { ART_PIXEL, DUST_AREA, GLOW_SOURCE_CENTER, SHADOW_CENTER } from '#src/constants'
import type { ScreenRect } from '#src/types'
import { Carpet } from '#src/ui/room/carpet'
import { Decals } from '#src/ui/room/decals'
import { Dust } from '#src/ui/room/dust'
import { Glow } from '#src/ui/room/glow'
import { Wainscot } from '#src/ui/room/wainscot'
import { Wallpaper } from '#src/ui/room/wallpaper'
import { getPlinthY, toArtPoint, toArtRect } from '#src/utils/room'
import { isReducedMotion } from '@pixi-demos/core/accessibility'
import type { GameTicker } from '@pixi-demos/engine/game-ticker'
import { LiveContainer } from '@pixi-demos/engine/live-container'
import { ENGINE_TOKENS } from '@pixi-demos/engine/tokens'

/**
 * Фон зала за автоматом: стена с обоями и декалями, панель с плинтусом и ковёр до краёв канваса, свет стеклянного куба
 * на стене с пылинками, тень автомата.
 */
@injectable()
export class RoomController extends LiveContainer {
  private readonly ticker: GameTicker
  private readonly layers = new Container()
  private readonly wallpaper: Wallpaper
  private readonly decals = new Decals()
  private readonly wainscot: Wainscot
  private readonly carpet: Carpet
  private readonly dust: Dust

  constructor(@inject(ENGINE_TOKENS.GameTicker) ticker: GameTicker) {
    super()

    this.ticker = ticker
    this.wallpaper = new Wallpaper(ticker)
    this.wainscot = new Wainscot(ticker)
    this.carpet = new Carpet(ticker)

    const source = toArtPoint(GLOW_SOURCE_CENTER)
    // Свет складывается с фоном: узор под пятном остаётся виден и светлеет
    const glow = new Glow(ROOM_FRAMES.wallGlow, 'add')
    const shadow = new Glow(ROOM_FRAMES.shadow, 'normal')

    glow.position.copyFrom(source)
    shadow.position.copyFrom(toArtPoint(SHADOW_CENTER))
    this.dust = new Dust({
      left: source.x - DUST_AREA.width / 2,
      top: source.y - DUST_AREA.height / 2,
      right: source.x + DUST_AREA.width / 2,
      bottom: source.y + DUST_AREA.height / 2,
    })

    // Ореол стены лежит под ковром: ковёр обрезает его по линии плинтуса
    this.layers.scale.set(ART_PIXEL)
    this.layers.addChild(this.wallpaper, this.decals, this.wainscot, glow, this.dust, this.carpet, shadow)
    this.addChild(this.layers)

    // Пылинки — декоративное движение: при уменьшенном движении их нет
    if (isReducedMotion()) this.dust.visible = false
    else this.ticker.add(this.step)
  }

  override destroy(options?: DestroyOptions): void {
    if (this.destroyed) return

    this.ticker.remove(this.step)
    super.destroy(options)
  }

  /** Закрывает фоном прямоугольник `area` в единицах сцены. */
  cover(area: ScreenRect): void {
    const { left, top, right, bottom } = toArtRect(area)
    const plinthY = getPlinthY()
    const panelTop = plinthY - this.wainscot.tileHeight

    this.wallpaper.cover({ left, top, right, bottom: panelTop }, panelTop)
    this.decals.cover({ left, top, right, bottom: panelTop })
    this.wainscot.cover({ left, top: panelTop, right, bottom: plinthY }, panelTop)
    this.carpet.cover({ left, top: plinthY, right, bottom }, plinthY)
  }

  private step = (ticker: Ticker): void => {
    this.dust.advance(ticker.deltaMS)
  }
}
