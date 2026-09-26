import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import react from 'eslint-plugin-react'
import importPlugin from 'eslint-plugin-import-x'
import unusedImports from 'eslint-plugin-unused-imports'
import prettierConfig from 'eslint-config-prettier'
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript'
import tseslint from 'typescript-eslint'

// Направление зависимостей между пакетами задают их package.json: pnpm не резолвит незаявленный пакет,
// `import/no-extraneous-dependencies` сообщает о нём ошибкой линта. Блоки ниже проверяют ограничения,
// которых в package.json нет: core и net без PIXI и React, PIXI в React-ките только динамическим
// импортом, уровни внутри игры. `allowTypeImports` оставляет развязку через `import type`, на ней стоит DI.
//
// Важно: в flat-config правила одного имени не складываются, а заменяются целиком. Поэтому каждый
// блок объявляет ПОЛНЫЙ набор ограничений для своих файлов (пакетные + слоевые + paths), а блоки
// идут от общего к частному — побеждает последний совпавший.
const boundary = (files, { patterns = [], paths = [] }) => ({
  files,
  rules: {
    '@typescript-eslint/no-restricted-imports': ['error', { patterns, paths }],
  },
})

const under = (...roots) => roots.flatMap((root) => [root, `${root}/**`])

/** Запрет на пакеты по их корням: и сам модуль, и всё под ним. */
const forbid = (roots, message, allowTypeImports = false) => ({ group: under(...roots), message, allowTypeImports })

/** Запрет импорта уровней своего пакета (`#src/<уровень>`). Задан через regex: в синтаксисе gitignore строка с ведущим `#` — комментарий. */
const forbidLayers = (layers, message, allowTypeImports = false) => ({
  regex: `^#src/(${layers.join('|')})(/|$)`,
  message,
  allowTypeImports,
})

/** Пакеты игр. Импортировать их могут только страница своей игры и агрегатор моков. */
const GAMES = ['slot', 'toybox'].map((name) => `@pixi-demos/${name}`)

const NO_REACT = {
  group: ['react', 'react-dom', 'react-dom/*'],
  message: 'Пакет обязан оставаться без React.',
}

const NO_PIXI = {
  group: ['pixi.js', 'pixi.js/*'],
  message: 'Пакет обязан оставаться чистым: без PIXI.',
}

// Типы PIXI стираются компилятором, в чанк попадает только рантайм-импорт
const NO_PIXI_RUNTIME = {
  ...NO_PIXI,
  message: 'PIXI в React-ките — только динамическим import(), иначе он попадёт в стартовый чанк.',
  allowTypeImports: true,
}

// Токены — лист графа из одних Symbol; всё остальное в engine тянет PIXI в стартовый чанк
const ENGINE_TOKENS_ONLY = {
  group: ['@pixi-demos/engine/**', '!@pixi-demos/engine/tokens'],
  message: 'app не тянет PIXI-рантайм: из engine ему доступны только токены.',
}

// Подписки в дереве сцены ставятся через watch/listen базы LiveContainer: она снимает их сама
const NO_RAW_SUBSCRIBE = [
  {
    name: 'mobx',
    importNames: ['reaction', 'autorun', 'when'],
    message: 'В дереве сцены подписки — через watch/listen базы LiveContainer.',
  },
]

const NOT_OTHER_GAME = forbid(GAMES, 'Игра не импортирует пакеты игр; свой пакет импортируется через #src/.')

// Физический движок импортирует только мир кучи heap/heap-world.ts: замена движка не выходит за его пределы
const NO_PLANCK = {
  group: ['planck', 'planck/*'],
  message: 'planck импортирует только heap/heap-world.ts: остальной код работает с миром через модель кучи.',
}

