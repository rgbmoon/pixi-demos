import babel from '@rolldown/plugin-babel'
import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import svgr from 'vite-plugin-svgr'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  // babel (React Compiler) обрабатывает только JSX-файлы: legacy-декораторы в .ts он не парсит, их трансформирует oxc
  plugins: [react(), babel({ presets: [reactCompilerPreset()], include: /\.[jt]sx(?:$|\?)/ }), tailwindcss(), svgr()],
  resolve: {
    alias: {
      src: path.resolve(__dirname, './src'),
    },
  },
})
