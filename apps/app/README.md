# @xplorio/app

The Xplorio app: Expo SDK 58, Expo Router and Tamagui v3. Web now, iOS later from the same code.

## Run it

From the repo root, `pnpm dev` starts this app on http://localhost:8081 and the API on http://localhost:7071/api, both with hot reload. The app talks to `EXPO_PUBLIC_API_URL` (default `http://localhost:7071/api`).

## Layout

```
src/app/              Routes (Expo Router): every file is a screen
  _layout.tsx         Tamagui provider, light/dark from the system
  index.tsx           My flights (home); flight detail and Add flight open as popups
src/components/       FlightCard, FlightDetail, AddFlightForm, Popup, Screen, Card, Pill, Stat
src/lib/              api client, formatting, status colours, polling hooks
src/tamagui.config.ts Tamagui config (default v6 config for now)
public/               Copied into the web build: staticwebapp.config.json (security headers, SPA fallback)
```

## Tamagui v3 notes

- Tokens and theme values have **no `$` prefix**: `gap="4"`, `bg="background"`, `color="color-10"`, `rounded="xl"`.
- Only **shorthands** are allowed for some props: `items`, `justify`, `self`, `bg`, `p`/`px`/`py`, `m`, `w`/`h`, `maxW`, `rounded`, `text`.
- Hover and press states use clauses: `borderColor="border-color hover:border-color-hover"` (no `hoverStyle`).
- Status colours come from sub-themes: wrap in `<Theme name="green|yellow|red|accent">` and use `color-1`…`color-11`.
- Runs in runtime mode (no compiler plugin). Add `@tamagui/metro-plugin` later if the bundle size matters.

## Expo notes

- Add packages with `npx expo install <pkg>` so versions match the SDK. If Expo's version service is unreachable, use `EXPO_OFFLINE=1 npx expo install <pkg>`.
- Shared packages (`@xplorio/core` etc.) use extensionless relative imports because Metro doesn't map `./x.js` to `./x.ts`.
- `AGENTS.md` here is Expo's own guidance for coding agents; keep it.
