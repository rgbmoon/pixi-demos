import path from 'node:path'

import { AssetPack, type AssetPackConfig } from '@assetpack/core'
import { texturePacker } from '@assetpack/core/texture-packer'

import { SIDECAR_SUFFIX, TEXTURE_PACKER_OPTIONS } from '#src/constants'
import { bitmapFontPipe } from '#src/pipes/bitmap-font'
import { composePipe } from '#src/pipes/compose'
import { frameMetaPipe } from '#src/pipes/frame-meta'
import { lightPipe } from '#src/pipes/light'
import { outlinePipe } from '#src/pipes/outline'
import { palettePipe } from '#src/pipes/palette'
import { previewPipe } from '#src/pipes/preview'
import { projectionPipe } from '#src/pipes/projection'
import { rotspritePipe } from '#src/pipes/rotsprite'
import { stagePipe } from '#src/pipes/stage'
import { tileCheckPipe } from '#src/pipes/tile-check'
import type { AssetBuildOptions } from '#src/types'

/**
 * Сборка ассетов игры в два прогона AssetPack. Прогон подготовки своими пайпами строит кадры из исходников арта,
 * прогон упаковки собирает из них атласы и шрифты. Встроенный упаковщик читает кадры папки с диска, поэтому
 * кадры записываются на диск между прогонами.
 */
export class AssetBuild {
  private readonly options: AssetBuildOptions

  constructor(options: AssetBuildOptions) {
    this.options = options
  }

  /** Выполняет оба прогона. Ошибка пайпа завершает процесс с кодом 1. */
  async run(): Promise<void> {
    const stage = path.join(this.options.cacheDir, 'stage')

    await new AssetPack(this.getPrepareConfig(stage)).run()
    await new AssetPack(this.getPackConfig(stage)).run()
  }

  private getCommonConfig(): AssetPackConfig {
    return {
      cache: false,
      cacheLocation: path.join(this.options.cacheDir, 'assetpack'),
      logLevel: this.options.logLevel ?? 'info',
      strict: true,
    }
  }

  private getPrepareConfig(stage: string): AssetPackConfig {
    const {
      entry,
      ignore = [],
      palette,
      targetPalette,
      faces = {},
      projections = {},
      outlineColor,
      previewDir,
    } = this.options

    return {
      ...this.getCommonConfig(),
      entry,
      output: stage,
      // Сайдкары читают пайпы; в каталог подготовки их пишет stage уже с данными после преобразований
      ignore: [...ignore, `**/*${SIDECAR_SUFFIX}`],
      pipes: [
        composePipe(faces),
        palettePipe({ palette, target: targetPalette }),
        projectionPipe(projections),
        rotspritePipe(),
        outlinePipe(outlineColor),
        lightPipe(targetPalette ?? palette),
        tileCheckPipe(previewDir),
        stagePipe(),
      ],
    }
  }

  private getPackConfig(stage: string): AssetPackConfig {
    const { output, previewDir } = this.options

    return {
      ...this.getCommonConfig(),
      entry: stage,
      output,
      ignore: [`**/*${SIDECAR_SUFFIX}`],
      pipes: [
        bitmapFontPipe(),
        texturePacker(TEXTURE_PACKER_OPTIONS),
        frameMetaPipe(),
        ...(previewDir ? [previewPipe(previewDir)] : []),
      ],
    }
  }
}
