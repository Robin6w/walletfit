/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite'
import { configDefaults } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'

const rootDir = import.meta.dirname

/**
 * 큰 Pyodide wheel(scipy 약 47MB)을 조각으로 받아 둔 경우 개발 서버·빌드를 시작할 때 합친다.
 *  - 조각: _scipy_parts/<wheel 파일 이름>.part0, .part1, … (.gitignore 대상)
 *  - 결과: public/pyodide-dist/<wheel 파일 이름>. 이미 있으면 아무것도 하지 않는다
 *  - 합친 파일의 sha256이 pyodide-lock.json 값과 다르면 만들지 않는다(브라우저 무결성 검사와 같은 기준)
 */
function joinWheelParts(): Plugin {
  const partsDir = path.join(rootDir, '_scipy_parts')
  const distDir = path.join(rootDir, 'public', 'pyodide-dist')
  return {
    name: 'walletfit-join-wheel-parts',
    // config 단계에서 합친다. 개발 서버는 시작할 때 public 폴더 파일 목록을 한 번 읽어 두기 때문에
    // buildStart에서 만들면 그 목록에 없어서 index.html이 대신 나간다
    config() {
      if (!existsSync(partsDir) || !existsSync(path.join(distDir, 'pyodide-lock.json'))) return
      const lock = JSON.parse(readFileSync(path.join(distDir, 'pyodide-lock.json'), 'utf-8')) as {
        packages: Record<string, { file_name: string; sha256: string }>
      }
      const parts = readdirSync(partsDir).filter((f) => /\.part\d+$/.test(f))
      const wheels = new Set(parts.map((f) => f.replace(/\.part\d+$/, '')))
      for (const wheel of wheels) {
        const target = path.join(distDir, wheel)
        if (existsSync(target)) continue
        const expected = Object.values(lock.packages).find((p) => p.file_name === wheel)?.sha256
        const ordered = parts
          .filter((f) => f.startsWith(`${wheel}.part`))
          .sort((a, b) => Number(a.slice(a.lastIndexOf('.part') + 5)) - Number(b.slice(b.lastIndexOf('.part') + 5)))
        const data = Buffer.concat(ordered.map((f) => readFileSync(path.join(partsDir, f))))
        const actual = createHash('sha256').update(data).digest('hex')
        if (!expected || actual !== expected) {
          console.warn(`[walletfit] ${wheel} 조각을 합쳤지만 pyodide-lock.json의 해시와 달라서 만들지 않았어요.`)
          continue
        }
        writeFileSync(target, data)
        console.log(`[walletfit] ${wheel}: 조각 ${ordered.length}개를 public/pyodide-dist에 합쳤어요.`)
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [joinWheelParts(), react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(rootDir, './src'),
      '@data': path.resolve(rootDir, './data'),
    },
  },
  build: {
    chunkSizeWarningLimit: 800,
    // 글꼴(woff·woff2)은 CSS 안에 base64로 넣지 않는다. 한글 글꼴은 글자 범위별로 수백 개로 나뉘어 있어
    // 작은 조각 16개(약 92KB)가 CSS에 들어가 첫 화면 CSS가 커졌다. 파일로 두면 필요한 조각만 받는다(2026-10-29)
    assetsInlineLimit: (filePath: string) => (/\.(woff2?|ttf|otf)$/.test(filePath) ? false : undefined),
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
    // PC 작업 폴더의 백업본(_backup_*/tests)은 테스트로 돌리지 않는다(2026-10-29)
    exclude: [...configDefaults.exclude, '_backup_*/**'],
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
