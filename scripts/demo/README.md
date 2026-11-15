# Offline demo cache

Kisht pulls climate (NASA POWER), soil (SoilGrids) and groundwater (GRACE-FO)
live. On flaky venue Wi-Fi that's a risk during judging, so for the **three
example fields** (Vakhsh, Punjab, Nakuru) we ship pre-fetched copies in
`public/data/demo/`.

When a live API call for an example point fails or doesn't answer within 8
seconds, the app falls back to these files and shows a small **"cached NASA
data"** badge. Everything except the map tiles then works with no network.

> These are **real** API responses, saved to disk — nothing here is
> hand-written or fabricated.

## Build the files

Run once, from the repo root, with internet:

```bash
# (optional but recommended) build GRACE first so groundwater is cached too:
#   see scripts/grace/README.md  -> produces public/data/grace_trend.json

npx tsx scripts/demo/build-demo-cache.ts
```

You'll see, per field:

```
vakhsh (37.7, 68.8) … ok  [power ✓, soil ✓, grace -1.x cm/yr (falling)]
punjab (30.9, 75.85) … ok  [power ✓, soil ✓, grace -3.x cm/yr (falling)]
nakuru (-0.3, 36.07) … ok  [power ✓, soil ✓, grace +0.x cm/yr (stable)]

Wrote 3 files to public/data/demo/
```

## Verify offline

1. `npm run build && npm run preview` (or `npm run dev`).
2. Open the app, pick the **Punjab** example.
3. Turn off Wi-Fi.
4. Walk Field → Climate → Priorities → Rotation → Why. Every screen should work
   and show the "cached NASA data" badge. Only the map tiles will be blank —
   that's expected (they come from a tile server, not from us).

The small `public/data/demo/*.json` files are committed to the repo; they're a
few hundred KB total.
