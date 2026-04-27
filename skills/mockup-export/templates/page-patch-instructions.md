# page.tsx patch — mount the BriefsBootstrapper

The `BriefsBootstrapper` component fetches `/briefs.json` on mount, maps the AI-shape layers to Zustand-shape layers, calls `loadTemplate()` on the mockup store, and writes `data-briefs-generated-at` on `<body>` so the headless export script can verify hydration before clicking export.

## File to edit

`src/app/page.tsx`

## 1. Add the import

Near the existing imports for components like `GenerateFromRepo`:

```tsx
import BriefsBootstrapper from "@/components/mockup/BriefsBootstrapper";
```

## 2. Mount it inside the editor JSX

Place `<BriefsBootstrapper />` near the top of the returned JSX — it renders nothing, but `useEffect` only fires while it's mounted. Recommended location: just inside the outermost wrapper, before the header.

```tsx
return (
  <div className="flex flex-col min-w-0 h-screen overflow-hidden">
    <BriefsBootstrapper />
    {/* …rest of the editor… */}
  </div>
);
```

## Verification

Open `http://localhost:3000` after dropping a `briefs.json` into `public/`. The DOM should have:

```html
<body data-briefs-generated-at="2026-04-27T10:21:21Z">
```

and the canvas should show 6 mockups instead of the default 1. If `data-briefs-generated-at` is missing, the bootstrapper isn't mounted (or `briefs.json` isn't being served).
