# Online Music Player System

A backend-focused music player prototype with:

- Login and signup
- Local audio uploads from the user's device
- External music links for YouTube, SoundCloud, Spotify, and direct audio URLs
- Spotify track imports and full Spotify playlist imports
- Listening data capture
- Most-listened artist stats
- Total playing time
- Similar-user matching based on artist listening vectors

## Project layout

- `frontend/`
  - `public/` - web UI static assets
  - `MuzicSwiftUI/` - native macOS SwiftUI app and packaging scripts
- `backend/`
  - `server.js`
  - `package.json`
  - `lib/`
  - `data/db.json`
  - `test/`

## Run

From the repository root:

```bash
cd backend
npm install
npm start
```

Open `http://localhost:3000`.

## Native SwiftUI interface

The remodeled native macOS UI lives in `frontend/MuzicSwiftUI` and uses the existing Node backend at `http://localhost:3000`.

Run the backend first:

```bash
cd backend
npm start
```

Then launch the SwiftUI app:

```bash
cd ../frontend/MuzicSwiftUI
swift run
```

Or use the helper launcher, which starts the backend if needed:

```bash
./frontend/MuzicSwiftUI/run-muzic.sh
```

To make a clickable Mac app bundle:

```bash
./frontend/MuzicSwiftUI/package-app.sh
open ./frontend/MuzicSwiftUI/Muzic.app
```

## API

- `POST /api/auth/signup`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/me`
- `GET /api/tracks`
- `POST /api/tracks`
- `POST /api/spotify/import`
- `POST /api/listens`
- `GET /api/stats`

Data is stored locally in `backend/data/db.json`; uploaded songs are stored in `frontend/public/uploads`.

## Spotify imports

Single Spotify track links can be saved with manually entered title/artist. Full playlist imports need Spotify API credentials:

```bash
SPOTIFY_CLIENT_ID=your_client_id SPOTIFY_CLIENT_SECRET=your_client_secret npm start
```

Create those credentials from a Spotify Developer app, then paste a Spotify track or playlist URL in Add music -> External link -> Spotify track or playlist. Spotify content plays through Spotify's embedded player; Muzic tracks listening time when you use Track listening.

## React / shadcn version

This project is currently a plain Node + HTML/CSS/JS app, not a React, shadcn, Tailwind CSS, or TypeScript project. That is why there is no default `/components/ui` path here. In a shadcn project, `/components/ui` is important because shadcn components and imports such as `@/components/ui/music-player` expect reusable UI components to live there.

To use the exact TSX music player component from the prompt, create a shadcn-compatible app:

```bash
npx create-next-app@latest music-player-ui --typescript --tailwind --eslint --app
cd music-player-ui
npx shadcn@latest init
npm install lucide-react framer-motion
mkdir -p components/ui
```

Then put the TSX component in:

```text
components/ui/music-player.tsx
```

The default global styles file in that setup is usually `app/globals.css`, or `src/app/globals.css` if you choose a `src` directory.
