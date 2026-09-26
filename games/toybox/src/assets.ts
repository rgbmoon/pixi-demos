import { Assets, type Spritesheet } from 'pixi.js'

// Единый манифест ассетов toybox: все URL в одном месте. Атласы и шрифты собирает `pnpm assets` из
// `games/toybox/art/`; `preloadGameAssets` грузит их одним `Assets.load` до сборки сцены, классы читают их из
// кэша синхронно (`Assets.get`).

const ASSETS_DIR = '/games/toybox/assets'

/** Атласы игры: алиас в кэше Assets → URL JSON атласа. */
export const ATLASES = {
  // TODO заменить первым атласом арта в Т4: фикстура проверяет сборку и загрузку
  fixture: `${ASSETS_DIR}/fixture/fixture.json`,
} as const

/**
 * Грузит атласы в кэш Assets. Каждому атласу после загрузки ставится выборка ближайшего пикселя (`nearest`):
 * пиксель-арт рисуется целым масштабом без сглаживания. `TextureSource.defaultOptions` не меняется, потому что
 * его использует и слот.
 */
export async function preloadGameAssets(): Promise<void> {
  const sheets = await Assets.load<Spritesheet>(Object.entries(ATLASES).map(([alias, src]) => ({ alias, src })))

  for (const sheet of Object.values(sheets)) sheet.textureSource.scaleMode = 'nearest'
}
