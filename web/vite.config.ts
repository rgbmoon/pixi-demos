import babel from '@rolldown/plugin-babel'
import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import svgr from 'vite-plugin-svgr'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  // babel (React Compiler) обрабатывает только JSX-файлы: legacy-декораторы в .ts он не парсит, их трансформирует oxc
  plugins: [react(), babel({ presets: [reactCompilerPreset()], include: /\.[jt]sx(?:$|\?)/ }), tailwindcss(), svgr()],
  // .env общий для приложения и тестов пакетов, поэтому лежит в корне репозитория
  envDir: path.resolve(import.meta.dirname, '..'),
  resolve: {
    alias: {
      src: path.resolve(import.meta.dirname, './src'),
    },
  },
})
