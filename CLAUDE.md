# CLAUDE.md

Инструкция для Claude по проекту **pixi-game**. Читается в начале каждой сессии — держи её актуальной.

> Язык проекта — русский: UI-тексты, комментарии в коде и эта документация на русском. Пиши так же.

---

## Обзор

Пет-проект для изучения PIXI.js и геймдева. Цель — **слот-машина**.

**Статус: каркас.** Все пять слоёв целевой архитектуры реализованы, сквозной спин работает (кнопка → сеть → стор → контроллер → Spine): барабаны крутятся, тормозят и садятся на серверные символы. Линий, выигрышей и звука **пока нет** (см. [Целевая архитектура](#целевая-архитектура)).

**Стек:** React 19 · PIXI.js v8 · MobX 6 · inversify 8 (DI-контейнер) · Tailwind CSS v4 · react-router-dom v7 · TypeScript 6 · Vite 8; сеть — zod + partysocket, моки — MSW. Spine — `@esotericsoftware/spine-pixi-v8`, версия пинована тильдой `~4.2.x`: major.minor рантайма обязан совпадать с версией редактора, экспортировавшего ассеты (4.2.43), рантайм 4.3 их не загрузит. **React Compiler включён** (через `reactCompilerPreset()`, только для JSX-файлов — babel не парсит декораторы в `.ts`, см. [vite.config.ts](vite.config.ts)). `reflect-metadata` — peer-зависимость inversify, стоит в `dependencies` (сами её не импортируем — библиотека тянет `reflect-metadata/lite` сама). `clsx` и `mobx-utils` в зависимостях, но пока не используются.

---

## Учебный проект: комментарии и спецификации

Проект **учебный**, но инлайн-доки в коде — короткие и сухие: разбор «зачем» идёт в ответах в чате, а договорённости, которые надо помнить между сессиями, фиксируются здесь, в CLAUDE.md.

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
| `npm run preview:mocks` | сборка с `VITE_USE_MOCKS=true` + превью — прод-сборка с работающими MSW-моками |

- Husky `pre-commit` запускает `npm run lint` — линт с автофиксом и тайпчек проходят на каждом коммите.
- Тестов и тест-раннера в проекте нет.

---

## Структура каталогов

Весь код — в `src/`. **Folder-as-module** — только для **компонентов и страниц**: папка экспонирует `index.tsx`, импорт указывает на папку (`src/components/Button`). **Слои** (`api/`, `events/`, `flow/`, `game/`, `stores/`, `types/`) — плоские файлы, имя файла описывает содержимое, импорт указывает на **файл** (`src/events/game-emitter`). Баррелей-`index.ts` в слоях нет. Экземплярами классов владеет DI-контейнер (см. «Композиция и DI»); синглтоны уровня модуля — только в composition root ([app/container.ts](src/app/container.ts)): `appContainer` и слот текущего game-контейнера.

```
src/
  main.tsx                 # вход: по USE_MOCKS стартует MSW, затем createRoot + render(<App/>)
  app/
    index.tsx              # <App>: StrictMode → RouterProvider
    router.tsx             # createBrowserRouter, ленивые страницы
    container.ts           # composition root: appContainer + createGameContainer/destroyGameContainer (без аргументов, слот game-контейнера в замыкании)
    bindings.ts            # все биндинги: bindApp + bindGame (доменные функции core / flow / scene / host)
  api/                     # сетевой слой: service.ts (класс WsTransport) + types.ts + <name>-api.ts (класс-фасад эндпоинтов + zod-DTO)
  components/              # переиспользуемые компоненты
  events/                  # эвентный слой: game-emitter.ts (класс GameEmitter: on/emit/waitFor) + types.ts (карта GameEvents) + utils.ts (traceEvent)
  flow/                    # конечный автомат раунда: fsm.ts (движок, @multiInject фаз) + types.ts (Phase) + constants.ts (INITIAL_PHASE) + utils.ts (tracePhase) + phases/ (классы IdlePhase, SpinningPhase, ResultPhase)
  game/                    # PIXI-слой: game-root.ts (хост жизненного цикла) + game-ticker.ts (GameTicker: тикер + waitTicks) + utils.ts (утилиты слоя: formatAmount, математика посадки барабана) + constants.ts (размеры и тайминги дерева барабанов) + types.ts (LandingPlan) + роли из брифа:
    game-root.ts           #   хост жизненного цикла игры: PIXI-init, DOM-мост, игровой тикер, запуск автомата
    scenes/                #   сцены: GameScene — @inject контроллеров, дерево отображения, layout
    animations/            #   п.4 — классы анимации: обёртки над визуальной сущностью, методы с игровой семантикой → промис
    controllers/           #   п.5 — контроллеры (наследники LiveContainer): создают анимации, держат подписки на эвенты через watch/listen
    ui/                    #   базовые view-классы сцен: live-container.ts (LiveContainer: подписки watch/listen, снимаются в destroy) + button.ts (Button: подложка + active + size-пресет + SVG-иконка) + label.ts (Label: текст игровым шрифтом, цвет из палитры)
  mocks/                   # MSW-моки: create-ws-handler.ts (база) + types.ts + handlers.ts (эндпоинты) + browser.ts (worker)
  pages/                   # роут-страницы
  stores/                  # MobX-сторы: flow-store.ts (фаза автомата) + scene-store.ts (состояние раунда) + utils/ (классы AsyncValue, AsyncStream)
  constants/               # глобальные константы: environment.ts (WS_URL ← VITE_WS_URL), tokens.ts (словарь DI-токенов TOKENS), palette.ts (палитра бренда), bg-blobs.ts
  types/                   # кросс-слойные типы по темам (game.ts, network.ts → RequestStatus)
  styles/index.css         # единственный глобальный стиль (Tailwind + @theme)
  assets/
    icons/index.ts         # баррель SVG-иконок как React-компонентов
public/
  game-assets/             # ⚠️ ассеты игры — в .gitignore, не коммитить (см. ниже)
```

---

## Конвенции кода

**Раскладка файлов в слое** — одинакова во всех слоях. Файл с классом содержит **только класс**; типы, константы и свободные функции выносятся в соседние файлы слоя:

- **`<name>.ts`** — класс и ничего кроме: ни свободных функций, ни типов, ни констант, ни синглтонов (`game-emitter.ts` → `GameEmitter`). Экземплярами заведует контейнер в `app/`.
- **`types.ts`** — типы слоя (`events/types.ts` → карта `GameEvents`). В `src/types/` выносим только то, что используют несколько слоёв (`RequestStatus` в `network.ts` читают и `stores/utils/`, и `flow/`).
- **`utils.ts`** — утилиты слоя (`events/utils.ts` → `traceEvent`: его зовёт эмиттер на каждом `emit`, а в конструктор подставляет биндинг в `app/container.ts`). API поверх класса для внешних потребителей — методы самого класса (`waitFor` у эмиттера); свободные функции-обёртки, которым нужно передавать инстанс, не заводим.
- **`utils/` (папка)** — когда утилиты слоя сами классы: по классу на файл (`stores/utils/async-value.ts`, `async-stream.ts`).
- **`constants.ts`** — константы слоя. Глобальные, общие для всего приложения, — по-прежнему в `src/constants/`.

Файлы создаём по мере необходимости; пустые файлы-заготовки не создаём.

**Исключения из «в файле только класс»** — два, новых без причины не заводим:

- **`game/animations/`, `game/controllers/` и `game/ui/`** — константы и утилиты класса кладём **в его же файл, выше объявления** (размер-пресеты подложки в [button.ts](src/game/ui/button.ts)): это числовые параметры одной визуальной сущности, их правят вместе с кодом, который их использует. Исключение внутри исключения — **дерево барабанов**: размеры и тайминги общие для `reel.ts`, `reel-set.ts` и `reels-machine.ts`, они лежат в [game/constants.ts](src/game/constants.ts), а расчёт траектории посадки (`planLanding`) — в [game/utils.ts](src/game/utils.ts) рядом с `easeOutBack`.
- **zod-схемы api-слоя** — в файле класса, который ими парсит (`EnvelopeSchema` в [service.ts](src/api/service.ts), `SpinResponseSchema` в [root-api.ts](src/api/root-api.ts)): формат читается рядом с разбирающим кодом.

**Именование**

- Папки-компоненты — **PascalCase** (`Button/`, `Layout/`, `BackgroundCanvas/`).
- Роут-страницы и не-компонентные файлы — **kebab-case** (`pages/main/`, `not-found/`, `bg-blobs.ts`, `scene-store.ts`).
- Страницы — суффикс `Page` (`MainPage`), иконки — `Icon` (`LogoIcon`), сторы — класс `XxxStore` (экземпляр создаёт контейнер).
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

**Компоненты** — функциональные, Tailwind-классы в `className`. Для крупных наборов классов — многострочный шаблон-литерал (см. `baseStyles` в [Button](src/components/Button/index.tsx)). CSS-модулей и styled-components нет; глобальный стиль один — [styles/index.css](src/styles/index.css) (`@import "tailwindcss"; @theme { --header-height }`). CSS-переменные через arbitrary values: `h-(--header-height)`. Брендовые цвета — токены из `@theme` (`text-brand-primary`); их TS-двойник для PIXI и JS-конфигов — `PALETTE` в [constants/palette.ts](src/constants/palette.ts), хардкод хексов по слоям не размазываем.

> **React Compiler включён** — ручная мемоизация (`useMemo`/`useCallback`/`React.memo`) обычно не нужна, не добавляй её по умолчанию. Соблюдай Правила Хуков (компилятор на них опирается).

**Роутинг** — `createBrowserRouter` (react-router v7 data-router), единый [Layout](src/components/Layout/index.tsx) с `<Outlet/>`. Страницы грузятся **лениво**: `lazy: async () => ({ element: <MainPage /> })` с динамическим `import('src/pages/main')` внутри (см. [router.tsx](src/app/router.tsx)).

**Сетевой слой** — в `api/`: [service.ts](src/api/service.ts) (транспорт) + `<name>-api.ts` (эндпоинты + zod-DTO).

- Транспорт — класс `WsTransport { request/subscribe/disconnect }`, состояние в приватных полях (фабрик-замыканий не пишем). Экземпляром владеет app-контейнер; конфиг в класс не зашит — `url` обязателен в опциях, `WS_URL` подставляет биндинг (транспорт не знает про environment). Свободных обёрток (`export const { request } = ...`) не выносим — деструктуризация методов теряет привязку `this`.
- Реализация транспорта — `ReconnectingWebSocket` из **partysocket** (авто-реконнект). Запрос, начатый до открытия сокета, ждёт `open`; при закрытии сокета незавершённые запросы реджектятся. `WS_URL` — из [constants/environment.ts](src/constants/environment.ts) (`VITE_WS_URL`, задаётся в `.env.local`).
- Эндпоинты — методы **класса-фасада** в `<name>-api.ts` (`@injectable`, транспорт через `@inject`): вызывают транспорт, отдают распарсенный zod-схемой DTO (см. `RootApi.sendSpin` в [root-api.ts](src/api/root-api.ts)). Фазы получают фасад через `@inject(TOKENS.RootApi)`.
- **Конверт — SignalR-формат `{ request, response }`** (реальная форма сервера). `request` — invocation (`type: 1`, `{ invocationId, target, arguments }`), `response` — completion (`type: 3`, `{ invocationId, result }`). Транспорт шлёт invocation с `invocationId = nanoid()`, коррелирует ответ по `response.invocationId`, роутит по `target`. Обёртку `{ request, response }` для DTO-схем строит общий хелпер `envelope(argumentsSchema, resultSchema)` в [root-api.ts](src/api/root-api.ts): им заданы и `SpinResponseSchema`, и `GameInitResponseSchema`.
- **Ошибка сервера** — completion с полем `error: string` вместо `result`; транспорт видит `response.error` → **реджектит** `request` сразу, не дожидаясь watchdog-таймаута. В моках её шлёт `fail(error)` (см. [create-ws-handler.ts](src/mocks/create-ws-handler.ts)).
- **Входящее сообщение парсим `safeParse`** (и `JSON.parse` в `try/catch`): сперва пробуем completion-конверт (есть `response.invocationId` → ответ на запрос), иначе серверную invocation (push по `target`); невалидное сообщение игнорируем без ошибки, push доставляем каждому подписчику изолированно — у WS-колбэка нет внешнего обработчика исключений.
- **`request` отменяем**: четвёртый аргумент `{ signal }` — тот же `AbortSignal`, что фаза передаёт в анимации (`api.sendSpin(bet, gameMode, signal)`).
- **Моки отвечают с задержкой 100–300 мс** — `create-ws-handler` планирует отправку `reply`/`fail` через `setTimeout` (симуляция латентности по системному времени; в моке это не игровая пауза).
- **Включение MSW — флаг `USE_MOCKS` в [main.tsx](src/main.tsx)**: по умолчанию моки идут в dev, `VITE_USE_MOCKS` задаёт значение явно и включает их в прод-сборке (`npm run preview:mocks` — единственный способ погонять preview без живого бэкенда). Флаг объявлен прямо в `main.tsx`, а не в `constants/environment.ts`, вопреки общему правилу: rolldown выбрасывает `import('src/mocks/browser')` из прод-бандла, только пока условие сворачивается в литерал внутри того же модуля — через импортированную константу свёртка не проходит и msw (432 КБ) уезжает в прод. При правке `main.tsx` проверяй: `npm run build && grep -rl setupWorker dist/assets/` должен молчать.

**Стейт (MobX)** — в `stores/`: [flow-store.ts](src/stores/flow-store.ts) (публичное состояние автомата: фаза и фатальная ошибка; без зависимостей — его читают другие сторы и view, циклов с движком не возникает) + [scene-store.ts](src/stores/scene-store.ts) (состояние раунда: ставка, результат; `canSpin` — cross-store computed от `flowStore.phase`). Паттерн стора: класс с `@injectable()`, разметка **legacy-декораторами MobX** (`@observable` / `@observable.ref` / `@computed` / `@action`) у объявления члена + **обязательный `makeObservable(this)`** (без карты) в конструкторе; экземпляром владеет контейнер того скоупа, чьё состояние стор хранит (`SceneStore` — game-контейнер: раунд живёт один маунт). В `stores/` — только MobX-классы; классы без реактивности размещаются в других слоях.

- MobX — для **игрового состояния**. UI-состояние интерфейса — на стороне React (`useState`, позже Zustand), не в MobX.
- **Аннотации только явные.** `makeAutoObservable` не используем, карты-объекты `makeObservable(this, {...})` не пишем — каждый наблюдаемый член помечен декоратором у объявления. Что не декорировано — не наблюдается: тяжёлый объект не станет наблюдаемым непреднамеренно, а приватные члены просто не декорируем (параметр типа `makeObservable<this, '...'>` ушёл вместе с картой). `makeObservable(this)` в конструкторе **обязателен**: в legacy-режиме декоратор только записывает разметку, применяет её этот вызов.
- > Современные stage-3 декораторы MobX (`@observable accessor x`, без `makeObservable`) недоступны: `@inject` inversify — параметр-декоратор, он существует только в legacy-режиме, а `experimentalDecorators` переключает интерпретацию декораторов для всего проекта. Освоит inversify stage-3 — мигрируем.
- **`@observable.ref` — для полей, за внутренним состоянием которых следить не нужно**: произвольные `T`/DTO, `unknown`-ошибки, чужие observable-инстансы. Глубокий `@observable` — только для собственных примитивов и структур.
- **Поле-`flow(...)`** (как `run` в [AsyncValue](src/stores/utils/async-value.ts)) — **без декоратора**: обёртка уже сделана вызовом `flow()`, а недекорированное `makeObservable(this)` не трогает. Именно **поле**, а не generator-метод с `@flow`: только форма-поле типизируется как «возвращает промис» для `await` в фазах.
- Мутации observable в async-коде оборачивай в `runInAction`.
- Включён строгий режим — `configure({ enforceActions: 'always' })` в composition root ([app/container.ts](src/app/container.ts)): запись observable вне action — рантайм-ошибка. В `main.tsx` конфиг не выносим — импорт mobx утянул бы библиотеку в стартовый бандл лендинга.
- Библиотека — только `mobx` (без `mobx-react`/`-lite`). `observer()` пока не используется; в PIXI-слое подписка на стор — через `this.watch` базы [LiveContainer](src/game/ui/live-container.ts) (MobX-`reaction`, отписка привязана к `destroy`; см. [SpinButton](src/game/controllers/spin-button.ts)). Прямой импорт `reaction`/`autorun`/`when` в `game/` запрещён ESLint-правилом.
- **Единственный писатель в сторы — автомат** (`flow/`): движок пишет `FlowStore`, фазы — доменные сторы. Контроллеры, view и React только читают.
- **Сеть в сторе** — через единые хелперы [AsyncValue](src/stores/utils/async-value.ts)`<T>` (фетч/мутации: `this.x.run(apiCall())`, управляет полями `value/status/error`) и [AsyncStream](src/stores/utils/async-stream.ts)`<T>` (WS-подписки: `this.x.start(subscribeFn)`/`stop()`). `fromResource`/сырой `flow` в сторах для этого не пишем.

**Композиция и DI (inversify)** — composition root живёт в `app/`, **над** слоями: [container.ts](src/app/container.ts) (оба контейнера: `appContainer` + пара `createGameContainer()`/`destroyGameContainer()` — вызываются без аргументов, родитель и слот текущего game-контейнера живут в замыкании модуля) + [bindings.ts](src/app/bindings.ts) (манифест биндингов: `bindApp` + `bindGame` из доменных функций). Словарь токенов — [constants/tokens.ts](src/constants/tokens.ts): аналог карты `GameEvents`, все идентификаторы зависимостей в одном месте; в рантайме файл — лист графа импортов (только `Symbol`, типы через `import type` — их обязан стирать компилятор, иначе появятся циклы).

- **Два уровня жизни = два контейнера.** App-контейнер живёт всю вкладку (`WsTransport`, `RootApi`, `GameEmitter`); child-контейнер — один маунт `/game` (`GameRoot`, `Ticker`, `SceneStore`, сцена, контроллеры, фазы, `Fsm`). Оба сконфигурированы `defaultScope: 'Singleton'` (дефолт inversify — transient, случайно-транзиентный стор — трудноловимый баг); свежесть игрового графа обеспечивает новый контейнер на маунт, а не transient-биндинги. Уровень биндинга выбирается по **времени жизни** сущности, а не по месту использования.
- **Скоуп стора = скоуп его состояния.** `FlowStore` и `SceneStore` хранят раунд (фаза, ставка, результат) → game-контейнер, свежие на каждый маунт. Сессионное состояние (будущий баланс, настройки игрока) — отдельные сторы в app-контейнере.
- **Внутри уровня видимость плоская, дерево — про владение.** Любой класс инжектит любой токен своего и родительского уровня (child видит parent). Дерево `GameRoot → GameScene → контроллеры → анимации` отвечает «кто кого создаёт/показывает/уничтожает», а не «кто что видит»: стор делят автомат (пишет) и кнопка (читает) — поэтому он в контейнере, а не «у сцены».
- **Правила биндингов.** Зависимости-сервисы → `@injectable()` на классе + явный `@inject(TOKENS.X)` на каждом параметре + `.to(Class)` (контроллеры, сцена, фазы, `Fsm`, `GameRoot`, сторы). Конфиг/дженерики → фабрика `toDynamicValue` без декораторов, конфиг живёт в композиции (`new WsTransport({ url: WS_URL })`, `new GameEmitter<GameEvents>(traceEvent)`). Не-сервисы (анимации, value-объекты, PIXI-детали) создаёт класс-владелец, в DI они не биндятся.
- **Асинхронно-рождающиеся ресурсы в граф не кладём.** PIXI `Application` обретает поля только после `await init()` — им владеет `GameRoot` (создаёт, уничтожает, держит pending-guard). Игровой тикер (`GameTicker`, подкласс PIXI-`Ticker` с паузой `waitTicks`) поэтому создаёт контейнер (валиден с рождения), а после init `GameRoot` переводит рендер на него: `app.ticker = ticker` (штатный сеттер `TickerPlugin`), дальше тикером владеет приложение.
- **`container.get()` — только в точках входа**: `app/` и роут-страницы. `GamePage` создаёт game-контейнер и одним `get(TOKENS.GameRoot)` материализует весь граф по конструкторам; cleanup вызывает `destroyGameContainer`. Слои получают зависимости конструктором и импортируют только значение `TOKENS`; классы зависимостей — строго `import type`.
- **Смерть — через контейнер**: `onDeactivation` пишется рядом с `bind()` (автомату — `dispose()`, контроллерам и сцене — guard-`destroy()`, хосту — `unmount()`, транспорту — `disconnect()`). Деактивации **синхронные** (появится async — вызов меняется на `unbindAsync`), **идемпотентные и порядконезависимые**: destroy — под guard'ом `if (!x.destroyed)`. Порядкозависимых смертей две, они зашиты в `destroyGameContainer` навсегда: `unbind(Fsm)` → `unbind(GameRoot)` (его `app.destroy` каскадом уничтожает сцену с контроллерами — унаследованный от `LiveContainer` `destroy` чистит их подписки) → `unbindAll()` — хвост для остальных деактиваций (нужен графу, не доехавшему до сцены из-за StrictMode-гонки). Новая сущность в разборку не добавляется.
- **GameRoot — хост жизненного цикла** (биндинг в game-контейнере): за ним только то, что невозможно до конца `init` — PIXI-init с pending-guard, перевод рендера на игровой тикер, канвас в DOM, сцена на stage, ресайз, запуск автомата. Сборкой графа не занимается: сцену, тикер и автомат получает `@inject`, контейнера не видит.
- **Как расширять.** Контроллер: класс → токен → строка `bind` + guard-деактивация в своей bind-функции (`bindScene` и т.п.) → `@inject` в `GameScene`, она же ставит его на место в `layout`; `destroyGameContainer` не трогается. Кнопка: наследуй `Button` из `game/ui/` (подложка, `active`, размер-пресет и иконка уже в нём), дальше — как контроллер. Подписки контроллера — только `this.watch`/`this.listen` (наследуются от `LiveContainer`), свой `destroy` для отписок не нужен. Анимация: класс в `animations/`, создаёт контроллер — композиция не меняется. Фаза: класс → имя в `PhaseName` → `bind(TOKENS.Phase).to(X)` → `return`-переходы соседних фаз; `Fsm` не меняется. Сцена: класс в `scenes/` + токен + `bind`; сцене с приватным состоянием — свой child-контейнер по образцу game. Вырастет `bindings.ts` — режется на `app/bindings/*.ts`, `bindGame` остаётся оглавлением.

**Событийная модель** — [events/](src/events/): `GameEmitter` (тонкая обёртка над `EventEmitter` из `pixi.js` — это eventemitter3, он уже в бандле; ожидание события промисом — его метод `waitFor`) и карта событий [types.ts](src/events/types.ts). Единственный экземпляр эмиттера создаёт app-контейнер (фабричный биндинг — класс generic-параметризован `GameEvents`); слои получают его через `@inject`/контекст, а не импортом.

- **Все имена событий — только в `GameEvents`.** Набор ограничен и типизирован: `emit(произвольная строка)` невозможен, payload проверяет компилятор.
- **Две системы наблюдения, не смешивать.** Эмиттер — для дискретных **моментов** (`ui:spinRequested`, `spin:landed`). MobX — для непрерывного **состояния** (ставка, фаза, баланс). Событие, у которого есть «текущее значение», на самом деле состояние — его место в сторе.
- **Событие ≠ команда.** Вверх (view → логика) — событие в прошедшем времени: view сообщает, что произошло. Вниз (автомат → view) — **прямой вызов метода контроллера**, возвращающего промис (`await reels.land(result)`): фаза обязана дождаться конца анимации, а `emit` ничего не возвращает.
- `on()` возвращает **функцию отписки**. В классах дерева сцены его напрямую не зови — подписывайся через `this.listen` базы [LiveContainer](src/game/ui/live-container.ts): отписка регистрируется сама и снимается в `destroy()`. Вне дерева сцены — сохрани функцию отписки и вызови при смерти владельца. `off(event)` без колбэка и `removeAllListeners()` **не вызывай**: они снимут и чужие подписки.
- Утечки диагностируй через `listenerCounts()` эмиттера (в консоли: `appContainer.get(TOKENS.GameEmitter).listenerCounts()`) — числа должны быть стабильны от раунда к раунду, а после ухода со страницы игры — пустыми.

**Конечный автомат (цикл раунда)** — [flow/](src/flow/): движок [fsm.ts](src/flow/fsm.ts) + фазы `idle → spinning → result → idle`. Своя реализация на async-фазах.

- Фаза — `@injectable`-класс, реализующий `Phase` (`{ name, enter(signal), exit?() }`), по файлу `*-phase.ts` в `phases/`. `enter` **возвращает имя следующей фазы** — переход не делается изнутри фазы: граф переходов читается по `return`-значениям, и цепочка промисов не растёт с каждым раундом. Цикл переходов выполняет движок.
- **Внутри фазы нет цикла.** Появился `while` — это не одна фаза, а две.
- Зависимости (`emitter`, `reels`, `sceneStore`, `api`) фаза объявляет сама через `@inject`; `signal` — не зависимость, а рантайм-значение движка, приходит аргументом `enter`. `fsm.dispose()` абортит его — все незавершённые `waitFor` и анимации реджектятся, при уходе со страницы все фазы завершаются.
- Движок собирает фазы `@multiInject(TOKENS.Phase)` в словарь по `name` (стартовая — `INITIAL_PHASE` из [constants.ts](src/flow/constants.ts)) и публикует активную фазу и фатальную ошибку в `FlowStore` — стор без зависимостей, который читают и другие сторы (`canSpin` в `SceneStore`), и view.
- Сеть и анимация запускаются **параллельно**: фаза дёргает `reels.spin()` и уходит ждать `api.sendSpin(bet, gameMode, signal)`. Промис возвращают только методы с концом (`reels.land(...)`); бесконечная анимация — обычный синхронный вызов, ждать её нечего.
- Сервер — **источник правды**: клиент отображает присланный результат и ничего не пересчитывает.

**Мост React ↔ PIXI** — `useRef` + `useEffect` с очисткой; cleanup разбирает game-контейнер (а деактивация `GameRoot` уничтожает `Application` с тикером и WebGL-контекстом). Бутстрап двухфазный: сперва `await preloadGameAssets()` (все ассеты в кэш), затем сборка графа — конструкторы сцены читают кэш синхронно. На время предзагрузки [GamePage](src/pages/game/index.tsx) держит React-оверлей (канваса ещё нет), снимает его, когда `root.mount` резолвится (внутри `mount` — `await sceneStore.gameLoaded`, доска наполнена). Провал бутстрапа (ассеты или данные раунда) `mount` отдаёт исключением, `boot` ловит его и оставляет оверлей с текстом ошибки: реджектить сам `gameLoaded` нельзя — его ждут после `await app.init()`, и при раннем отказе запроса отклонение осталось бы без обработчика. Guard `disposed` защищает от гонки StrictMode вокруг `await`:

```tsx
useEffect(() => {
  let disposed = false
  const boot = async () => {
    try {
      await preloadGameAssets() // все ассеты в кэш до сборки графа
      if (disposed || !containerRef.current) return
      const game = createGameContainer() // parent — appContainer из замыкания
      const root = game.get(TOKENS.GameRoot) // один get собирает весь граф из кэша
      await root.mount(containerRef.current)
      if (!disposed) setLoading(false)
    } catch {
      if (!disposed) setFailed(true)
    }
  }
  void boot()
  return () => {
    disposed = true
    destroyGameContainer()
  }
}, [])
```

---

## PIXI / канвас

- PIXI **v8**. Инициализация асинхронная: `const app = new Application(); await app.init({ resizeTo: container, ... }); container.appendChild(app.canvas)`.
- Ресайз — только через опцию `resizeTo`, ручных listener'ов нет.
- Игровой цикл — `ticker.add(fn)`; `fn` хранится как стабильная ссылка (поле класса или локальная `const`), чтобы её можно было удалить из тикера при teardown. Игровой тикер приходит из game-контейнера (`@inject(TOKENS.GameTicker)`), рендер PIXI переводится на него после `init` — см. «Композиция и DI».
- **Игровые задержки — только [ticker.waitTicks](src/game/game-ticker.ts)**, не `setTimeout`: в свёрнутой вкладке тикер PIXI останавливается, а `setTimeout` — нет; анимация завершилась бы по таймеру, не отрисовав ни одного кадра, и автомат перешёл бы к следующей фазе, рассинхронизировавшись с отрисовкой. `setTimeout` допустим лишь как watchdog-таймаут по системному времени ([waitFor](src/events/game-emitter.ts), [service.ts](src/api/service.ts)).
- **React StrictMode** монтирует эффекты дважды (mount → cleanup → mount) — защищайся от гонки инициализации. В классе-владельце — поле `pending` ([game-root.ts](src/game/game-root.ts)); в функции — локальный флаг `disposed` (`mountBackground` в [BackgroundCanvas/utils.ts](src/components/BackgroundCanvas/utils.ts)): после `await init()` уничтожаем устаревший app и выходим.
- Учитывай **доступность**: анимационный тикер добавляется только если нет `prefers-reduced-motion` (см. `mountBackground`).
- Фон лендинга ([BackgroundCanvas](src/components/BackgroundCanvas/utils.ts)) грузит PIXI **динамическим `import()`**: компонент стоит в глобальном Layout, и статический импорт утянул бы рендерер в стартовый бандл каждой страницы.
- Провайдеры приложения — только `StrictMode → RouterProvider` ([app/index.tsx](src/app/index.tsx)). Store-провайдера/темы/error-boundary нет.

---

## Ассеты и .gitignore

- Ассеты игры лежат в **`public/game-assets/`** (~7.5 МБ) и игнорятся в [.gitignore](.gitignore) правилом `public/game-assets/` — **не коммить их в remote**.
- **Почему `public/`, а не `src/`**: их грузит `Assets.load` по строковому URL в рантайме, ESM-импорта нет, поэтому в граф сборки Vite они не попадают. Содержимое `public/` копируется в `dist/` как есть, без хеширования имён; из `src/` в прод-сборке они были бы недоступны (в dev это работало, потому что dev-сервер отдаёт исходники по их путям).
- **Корень URL — `/game-assets`**, задан тремя константами в [assets.ts](src/game/assets.ts) (`SYMBOLS_DIR`, `ANIMATIONS_DIR`, `GRAPHIC_DIR`), остальные пути собираются из них. Каталог назван не `game`, чтобы не пересекаться с роутом `/game` в SPA-фолбэке.
- **Вложенность внутри `game-assets/` не менять**: `.atlas` ссылается на свою страницу голым именем файла, PIXI резолвит его относительно URL атласа.
- **Регистр в путях сверяй с диском.** APFS на macOS регистронезависима, поэтому в `npm run dev` опечатка в регистре не проявляется; `sirv` в `vite preview` (и любая прод-раздача) ищет по реальным именам, не находит файл и отдаёт SPA-фолбэк — PIXI получает `index.html` вместо ассета и падает с `InvalidStateError: The source image could not be decoded`. Ошибка указывает на существующий файл, но проблема в регистре. Проверка полного манифеста:
  ```bash
  cd public/game-assets && find . -type f | sed 's|^\./||' | sort > /tmp/real.txt
  # каждый путь из assets.ts должен находиться: grep -qxF "<путь>" /tmp/real.txt
  ```
- **SVG-иконки игры (`graphic/Icons/`) — всегда белые**: tint PIXI умножает цвет (белому источнику можно задать любой цвет, чёрному — никакой), поэтому у новой иконки правь `stroke`/`fill` на `#ffffff` прямо в файле.

---

## Целевая архитектура

> Из брифа. Каркас всех пяти слоёв реализован — их устройство описано в «Паттернах»; здесь — роли и то, чего ещё нет.

1. **Сторы (MobX)** — игровое состояние. Держим **независимые сторы** (по singleton-биндингу на каждый в контейнере его скоупа); RootStore/store-of-stores не вводим, координация между сторами — в фазах автомата. _(есть)_
2. **Сетевой слой** — запросы и парсинг ответов; результат в сторы кладут фазы. Бэкенд мокаем через [MSW](https://mswjs.io/). _(есть)_
3. **Event emitter** — центр регистрации имён событий; связывает логику и сторы с презентацией. _(есть)_
4. **Класс анимации** — обёртка над визуальной сущностью: внешний код работает с методами с игровой семантикой (`spin`, `land`), а не с сырым объектом, поэтому замена `Graphics`-заглушки на Spine не потребует изменений ни в контроллере, ни в фазах. _(есть: база [SpineAnimation](src/game/ui/spine-animation.ts), рамка барабанов, символы; вращение и посадка — в [reel.ts](src/game/controllers/reel.ts), выигрышных анимаций нет)_

> **Единый флоу загрузки.** Все URL игровых ассетов — в одном манифесте [assets.ts](src/game/assets.ts) (Spine-скелеты, текстуры, шрифт). Единственный `Assets.load` в проекте — `preloadGameAssets`, его зовёт [GamePage](src/pages/game/index.tsx) на бутстрапе **до** сборки графа. Дальше всё читается из кэша синхронно: Spine — `SpineAnimation.attach` (берёт готовый скелет из `SpinePool`), текстуры — `Assets.get`, шрифт зарегистрирован. Никакой класс не зовёт `Assets.load` сам; `SpineAnimation` синхронный (только `attach`, без `load`/`onLoaded`). Визуал собирается в конструкторе (рамка, кнопки, фон, лейблы) или в `setKey` (символ) — двухфазного `build()` нет, объект рождается после предзагрузки. Поэтому `SymbolAnimation.setKey` синхронный: подмена скелета и следующий pose-метод (`idle`/`blur`) применяются в одном тике — без гонок, `loadId`, `desiredState`, флагов. Асинхронна только **сеть**: `initGame` (данные, не ассеты) наполняет доску реактивно по `initialSymbols`; `GameRoot.mount` ждёт `sceneStore.gameLoaded` перед стартом автомата и снятием оверлея.

> **Пул скелетов.** `Spine`-инстансы в проекте создаёт и уничтожает только [SpinePool](src/game/spine-pool.ts) (game-контейнер, `TOKENS.SpinePool`) — классы берут их через `SpineAnimation.attach` и возвращают туда же при смене ассета. Причина: `Spine.from` кэширует `SkeletonData`, но на каждый инстанс строит `Skeleton`, `AnimationState` и типизированные массивы на каждый attachment (~35 KB), а лента барабана меняет символ ~83 раза в секунду — пересборка давала мажорные GC и микрофризы. Пул ключуется парой `(skeletonUrl, atlasUrl)` и прогревается в конструкторе по `SPINE_WARM_UP` из [assets.ts](src/game/assets.ts) (число на ассет — пик одновременного спроса). Скоуп — маунт, а не вкладка: инстансы привязаны к `GameTicker`, который умирает вместе с приложением. В `release` обязателен полный сброс — `removeSlotObjects`, `clearTracks`, `setToSetupPose`.
>
> **Статичные позы — с `autoUpdate = false`** (`SpineAnimation.freeze`/`unfreeze`). Поза `blur` у символов задана одним ключом, обновлять по ней скелет каждый кадр незачем: без `_updateAndApplyState` Spine не пересчитывает ни кости, ни вершины. Все `Spine` тикают на `GameTicker` (`Spine.from({ ticker })`), а не на `Ticker.shared` с его отдельным rAF-циклом.

5. **Класс-контроллер** — PIXI `Container`: создаёт класс анимации (п.4) и держит подписки на эвенты (п.3). _(есть)_

Поток: **сеть → фазы автомата → сторы + эмиттер → контроллер → класс анимации → Spine.**
Автомат координирует этот поток: единственный писатель в сторы и единственный источник игровых событий.

**Звук** (вне 5 слоёв брифа) — нативное для PIXI решение (`@pixi/sound`). Подключится подпиской на эвенты, без правок фаз. _(нет)_

### Ещё не решено

- **Слэм-стоп** (досрочная остановка барабанов): под него в фазе зарезервирован `skip()`, но реализации нет.

---

## Чего избегать

Причины — в профильных разделах выше; здесь только чек-лист.

- Не коммить `public/game-assets/**`.
- Не вводи `any` и `@ts-ignore`; не оставляй `console.*` (warn) и `debugger` (error) — исключения: `traceEvent` ([events/utils.ts](src/events/utils.ts)) и `tracePhase` ([flow/utils.ts](src/flow/utils.ts)).
- Не используй `setTimeout` для игровых задержек — только `waitTicks` (см. «PIXI / канвас»).
- Не зови `Spine.from`/`spine.destroy` вне [SpinePool](src/game/spine-pool.ts) — скелеты берутся из пула через `attach` (см. «Единый флоу загрузки»).
- Граф импортов всегда односторонний.
- Не заводи module-scope синглтоны — экземплярами владеет контейнер; единственное исключение — composition root (`appContainer` и слот game-контейнера в [app/container.ts](src/app/container.ts)).
- Не вызывай `container.get()` вне `app/` и роут-страниц; в слоях импортируй только `TOKENS`, классы зависимостей — строго `import type`.
- Не включай `emitDecoratorMetadata` и не импортируй `reflect-metadata` вручную.
- Не используй parameter properties (`constructor(private x: X)`) — запрещены `erasableSyntaxOnly`.
- Не вешай async-обработчики на `onDeactivation` при синхронном `unbind`; `unbindAll()` — только страховочный хвост `destroyGameContainer` после порядкозависимых `unbind`, не замена им. Деактивации-`destroy` — только под guard'ом `destroyed` (см. «Композиция и DI»).
- Не используй callback-ref без cleanup для канвасов — только `useEffect` с очисткой (см. «Мост React↔PIXI»).
- Не используй `makeAutoObservable` и карты-объекты `makeObservable(this, {...})` — только декораторы у членов + `makeObservable(this)` в конструкторе.
- Не подписывайся в `game/` напрямую (`reaction` MobX, `emitter.on`) — только `watch`/`listen` базы `LiveContainer`; mobx-обход ловит ESLint (см. «Стейт (MobX)» и «Событийная модель»).
- Не делай тяжёлые PIXI-инстансы observable; классу без реактивных полей MobX не подключаем (см. `game/game-root.ts`).
- Не клади в `stores/` не-MobX-классы.
- Не добавляй ручную мемоизацию без нужды — работает React Compiler.
- По нерешённым техвыборам (см. «Ещё не решено») не принимай решений самостоятельно — сперва уточни.
- Не комментируй существующий неизменённый код (см. «Учебный проект…»).
- Не добавляй в файл с классом типы, константы и свободные функции — они выносятся в `types.ts`/`utils.ts` рядом (см. «Раскладка файлов в слое», там же — два исключения).
