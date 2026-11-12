# Connected Two-Station Metro Scene

## Product intent

Create a premium, browser-native Three.js/WebGL metro experience inspired by an architectural cutaway model. Instead of presenting a conventional map, the opening experience is a living section of the Delhi Metro: two elevated stations connected by a short viaduct, with trains visibly travelling between them.

The scene must be visually honest about operations. Train movement is labelled **Live**, **Predicted**, or **Scheduled** according to the freshness and source of the backend data.

## Composition

```text
       Station A                               Station B
  ┌────────────────┐                      ┌────────────────┐
  │ arched canopy  │                      │ arched canopy  │
  │ platforms      │══════ viaduct ══════│ platforms      │
  │ moving train   │   twin rails + OHE   │ moving train   │
  │ concourse      │                      │ concourse      │
  │ gates/lifts    │                      │ gates/lifts    │
  └───────┬────────┘                      └───────┬────────┘
          │                                       │
       pier + plinth                           pier + plinth
```

The visual language is an isometric architectural model:

- A white or warm-grey presentation plinth beneath the complete scene.
- Exposed structural cross-sections: platform, concourse, entry level, escalators, lifts, piers and foundations.
- Curved translucent station canopies, tactile edges, rails, catenary and restrained Delhi Metro line colours.
- One animated train moving on a spline between the stations; additional trains appear only where live/predicted data warrants them.
- Small instanced commuters, signage, lighting and trees provide scale without excessive draw calls.

## Interaction model

- **Orbit:** one-finger / mouse drag rotates around the two-station model.
- **Zoom:** pinch / wheel zooms to the chosen station or moving train.
- **Station focus:** tap or click either canopy, platform or nameboard to open arrivals, exits and station detail.
- **Follow train:** smooth camera motion follows an active train between stations.
- **Scene controls:** day/night, live-data confidence, reduced-motion and data-saver modes.

The arrival board and accessibility controls remain HTML/CSS overlays, not texture-rendered text inside WebGL.

## Technical scene structure

```text
Three.js Scene
├─ WorldGroup
│  ├─ PresentationPlinth
│  ├─ StationA
│  │  ├─ ViaductStructure
│  │  ├─ PlatformsAndCanopy
│  │  └─ ConcourseCutaway
│  ├─ Corridor
│  │  ├─ TrackSplineSouthbound
│  │  ├─ TrackSplineNorthbound
│  │  ├─ Piers (instanced)
│  │  └─ OverheadEquipment (instanced)
│  └─ StationB
├─ FleetGroup
│  └─ Train instances positioned by route progress
├─ DetailGroup
│  ├─ Passengers (instanced)
│  ├─ Lights
│  └─ Environmental props
└─ Effects
   ├─ Directional + ambient lighting
   └─ Optional bloom / contact shadows
```

Use GLB/glTF assets with Draco mesh compression and KTX2/Basis textures. The repeated objects—piers, lights, trees, commuters and catenary poles—must use `InstancedMesh`. Train transforms should update from route progress; never recreate model geometry for live updates.

## Data contract

The frontend needs only compact, normalized vehicle updates:

```json
{
  "vehicleId": "yellow-203",
  "lineId": "yellow",
  "direction": "southbound",
  "routeProgress": 0.43,
  "nextStationId": "station_b",
  "state": "predicted",
  "observedAt": "2026-11-10T05:50:00Z",
  "expiresAt": "2026-11-10T05:51:00Z"
}
```

`state` must be one of `live`, `predicted`, or `scheduled`. If the update expires, the visual train fades and the HUD changes state rather than continuing a false live animation.

## Desktop and mobile quality tiers

| Tier | Render approach |
| --- | --- |
| Cinematic | Full canopies, detailed concourse, shadows, selective bloom, high detail trains and 60 FPS target. |
| Balanced | Instanced details, simplified shadows, capped device pixel ratio, 30–45 FPS target. |
| Data Saver | Stylized stations and viaduct, train animation, no post-processing, 30 FPS cap. |
| Fallback | Accessible arrival list and animated line diagram when WebGL is unavailable. |

The renderer should choose an initial tier from device capabilities, then lower quality dynamically if sustained frame time is too high. On mobile, cap pixel ratio at `1.5`, pause on hidden tabs, and load station detail only after the core corridor is visible.

## Delivery phases

1. **Hero corridor:** a static, polished two-station cutaway with orbit controls and responsive layout.
2. **Kinetics:** spline-driven train movement, station focus and day/night lighting.
3. **Operational UI:** arrival board, confidence labels and search.
4. **Live connection:** WebSocket train-state updates, stale-data handling and replay mode.
5. **Scale-out:** reusable station modules and additional corridor scenes, without loading all Delhi assets at once.

## Suggested first Delhi pairing

Start with an elevated Yellow Line pairing such as **Qutab Minar ↔ Chhattarpur**. It suits the visible viaduct concept and lets the first scene establish a strong visual identity before introducing underground/interchange cutaways.
