import { injectable } from 'inversify'
import { Container } from 'pixi.js'

/**
 * Сцена игры: корень дерева отображения. Элементов на сцене пока нет, поэтому раскладка пустая.
 */
@injectable()
export class GameScene extends Container {
  layout(_screenWidth: number, _screenHeight: number): void {}
}
