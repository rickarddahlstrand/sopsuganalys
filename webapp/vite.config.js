import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'child_process'

const commitHash = execSync('git rev-parse --short HEAD').toString().trim()
const commitDate = execSync('git log -1 --format=%cI').toString().trim().split('T')[0]

export default defineConfig({
  plugins: [react()],
  define: {
    __COMMIT_HASH__: JSON.stringify(commitHash),
    __COMMIT_DATE__: JSON.stringify(commitDate),
  },
  build: {
    outDir: 'dist',
  },
  server: {
    allowedHosts: ['app1-sopsuganalys-dev-server.gapingvoid.net'],
  },
})
