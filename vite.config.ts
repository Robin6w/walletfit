/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

const rootDir = import.meta.dirname

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(rootDir, './src'),
      '@data': path.resolve(rootDir, './data'),
    },
  },
  build: {
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('cards-catalog.json')) {
            return 'cards-catalog'
          }
          // 예전에는 "node_modules에 있으면 무조건 vendor 청크로" 규칙이 있었는데,
          // 이 규칙 때문에 react/react-dom(CommonJS로 배포됨)의 CJS→ESM 변환
          // 헬퍼 함수가 vendor 청크가 아니라 그 헬퍼를 필요로 하는 앱 코드 청크
          // (예: categoryStyle.ts처럼 lucide-react 아이콘을 불러오는 파일) 쪽에
          // 놓이면서, 두 청크가 서로를 참조하는 순환 구조가 만들어졌다.
          // 그 결과 프로덕션 빌드에서만 "__commonJSMin is not a function" /
          // "t is not a function" 런타임 에러가 나서 화면이 완전히 하얗게
          // 뜨는 문제가 있었다(로컬 개발 서버·타입체크로는 잡히지 않음).
          // cards-catalog.json 분리는 그대로 유지하고, 나머지는 Vite(rolldown)
          // 기본 자동 청크 분할에 맡겨서 이 순환 참조를 없앤다.
        },
      },
    },
  },
  test: {
    environment: 'happy-dom',
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/**',
        'dist/**',
        'tests/**',
        'data/**',
        '**/*.d.ts',
        'vite.config.ts',
      ],
    },
  },
})
