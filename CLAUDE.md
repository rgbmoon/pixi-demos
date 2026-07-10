# CLAUDE.md

Инструкция для Claude по проекту **pixi-game**. Читается в начале каждой сессии — держи её актуальной.

> Язык проекта — русский: UI-тексты, комментарии в коде и эта документация на русском. Пиши так же.

---

## Обзор

Пет-проект для изучения PIXI.js и геймдева. Цель — **слот-машина**.

**Статус: ранний скелет.** Сейчас есть: роутинг, лендинг с анимированным PIXI-фоном, пустой game-канвас с no-op тикером. Игровой логики, сети, эвентной модели и подключения Spine-ассетов **пока нет** (см. [Целевая архитектура](#целевая-архитектура)).

**Стек:** React 19 · PIXI.js v8 · MobX 6 · Tailwind CSS v4 · react-router-dom v7 · TypeScript 6 · Vite 8. **React Compiler включён** (через `reactCompilerPreset()` — см. [vite.config.ts](vite.config.ts)). `clsx` в зависимостях, но пока не используется.

---

## Учебный проект: комментарии и спецификации

Проект **учебный** — Сергею важно понимать, **зачем** код устроен именно так.

- **Новый и изменённый код** снабжай подробными комментариями: **зачем** он здесь и какую задачу решает (назначение, принципы, неочевидные решения) — а не буквальный пересказ «что делает строка».
- Комментируй **только новое/изменённое**. **Не** дописывай комментарии в существующий неизменённый код.
- Сергей при ревью может вычищать эти комментарии — это ожидаемо, не возвращай их.
- **Спецификации функционала** — в [docs/](docs/): по каждому модулю назначение, бизнес-логика и принципы работы. Добавляешь/меняешь модуль — создай или обнови его спеку (шаблон: [docs/specs/\_template.md](docs/specs/_template.md)).

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

Весь код — в `src/`. **Folder-as-module:** каждая папка компонента/страницы/стора экспонирует `index.tsx`/`index.ts`, а импорт целит в папку (не в файл).

```
src/
  main.tsx                 # вход: createRoot + render(<App/>)
  app/
    index.tsx              # <App>: StrictMode → RouterProvider
    router.tsx             # createBrowserRouter, ленивые страницы
  components/              # переиспользуемые компоненты
  pages/                   # роут-страницы
  stores/                  # MobX-сторы: game-root.ts (корень игры) + будущее игровое состояние
  constants/               # глобальные константы, переиспользуемые на уровне всего приложения
  utils/                   # глобальные утилиты, переиспользуемые на уровне всего приложения
  styles/index.css         # единственный глобальный стиль (Tailwind + @theme)
  assets/
    icons/index.ts         # баррель SVG-иконок как React-компонентов
    game/                  # ⚠️ ассеты игры — в .gitignore, не коммитить (см. ниже)
```

Вне `src/`: **`docs/`** — спецификации функционала (бизнес-логика и принципы работы модулей).

---

## Конвенции кода

**Именование**

- Папки-компоненты — **PascalCase** (`Button/`, `GameCanvas/`, `Layout/`, `BackgroundCanvas/`).
- Роут-страницы и не-компонентные файлы — **kebab-case** (`pages/main/`, `not-found/`, `bg-blobs.ts`, `create-blob-texture.ts`).
- Страницы — суффикс `Page` (`MainPage`), иконки — `Icon` (`LogoIcon`), сторы — класс `XxxStore` + синглтон `xxxStore`.
- Константы — `SCREAMING_SNAKE_CASE` (`BG_BLOBS`).

**Экспорты и типы**

- Только **именованные экспорты** (default — лишь у SVG через `?react`).
- Компоненты — стрелочные `export const`, без `React.FC`. Пропсы типизируй `interface XxxProps` рядом с компонентом (см. [Button](src/components/Button/index.tsx)). Отдельной папки `types/` нет — типы держим рядом с использованием.
- `any` **запрещён** (`no-explicit-any: error`) — в коде его нет, не вводи. Вместо `@ts-ignore` — `@ts-expect-error`.
- Type-only импорты обязательны: `import { type X }` / `import type` (`consistent-type-imports: error`).

**Импорты**

- Алиас пути — **`src/*` → `./src`** (не `@/`). Кросс-папочные импорты — через `src/...`, относительные (`./`) — только для соседних/дочерних файлов.
- Порядок импортов навязан ESLint (`import/order`): `builtin → external → internal`, `react` первым, пустая строка между группами, алфавит. `import/no-cycle` включён.

**Форматирование** — Prettier + автофиксимые ESLint-правила чинит `npm run lint` на pre-commit; вручную формат не подгоняй.

**TypeScript** — строгий (`strict` + `noUnusedLocals/Parameters`, `verbatimModuleSyntax`, `erasableSyntaxOnly`, `moduleDetection: force`). Неиспользуемые параметры — с префиксом `_` (`(_ticker: Ticker) => {}`).

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

**Стейт (MobX)** — в `stores/` пока один стор — `game-root.ts` (корень игрового PIXI: `makeAutoObservable` с исключением тяжёлых полей `app`/`pending`, своего реактивного состояния ещё не держит — обвязка «на вырост»). Сторы игрового состояния (баланс, фаза спина и т.п.) появятся позже. Паттерн для них: классы-синглтоны на уровне модуля, `makeAutoObservable(this)` в конструкторе, экспорт инстанса в конце файла (`export const balanceStore = new BalanceStore()`).

- MobX — для **игрового состояния**. UI-состояние интерфейса — на стороне React (`useState`, позже Zustand), не в MobX.
- Тяжёлые/нереактивные PIXI-поля **исключай из наблюдения**: `makeAutoObservable<this,'app'|...>(this, { app: false, ... })`. Observable — только то, на что реагирует UI/логика.
- Мутации observable в async-коде оборачивай в `runInAction`.
- Библиотека — только `mobx` (без `mobx-react`/`-lite`). `observer()` пока не используется.

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

> Из брифа. **Ещё не реализовано** — ориентир для будущего кода. Слои канваса оперируют обвязками, а не сырыми Spine-объектами.

1. **Сторы (MobX)** — хранение данных и реактивность игрового состояния (сейчас есть только `game-root.ts` — корень канваса; сторы состояния добавим позже). Держим **независимые синглтоны**; RootStore/store-of-stores не вводим, координацию между сторами — в контроллерах/эмиттере.
2. **Сетевой слой** — делает запросы, парсит ответы, пишет результат в сторы. Бэкенд **мокаем через [MSW](https://mswjs.io/)**; транспорт (REST/WebSocket) ещё не выбран. _(нет)_
3. **Event emitter** — **собственный класс-эмиттер** (не сторонняя библиотека) — «склеивает» JS-логику/сторы с анимациями. _(нет)_
4. **Класс анимации** — обвязка над конкретной Spine-сущностью: методы, дёргающие её анимации. Внешний код работает с этой обвязкой, а не с сырым Spine-объектом. Spine-интеграцию, скорее всего, **пишем своим решением**, а не берём готовый сторонний рантайм. _(нет)_
5. **Класс-контроллер** — по сути PIXI `Container`: создаёт инстанс класса анимации (п.4) и подписки на эвенты эмиттера (п.3). _(нет)_

Поток: сеть → сторы → эмиттер → контроллер → класс анимации → Spine.

**Звук** (вне 5 слоёв брифа) — нативное для PIXI решение (`@pixi/sound`). _(нет)_

### Ещё не решено

- **Сетевой транспорт:** REST или WebSocket — определимся позже; мок-слой в любом случае на MSW.

---

## Чего избегать

- Не коммить `src/assets/game/**`.
- Не вводи `any` и `@ts-ignore`; не оставляй `console.*` (это warn) и `debugger` (error).
- Не используй callback-ref без cleanup для канвасов — только `useEffect` с очисткой (см. канон «Мост React↔PIXI»).
- Не делай тяжёлые PIXI-инстансы observable — исключай их из `makeAutoObservable` (см. `game-root.ts`).
- Не добавляй ручную мемоизацию без нужды — работает React Compiler.
- Не выдумывай нерешённые техвыборы (см. «Ещё не решено») — сперва уточни.
- Не комментируй существующий неизменённый код — комментарии только к новому/изменённому (см. «Учебный проект…»).