const packageBoundaries = [
  boundary(['packages/core/src/**/*.ts'], {
    patterns: [
      forbid(['@pixi-demos/net', '@pixi-demos/engine', ...GAMES], 'core — лист графа: остальных пакетов он не знает.'),
      NO_PIXI,
      NO_REACT,
    ],
  }),
  boundary(['packages/net/src/**/*.ts'], {
    patterns: [forbid(['@pixi-demos/engine', ...GAMES], 'net знает только core.'), NO_PIXI, NO_REACT],
  }),
  // Рил-машина — самостоятельная библиотека: модель не импортирует пакеты монорепо, адаптер импортирует только модель
  boundary(['packages/reels/src/**/*.ts'], {
    patterns: [
      {
        group: ['@pixi-demos/*', '@pixi-demos/*/**'],
        message: 'reels — независимая библиотека: импорт пакетов монорепо запрещён.',
      },
      NO_PIXI,
      NO_REACT,
    ],
  }),
  boundary(['packages/reels-pixi-adapter/src/**/*.ts'], {
    patterns: [
      {
        group: ['@pixi-demos/*', '@pixi-demos/*/**', '!@pixi-demos/reels'],
        message: 'Адаптеру доступна только модель рил-машины, импорт — из корня @pixi-demos/reels.',
      },
      NO_REACT,
    ],
  }),
  boundary(['packages/engine/src/**/*.ts'], {
    patterns: [forbid(GAMES, 'engine — общий PIXI-рантайм: импорт игр запрещён.'), NO_REACT],
    paths: NO_RAW_SUBSCRIBE,
  }),
  // LiveContainer — единственное место, где подписка ставится напрямую: она и есть их владелец
  boundary(['packages/engine/src/live-container.ts'], {
    patterns: [forbid(GAMES, 'engine — общий PIXI-рантайм: импорт игр запрещён.'), NO_REACT],
  }),
  boundary(['web/src/components/**/*.{ts,tsx}'], {
    patterns: [
      forbid(['@pixi-demos/engine', ...GAMES, 'src/pages', 'src/app'], 'components знает только core и net.'),
      NO_PIXI_RUNTIME,
    ],
  }),
  boundary(['web/src/app/**/*.{ts,tsx}'], {
    patterns: [
      forbid(GAMES, 'Композиционный корень не знает игру статически — её знает только её страница.'),
      ENGINE_TOKENS_ONLY,
    ],
  }),
  // Агрегатор моков по определению перечисляет все игры; в прод-бандл он не попадает (флаг USE_MOCKS)
  boundary(['web/src/app/mocks/**/*.ts'], {
    patterns: [ENGINE_TOKENS_ONLY],
  }),
  // Из пакета игры странице доступен только контракт — вход `.`; внутренние модули игры не импортируются
  boundary(['web/src/pages/**/*.{ts,tsx}'], {
    patterns: [
      {
        group: GAMES.map((game) => `${game}/**`),
        message: 'Из пакета игры странице доступен только контракт: импорт из корня пакета.',
      },
    ],
  }),
  // Лендинг и 404 — общий бандл: игра и PIXI приезжают только с ленивым чанком страницы игры
  boundary(['web/src/pages/main/**/*.{ts,tsx}', 'web/src/pages/not-found/**/*.{ts,tsx}'], {
    patterns: [
      forbid(
        ['@pixi-demos/engine', ...GAMES],
        'Страницы вне игры не тянут ни игру, ни PIXI — иначе они уедут в стартовый чанк.'
      ),
      NO_PIXI_RUNTIME,
    ],
  }),
  // Пайпы сборки ассетов работают в Node; знания игры приходят конфигом сборки
  boundary(['tools/*/src/**/*.ts'], {
    patterns: [
      {
        group: ['@pixi-demos/*', '@pixi-demos/*/**'],
        message: 'Инструмент сборки не импортирует пакеты монорепо: знания игры приходят конфигом.',
      },
      NO_PIXI,
      NO_REACT,
    ],
  }),
]

// Уровни внутри игры: вниз импортировать можно, вверх — только `import type`.
// Каждый блок повторяет пакетный набор, иначе он его затрёт.
const GAME_BASE = [NOT_OTHER_GAME, NO_REACT, NO_PLANCK]

