# Online Music Player System

A backend-focused music player prototype with:

- Login and signup
- Local audio uploads from the user's device
- External music links for YouTube, SoundCloud, and direct audio URLs
- Listening data capture
- Most-listened artist stats
- Total playing time
- Similar-user matching based on artist listening vectors

## Run

```bash
npm start
```

Open `http://localhost:3000`.

## API

- `POST /api/auth/signup`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/me`
- `GET /api/tracks`
- `POST /api/tracks`
- `POST /api/listens`
- `GET /api/stats`

Data is stored locally in `data/db.json`; uploaded songs are stored in `public/uploads`.

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
