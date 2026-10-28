# @xplorio/app

The Expo (React Native + react-native-web) app: web build now, iOS later, one codebase.

This folder is a placeholder until build step 5 ("Add and view a flight"), when the Expo Router
app is generated here with Tamagui, wired to `@xplorio/api-client`, and deployed to
`https://xp.example.com` through Azure Static Web Apps.

Planned layout:

```
app/
  (auth)/sign-in.tsx
  flights/index.tsx
  flights/[id].tsx
  history.tsx
  settings.tsx
components/
  FlightCard.tsx
  StatusTimeline.tsx
  FlightMap.web.tsx   # MapLibre
  FlightMap.ios.tsx   # MapKit (later)
app.config.ts
```
