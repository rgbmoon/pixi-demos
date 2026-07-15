# CLAUDE.md

Инструкция для Claude по проекту **pixi-game**. Читается в начале каждой сессии — держи её актуальной.

> Язык проекта — русский: UI-тексты, комментарии в коде и эта документация на русском. Пиши так же.

---

## Обзор

Пет-проект для изучения PIXI.js и геймдева. Цель — **слот-машина**.

**Статус: каркас.** Все пять слоёв целевой архитектуры реализованы, сквозной демо-спин работает (кнопка → сеть → стор → контроллер → анимация-заглушка); настоящей слот-логики (барабаны, символы, линии) и Spine **пока нет** (см. [Целевая архитектура](#целевая-архитектура)).

**Стек:** React 19 · PIXI.js v8 · MobX 6 · inversify 8 (DI-контейнер) · Tailwind CSS v4 · react-router-dom v7 · TypeScript 6 · Vite 8; сеть — zod + partysocket, моки — MSW. **React Compiler включён** (через `reactCompilerPreset()`, только для JSX-файлов — babel не парсит декораторы в `.ts`, см. [vite.config.ts](vite.config.ts)). `reflect-metadata` — peer-зависимость inversify, стоит в `dependencies` (сами её не импортируем — библиотека тянет `reflect-metadata/lite` сама). `clsx` и `mobx-utils` в зависимостях, но пока не используются.

**Архитектура подробно** — в [ARCHITECTURE.md](ARCHITECTURE.md): узлы системы, их устройство и тонкости, связи между блоками, трассировка спина и жизненный цикл. Читай его, когда нужен архитектурный контекст; при изменении архитектуры — обновляй.

---

## Учебный проект: комментарии и спецификации

Проект **учебный**, но обучающие объяснения «зачем» живут в [ARCHITECTURE.md](ARCHITECTURE.md); инлайн-доки в коде — короткие и сухие.

- **Классы, публичные методы и утилиты** снабжай JSDoc-описанием: **что** делает код, 1–2 строки максимум, сухой инженерный язык. Запрещены клише, дихотомии («это, а не это»), метафоры и сленг (кроме технического). Эталоны — описания в [service.ts](src/api/service.ts) и [game-emitter.ts](src/events/game-emitter.ts).
- Точечные `//`-пояснения — только у неочевидных решений, одна-две строки (пример: обязательность `makeObservable(this)` при legacy-декораторах).
- Комментируй **только новое/изменённое**. **Не** дописывай комментарии в существующий неизменённый код.
- Сергей при ревью может удалять и править комментарии — это ожидаемо, не возвращай их.

---

## Команды

| Команда           | Что делает                                                                          |
| ----------------- | ----------------------------------------------------------------------------------- |
| `npm run dev`     | Vite dev-сервер                                                                     |
| `npm run build`   | `tsc -b && vite build`                                                              |
| `npm run lint`    | `eslint --quiet --fix .` + `tsc --noEmit -p tsconfig.app.json` (автофикс + тайпчек) |
| `npm run preview` | превью прод-сборки                                                                  |

- Husky `pre-commit` запускает `npm run lint` — линт с автофиксом и тайпчек проходят на каждом коммите.
- Тестов и тест-раннера в проекте нет.

---

## Структура каталогов

Весь код — в `src/`. **Folder-as-module** — только для **компонентов и страниц**: папка экспонирует `index.tsx`, импорт указывает на папку (`src/components/Button`). **Слои** (`api/`, `events/`, `flow/`, `game/`, `stores/`, `types/`) — плоские файлы, имя файла описывает содержимое, импорт указывает на **файл** (`src/events/game-emitter`). Баррелей-`index.ts` в слоях нет. Экземплярами классов владеет DI-контейнер (см. «Композиция и DI»); единственный синглтон уровня модуля — `appContainer` в [app/container.ts](src/app/container.ts).

```
src/
  main.tsx                 # вход: в DEV стартует MSW, затем createRoot + render(<App/>)
  app/
    index.tsx              # <App>: StrictMode → RouterProvider
    router.tsx             # createBrowserRouter, ленивые страницы
    container.ts           # app-контейнер (composition root): биндинги транспорта, api, эмиттера, стора, GameRoot
    game-container.ts      # фабрика child-контейнера на один маунт: Application/Ticker, контроллеры, Fsm + деактивации
  api/                     # сетевой слой: service.ts (класс WsTransport) + types.ts + <name>-api.ts (класс-фасад эндпоинтов + zod-DTO)
  components/              # переиспользуемые компоненты
  events/                  # эвентный слой: game-emitter.ts (класс GameEmitter) + types.ts (карта GameEvents) + utils.ts (traceEvent) + helpers.ts (waitFor)
  flow/                    # конечный автомат раунда: fsm.ts (движок) + types.ts (Phase, PhaseContext, опции) + helpers.ts (createGameFsm — сборка) + phases/ (idle, spinning, result)
  game/                    # PIXI-слой: game-root.ts (хост жизненного цикла) + utils.ts (waitTicks) + роли из брифа:
    game-root.ts           #   хост жизненного цикла игры: PIXI-init, DOM-мост, layout, порядок unbind (transient)
    animations/            #   п.4 — классы анимации: обёртки над визуальной сущностью, методы с игровой семантикой → промис
    controllers/           #   п.5 — контроллеры-Container: создают анимации, держат подписки на эвенты
  mocks/                   # MSW-моки: create-ws-handler.ts (база) + types.ts + handlers.ts (эндпоинты) + browser.ts (worker)
  pages/                   # роут-страницы
  stores/                  # MobX-сторы: spin-store.ts (состояние раунда) + utils/ (классы AsyncValue, AsyncStream)
  constants/               # глобальные константы: environment.ts (WS_URL ← VITE_WS_URL), tokens.ts (словарь DI-токенов TOKENS), bg-blobs.ts
  types/                   # кросс-слойные типы по темам (game.ts, network.ts → RequestStatus)
  styles/index.css         # единственный глобальный стиль (Tailwind + @theme)
  assets/
    icons/index.ts         # баррель SVG-иконок как React-компонентов
    game/                  # ⚠️ ассеты игры — в .gitignore, не коммитить (см. ниже)
```

---

## Конвенции кода

**Раскладка файлов в слое** — одинакова во всех слоях. Файл с классом содержит **только класс**; типы, константы и свободные функции выносятся в соседние файлы слоя:

- **`<name>.ts`** — класс и ничего кроме: ни свободных функций, ни типов, ни констант, ни синглтонов (`game-emitter.ts` → `GameEmitter`). Экземплярами заведует контейнер в `app/`.
- **`types.ts`** — типы слоя (`events/types.ts` → карта `GameEvents`). В `src/types/` выносим только то, что используют несколько слоёв (`RequestStatus` в `network.ts` читают и `stores/utils/`, и `flow/`).
- **`utils.ts`** — утилиты, которые вызывает **сам слой** (`events/utils.ts` → `traceEvent`: его зовёт эмиттер на каждом `emit`, а в конструктор подставляет биндинг в `app/container.ts`); **`helpers.ts`** — утилиты **поверх** класса для внешних потребителей (`events/helpers.ts` → `waitFor`, его вызывают фазы автомата). Критерий один — кто вызывает.
- **`utils/` (папка)** — когда утилиты слоя сами классы: по классу на файл (`stores/utils/async-value.ts`, `async-stream.ts`).
- **`constants.ts`** — константы слоя. Глобальные, общие для всего приложения, — по-прежнему в `src/constants/`.

Файлы создаём по мере необходимости; пустые файлы-заготовки не создаём.

**Исключения из «в файле только класс»** — два, новых без причины не заводим:

- **`game/animations/` и `game/controllers/`** — константы и утилиты класса кладём **в его же файл, выше объявления** (тайминги барабана в [reel-animation.ts](src/game/animations/reel-animation.ts)): это числовые параметры одной визуальной сущности, их правят вместе с кодом, который их использует.
- **zod-схемы api-слоя** — в файле класса, который ими парсит (`EnvelopeSchema` в [service.ts](src/api/service.ts), `SpinResultSchema` в [root-api.ts](src/api/root-api.ts)): формат читается рядом с разбирающим кодом.

**Именование**

- Папки-компоненты — **PascalCase** (`Button/`, `Layout/`, `BackgroundCanvas/`).
- Роут-страницы и не-компонентные файлы — **kebab-case** (`pages/main/`, `not-found/`, `bg-blobs.ts`, `spin-store.ts`).
- Страницы — суффикс `Page` (`MainPage`), иконки — `Icon` (`LogoIcon`), сторы — класс `XxxStore` (экземпляр создаёт app-контейнер).
- Константы — `SCREAMING_SNAKE_CASE` (`BG_BLOBS`, `WS_URL`).

**Экспорты и типы**

- Только **именованные экспорты** (default — лишь у SVG через `?react`).
- Компоненты — стрелочные `export const`, без `React.FC`. Пропсы типизируй `interface XxxProps` рядом с компонентом (см. [Button](src/components/Button/index.tsx)). **Кросс-слойные** типы — в `src/types/` по темам; типы одного слоя — в его `types.ts`; **DTO-типы `z.infer` размещаются рядом со своими zod-схемами в `api/`**.
- `any` **запрещён** (`no-explicit-any: error`) — в коде его нет, не вводи. Вместо `@ts-ignore` — `@ts-expect-error`.
- Type-only импорты обязательны: `import { type X }` / `import type` (`consistent-type-imports: error`).
- **Enum-подобные наборы** — не `enum` (запрещён `erasableSyntaxOnly`) и не голый union, а `as const`-объект + производный тип: `export const X = { a: 'a', … } as const` → `export type X = (typeof X)[keyof typeof X]` (см. [RequestStatus](src/types/network.ts)).

**Импорты**

- Алиас пути — **`src/*` → `./src`** (не `@/`). Кросс-папочные импорты — через `src/...`, относительные (`./`) — только для соседних/дочерних файлов.
- Порядок импортов навязан ESLint (`import/order`): `builtin → external → internal`, `react` первым, пустая строка между группами, алфавит. `import/no-cycle` включён.

**Форматирование** — Prettier + автофиксимые ESLint-правила чинит `npm run lint` на pre-commit; вручную не форматируй.

**TypeScript** — строгий (`strict` + `noUnusedLocals/Parameters`, `verbatimModuleSyntax`, `erasableSyntaxOnly`, `moduleDetection: force`). Неиспользуемые параметры — с префиксом `_` (`(_ticker: Ticker) => {}`). Включены legacy-декораторы (`experimentalDecorators`) под inversify; `emitDecoratorMetadata` **выключен** — токены в `@inject` всегда явные. Parameter properties (`constructor(private x: X)`) запрещены `erasableSyntaxOnly` — поле объявляем и присваиваем вручную.

**Асинхронность** — `async/await` + `try/catch`; `.then()/.catch()` **не используем**. Исключения: конструктор `new Promise((resolve, reject) => …)` для deferred-промиса, который резолвится извне (запрос↔ответ в [service.ts](src/api/service.ts)); запуск async-функции без ожидания результата — `void fn()` (`void setup()` в [BackgroundCanvas/utils.ts](src/components/BackgroundCanvas/utils.ts)); и `void startMocking().then(...)` в [main.tsx](src/main.tsx) — так синтаксически удобнее, конструкция легко читается.

---

## Паттерны

**Компоненты** — функциональные, Tailwind-классы в `className`. Для крупных наборов классов — многострочный шаблон-литерал (см. `baseStyles` в [Button](src/components/Button/index.tsx)). CSS-модулей и styled-components нет; глобальный стиль один — [styles/index.css](src/styles/index.css) (`@import "tailwindcss"; @theme { --header-height }`). CSS-переменные через arbitrary values: `h-(--header-height)`; брендовые цвета как `text-[#a98fc3]`.

> **React Compiler включён** — ручная мемоизация (`useMemo`/`useCallback`/`React.memo`) обычно не нужна, не добавляй её по умолчанию. Соблюдай Правила Хуков (компилятор на них опирается).

**Роутинг** — `createBrowserRouter` (react-router v7 data-router), единый [Layout](src/components/Layout/index.tsx) с `<Outlet/>`. Страницы грузятся **лениво**: `lazy: async () => ({ element: <MainPage /> })` с динамическим `import('src/pages/main')` внутри (см. [router.tsx](src/app/router.tsx)).

**Сетевой слой** — в `api/`: [service.ts](src/api/service.ts) (транспорт) + `<name>-api.ts` (эндпоинты + zod-DTO).

- Транспорт — класс `WsTransport { request/subscribe/disconnect }`, состояние в приватных полях (фабрик-замыканий не пишем). Экземпляром владеет app-контейнер; конфиг в класс не зашит — `url` обязателен в опциях, `WS_URL` подставляет биндинг (транспорт не знает про environment). Свободных обёрток (`export const { request } = ...`) не выносим — деструктуризация методов теряет привязку `this`.
- Реализация транспорта — `ReconnectingWebSocket` из **partysocket** (авто-реконнект). Запрос, начатый до открытия сокета, ждёт `open`; при закрытии сокета незавершённые запросы реджектятся. `WS_URL` — из [constants/environment.ts](src/constants/environment.ts) (`VITE_WS_URL`, задаётся в `.env.local`).
- Эндпоинты — методы **класса-фасада** в `<name>-api.ts` (`@injectable`, транспорт через `@inject`): вызывают транспорт, отдают распарсенный zod-схемой DTO (см. `RootApi.sendSpin` в [root-api.ts](src/api/root-api.ts)). Фазы получают фасад как `api` в контексте.
- **Конверт** — `{ id?, type, payload, error? }`. `id` запроса — `nanoid()`. Ответ с `error: { code, message }` **реджектит** `request` сразу, не дожидаясь watchdog-таймаута; в моках такой ответ шлёт `fail(code, message)` (см. [create-ws-handler.ts](src/mocks/create-ws-handler.ts)).
- **Входящее сообщение парсим `safeParse`** (и `JSON.parse` в `try/catch`): невалидный конверт игнорируем без ошибки, push доставляем каждому подписчику изолированно — у WS-колбэка нет внешнего обработчика исключений.
- **`request` отменяем**: четвёртый аргумент `{ signal }` — тот же `AbortSignal`, что фаза передаёт в анимации (`api.sendSpin(bet, signal)`).

**Стейт (MobX)** — в `stores/`: пока один [spin-store.ts](src/stores/spin-store.ts) (состояние раунда). Паттерн стора: класс с `@injectable()`, разметка **legacy-декораторами MobX** (`@observable` / `@observable.ref` / `@computed` / `@action`) у объявления члена + **обязательный `makeObservable(this)`** (без карты) в конструкторе; экземпляром владеет app-контейнер — стор живёт всю вкладку, ставка переживает перезаход на страницу игры. В `stores/` — только MobX-классы; классы без реактивности размещаются в других слоях.

- MobX — для **игрового состояния**. UI-состояние интерфейса — на стороне React (`useState`, позже Zustand), не в MobX.
- **Аннотации только явные.** `makeAutoObservable` не используем, карты-объекты `makeObservable(this, {...})` не пишем — каждый наблюдаемый член помечен декоратором у объявления. Что не декорировано — не наблюдается: тяжёлый объект не станет наблюдаемым непреднамеренно, а приватные члены просто не декорируем (параметр типа `makeObservable<this, '...'>` ушёл вместе с картой). `makeObservable(this)` в конструкторе **обязателен**: в legacy-режиме декоратор только записывает разметку, применяет её этот вызов.
- > Современные stage-3 декораторы MobX (`@observable accessor x`, без `makeObservable`) недоступны: `@inject` inversify — параметр-декоратор, он существует только в legacy-режиме, а `experimentalDecorators` переключает интерпретацию декораторов для всего проекта. Освоит inversify stage-3 — мигрируем.
- **`@observable.ref` — для полей, за внутренним состоянием которых следить не нужно**: произвольные `T`/DTO, `unknown`-ошибки, чужие observable-инстансы. Глубокий `@observable` — только для собственных примитивов и структур.
- **Поле-`flow(...)`** (как `run` в [AsyncValue](src/stores/utils/async-value.ts)) — **без декоратора**: обёртка уже сделана вызовом `flow()`, а недекорированное `makeObservable(this)` не трогает. Именно **поле**, а не generator-метод с `@flow`: только форма-поле типизируется как «возвращает промис» для `await` в фазах.
- Мутации observable в async-коде оборачивай в `runInAction`.
- Библиотека — только `mobx` (без `mobx-react`/`-lite`). `observer()` пока не используется; в PIXI-слое подписка на стор — через `reaction` с отпиской в `destroy()` (см. [SpinButton](src/game/controllers/spin-button.ts)).
- **Единственный писатель в сторы — фазы автомата** (`flow/phases/`). Контроллеры, view и React только читают.
- **Сеть в сторе** — через единые хелперы [AsyncValue](src/stores/utils/async-value.ts)`<T>` (фетч/мутации: `this.x.run(() => apiCall())`, управляет полями `value/status/error`) и [AsyncStream](src/stores/utils/async-stream.ts)`<T>` (WS-подписки: `this.x.start(subscribeFn)`/`stop()`). `fromResource`/сырой `flow` в сторах для этого не пишем.

**Композиция и DI (inversify)** — composition root живёт в `app/`, **над** слоями: [container.ts](src/app/container.ts) (app-контейнер) + [game-container.ts](src/app/game-container.ts) (фабрика child-контейнера). Словарь токенов — [constants/tokens.ts](src/constants/tokens.ts): аналог карты `GameEvents`, все идентификаторы зависимостей в одном месте; в рантайме файл — лист графа импортов (только `Symbol`, типы через `import type` — их обязан стирать компилятор, иначе появятся циклы).

- **Два уровня жизни.** App-контейнер живёт всю вкладку (`WsTransport`, `RootApi`, `GameEmitter`, `SpinStore`); child-контейнер — один маунт `/game` (`Application`/`Ticker`, контроллеры, `Fsm`). Оба сконфигурированы `defaultScope: 'Singleton'` (дефолт inversify — transient, случайно-транзиентный стор — трудноловимый баг); transient задаём явно и только по делу (`GameRoot`).
- **Правила биндингов.** Зависимости-сервисы → `@injectable()` на классе + явный `@inject(TOKENS.X)` на каждом параметре + `.to(Class)`. Конфиг/дженерики/сборка агрегата → фабрика `toDynamicValue` без декораторов, конфиг живёт в композиции (`new WsTransport({ url: WS_URL })`, `new GameEmitter<GameEvents>(traceEvent)`, `createGameFsm`). Рантайм-значения, созданные вне контейнера, → `toConstantValue` («одолжены»: уничтожает создатель, не контейнер).
- **`container.get()` — только в точках входа**: `app/` и роут-страницы. Слои получают зависимости конструктором/контекстом и импортируют только значение `TOKENS`; классы зависимостей — строго `import type`.
- **Смерть — через контейнер**: `onDeactivation` пишется рядом с `bind()` (автомату — `dispose()`, контроллерам — `destroy()`, транспорту — `disconnect()`). **Порядок** смерти контейнер не гарантирует, поэтому он — явная цепочка синхронных `unbind()` в `GameRoot.unmount()`; `unbindAll()` не используем. Деактивации только синхронные (появится async — соответствующий вызов меняется на `unbindAsync`).
- **GameRoot — хост жизненного цикла** (transient-биндинг): PIXI-init, DOM-мост, layout и порядок unbind; сборкой графа не занимается. Страница резолвит его в `useEffect` (`appContainer.get(TOKENS.GameRoot)`), cleanup вызывает `unmount()` — время жизни совпадает с временем жизни роута. Фабрику game-контейнера он получает инъекцией (`TOKENS.GameContainerFactory`), не импортом `container.ts` — иначе цикл композиции.

**Событийная модель** — [events/](src/events/): `GameEmitter` (тонкая обёртка над `EventEmitter` из `pixi.js` — это eventemitter3, он уже в бандле), карта событий [types.ts](src/events/types.ts) и [waitFor](src/events/helpers.ts) (ожидание события промисом). Единственный экземпляр эмиттера создаёт app-контейнер (фабричный биндинг — класс generic-параметризован `GameEvents`); слои получают его через `@inject`/контекст, а не импортом.

- **Все имена событий — только в `GameEvents`.** Набор ограничен и типизирован: `emit(произвольная строка)` невозможен, payload проверяет компилятор.
- **Две системы наблюдения, не смешивать.** Эмиттер — для дискретных **моментов** (`ui:spinRequested`, `spin:landed`). MobX — для непрерывного **состояния** (ставка, фаза, баланс). Событие, у которого есть «текущее значение», на самом деле состояние — его место в сторе.
- **Событие ≠ команда.** Вверх (view → логика) — событие в прошедшем времени: view сообщает, что произошло. Вниз (автомат → view) — **прямой вызов метода контроллера**, возвращающего промис (`await reels.land(result)`): фаза обязана дождаться конца анимации, а `emit` ничего не возвращает.
- `on()` возвращает **функцию отписки** — сохраняй их в массив и вызывай все в `destroy()`. `off(event)` без колбэка и `removeAllListeners()` **не вызывай**: они снимут и чужие подписки.
- Утечки диагностируй через `listenerCounts()` эмиттера (в консоли: `appContainer.get(TOKENS.GameEmitter).listenerCounts()`) — числа должны быть стабильны от раунда к раунду, а после ухода со страницы игры — пустыми.

**Конечный автомат (цикл раунда)** — [flow/](src/flow/): движок [fsm.ts](src/flow/fsm.ts) + фазы `idle → spinning → result → idle`. Своя реализация на async-фазах.

- Фаза = `{ name, enter(ctx), exit? }`. `enter` **возвращает имя следующей фазы** — переход не делается изнутри фазы: граф переходов читается по `return`-значениям, и цепочка промисов не растёт с каждым раундом. Цикл переходов выполняет движок.
- **Внутри фазы нет цикла.** Появился `while` — это не одна фаза, а две.
- Всё, что нужно фазе, приходит через `PhaseContext` (DI): `emitter`, `reels`, `spinStore`, `api` и `signal` — фазы не импортируют ничего, кроме типов и констант. Контекст комплектует биндинг `Fsm` в [game-container.ts](src/app/game-container.ts). `fsm.dispose()` абортит `signal` — все незавершённые `waitFor` и анимации реджектятся, при уходе со страницы все фазы завершаются.
- Сеть и анимация запускаются **параллельно** (`Promise.all([api.sendSpin(bet, signal), reels.spin(signal)])`) — анимация не ждёт ответа сервера.
- Сервер — **источник правды**: клиент отображает присланный результат и ничего не пересчитывает.

**Мост React ↔ PIXI** — стандартный паттерн: `useRef` + `useEffect` с очисткой; cleanup уничтожает `Application` (тикер, ResizeObserver, WebGL-контекст):

```tsx
useEffect(() => {
  const container = containerRef.current
  if (!container) return
  const game = appContainer.get(TOKENS.GameRoot) // transient: свой хост на каждый маунт
  void game.mount(container)
  return () => game.unmount()
}, [])
```

---

## PIXI / канвас

- PIXI **v8**. Инициализация асинхронная: `const app = new Application(); await app.init({ resizeTo: container, ... }); container.appendChild(app.canvas)`.
- Ресайз — только через опцию `resizeTo`, ручных listener'ов нет.
- Игровой цикл — `app.ticker.add(fn)`; `fn` хранится как стабильная ссылка (поле класса или локальная `const`), чтобы её можно было удалить из тикера при teardown.
- **Игровые задержки — только [waitTicks](src/game/utils.ts)**, не `setTimeout`: в свёрнутой вкладке тикер PIXI останавливается, а `setTimeout` — нет; анимация завершилась бы по таймеру, не отрисовав ни одного кадра, и автомат перешёл бы к следующей фазе, рассинхронизировавшись с отрисовкой. `setTimeout` допустим лишь как watchdog-таймаут по системному времени ([waitFor](src/events/helpers.ts), [service.ts](src/api/service.ts)).
- **React StrictMode** монтирует эффекты дважды (mount → cleanup → mount) — защищайся от гонки инициализации. В классе-владельце — поле `pending` ([game-root.ts](src/game/game-root.ts)); в функции — локальный флаг `disposed` (`mountBackground` в [BackgroundCanvas/utils.ts](src/components/BackgroundCanvas/utils.ts)): после `await init()` уничтожаем устаревший app и выходим.
- Учитывай **доступность**: анимационный тикер добавляется только если нет `prefers-reduced-motion` (см. `mountBackground`).
- Провайдеры приложения — только `StrictMode → RouterProvider` ([app/index.tsx](src/app/index.tsx)). Store-провайдера/темы/error-boundary нет.

---

## Ассеты и .gitignore

- Ассеты игры лежат в **`src/assets/game/`** (~146 МБ) и игнорятся в [.gitignore](.gitignore) правилом `src/assets/game/` — **не коммить их в remote**.

---

## Целевая архитектура

> Из брифа. Каркас всех пяти слоёв реализован — их устройство описано в «Паттернах»; здесь — роли и то, чего ещё нет.

1. **Сторы (MobX)** — игровое состояние. Держим **независимые сторы** (по singleton-биндингу на каждый в app-контейнере); RootStore/store-of-stores не вводим, координация между сторами — в фазах автомата. _(есть)_
2. **Сетевой слой** — запросы и парсинг ответов; результат в сторы кладут фазы. Бэкенд мокаем через [MSW](https://mswjs.io/). _(есть)_
3. **Event emitter** — центр регистрации имён событий; связывает логику и сторы с презентацией. _(есть)_
4. **Класс анимации** — обёртка над визуальной сущностью: внешний код работает с методами с игровой семантикой (`spin`, `land`), а не с сырым объектом, поэтому замена `Graphics`-заглушки на Spine не потребует изменений ни в контроллере, ни в фазах. _(каркас; Spine — нет)_
5. **Класс-контроллер** — PIXI `Container`: создаёт класс анимации (п.4) и держит подписки на эвенты (п.3). _(есть)_

Поток: **сеть → фазы автомата → сторы + эмиттер → контроллер → класс анимации → Spine.**
Автомат координирует этот поток: единственный писатель в сторы и единственный источник игровых событий.

**Звук** (вне 5 слоёв брифа) — нативное для PIXI решение (`@pixi/sound`). Подключится подпиской на эвенты, без правок фаз. _(нет)_

### Ещё не решено

- **Spine-рантайм:** своё решение или готовый (`@esotericsoftware/spine-pixi`) — определимся, когда дойдём до ассетов.
- **Слэм-стоп** (досрочная остановка барабанов): под него в фазе зарезервирован `skip()`, но реализации нет.

---

## Чего избегать

Причины — в профильных разделах выше; здесь только чек-лист.

- Не коммить `src/assets/game/**`.
- Не вводи `any` и `@ts-ignore`; не оставляй `console.*` (warn) и `debugger` (error) — единственное исключение: `traceEvent` в [events/utils.ts](src/events/utils.ts).
- Не используй `setTimeout` для игровых задержек — только `waitTicks` (см. «PIXI / канвас»).
- Граф импортов всегда односторонний.
- Не заводи module-scope синглтоны — экземплярами владеет контейнер; единственное исключение — `appContainer`.
- Не вызывай `container.get()` вне `app/` и роут-страниц; в слоях импортируй только `TOKENS`, классы зависимостей — строго `import type`.
- Не включай `emitDecoratorMetadata` и не импортируй `reflect-metadata` вручную.
- Не используй parameter properties (`constructor(private x: X)`) — запрещены `erasableSyntaxOnly`.
- Не вызывай `unbindAll()` и не вешай async-обработчики на `onDeactivation` при синхронном `unbind` — порядок смерти только явной цепочкой (см. «Композиция и DI»).
- Не используй callback-ref без cleanup для канвасов — только `useEffect` с очисткой (см. «Мост React↔PIXI»).
- Не используй `makeAutoObservable` и карты-объекты `makeObservable(this, {...})` — только декораторы у членов + `makeObservable(this)` в конструкторе.
- Не делай тяжёлые PIXI-инстансы observable; классу без реактивных полей MobX не подключаем (см. `game/game-root.ts`).
- Не клади в `stores/` не-MobX-классы.
- Не добавляй ручную мемоизацию без нужды — работает React Compiler.
- По нерешённым техвыборам (см. «Ещё не решено») не принимай решений самостоятельно — сперва уточни.
- Не комментируй существующий неизменённый код (см. «Учебный проект…»).
- Не добавляй в файл с классом типы, константы и свободные функции — они выносятся в `types.ts`/`utils.ts`/`helpers.ts` рядом (см. «Раскладка файлов в слое», там же — два исключения).
