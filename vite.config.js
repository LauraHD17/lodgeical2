import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'url'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load .env files so VITE_MSW is available at config time
  const env = loadEnv(mode, process.cwd(), '')
  const isMock = env.VITE_MSW === 'true'

  return {
    plugins: [react()],
    resolve: {
      alias: {
        // When mock mode is on, swap the real Supabase client for the in-memory
        // mock. All supabase imports now use the @/ alias, so this string prefix
        // match intercepts every one of them before the general `@` entry below.
        ...(isMock && {
          '@/lib/supabaseClient': fileURLToPath(
            new URL('./src/mocks/supabaseMock.js', import.meta.url),
          ),
        }),
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./tests/setup.js'],
      css: true,
      // Exclude Playwright E2E tests — those are run via `npm run test:e2e`
      exclude: ['**/node_modules/**', '**/tests/e2e/**'],
    },
  }
})
