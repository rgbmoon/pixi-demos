import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import react from 'eslint-plugin-react'
import importPlugin from 'eslint-plugin-import-x'
import unusedImports from 'eslint-plugin-unused-imports'
import prettierConfig from 'eslint-config-prettier'
import tseslint from 'typescript-eslint'

// Каждая папка верхнего уровня — будущий npm-пакет, поэтому направление импортов между ними
// проверяется линтером. `allowTypeImports` оставляет развязку через `import type`, на ней стоит DI.
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

// Подписки в дереве сцены ставятся через watch/listen базы LiveContainer: она снимает их сама
const NO_RAW_SUBSCRIBE = [
  {
    name: 'mobx',
    importNames: ['reaction', 'autorun', 'when'],
    message: 'В дереве сцены подписки — через watch/listen базы LiveContainer.',
  },
]

const NOT_A_GAME = forbid(['src/components', 'src/pages', 'src/app'], 'Игра не знает ни React-кита, ни страниц, ни композиции.')

const packageBoundaries = [
  boundary(['src/core/**/*.ts'], {
    patterns: [
      forbid(
        ['src/net', 'src/components', 'src/engine', 'src/games', 'src/pages', 'src/app'],
        'core — лист графа: остальных пакетов он не знает.'
      ),
      NO_PIXI,
      NO_REACT,
    ],
  }),
  boundary(['src/net/**/*.ts'], {
    patterns: [
      forbid(['src/components', 'src/engine', 'src/games', 'src/pages', 'src/app'], 'net знает только core.'),
      NO_PIXI,
      NO_REACT,
    ],
  }),
  boundary(['src/components/**/*.{ts,tsx}'], {
    patterns: [
      forbid(['src/engine', 'src/games', 'src/pages', 'src/app'], 'components знает только core и net.'),
      NO_PIXI_RUNTIME,
    ],
  }),
  boundary(['src/engine/**/*.ts'], {
    patterns: [
      forbid(['src/components', 'src/games', 'src/pages', 'src/app'], 'engine — общий PIXI-рантайм: игр и React-кита он не знает.'),
      NO_REACT,
    ],
    paths: NO_RAW_SUBSCRIBE,
  }),
  // LiveContainer — единственное место, где подписка ставится напрямую: она и есть их владелец
  boundary(['src/engine/live-container.ts'], {
    patterns: [
      forbid(['src/components', 'src/games', 'src/pages', 'src/app'], 'engine — общий PIXI-рантайм: игр и React-кита он не знает.'),
      NO_REACT,
    ],
  }),
  boundary(['src/app/**/*.{ts,tsx}'], {
    patterns: [
      forbid(['src/games'], 'Композиционный корень не знает игру статически — её знает только её страница.'),
      {
        // Токены — лист графа из одних Symbol; всё остальное в engine тянет PIXI в стартовый чанк
        group: ['src/engine/**', '!src/engine/tokens'],
        message: 'app не тянет PIXI-рантайм: из engine ему доступны только токены.',
      },
    ],
  }),
  // Агрегатор моков по определению перечисляет все игры; в прод-бандл он не попадает (флаг USE_MOCKS)
  boundary(['src/app/mocks/**/*.ts'], {
    patterns: [
      {
        group: ['src/engine/**', '!src/engine/tokens'],
        message: 'app не тянет PIXI-рантайм: из engine ему доступны только токены.',
      },
    ],
  }),
  // Лендинг и 404 — общий бандл: игра и PIXI приезжают только с ленивым чанком страницы игры
  boundary(['src/pages/main/**/*.{ts,tsx}', 'src/pages/not-found/**/*.{ts,tsx}'], {
    patterns: [
      forbid(['src/engine', 'src/games'], 'Страницы вне игры не тянут ни игру, ни PIXI — иначе они уедут в стартовый чанк.'),
      NO_PIXI_RUNTIME,
    ],
  }),
]

// Уровни внутри игры: вниз импортировать можно, вверх — только `import type`.
// Каждый блок повторяет пакетный набор, иначе он его затрёт.
const GAME_BASE = [NOT_A_GAME, NO_REACT]

const gameLayers = [
  boundary(['src/games/**/*.ts'], { patterns: GAME_BASE, paths: NO_RAW_SUBSCRIBE }),
  boundary(['src/games/*/ui/**/*.ts'], {
    patterns: [
      ...GAME_BASE,
      forbid(
        ['src/games/*/stores', 'src/games/*/api', 'src/games/*/phases', 'src/games/*/controllers', 'src/games/*/scenes'],
        'ui — то, что рисуется: сторов, сети, контроллеров и сцены он не знает.'
      ),
      { group: under('src/games/*/events'), message: 'ui не подписывается на события — это работа контроллера.' },
    ],
    paths: NO_RAW_SUBSCRIBE,
  }),
  boundary(['src/games/*/api/**/*.ts'], {
    patterns: [
      ...GAME_BASE,
      forbid(
        ['src/games/*/stores', 'src/games/*/phases', 'src/games/*/controllers', 'src/games/*/ui', 'src/games/*/scenes'],
        'api знает только листовые типы и константы игры.'
      ),
    ],
    paths: NO_RAW_SUBSCRIBE,
  }),
  boundary(['src/games/*/stores/**/*.ts'], {
    patterns: [
      ...GAME_BASE,
      forbid(
        ['src/games/*/phases', 'src/games/*/controllers', 'src/games/*/ui', 'src/games/*/scenes'],
        'Стор не знает ни автомата, ни сцены.'
      ),
    ],
    paths: NO_RAW_SUBSCRIBE,
  }),
  boundary(['src/games/*/controllers/**/*.ts'], {
    patterns: [
      ...GAME_BASE,
      // DTO живут рядом со своими схемами, поэтому тип ответа контроллеру доступен — вызов нет
      forbid(['src/games/*/api'], 'Контроллер читает данные из стора, в сеть он не ходит.', true),
      forbid(['src/games/*/phases', 'src/games/*/scenes'], 'Контроллер не знает ни автомата, ни сцены: они дёргают его методы сами.'),
    ],
    paths: NO_RAW_SUBSCRIBE,
  }),
  boundary(['src/games/*/phases/**/*.ts'], {
    patterns: [
      ...GAME_BASE,
      forbid(
        ['src/games/*/controllers', 'src/games/*/scenes', 'src/games/*/ui'],
        'Фаза получает контроллеры через DI: сцену и виды — только import type.',
        true
      ),
    ],
    paths: NO_RAW_SUBSCRIBE,
  }),
  boundary(['src/games/*/scenes/**/*.ts'], {
    patterns: [
      ...GAME_BASE,
      forbid(['src/games/*/api', 'src/games/*/phases'], 'Сцена — раскладка контроллеров: ни сети, ни автомата она не знает.'),
    ],
    paths: NO_RAW_SUBSCRIBE,
  }),
]

export default [
  {
    ignores: ['**/node_modules/**', '**/dist/**', '**/.husky/**', 'public/**', 'vite.config.ts'],
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
    // Type-aware линтинг включаем только для src: eslint.config.js и прочие js вне tsconfig.app.json им не проверяются
    files: ['src/**/*.{ts,tsx}'],
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
  ...packageBoundaries,
  ...gameLayers,
]
