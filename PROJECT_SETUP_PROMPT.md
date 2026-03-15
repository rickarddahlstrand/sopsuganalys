# Teknisk specifikation

## PROMPT:

Hjälp mig sätta upp ett nytt projekt med följande stack och struktur. Skapa alla filer och konfigurationer.

### Stack

- **Frontend**: React 19 + TypeScript + Vite 7 + Tailwind CSS 4
- **Backend**: PocketBase 0.36+ (SQLite, Go-baserad, JavaScript hooks)
- **Deployment**: Docker multi-stage build + Cloudflare Tunnel
- **CI/CD**: GitHub Actions (lint + build + test → Docker multi-arch build → GHCR push)
- **Testning**: Vitest + @testing-library/react + jsdom

### Bibliotek

  - React – Komponentbaserad UI                                                                                                                                                                                                 
  - Framer Motion – Animationer (motion.div, AnimatePresence)                                                                                                                                                                   
  - Tailwind CSS – Utility-first styling                                                                                                                                                                                        
  - Lucide React – Ikoner (X, Zap, Activity, Wind, etc.)               
  - Backend Pocketbase
  - Testmiljö: Bygger BESKRIV ENLIGT SNABBADMINUPPLÄGGET...
  - Produktionsmiljö: Cloudflare tunnels, 


### Tailwind-mönster                                                                                                                                                                                                              
                                                                                                                                                                                                                                
  - Färger: slate för neutral, semantiska färger per kategori (yellow, blue, cyan, orange, purple)                                                                                                                              
  - Dark mode: dark: prefix genomgående                                                                                                                                                                                         
  - Spacing: gap-3, p-6, mb-6 (konsekvent 3/6-skala)                                                                                                                                                                            
  - Interaktivitet: hover:, transition-colors                                                                                                                                                                                   

### Animationer                                                                                                                                                                                                                   
                                                                                                                                                                                                                                
  - Skapa modala popup-rutor där det anses lämpligt.
  - Drop-effekt vid stängning: Modal krymper (scale: 0.8), roterar (rotate: 15), faller nedåt (y: 400) med ease-in över 0.5s                                                                                                    
  - Konsekvent: Samma animationer på liknande komponenter (alla modaler)                                                                                                                                                        
                                                                           
### Visuella element                                                                                                                                                                                                              
                                                                                                                                                                                                                                
  - Rundade bakgrunder (rounded-lg) med subtil färg (bg-slate-50 dark:bg-slate-800/50) istället för border-separatorer                                                                                                          
  - Ikoner med färgkodade bakgrunder per kategori                                                                                                                                                                               
  - Stöd för dark mode genomgående men gärna en liten knapp för att manuellt ändra detta längst ner på sidan.    


### Mappstruktur

```
projektnamn/
├── frontend/                    # React TypeScript-app (Vite)
│   ├── src/
│   │   ├── components/          # React-komponenter
│   │   │   └── __tests__/       # Komponenttester
│   │   ├── hooks/               # Custom hooks
│   │   │   └── __tests__/       # Hook-tester
│   │   ├── lib/                 # Utilities, API-klienter
│   │   │   └── __tests__/       # Lib-tester
│   │   ├── test/
│   │   │   └── setup.ts         # Vitest setup (importerar @testing-library/jest-dom/vitest)
│   │   ├── index.css            # Tailwind + globala stilar
│   │   ├── main.tsx             # React entry point (StrictMode)
│   │   └── App.tsx              # Huvudlayout
│   ├── index.html               # SPA entry med dark mode-stöd på body
│   ├── package.json
│   ├── vite.config.ts           # Plugins, proxy, test-config, build-arg defines
│   ├── tsconfig.json            # References tsconfig.app.json + tsconfig.node.json
│   ├── tsconfig.app.json        # ES2022, bundler resolution, strict, exkluderar tester
│   ├── tsconfig.node.json       # ES2023, för Vite/Vitest config
│   └── eslint.config.js         # ESLint 9 flat config
├── pb_runtime/                  # PocketBase runtime-filer
│   ├── pb_data/                 # SQLite-databas (gitignored)
│   ├── pb_hooks/                # Server-side hooks (*.pb.js)
│   └── pb_migrations/           # Databasmigrationer
├── pb_runtime_beta/             # Beta-miljöns data
│   └── pb_data/                 # Separat databas (gitignored)
├── pb/                          # Lokal PocketBase-binär (gitignored)
├── scripts/                     # Import- och verktygsskript
├── .github/workflows/
│   ├── ci.yml                   # Lint + build + test
│   └── docker.yml               # Multi-arch Docker build → GHCR
├── Dockerfile                   # Multi-stage: Node → build, Alpine → PocketBase
├── docker-compose.yml           # Produktion
├── docker-compose.beta.yml      # Beta
├── .env                         # TUNNEL_TOKEN, TUNNEL_TOKEN_BETA (gitignored)
├── .gitignore
└── CLAUDE.md                    # Projektdokumentation för Claude Code
```

