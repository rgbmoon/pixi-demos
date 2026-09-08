# Рил-машина

Устройство барабанов слот-машины: headless-модель, PIXI-адаптер и то, как к ним подключается игра.

- Модель — [`src/core/reels/`](../src/core/reels), чистый TS без PIXI и React.
- Адаптер — [`src/engine/reels/`](../src/engine/reels), PIXI.
- Со стороны игры — конфиг барабанов и арт ячейки; как это выглядит, разобрано в
  [§5 «Как подключить»](#5-как-подключить) на примере слота.

---

## 1. Мотивация

Барабан объединяет три разные вещи: **данные раунда** (какой символ в какой ячейке),
**движение** (лента едет, тормозит, садится) и **рисование** (спрайты, скелеты, маска). Пока они
живут в одном PIXI-классе, любая новая механика — каскад, held-барабан, nudge, турбо — правит тот же
класс, и её нельзя ни проверить, ни переиспользовать отдельно от рендера.

Поэтому машина разрезана надвое:

> **Ядро ничего не рисует. Адаптер ничего не решает.**

Ядро принимает данные раунда и конфиг барабанов, отдаёт ячейки со значениями и контекстом и ведёт
движение ленты. Адаптер каждый кадр двигает модель и переносит её слоты в PIXI-объекты.

Действующие лица:

| Сущность                           | Слой    | Что это                                                   |
| ---------------------------------- | ------- | --------------------------------------------------------- |
| `ReelsMachine`                     | ядро    | вся машина: данные раунда, состав барабанов, общий такт   |
| `Reel`                             | ядро    | один барабан: лента слотов, своя фаза и свои стратегии    |
| `Cell`                             | ядро    | стабильный адрес `(барабан, ряд)` и значение раунда в нём |
| `Row`                              | ядро    | поперечный ряд: по ячейке с каждого барабана              |
| `StripSlot`                        | ядро    | движущийся слот ленты: позиция, значение и поза           |
| `ReelDef`                          | конфиг  | описание барабана: id, ряды, стратегии, аксессор          |
| `ReelsConfig`                      | конфиг  | состав машины и значения по умолчанию для барабанов       |
| `SpinStrategy` / `LandingStrategy` | конфиг  | как барабан крутится и как садится                        |
| `ReelsView` / `ReelView`           | адаптер | PIXI-обёртка: маска, ленты view, единственный такт        |
| `CellView`                         | адаптер | контракт view ячейки, который реализует игра: `setValue` и `setMoving` |

Что это даёт: новая механика — это стратегия или правка модели, рендер не меняется; модель —
чистая функция от кадров и воспроизводится без канваса; ядро выносится в отдельный пакет одной
папкой.

Разделение на платформо-независимое ядро и тонкий адаптер под конкретный рендер — та же схема, что
у headless-библиотек вроде [TanStack Table](https://tanstack.com/table/latest/docs/overview).

---

## 2. Архитектура

```
src/core/reels/                 headless: ни PIXI, ни React, ни тикера
  types.ts                      контракты: описания барабанов, слот ленты, стратегии
  constants.ts                  умолчания модели и допуск на границе ленты
  utils.ts                      математика замкнутой ленты: выравнивание и свёртка позиций
  reels-machine.ts              ReelsMachine — данные раунда, состав барабанов, такт
  reel.ts                       Reel — лента, движение, посадка
  cell.ts                       Cell — стабильный адрес (барабан, ряд)
  row.ts                        Row — поперечный ряд
  strategies/                   готовые стратегии прокрутки и посадки со своими настройками

src/engine/reels/               PIXI-адаптер
  types.ts                      CellView, ReelsViewConfig
  reels-view.ts                 ReelsView — маска, ленты, единственный тикер-колбэк
  reel-view.ts                  ReelView — view слотов одной ленты

<игра>/                         конфиг барабанов, view ячейки, контроллер для фаз — см. §5
```

Зависимости строго вниз: `игра → engine/reels → core/reels`. Ядро не зависит ни от адаптера, ни от
игры, адаптер — от игры. Проверяется теми же ESLint-границами, что и остальные пакеты.

### Кадр

```
GameTicker
  └─ ReelsView.step(deltaTime)
       ├─ machine.advance(deltaFrames)          модель: сдвинуть ленты, наполнить обёрнутые слоты
       └─ ReelsView.sync()                      перенести слоты изменившихся барабанов в view
            └─ ReelView.sync(strip)
                 view.y = slot.offset
                 view.setValue(slot.value)
                 view.setMoving(slot.moving)
```

Один тикер-колбэк на всю машину. Доступа к тикеру у модели нет: величина шага приходит аргументом
в `advance`.

---

## 3. Модель данных

### Две разные ячейки

Это главное различие, и его стоит держать в голове:

|              | `Cell`                            | `StripSlot`                            |
| ------------ | --------------------------------- | -------------------------------------- |
| Что это      | стабильный адрес `(барабан, ряд)` | движущийся слот ленты                  |
| Сколько      | `rows` на барабан                 | `rows + buffer` на барабан             |
| Живёт        | весь маунт, адрес не меняется     | весь маунт, но ездит и меняет значение |
| Значение     | из данных раунда через аксессор   | то, что показано сейчас                |
| Кто адресует | линии выплат, оверлеи, каскады    | рендер                                 |

Во время вращения они расходятся: `cell.getValue()` уже знает результат раунда, а `cell.getSlot()`
показывает то, что физически стоит в ячейке. После посадки совпадают.

### Единицы измерения

Ядро считает в **абстрактных единицах длины**. `cellHeight` — число из конфига, физический смысл
которого ядро не интерпретирует. Игра, передающая нативные пиксели зоны символов, получает
`slot.offset`, который адаптер переносит прямо в `view.y` без пересчёта; игре, которой удобнее
считать в ячейках, достаточно передать `cellHeight: 1` и умножать на своей стороне.

Скорости и ускорения — **на кадр приведённой частоты**: `deltaFrames = 1` при 60 fps, как
`Ticker.deltaTime` у PIXI.

### Лента

Слоты барабана лежат на замкнутой ленте длиной `stripHeight = (rows + buffer) * cellHeight`.
Барабан держит одно число — `offset`, накопленный путь ленты. Позиция слота выводится из него:

```
позиция слота i = wrapOffset(cellHeight * (i - buffer) + offset)
диапазон        = [-buffer * cellHeight, rows * cellHeight)
```

Буферные ячейки лежат **над** зоной: в них слот успевает сменить значение вне маски.

```
пример: offset = 0, rows = 3, buffer = 1, cellHeight = h

  -h  ┌─────────┐  слот вне зоны: здесь меняется значение
      ├─────────┤
   0  │  ряд 0  │
      ├─────────┤
   h  │  ряд 1  │   видимая зона, накрыта маской
      ├─────────┤
  2h  │  ряд 2  │
      └─────────┘
  3h  ← граница диапазона: перешагнув её, слот появляется сверху на -h
```

---

## 4. API

### `ReelsMachine<TData, TValue>`

| Метод                                             | Что делает                                                             |
| ------------------------------------------------- | ---------------------------------------------------------------------- |
| `constructor(config: ReelsConfig<TData, TValue>)` | собирает барабаны, ряды и ячейки                                       |
| `getData(): TData \| null`                        | текущие данные раунда                                                  |
| `setData(data: TData \| null): void`              | записывает результат раунда; из него читают посадка и `Cell.getValue`  |
| `reset(): void`                                   | мгновенно ставит ленты по текущим данным — стартовая доска             |
| `spin(): void`                                    | запускает прокрутку всех барабанов                                     |
| `land(signal?): Promise<void>`                    | сажает все барабаны, `Promise.all` по лентам                           |
| `advance(deltaFrames): void`                      | шаг модели; зовёт владелец такта                                       |
| `getReels() / getReel(i)`                         | барабаны                                                               |
| `getRows()`                                       | поперечные ряды                                                        |
| `getCell(index) / getGrid()`                      | ячейка по адресу / сетка `[барабан][ряд]`                              |
| `getPhase(): ReelPhase`                           | `landing`, если садится хоть один; `spinning`, если крутится хоть один |

### `Reel<TData, TValue>`

| Член                                             | Что делает                                                                  |
| ------------------------------------------------ | --------------------------------------------------------------------------- |
| `id`, `index`, `def`, `machine`                  | тождество барабана                                                          |
| `getPhase(): ReelPhase`                          | `idle` / `spinning` / `landing`                                             |
| `getRevision(): number`                          | счётчик правок ленты — см. [§8](#8-инварианты-и-подводные-камни)            |
| `getCells() / getCell(row)`                      | стабильные ячейки поля                                                      |
| `getStrip(): readonly StripSlot[]`               | слоты в **порядке создания**: он стабилен, по нему адаптер держит свои view |
| `getVisibleSlotIndices(): number[]`              | индексы слотов внутри зоны сверху вниз                                      |
| `getSlotAt(row)`                                 | слот, занимающий ряд сейчас                                                 |
| `readValue(row)`                                 | значение ряда в данных раунда                                               |
| `reset() / spin() / land(signal?) / advance(dt)` | то же, что у машины, но на одной ленте                                      |

### `Cell<TData, TValue>`

| Член                                | Что делает                                        |
| ----------------------------------- | ------------------------------------------------- |
| `id`, `index`, `reel`, `machine`    | тождество ячейки; `id` — `` `${reelId}_${row}` `` |
| `getValue(): TValue \| undefined`   | значение из данных раунда через аксессор          |
| `getSlot(): StripSlot \| undefined` | что физически стоит в ячейке сейчас               |
| `getContext(): CellContext`         | `{ machine, reel, cell, getValue }`               |

### `Row<TData, TValue>`

`index` и `getCells()` — по ячейке с каждого барабана слева направо.

### Стратегии

```ts
/** Как барабан крутится: путь ленты за кадр. */
type SpinStrategy = {
  step(deltaFrames: number, context: ReelContext): number
}

/** Как барабан садится: расписание пути от текущей позиции ленты. */
type LandingStrategy = {
  plan(context: LandingContext): LandingPlan
}

type LandingPlan = {
  readonly distance: number // полный путь до остановки
  readonly totalFrames: number // длительность посадки в кадрах
  positionAt(frames: number): number
}

type ReelContext = {
  readonly index: number // номер барабана — им стратегия делает лесенку
  readonly rows: number
  readonly buffer: number
  readonly cellHeight: number
  readonly stripHeight: number
}

type LandingContext = ReelContext & {
  readonly fromOffset: number // позиция ленты в момент начала посадки
}
```

Готовые: `LinearSpinStrategy` — равномерная прокрутка, и `PlannedLandingStrategy` — посадка
из трёх участков (равномерный ход, торможение, отскок). Их настройки объявлены рядом с ними
в `strategies/types.ts`; пример заполнения — в [§5](#шаг-1-конфиг-барабанов).

### `ReelsView<TData, TValue, TView>`

| Член                                     | Что делает                                            |
| ---------------------------------------- | ----------------------------------------------------- |
| `constructor(ticker, machine, config)`   | создаёт ленты view, маску зоны и ставит такт на тикер |
| `getCellView(index): TView \| undefined` | view, занимающий ячейку сейчас                        |
| `getGridViews(): TView[][]`              | сетка view `[барабан][ряд]`                           |
| `destroy(options?)`                      | снимает такт с тикера                                 |

---

## 5. Как подключить

Четыре шага. Ниже — как это сделано в слоте.

### Шаг 1. Конфиг барабанов

[`src/games/slot/reels.ts`](../src/games/slot/reels.ts):

```ts
/** Данные раунда для лент: сетка символов `[барабан][ряд]`. */
export type SlotReelsData = SymbolKey[][]

export const SLOT_REELS: ReelsConfig<SlotReelsData, SymbolKey> = {
  reels: Array.from({ length: REELS_COUNT }, (_, index) => ({ id: `reel-${index}` })),
  rows: VISIBLE_SYMBOLS_COUNT,
  buffer: BUFFER_SYMBOLS_COUNT,
  cellHeight: CELL_HEIGHT,
  accessorFn: (data, { reel, row }) => data[reel]?.[row],
  getFillerValue: () => getRandomSymbolKey(),
  spinStrategy: new LinearSpinStrategy({ speed: SPIN_SPEED }),
  landingStrategy: new PlannedLandingStrategy({
    speed: SPIN_SPEED,
    deceleration: LANDING_DECELERATION,
    handoverSpeed: LANDING_HANDOVER_SPEED,
    easeCells: LANDING_EASE_CELLS,
    backStrength: LANDING_BACK_STRENGTH,
    staggerCells: LAND_STAGGER_CELLS,
  }),
}
```

Два обязательных колбэка:

- **`accessorFn(data, index)`** — как достать значение ячейки из результата раунда. Форма данных
  целиком за игрой: `[барабан][ряд]`, `[ряд][барабан]`, объект — ядро её не ограничивает.
- **`getFillerValue(reel)`** — чем наполнять ленту там, где результата нет: во время вращения и в
  буферных ячейках.

Любое поле конфига перекрывается на отдельном барабане через `ReelDef` — ряды, буфер, стратегии,
аксессор.

### Шаг 2. View ячейки

Реализовать `CellView<TValue>` — два метода поверх обычного `Container`:

```ts
export class ReelSymbol extends SpineAnimation implements CellView<SymbolKey> {
  setValue(key: SymbolKey): void // показать значение
  setMoving(moving: boolean): void // размытая поза против покоя
}
```

Оба обязаны быть **идемпотентны**: адаптер зовёт их на каждой синхронизации, и повторный вызов с тем
же аргументом не должен ничего перезапускать. Всё остальное — арт, скелеты, дополнительные позы —
дело игры и адаптеру не адресовано.

### Шаг 3. Адаптер в дерево сцены

[`ui/reels/reels-board.ts`](../src/games/slot/ui/reels/reels-board.ts):

```ts
this.reelsView = new ReelsView(ticker, machine, {
  cellWidth: CELL_WIDTH,
  cellHeight: CELL_HEIGHT,
  zoneWidth: REELS_ZONE_WIDTH,
  zoneHeight: REELS_ZONE_HEIGHT,
  createCellView: () => new ReelSymbol(pool),
})

this.reelsView.position.set(CELLS_ORIGIN_X, CELLS_ORIGIN_Y)

this.frame = new ReelsFrame(ticker)
this.frame.addChildToSymbolsSlot(this.reelsView)
```

### Шаг 4. Контроллер и фазы

[`controllers/reels/reels-machine.ts`](../src/games/slot/controllers/reels/reels-machine.ts):

```ts
this.machine = new ReelsMachine(SLOT_REELS)
this.board = new ReelsBoard(ticker, this.machine, pool)

// стартовая доска: данные приходят из стора, писать в него может только автомат
this.watch(() => slotStore.initialSymbols, (initialSymbols) => this.setSymbols(initialSymbols), {
  fireImmediately: true,
})

private setSymbols(symbols: SlotReelsData | undefined): void {
  if (!symbols) return

  this.machine.setData(symbols)
  this.machine.reset()
}

spin(): void {
  this.machine.spin()
}

land(symbolKeys: SlotReelsData | undefined, signal?: AbortSignal): Promise<void> {
  this.machine.setData(symbolKeys ?? null)

  return this.machine.land(signal)
}
```

Фазы дальше зовут только контроллер: `spin()` — когда раунд начался, `await land(данные, signal)` —
когда пришёл результат сервера. Ядра и адаптера они не видят вовсе.

---

## 6. Жизненный цикл

### `reset()` — стартовая доска

Ставит `offset = 0` и раздаёт видимым слотам значения из данных раунда; буферный слот не затрагивает.
Работает только когда барабан в покое — на крутящемся барабане это no-op.

### `spin()` — прокрутка

Переводит барабан в `spinning` и помечает все слоты `moving = true`. Значения не меняет: они
обновятся, когда слоты начнут оборачиваться.

Каждый кадр `advanceSpin` двигает `offset` на `spinStrategy.step(...)` и пересчитывает позиции.
Слот, сменивший круг, получает `getFillerValue(reel)` и `moving = true`.

### `land(signal)` — посадка

1. Барабан не в `spinning` — промис резолвится сразу.
2. `landingStrategy.plan({ ...context, fromOffset })` считает расписание один раз.
3. Каждый кадр `advanceLanding` берёт `plan.positionAt(elapsed)` и ставит `offset` в него.
   Шаг может быть **отрицательным** — на отскоке лента возвращается из-за точки посадки.
4. Слот, сменивший круг, узнаёт своё финальное значение (ниже).
5. На последнем кадре — `snap()`, и промис резолвится.

`signal` реджектит промис и возвращает барабан в покой.

### Как слот узнаёт финальное значение

Точка остановки слота известна на **любом** кадре посадки: это его текущая позиция плюс непройденный
остаток пути. Поэтому символ садится в покое ещё на последнем обороте, а не рывком после остановки:

```ts
const landingOffset = slot.offset + remaining

// слот пройдёт ещё круг: наполняем случайным значением и оставляем размытым
if (landingOffset >= rows * cellHeight) return this.fill(slot)

const value = this.readValue(Math.round(landingOffset / cellHeight))

if (value === undefined) return this.fill(slot)

slot.value = value
slot.moving = false
```

### Расписание `PlannedLandingStrategy`

```
путь = оборот ленты + лесенка (index * staggerCells) + тормозной путь + хвост отскока
       + добор до границы ячейки

  скорость
     speed ├──────────────┐
           │   равномерно  \  линейное торможение
  handover │                \────┐
           │                     │ отскок easeOutBack с забросом
         0 └─────────────────────┴──── кадры
```

Полный оборот ленты в дистанции гарантирует, что **каждый** слот обернётся хотя бы раз и получит
значение раунда. Добор до границы ячейки делает всю дистанцию кратной ячейке, поэтому лента садится
ровно. Длительность отскока подобрана по производной кривой в нуле, чтобы он подхватил ленту на
`handoverSpeed` без рывка.

---

## 7. Расширение

### Своя стратегия прокрутки

Реверс — весь файл:

```ts
/** Обратная прокрутка: лента идёт вверх. */
export class ReverseSpinStrategy implements SpinStrategy {
  private readonly speed: number

  constructor(options: LinearSpinOptions) {
    this.speed = options.speed
  }

  step(deltaFrames: number): number {
    return -this.speed * deltaFrames
  }
}
```

Работает без единой правки ядра: обёртка ловится сменой круга, а она не зависит от направления.

### Своя стратегия посадки

Турбо — обёртка над готовой:

```ts
/** Сжатое расписание: те же участки, но лента идёт быстрее и тормозит резче. */
export class TurboLandingStrategy implements LandingStrategy {
  private readonly planned: PlannedLandingStrategy

  constructor(options: PlannedLandingOptions, factor: number) {
    this.planned = new PlannedLandingStrategy({
      ...options,
      speed: options.speed * factor,
      deceleration: options.deceleration * factor ** 2,
      staggerCells: 0,
    })
  }

  plan(context: LandingContext): LandingPlan {
    return this.planned.plan(context)
  }
}
```

Подключение — одна строка в конфиге игры либо в `ReelDef` конкретного барабана.

### Место остальных механик

| Механика             | Где живёт                                  | Что уже готово                                                                  |
| -------------------- | ------------------------------------------ | ------------------------------------------------------------------------------- |
| Независимые барабаны | есть                                       | у каждого свой `offset`, фаза и стратегии; `land` — `Promise.all`               |
| Турбо                | `LandingStrategy`                          | расписание целиком в стратегии                                                  |
| Slam stop            | `Reel`                                     | перевод `elapsed` в `plan.totalFrames`; расписание уже считает позицию по кадру |
| Реверс, nudge        | `SpinStrategy`                             | обёртка по кругу, направление не зашито                                         |
| Held-барабаны        | флаг в `ReelDef`, проверка в `Reel.spin()` | `ReelDef` уже на барабан                                                        |
| Каскады              | трансформация ленты между раундами         | `Cell` отделена от `StripSlot` — точка расширения готова                        |
| Двойные ячейки       | `StripSlot.span`                           | позиции считаются от `offset`, а не от `row * cellHeight`                       |

### Что менять не надо

Адаптер. Если механика требует правки `ReelsView` или `ReelView` — почти наверняка её место в
модели. Единственная законная причина изменить адаптер — новый способ рисовать ячейку, и он
решается реализацией `CellView` на стороне игры.

---

## 8. Инварианты и подводные камни

**Тактом владеет адаптер.** `machine.advance()` зовётся из одного места — тикер-колбэка `ReelsView`.
Два адаптера на одну машину продвинут её дважды за кадр.

**Сверка по ревизии — не оптимизация.** `Reel.getRevision()` растёт на каждой правке ленты, адаптер
помнит последнее отрисованное значение и пропускает барабаны, где ничего не изменилось. Так сделано
потому, что **у остановленного барабана его view может временно забрать сцена** — например, поднять
выигравшие символы поверх затемнения, чтобы они не попали под маску. Запись позиций в это время
перебила бы положение, выставленное сценой. В прежней реализации это обеспечивалось само:
у неподвижного барабана не было тикер-колбэка.

**Граница диапазона ленты.** Позиции слотов выводятся из одного числа через `%`, и точка покоя слота
может попасть ровно на границу диапазона. С какой её стороны окажется результат, решает порядок
ошибок округления: слот встаёт под зоной вместо буфера над ней, а соответствие «слот → ряд»
смещается на единицу. На замере это давало примерно каждую десятую точку покоя — то есть промах
раз в несколько спинов. Устраняется допуском `WRAP_EPSILON`, согласованным в `wrapOffset` и
`getLap`: границу они обязаны трактовать одинаково. Регрессия закрыта тестом свёртки ленты.

**`snap()` намеренно не меняет позы.** Покой каждый слот получает на своём последнем обороте;
повторное переключение сбросило бы фазу idle-анимации.

**`getValue()` против `getSlot()`.** Первое — данные раунда, второе — экран. Во время вращения они
расходятся. Линиям и подсчётам нужно первое, рендеру и оверлеям — второе.

**Порядок `getStrip()` стабилен**, порядок `getVisibleSlotIndices()` — нет: он пересортировывается
по позициям. Держать view по индексу можно только от первого.

---

## 9. Вынос в отдельный пакет

`src/core/reels/` переносится без изменений: внешних зависимостей у него нет, кроме `src/core/easing`
(её использует `PlannedLandingStrategy`) — либо она переносится вместе, либо кривая передаётся
в стратегию опцией.

`src/engine/reels/` — второй пакет, адаптер: зависит от `pixi.js` и от `GameTicker`. Последний
сводится к интерфейсу «`add`/`remove` колбэка с `deltaTime`», и это единственное, что придётся
развязать.

Игра остаётся у себя целиком: `ReelsConfig`, реализация `CellView`, арт и раскладка.