// Модели кучи и клешни — соседние уровни под фазами и контроллерами: друг друга они не импортируют
const HEAP_FORBIDDEN_LAYERS = forbidLayers(
  ['claw', 'stores', 'api', 'phases', 'controllers', 'ui', 'scenes'],
  'Модель кучи — уровень под фазами и контроллерами: модель клешни, сторы, сеть, автомат и сцену она не импортирует.'
)

const CLAW_FORBIDDEN_LAYERS = forbidLayers(
  ['heap', 'stores', 'api', 'phases', 'controllers', 'ui', 'scenes'],
  'Модель клешни — уровень под фазами и контроллерами: модель кучи, сторы, сеть, автомат и сцену она не импортирует.'
)

const gameLayers = [
  boundary(['games/*/src/**/*.ts'], { patterns: GAME_BASE, paths: NO_RAW_SUBSCRIBE }),
  boundary(['games/*/src/ui/**/*.ts'], {
    patterns: [
      ...GAME_BASE,
      forbidLayers(
        ['stores', 'heap', 'claw', 'api', 'phases', 'controllers', 'scenes'],
        'ui — то, что рисуется: сторов, моделей кучи и клешни, сети, контроллеров и сцены он не знает.'
      ),
      forbidLayers(['events'], 'ui не подписывается на события — это работа контроллера.'),
    ],
    paths: NO_RAW_SUBSCRIBE,
  }),
  boundary(['games/*/src/api/**/*.ts'], {
    patterns: [
      ...GAME_BASE,
      forbidLayers(
        ['stores', 'heap', 'claw', 'phases', 'controllers', 'ui', 'scenes'],
        'api знает только листовые типы и константы игры.'
      ),
    ],
    paths: NO_RAW_SUBSCRIBE,
  }),
  boundary(['games/*/src/stores/**/*.ts'], {
    patterns: [
      ...GAME_BASE,
      forbidLayers(
        ['heap', 'claw', 'phases', 'controllers', 'ui', 'scenes'],
        'Стор не знает ни моделей кучи и клешни, ни автомата, ни сцены.'
      ),
    ],
    paths: NO_RAW_SUBSCRIBE,
  }),
  boundary(['games/*/src/controllers/**/*.ts'], {
    patterns: [
      ...GAME_BASE,
      // DTO живут рядом со своими схемами, поэтому тип ответа контроллеру доступен — вызов нет
      forbidLayers(['api'], 'Контроллер читает данные из стора, в сеть он не ходит.', true),
      forbidLayers(['phases', 'scenes'], 'Контроллер не знает ни автомата, ни сцены: они дёргают его методы сами.'),
    ],
    paths: NO_RAW_SUBSCRIBE,
  }),
  boundary(['games/*/src/phases/**/*.ts'], {
    patterns: [
      ...GAME_BASE,
      forbidLayers(
        ['controllers', 'scenes', 'ui'],
        'Фаза получает контроллеры через DI: сцену и виды — только import type.',
        true
      ),
    ],
    paths: NO_RAW_SUBSCRIBE,
  }),
  boundary(['games/*/src/scenes/**/*.ts'], {
    patterns: [
      ...GAME_BASE,
      forbidLayers(
        ['api', 'phases', 'heap', 'claw'],
        'Сцена — раскладка контроллеров: ни сети, ни автомата, ни моделей кучи и клешни она не знает.'
      ),
    ],
    paths: NO_RAW_SUBSCRIBE,
  }),
  boundary(['games/*/src/heap/**/*.ts'], {
    patterns: [...GAME_BASE, HEAP_FORBIDDEN_LAYERS],
    paths: NO_RAW_SUBSCRIBE,
  }),
  // Мир кучи — единственный модуль игры с planck: набор уровня heap без NO_PLANCK
  boundary(['games/*/src/heap/heap-world.ts'], {
    patterns: [NOT_OTHER_GAME, NO_REACT, HEAP_FORBIDDEN_LAYERS],
    paths: NO_RAW_SUBSCRIBE,
  }),
  boundary(['games/*/src/claw/**/*.ts'], {
    patterns: [...GAME_BASE, CLAW_FORBIDDEN_LAYERS],
    paths: NO_RAW_SUBSCRIBE,
  }),
]