### Konfigurationsdetaljer

#### vite.config.ts
```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { execSync } from 'child_process'

// Git hash och build time — skickas som Docker build-args eller läses lokalt
let gitHash = process.env.VITE_GIT_HASH || 'unknown'
if (gitHash === 'unknown') {
  try { gitHash = execSync('git rev-parse --short HEAD').toString().trim() } catch { /* */ }
}
const buildTime = process.env.VITE_BUILD_TIME || new Date().toISOString()

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    __GIT_HASH__: JSON.stringify(gitHash),
    __BUILD_TIME__: JSON.stringify(buildTime),
  },
  server: {
    proxy: {
      '/api': { target: 'http://127.0.0.1:8090', changeOrigin: true },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
})
```

#### package.json scripts
```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "lint": "eslint .",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

#### Frontend dependencies
```
# Dependencies
react, react-dom (v19), pocketbase, lucide-react, date-fns

# DevDependencies
vite (v7), vitest (v4), @vitejs/plugin-react
tailwindcss (v4), @tailwindcss/vite (v4)
typescript (~5.9)
@testing-library/react, @testing-library/jest-dom, @testing-library/user-event
jsdom
eslint, @eslint/js, typescript-eslint, eslint-plugin-react-hooks, eslint-plugin-react-refresh
@types/react, @types/react-dom
```

#### index.css (Tailwind CSS 4)
```css
@import "tailwindcss";
@custom-variant dark (&:where(.dark, .dark *));
```

#### test/setup.ts
```typescript
import '@testing-library/jest-dom/vitest'
```

#### lib/pocketbase.ts (dynamisk URL)
```typescript
import PocketBase from 'pocketbase'
const pb = new PocketBase()
pb.baseURL = import.meta.env.VITE_PB_URL || window.location.origin
export default pb
```
Mönster: Ingen hårdkodad URL. Fungerar automatiskt lokalt (Vite proxy), i Docker och med Cloudflare Tunnel.

#### TypeScript — tsconfig.app.json
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  },
  "include": ["src"],
  "exclude": ["src/**/__tests__/**", "src/**/*.test.*", "src/test/**"]
}
```

#### ESLint (flat config, eslint.config.js)
```javascript
import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

export default [
  { ignores: ['dist'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    languageOptions: { ecmaVersion: 2020 },
  },
]
```

### Dockerfile (multi-stage)
```dockerfile
# Stage 1: Frontend build
FROM node:22-alpine AS frontend
ARG GIT_HASH=unknown
ARG BUILD_TIME=unknown
WORKDIR /app
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
ENV VITE_GIT_HASH=$GIT_HASH VITE_BUILD_TIME=$BUILD_TIME
RUN npx vite build

# Stage 2: PocketBase runtime
FROM alpine:3.21
ARG PB_VERSION=0.36.2
ARG TARGETARCH
RUN apk add --no-cache ca-certificates curl unzip && \
    curl -fsSL "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_${TARGETARCH}.zip" -o /tmp/pb.zip && \
    unzip /tmp/pb.zip -d /app && rm /tmp/pb.zip && chmod +x /app/pocketbase

COPY --from=frontend /app/dist /app/pb_public
COPY pb_runtime/pb_hooks/ /app/pb_hooks/
COPY pb_runtime/pb_migrations/ /app/pb_migrations/

EXPOSE 8090
CMD ["/app/pocketbase", "serve", "--http=0.0.0.0:8090", "--dir=/pb_data", "--hooksDir=/app/pb_hooks", "--migrationsDir=/app/pb_migrations"]
```

### docker-compose.yml (produktion)
```yaml
name: projektnamn
services:
  app:
    image: ghcr.io/OWNER/REPO:latest
    restart: unless-stopped
    volumes:
      - pocketbase_data:/pb_data
    networks:
      - net
    depends_on:
      - tunnel
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8090/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  tunnel:
    image: cloudflare/cloudflared
    restart: unless-stopped
    command: tunnel run
    environment:
      - TUNNEL_TOKEN=${TUNNEL_TOKEN}
    networks:
      - net

volumes:
  pocketbase_data:

networks:
  net:
    driver: bridge
```

