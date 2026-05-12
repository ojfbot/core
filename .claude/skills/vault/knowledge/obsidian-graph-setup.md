# The graph UI — Obsidian graph, Excalibrain, mindmaps, Graphify

This vault is laid out (Karpathy LLM-Wiki: `raw/` + `wiki/{index,log,sources,entities,concepts,synthesis}`) so
Obsidian's graph view reads as the "orbiting clusters / galaxy" visuals people post. That look conflates two things:

1. **Graphify's own "galaxy" UI** — a separate app (external to Obsidian) that ingests a markdown corpus and renders
   a force-directed, clustered graph with a cinematic orbit aesthetic. Framed as "Graphify vs Obsidian graph view":
   Obsidian is the editor, Graphify the analytics/overview brain. <https://www.getgraphify.com/blog/graphify-vs-obsidian>
2. **Obsidian's own graph + graph-adjacent plugins** tuned to mimic that feel.

The "orbiting neighbourhood around one note" screenshots that are clearly Obsidian are usually **Excalibrain** or a
carefully configured local graph; the cinematic full-vault galaxies are usually **Graphify** on the same markdown.

## What makes the native Obsidian global graph cluster nicely

- **`wiki/index.md` is the hub** — it links every page, so it's the big central node with everything orbiting it.
  Every page has `Up: [[index]]`; the index links back down. Dense both ways → strong edges.
  <https://www.reddit.com/r/ObsidianMD/comments/yd0uaf/>
- **Colour groups by folder path** — `graph.json` `colorGroups` keyed on `path:wiki/entities`, `path:wiki/concepts`,
  `path:wiki/sources`, `path:wiki/synthesis`, `path:raw` (distinct hues) — the Karpathy layout is folder-driven, so
  this is the natural axis. Optional overlay group `tag:#status/active` to make live repo entities pop.
- **Node size by link count** (`nodeSizeMultiplier` ~1.8) so `index.md` and well-connected entities dominate.
- **Layout knobs** — `centerStrength` ~0.3, `repelStrength` ~9, `linkStrength` ~1, `linkDistance` ~160 — tight
  folder clusters that still orbit a centre. Tune in-app to taste.
- **Persistent Graph** plugin so the layout doesn't reshuffle every open.

Starting `graph.json` (`init-vault.py` writes ~this; Obsidian rewrites it as you tweak, so treat it as a seed):

```json
{
  "collapse-filter": true, "search": "", "showTags": true, "showAttachments": false,
  "hideUnresolved": true, "showOrphans": true, "collapse-color-groups": false,
  "colorGroups": [
    { "query": "path:wiki/entities",  "color": { "a": 1, "rgb": 5431378 } },
    { "query": "path:wiki/concepts",  "color": { "a": 1, "rgb": 14701138 } },
    { "query": "path:wiki/sources",   "color": { "a": 1, "rgb": 5419488 } },
    { "query": "path:wiki/synthesis", "color": { "a": 1, "rgb": 14064173 } },
    { "query": "path:raw",            "color": { "a": 1, "rgb": 7506394 } },
    { "query": "tag:#status/active",  "color": { "a": 1, "rgb": 11657298 } }
  ],
  "collapse-display": false, "showArrow": false, "textFadeMultiplier": 0,
  "nodeSizeMultiplier": 1.8, "lineSizeMultiplier": 1,
  "collapse-forces": false, "centerStrength": 0.3, "repelStrength": 9,
  "linkStrength": 1, "linkDistance": 160, "scale": 1
}
```

## Bundled community plugins (`community-plugins.json` + fetched into `.obsidian/plugins/` by `install-obsidian-plugins.sh`)

| id | what it gives | repo (resolved via the obsidianmd/obsidian-releases registry) |
|---|---|---|
| `excalibrain` | TheBrain-style local graph — parents/children/siblings around the focal note. The "orbiting neighbourhood" effect. | `zsviczian/excalibrain` |
| `obsidian-excalidraw-plugin` | Excalibrain's drawing surface (soft dependency) | `zsviczian/obsidian-excalidraw-plugin` |
| `obsidian-mind-map` | render a single markdown/outline note as a mind map (read-only) | `lynchjames/obsidian-mind-map` |
| `graph-analysis` | community/centrality computation — colour/cluster nodes more informatively | `SkepticMystic/graph-analysis` |
| `persistent-graph` | save & restore a stable global-graph layout | (resolved via the registry) |

`install-obsidian-plugins.sh` resolves each id → GitHub repo via
`https://raw.githubusercontent.com/obsidianmd/obsidian-releases/master/community-plugins.json`, then downloads that
repo's latest-release `manifest.json` / `main.js` / `styles.css` into `.obsidian/plugins/<id>/`. **It does not enable
anything** — it never touches `.obsidian/community-plugins.json` (which `init-vault.py` leaves empty). Enable the
plugins you want from Obsidian → Settings → Community plugins; that path version-checks each `manifest.json`'s
`minAppVersion` against the installed Obsidian. The script also reads the installed Obsidian version (from
`/Applications/Obsidian.app/Contents/Info.plist`) and prints a `⚠ needs Obsidian ≥ X` warning for any plugin that's
too new — **don't pre-list such a plugin as enabled**: Obsidian will load it on vault open without a version gate and
the renderer crashes (this is exactly what happened with Excalidraw 2.22.3 / `minAppVersion 1.5.7` on a 1.5.3 install).
Excalibrain depends on Excalidraw, so the two move together. If an id isn't in the registry or has no usable release,
the script warns and skips ("Enhancing Mindmap" isn't in the registry, so `obsidian-mind-map` is fetched instead).
`.obsidian/plugins/` is gitignored; re-run the script after a fresh clone. Obsidian Hub's mindmapping list, if you
want more: <https://publish.obsidian.md/hub/02+-+Community+Expansions/02.01+Plugins+by+Category/Mindmapping+plugins>

## Graphify / TheBrain (external, optional — not an integration)

Point Graphify (separate app) at the `~/selfco` folder for the cinematic whole-vault galaxy; same for TheBrain. The
corpus is plain markdown with consistent folders/tags and a dense `index.md`, so it clusters well there with no extra
work. The vault `README.md` documents this; there is no Graphify code in this repo.

## Workflow summary

Author + structure in Obsidian (lots of `[[links]]`, `index.md` as the hub, folder = category). Native global graph
tuned (path colour groups, node sizing, Persistent Graph) for the in-Obsidian galaxy. Excalibrain for the
orbit-around-the-current-note view; Obsidian Mind Map for a tree view of one note. Graphify/TheBrain on the same
folder for the cinematic overview.