export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.husky/**',
      '**/.turbo/**',
      '**/public/**',
      '**/vite.config.ts',
      '**/coverage/**',
      '**/playwright-report/**',
      '**/test-results/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettierConfig,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      globals: globals.browser,
    },
    settings: {
      react: {
        version: 'detect',
      },
      // Пакеты монорепо и свой #src/ — группа internal: после npm-зависимостей, через пустую строку
      'import-x/internal-regex': '^(#src|@pixi-demos)/',
      // Без этих настроек import-x не резолвит и не разбирает .ts-файлы, и import/no-cycle не находит циклов.
      // Пути к tsconfig абсолютные: eslint запускается из папки пакета
      'import-x/extensions': importPlugin.flatConfigs.typescript.settings['import-x/extensions'],
      'import-x/parsers': importPlugin.flatConfigs.typescript.settings['import-x/parsers'],
      'import-x/resolver-next': [
        createTypeScriptImportResolver({
          noWarnOnMultipleProjects: true,
          project: [
            'tsconfig.json',
            'packages/*/tsconfig*.json',
            'games/*/tsconfig*.json',
            'tools/*/tsconfig*.json',
            'web/tsconfig*.json',
          ].map((glob) => `${import.meta.dirname}/${glob}`),
        }),
      ],
    },
    plugins: {
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      import: importPlugin,
      'unused-imports': unusedImports,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // JS/TS базовые
      'no-param-reassign': 'off',
      'no-plusplus': ['error', { allowForLoopAfterthoughts: true }],
      'prefer-destructuring': ['error', { object: true, array: false }],
      'no-console': 'warn',
      'no-debugger': 'error',
      'object-shorthand': ['error', 'always'],
      // Состав публичного API задаёт явный список: новый экспорт внутреннего модуля не становится публичным
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ExportAllDeclaration',
          message: 'Реэкспорт — только именованный: export { A } from, export type { B } from.',
        },
      ],

      // TypeScript
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-use-before-define': ['error', { variables: false, functions: false, classes: false }],
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/prefer-ts-expect-error': 'error',

      // Import
      'import/no-extraneous-dependencies': ['error', { devDependencies: true }],
      'import/no-duplicates': 'error',
      'import/no-named-as-default-member': 'error',
      'import/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
          pathGroups: [{ pattern: 'react', group: 'external', position: 'before' }],
          pathGroupsExcludedImportTypes: ['react'],
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],
      'import/no-cycle': ['error', { maxDepth: Infinity, ignoreExternal: true }],
      'unused-imports/no-unused-imports': 'error',

      // React
      'react/react-in-jsx-scope': 'off',
      'react/jsx-key': 'error',
      'react/jsx-filename-extension': ['error', { extensions: ['.tsx'] }],
      'react/jsx-no-useless-fragment': 'error',
      'react-refresh/only-export-components': 'warn',
      'react/prop-types': 'off',
      'react/jsx-curly-brace-presence': ['error', { props: 'never', children: 'ignore' }],
      'react/self-closing-comp': ['error'],
    },
  },
  {
    // Type-aware линтинг для всего, что покрывают tsconfig пакетов и корня: eslint.config.js и прочие js им не проверяются
    files: [
      '**/src/**/*.{ts,tsx}',
      '**/tests/**/*.ts',
      '**/e2e/**/*.ts',
      '**/vitest.config.ts',
      '**/playwright.config.ts',
      '**/assetpack.config.ts',
      'vitest.shared.ts',
      'playwright.shared.ts',
    ],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Промис без await и без обработки — ошибка; осознанный fire-and-forget помечается void
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
    },
  },
  {
    // Сборка ассетов идёт в Node: пакеты инструментов и конфиги сборки игр
    files: ['tools/**/*.ts', '**/assetpack.config.ts'],
    languageOptions: {
      globals: globals.node,
    },
  },
  ...packageBoundaries,
  ...gameLayers,
]