### docker-compose.beta.yml
Samma struktur men med:
- Bind mount istället för named volume för att köra lokalt: `./pb_runtime_beta/pb_data:/pb_data`
- Separat tunnel-token: `TUNNEL_TOKEN_BETA`

### GitHub Actions

#### ci.yml — körs på push/PR till main
```yaml
name: CI
on:
  push: { branches: [main] }
  pull_request: { branches: [main] }
jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm, cache-dependency-path: frontend/package-lock.json }
      - run: cd frontend && npm ci
      - run: cd frontend && npm run lint
      - run: cd frontend && npm run build
      - run: cd frontend && npm run test
```

#### docker.yml — körs på push till main, bygger multi-arch och pushar till GHCR
```yaml
name: Docker
on:
  push: { branches: [main] }
jobs:
  docker:
    runs-on: ubuntu-latest
    permissions: { contents: read, packages: write }
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-qemu-action@v3
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with: { registry: ghcr.io, username: ${{ github.actor }}, password: ${{ secrets.GITHUB_TOKEN }} }
      - uses: docker/build-push-action@v6
        with:
          push: true
          platforms: linux/amd64,linux/arm64
          tags: |
            ghcr.io/OWNER/REPO:latest
            ghcr.io/OWNER/REPO:v${{ github.run_number }}-${{ github.sha }}
          build-args: |
            GIT_HASH=${{ github.sha }}
            BUILD_TIME=${{ github.event.head_commit.timestamp }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

### PocketBase hooks-mönster

PB 0.36 kör hooks i isolerat scope. Delade funktioner måste laddas via `require()`:

```javascript
// pb_hooks/utils.js (utan .pb — laddas INTE automatiskt)
function myHelper() { return 'hello' }
module.exports = { myHelper }

// pb_hooks/main.pb.js (med .pb — laddas automatiskt)
routerAdd('GET', '/api/test', (e) => {
  const { myHelper } = require(`${__hooks}/utils.js`)
  return e.json(200, { msg: myHelper() })
})
```

Begränsningar:
- Ingen Node.js (Goja JS-motor) — ingen Buffer, fetch osv
- `*.pb.js` = auto-laddade hooks, `*.js` = moduler via require()
- Hot reload när `.pb.js`-filer ändras

### Lokala utvecklingskommandon
```bash
# Backend (ladda ner PocketBase-binären till pb/)
cd pb && ./pocketbase serve --dir=../pb_runtime/pb_data --hooksDir=../pb_runtime/pb_hooks --migrationsDir=../pb_runtime/pb_migrations

# Frontend
cd frontend && npm run dev

# Docker-build med versionsinfo
docker buildx build --platform linux/amd64,linux/arm64 \
  --build-arg GIT_HASH=$(git rev-parse --short HEAD) \
  --build-arg BUILD_TIME=$(date -u +%Y-%m-%dT%H:%M:%SZ) \
  -t ghcr.io/OWNER/REPO:latest --push .
```

### Stilkonventioner
- Tailwind CSS 4 med `@import "tailwindcss"` (Vite plugin, INTE PostCSS)
- Dark mode via klass `dark` på `<html>`, sparas i localStorage
- Kompakt UI: `text-xs`, `py-0.5`, `px-1.5`
- Ikoner: Lucide React
- Layout: `h-screen flex flex-col overflow-hidden` med sticky headers

### Testkonventioner
- Testfiler i `__tests__/`-mappar bredvid källkoden
- `makeJob()` / `makeItem()` factory-funktioner i testfiler
- `defaultProps`-mönster för komponenttester
- Alla nya funktioner MÅSTE ha tester
- CI kör lint + build + test automatiskt

### .gitignore (viktiga rader)
```
pb_runtime/pb_data/
pb_runtime_beta/pb_data/
pb/
.env
node_modules/
dist/
```

### Env-variabler
- `.env`: `TUNNEL_TOKEN`, `TUNNEL_TOKEN_BETA` (Cloudflare)
- Inga env-variabler i frontend runtime — allt dynamiskt via `window.location.origin`
- Docker build-args: `GIT_HASH`, `BUILD_TIME` (MÅSTE skickas, annars "unknown" i footer)
- API-credentials lagras i PocketBase-databasen, inte i env

### Viktigt
- Cloudflare SSL/TLS måste vara **Full** (inte Flexible) — annars redirect-loop
- PocketBase URL i frontend: dynamisk via `window.location.origin`
- Docker volumes: bara `pb_data` mountas, hooks/migrations bakas in i imagen
- Relativa symlinks fungerar INTE i Docker bind volumes

Skapa alla filer, installera dependencies och verifiera att `npm run lint`, `npm run build` och `npm run test` fungerar.
