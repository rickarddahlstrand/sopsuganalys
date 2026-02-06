# Deploy till Cloudflare Pages

## Förutsättningar

- Ett Cloudflare-konto (gratis plan fungerar)
- Repot pushat till GitHub

## Alternativ 1: Koppla GitHub-repo (rekommenderat)

1. Logga in på [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Gå till **Workers & Pages** > **Create** > **Pages** > **Connect to Git**
3. Välj ditt GitHub-repo `sopsuganalys`
4. Konfigurera bygginställningar:

   | Inställning | Värde |
   |---|---|
   | Framework preset | None |
   | Build command | `cd webapp && npm install && npm run build` |
   | Build output directory | `webapp/dist` |
   | Root directory | `/` |
   | Node.js version | `18` (eller högre) |

5. Klicka **Save and Deploy**
6. Cloudflare bygger och publicerar sidan automatiskt vid varje push till `main`

### Miljövariabel (om Node-version behöver sättas explicit)

Lägg till under **Settings** > **Environment variables**:

| Variabel | Värde |
|---|---|
| `NODE_VERSION` | `20` |

## Alternativ 2: Direkt uppladdning

1. Bygg lokalt:
   ```bash
   cd webapp
   npm install
   npm run build
   ```
2. Gå till **Workers & Pages** > **Create** > **Pages** > **Upload assets**
3. Dra in hela `webapp/dist/`-mappen
4. Ge projektet ett namn och klicka **Deploy**

## Efter deploy

- Sidan nås via `https://<projektnamn>.pages.dev`
- Eget domännamn kan konfigureras under **Custom domains**
- All analys sker fortfarande i besökarens webbläsare — Cloudflare servar bara de statiska filerna
