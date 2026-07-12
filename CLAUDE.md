# CLAUDE.md

Инструкция для Claude по проекту **pixi-game**. Читается в начале каждой сессии — держи её актуальной.

> Язык проекта — русский: UI-тексты, комментарии в коде и эта документация на русском. Пиши так же.

---

## Обзор

Пет-проект для изучения PIXI.js и геймдева. Цель — **слот-машина**.

**Статус: каркас.** Есть: роутинг, лендинг с анимированным PIXI-фоном, WS-транспорт с MSW-моками, event-driven ядро (типизированный эмиттер + конечный автомат раунда на промисах) и сквозной демо-спин (кнопка → сеть → стор → контроллер → анимация-заглушка). Настоящей слот-логики (барабаны, символы, линии) и Spine **пока нет** (см. [Целевая архитектура](#целевая-архитектура)).

**Стек:** React 19 · PIXI.js v8 · MobX 6 · Tailwind CSS v4 · react-router-dom v7 · TypeScript 6 · Vite 8. **React Compiler включён** (через `reactCompilerPreset()` — см. [vite.config.ts](vite.config.ts)). `clsx` в зависимостях, но пока не используется.

---

## Учебный проект: комментарии и спецификации

Проект **учебный** — Сергею важно понимать, **зачем** код устроен именно так.

- **Новый и изменённый код** снабжай подробными комментариями: **зачем** он здесь и какую задачу решает (назначение, принципы, неочевидные решения) — а не буквальный пересказ «что делает строка».
- Комментируй **только новое/изменённое**. **Не** дописывай комментарии в существующий неизменённый код.
- Сергей при ревью может вычищать эти комментарии — это ожидаемо, не возвращай их.

---

## Команды

| Команда           | Что делает                                                                   |
| ----------------- | ---------------------------------------------------------------------------- |
| `npm run dev`     | Vite dev-сервер                                                              |
| `npm run build`   | `tsc -b && vite build`                                                       |
| `npm run lint`    | `eslint --quiet --fix .` + `tsc --noEmit` (автофикс + полная проверка типов) |
| `npm run preview` | превью прод-сборки                                                           |

- Husky `pre-commit` запускает `npm run lint` — линт с автофиксом и тайпчек проходят на каждом коммите.
- Тестов и тест-раннера в проекте нет.

---

## Структура каталогов

Весь код — в `src/`. **Folder-as-module** — только для **компонентов и страниц**: папка экспонирует `index.tsx`, импорт целит в папку (`src/components/Button`). **Слои** (`api/`, `events/`, `flow/`, `game/`, `stores/`, `utils/`, `types/`) — плоские файлы с говорящими именами, импорт целит в **файл** (`src/events/game-emitter`). Баррелей-`index.ts` в слоях нет: синглтон живёт в конце файла со своим классом (как `gameEmitter`, `spinStore`, транспорт в `service.ts`), а сборка — в файле с осмысленным именем (`flow/game-fsm.ts`).

```
src/
  main.tsx                 # вход: createRoot + render(<App/>)
  app/
    index.tsx              # <App>: StrictMode → RouterProvider
    router.tsx             # createBrowserRouter, ленивые страницы
  api/                     # сетевой слой: service.ts (базовый WS-транспорт) + <name>-api.ts (эндпоинт + zod-DTO)
  components/              # переиспользуемые компоненты
  events/                  # эвентный слой: types.ts (карта GameEvents) + game-emitter.ts (класс + синглтон gameEmitter) + wait-for.ts
  flow/                    # конечный автомат раунда: types.ts (Phase, PhaseContext) + fsm.ts (движок) + game-fsm.ts (сборка) + phases/ (idle, spinning, result)
  game/                    # PIXI-слой, разделён по ролям из брифа:
    animations/            #   п.4 — классы анимации: обвязки над визуальной сущностью, смысловые методы → промис
    controllers/           #   п.5 — контроллеры-Container: создают анимации, держат подписки на эвенты
  mocks/                   # MSW-моки: create-ws-handler.ts (база) + handlers.ts (эндпоинты) + browser.ts (worker)
  pages/                   # роут-страницы
  stores/                  # MobX-сторы: game-root.ts (композиционный корень) + spin-store.ts (состояние раунда)
  constants/               # глобальные константы, переиспользуемые на уровне всего приложения
  utils/                   # глобальные утилиты: async-value.ts, async-stream.ts, wait-ticks.ts, …
  types/                   # общие типы по темам (game.ts, network.ts, …)
  styles/index.css         # единственный глобальный стиль (Tailwind + @theme)
  assets/
    icons/index.ts         # баррель SVG-иконок как React-компонентов
    game/                  # ⚠️ ассеты игры — в .gitignore, не коммитить (см. ниже)
```

---

## Конвенции кода

**Именование**

- Папки-компоненты — **PascalCase** (`Button/`, `GameCanvas/`, `Layout/`, `BackgroundCanvas/`).
- Роут-страницы и не-компонентные файлы — **kebab-case** (`pages/main/`, `not-found/`, `bg-blobs.ts`, `create-blob-texture.ts`).
- Страницы — суффикс `Page` (`MainPage`), иконки — `Icon` (`LogoIcon`), сторы — класс `XxxStore` + синглтон `xxxStore`.
- Константы — `SCREAMING_SNAKE_CASE` (`BG_BLOBS`).

**Экспорты и типы**

- Только **именованные экспорты** (default — лишь у SVG через `?react`).
- Компоненты — стрелочные `export const`, без `React.FC`. Пропсы типизируй `interface XxxProps` рядом с компонентом (см. [Button](src/components/Button/index.tsx)). Общие/переиспользуемые типы — в **`src/types/`** по темам (`network.ts` и т.п.); типы, специфичные для одного места, держим рядом с использованием — в частности **DTO-типы `z.infer` живут рядом со своими zod-схемами в `api/`**.
- `any` **запрещён** (`no-explicit-any: error`) — в коде его нет, не вводи. Вместо `@ts-ignore` — `@ts-expect-error`.
- Type-only импорты обязательны: `import { type X }` / `import type` (`consistent-type-imports: error`).
- **Enum-подобные наборы** — не `enum` (запрещён `erasableSyntaxOnly`) и не голый union, а `as const`-объект + производный тип: `export const X = { a: 'a', … } as const` → `export type X = (typeof X)[keyof typeof X]` (см. [RequestStatus](src/types/network.ts)). Даёт значения с автокомплитом (`X.a`, сужение в `if`/`switch`) и zero-runtime union-тип.

**Импорты**

- Алиас пути — **`src/*` → `./src`** (не `@/`). Кросс-папочные импорты — через `src/...`, относительные (`./`) — только для соседних/дочерних файлов.
- Порядок импортов навязан ESLint (`import/order`): `builtin → external → internal`, `react` первым, пустая строка между группами, алфавит. `import/no-cycle` включён.

**Форматирование** — Prettier + автофиксимые ESLint-правила чинит `npm run lint` на pre-commit; вручную формат не подгоняй.

**TypeScript** — строгий (`strict` + `noUnusedLocals/Parameters`, `verbatimModuleSyntax`, `erasableSyntaxOnly`, `moduleDetection: force`). Неиспользуемые параметры — с префиксом `_` (`(_ticker: Ticker) => {}`).

**Асинхронность** — `async/await` + `try/catch`; `.then()/.catch()` **не используем**. Неизбежные исключения: конструктор `new Promise((resolve, reject) => …)` для отложенного (deferred) промиса, который резолвится извне — напр. запрос↔ответ в [service.ts](src/api/service.ts); и «выстрелил-и-забыл» через `void fn()` (см. [main.tsx](src/main.tsx), [mount-background.ts](src/pages/main/utils/mount-background.ts)). Так же исключение startMocking - так синтаксически удобнее и конструкция легко читаемая

---

## Паттерны

**Компоненты** — функциональные, Tailwind-классы в `className`. Для крупных наборов классов — многострочный шаблон-литерал (см. `baseStyles` в [Button](src/components/Button/index.tsx)). CSS-модулей и styled-components нет; глобальный стиль один — [styles/index.css](src/styles/index.css) (`@import "tailwindcss"; @theme { --header-height }`). CSS-переменные через arbitrary values: `h-(--header-height)`; брендовые цвета как `text-[#a98fc3]`.

> **React Compiler включён** — ручная мемоизация (`useMemo`/`useCallback`/`React.memo`) обычно не нужна, не добавляй её по умолчанию. Соблюдай Правила Хуков (компилятор на них опирается).

**Роутинг** — `createBrowserRouter` (react-router v7 data-router), единый [Layout](src/components/Layout/index.tsx) с `<Outlet/>`. Страницы грузятся **лениво**:

```ts
lazy: async () => {
  const module = await import('src/pages/main')
  const { MainPage } = module
  return { element: <MainPage /> }
}
```

**Стейт (MobX)** — в `stores/`: [game-root.ts](src/stores/game-root.ts) (композиционный корень: PIXI `Application` + сборка контроллеров и автомата) и [spin-store.ts](src/stores/spin-store.ts) (состояние раунда). Паттерн стора: класс-синглтон на уровне модуля, `makeAutoObservable(this)` в конструкторе, экспорт инстанса в конце файла (`export const spinStore = new SpinStore()`).

- MobX — для **игрового состояния**. UI-состояние интерфейса — на стороне React (`useState`, позже Zustand), не в MobX.
- Тяжёлые/нереактивные PIXI-поля **исключай из наблюдения**: `makeAutoObservable<this,'app'|...>(this, { app: false, ... })`. Observable — только то, на что реагирует UI/логика.
- Мутации observable в async-коде оборачивай в `runInAction`.
- Библиотека — только `mobx` (без `mobx-react`/`-lite`). `observer()` пока не используется; в PIXI-слое подписка на стор — через `reaction` с отпиской в `destroy()` (см. [SpinButton](src/game/controllers/spin-button.ts)).
- **Единственный писатель в сторы — фазы автомата** (`flow/phases/`). Контроллеры, view и React только читают.
- **Сеть в сторе** — через единые хелперы [AsyncValue](src/utils/async-value.ts)`<T>` (фетч/мутации: `this.x.run(() => apiCall())`, сам ведёт `value/status/error`) и [AsyncStream](src/utils/async-stream.ts)`<T>` (WS-подписки: `this.x.start(subscribeFn)`/`stop()`, `value` = последнее push-значение). Единый синтаксис на все три задачи (фетч, мутация, подписка); `fromResource`/сырой `flow` в сторах для этого не пишем.

**Событийная модель** — [events/](src/events/): `GameEmitter` (тонкая обёртка над `EventEmitter` из `pixi.js` — это eventemitter3, он уже в бандле), карта событий [types.ts](src/events/types.ts) и [waitFor](src/events/wait-for.ts). Синглтон `gameEmitter` — в конце [game-emitter.ts](src/events/game-emitter.ts); слои получают его через DI (конструктор/контекст), а не импортом.

- **Все имена событий — только в `GameEvents`.** Набор ограничен и типизирован: `emit(произвольная строка)` невозможен, payload проверяет компилятор.
- **Две системы наблюдения, не смешивать.** Эмиттер — для дискретных **моментов** (`ui:spinRequested`, `spin:landed`). MobX — для непрерывного **состояния** (ставка, фаза, баланс). Событие, у которого есть «текущее значение», на самом деле состояние — его место в сторе.
- **Событие ≠ команда.** Вверх (view → логика) — событие в прошедшем времени: view сообщает, что случилось, и не знает ни про автомат, ни про сеть. Вниз (автомат → view) — **прямой вызов метода контроллера**, возвращающего промис (`await reels.land(result)`): фаза обязана дождаться конца анимации, а `emit` ничего не возвращает. Команды через эмиттер превращают его в скрытый RPC.
- `on()` возвращает **функцию отписки** — складывай их в мешок и снимай в `destroy()`. `off(event)` без колбэка и `removeAllListeners()` **не вызывай**: снимут и чужие подписки.
- Утечки диагностируй через `gameEmitter.listenerCounts()` — числа должны быть стабильны от раунда к раунду.

**Конечный автомат (петля раунда)** — [flow/](src/flow/): движок [fsm.ts](src/flow/fsm.ts) + фазы `idle → spinning → result → idle`. Своя реализация на async-фазах.

- Фаза = `{ name, enter(ctx), exit? }`. `enter` **возвращает имя следующей фазы** — переход не делается изнутри: так граф читается по `return`, и цепочка промисов не растёт с каждым раундом. Петлю крутит движок.
- **Внутри фазы нет цикла.** Появился `while` — это не одна фаза, а две.
- Всё, что нужно фазе, приходит через `PhaseContext` (DI), включая `signal`. `fsm.dispose()` абортит его — все висящие `waitFor` и анимации реджектятся, ни одна фаза не переживает уход со страницы.
- Сеть и анимация запускаются **параллельно** (`Promise.all([sendSpin(bet), reels.spin(signal)])`) — барабанам незачем ждать сервер.
- Сервер — **источник правды**: клиент рисует присланный результат и ничего не пересчитывает (никакого расчёта выигрыша на клиенте).

**Мост React ↔ PIXI** — канон: `useRef` + `useEffect` с очисткой. В `mount` канвас создаёт `Application`, а cleanup через `unmount`/teardown его уничтожает — при уходе со страницы освобождаются тикер, ResizeObserver и WebGL-контекст:

```tsx
useEffect(() => {
  const container = containerRef.current
  if (!container) return
  void gameRoot.mount(container)
  return () => gameRoot.unmount()
}, [])
```

---

## PIXI / канвас

- PIXI **v8**. Инициализация асинхронная: `const app = new Application(); await app.init({ resizeTo: container, ... }); container.appendChild(app.canvas)`.
- Ресайз — только через опцию `resizeTo`, ручных listener'ов нет.
- Игровой цикл — `app.ticker.add(fn)`; `fn` хранится как стабильная ссылка (поле класса или локальная `const`), чтобы корректно сниматься при teardown.
- **React StrictMode** двойной-монтирует эффекты — защищайся от гонки. В синглтоне-владельце — поле `pending` ([game-root.ts](src/stores/game-root.ts)); в функции — локальный флаг `disposed` ([mountBackground](src/pages/main/BackgroundCanvas/index.tsx)): после `await init()` уничтожаем «устаревший» app и выходим.
- Учитывай **доступность**: анимационный тикер добавляется только если нет `prefers-reduced-motion` (см. `mountBackground`).
- Провайдеры приложения — только `StrictMode → RouterProvider` ([app/index.tsx](src/app/index.tsx)). Store-провайдера/темы/error-boundary нет.

---

## Ассеты и .gitignore

- Ассеты игры лежат в **`src/assets/game/`** (~146 МБ) и игнорятся в [.gitignore](.gitignore) правилом `src/assets/game/` — **не коммить их в remote**.

---

## Целевая архитектура

> Из брифа. Каркас всех пяти слоёв стоит; наполнение реальной слот-логикой — впереди. Слои канваса оперируют обвязками, а не сырыми Spine-объектами.

1. **Сторы (MobX)** — хранение данных и реактивность игрового состояния ([spin-store.ts](src/stores/spin-store.ts); баланс и прочее добавим позже). Держим **независимые синглтоны**; RootStore/store-of-stores не вводим, координацию между сторами — в фазах автомата. _(есть)_
2. **Сетевой слой** — делает запросы, парсит ответы; результат в сторы кладут фазы. Транспорт — **WebSocket** ([service.ts](src/api/service.ts)), бэкенд мокаем через [MSW](https://mswjs.io/). _(есть)_
3. **Event emitter** — [events/](src/events/), обёртка над `EventEmitter` из `pixi.js` (eventemitter3 уже в бандле; отдельный пакет не ставили). Центр регистрации имён событий; «склеивает» логику/сторы с презентацией. _(есть)_
4. **Класс анимации** — обвязка над визуальной сущностью: смысловые методы, возвращающие промис ([reel-animation.ts](src/game/animations/reel-animation.ts)). Внешний код работает с обвязкой, а не с сырым объектом — поэтому подмена заглушки на Spine не заденет ни контроллер, ни фазы. Сейчас внутри `Graphics`; Spine-интеграцию, скорее всего, **пишем своим решением**. _(каркас; Spine — нет)_
5. **Класс-контроллер** — PIXI `Container`: создаёт класс анимации (п.4) и держит подписки на эвенты (п.3) ([reels-controller.ts](src/game/controllers/reels-controller.ts)). _(есть)_

Поток: **сеть → фазы автомата → сторы + эмиттер → контроллер → класс анимации → Spine.**
Автомат ([flow/](src/flow/)) — то, что дирижирует потоком: он единственный писатель в сторы и единственный, кто эмитит игровые события.

**Звук** (вне 5 слоёв брифа) — нативное для PIXI решение (`@pixi/sound`). Подключится подпиской на эвенты, без правок фаз. _(нет)_

### Ещё не решено

- **Spine-рантайм:** своё решение или готовый (`@esotericsoftware/spine-pixi`) — определимся, когда дойдём до ассетов.
- **Слэм-стоп** (досрочная остановка барабанов): под него в фазе зарезервирован `skip()`, но реализации нет.

---

## Чего избегать

- Не коммить `src/assets/game/**`.
- Не вводи `any` и `@ts-ignore`; не оставляй `console.*` (это warn) и `debugger` (error). Единственное исключение — DEV-трассировка эвентов в [game-emitter.ts](src/events/game-emitter.ts).
- **Не используй `setTimeout` для игровых задержек** — только [waitTicks](src/utils/wait-ticks.ts). В свёрнутой вкладке тикер PIXI встаёт, а `setTimeout` — нет: анимация «доиграет» без единого кадра, и автомат уедет дальше рассинхронизированным с картинкой. `setTimeout` допустим лишь как watchdog-таймаут (см. `waitFor`, `service.ts`).
- Не давай `game/*` (контроллеры, view) импортировать `flow/*` — это правило держит граф импортов односторонним и не даёт сработать `import/no-cycle`.
- Не используй callback-ref без cleanup для канвасов — только `useEffect` с очисткой (см. канон «Мост React↔PIXI»).
- Не делай тяжёлые PIXI-инстансы observable — исключай их из `makeAutoObservable` (см. `game-root.ts`).
- Не добавляй ручную мемоизацию без нужды — работает React Compiler.
- Не выдумывай нерешённые техвыборы (см. «Ещё не решено») — сперва уточни.
- Не комментируй существующий неизменённый код — комментарии только к новому/изменённому (см. «Учебный проект…»).
