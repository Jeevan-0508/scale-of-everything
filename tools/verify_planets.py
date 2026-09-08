"""Checks the Solar System rung: every body is on screen with its real map, the
rings use the measured radii, the panel shows the photograph with its credit and
carries the map-projection caveat, and nothing 404s."""
import asyncio, json, os, sys
from playwright.async_api import async_playwright

CHROME = os.environ.get("SOE_CHROME") or None
ARGS = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox"]
URL = "http://127.0.0.1:8080/"
fails = []


def ck(name, cond, extra=""):
    print(("PASS " if cond else "FAIL ") + name + ("  " + str(extra) if extra else ""))
    if not cond:
        fails.append(name)


async def main():
    async with async_playwright() as pw:
        b = await pw.chromium.launch(executable_path=CHROME, args=ARGS)
        pg = await b.new_page(viewport={"width": 1440, "height": 900})
        errs = []
        pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
        pg.on("pageerror", lambda e: errs.append(str(e)))
        bad = []
        pg.on("response", lambda r: bad.append((r.status, r.url)) if r.status >= 400 else None)
        await pg.goto(URL, wait_until="load")
        await pg.wait_for_function("window.SOE && window.SOE.planets", timeout=90000)

        bodies = await pg.evaluate("window.SOE.planets")
        meta = await pg.evaluate("window.SOE.planetMeta")
        ids = [x["id"] for x in bodies]
        ck("11 bodies loaded", len(bodies) == 11, ids)
        ck("eight planets", sum(1 for x in bodies if x["kind"] == "planet") == 8)
        ck("Moon and Pluto are present", "moon" in ids and "pluto" in ids)
        ck("every body has a map and a photograph",
           all(x["map"]["src"].startswith("assets/planets/")
               and x["shot"]["src"].startswith("assets/planets/") for x in bodies))
        ck("every image carries a licence and a source page",
           all(im["licence"] and im["page"]
               for x in bodies for im in (x["map"], x["shot"])))
        ck("giants are not called surface maps",
           all(x["map_role"] == "cloud-top map"
               for x in bodies if x["id"] in ("venus", "jupiter", "saturn", "uranus", "neptune")))
        ck("rotation periods carry retrograde signs",
           [x["id"] for x in bodies if x["rot_hours"] < 0] == ["venus", "uranus", "pluto"],
           [x["id"] for x in bodies if x["rot_hours"] < 0])

        scene = await pg.evaluate("""() => {
          const s = window.SOE.shellAt(1);
          const spheres = [];
          s.group.traverse(o => { if (o.isMesh && o.geometry.type === 'SphereGeometry')
            spheres.push({ id: o.userData.body && o.userData.body.id,
                           map: o.material.map && o.material.map.image
                                ? o.material.map.image.currentSrc || '' : null }); });
          const rings = [];
          s.group.traverse(o => { if (o.isMesh && o.geometry.type === 'RingGeometry') {
            const p = o.geometry.parameters;
            rings.push({ inner: p.innerRadius, outer: p.outerRadius,
                         uv: [o.geometry.attributes.uv.getX(0),
                              o.geometry.attributes.uv.getX(o.geometry.attributes.uv.count - 1)] });
          }});
          return { spheres, rings, clickable: (s.clickable || []).length };
        }""")
        ck("all 11 bodies are meshes in the shell", len(scene["spheres"]) == 11,
           len(scene["spheres"]))
        ck("all 11 bodies are clickable", scene["clickable"] == 11, scene["clickable"])
        ck("every body's map texture decoded",
           all(x["map"] and x["map"].endswith(".webp") for x in scene["spheres"]),
           [x for x in scene["spheres"] if not x["map"]])

        sat = next(x for x in bodies if x["id"] == "saturn")
        ck("one ring mesh", len(scene["rings"]) == 1)
        if scene["rings"]:
            r = scene["rings"][0]
            ratio = r["outer"] / r["inner"]
            want = sat["rings"]["outer_km"] / sat["rings"]["inner_km"]
            ck("ring radii keep the measured ratio", abs(ratio - want) < 0.01,
               "%.4f vs %.4f" % (ratio, want))
            ck("ring UVs run radially, not planar",
               abs(r["uv"][0] - 0.0) < 0.02 or abs(r["uv"][1] - 1.0) < 0.02, r["uv"])

        # The Earth rung wears the same surface plus two extra real layers, and
        # a shell built before its catalogue loaded used to come out plain.
        earth = next(x for x in bodies if x["id"] == "earth")
        ck("Earth carries cloud and night layers",
           set((earth.get("layers") or {})) == {"clouds", "night"},
           list(earth.get("layers") or {}))
        shell0 = await pg.evaluate("""() => {
          const s = window.SOE.shellAt(0); const out = [];
          const name = t => t && t.image ? (t.image.currentSrc || '').split('/').pop() : null;
          s.group.traverse(o => { if (o.isMesh)
            out.push({ map: name(o.material.map), alpha: name(o.material.alphaMap) }); });
          let grid = 0;
          s.group.traverse(o => { if (o.isLineSegments) grid = o.geometry.attributes.position.count; });
          return { meshes: out, grid };
        }""")
        maps = [m["map"] for m in shell0["meshes"] if m["map"]]
        alphas = [m["alpha"] for m in shell0["meshes"] if m["alpha"]]
        ck("Earth shell wears the real surface map",
           "map-earth.webp" in maps, maps)
        ck("Earth shell wears the cloud mask",
           "map-earth-clouds.webp" in alphas, alphas)
        ck("Earth graticule is parallels and meridians, not a mesh wireframe",
           shell0["grid"] == 4352, shell0["grid"])

        await pg.evaluate("window.SOE.goTo(0)")
        await pg.wait_for_timeout(600)
        # The rail button is what opens a level panel; runSearch('Earth') would
        # open the planet panel one rung out instead.
        await pg.evaluate("document.querySelector('.rung[data-index=\"0\"]').click()")
        await pg.wait_for_timeout(500)
        src0 = await pg.evaluate("document.getElementById('infoSource').textContent")
        ck("Earth level panel credits all three image layers",
           "Surface:" in src0 and "Clouds:" in src0 and "Night lights:" in src0, src0[-120:])

        await pg.evaluate("window.SOE.runSearch('Pluto')")
        await pg.wait_for_timeout(700)
        panel = await pg.evaluate("""() => {
          const p = document.getElementById('infoPanel');
          const shot = p.querySelector('.ds-shot');
          const cav = p.querySelector('.ds-caveat');
          return { hidden: p.classList.contains('hidden'),
                   title: document.getElementById('infoTitle').textContent,
                   kind: document.getElementById('infoKind').textContent,
                   img: shot ? shot.getAttribute('src') : null,
                   caveat: cav ? cav.textContent : '',
                   source: document.getElementById('infoSource').textContent,
                   facts: [...document.getElementById('infoFacts').children].map(li => li.textContent) };
        }""")
        ck("search finds Pluto", panel["title"] == "Pluto", panel["title"])
        ck("Pluto is labelled a dwarf planet", panel["kind"] == "Dwarf planet", panel["kind"])
        ck("panel shows the New Horizons photograph",
           panel["img"] == "assets/planets/shot-pluto.webp", panel["img"])
        ck("panel carries the map-projection caveat",
           "not single photographs" in panel["caveat"], panel["caveat"][:60])
        ck("panel says the display is compressed and the figures are not",
           "compressed" in panel["source"] and "uncompressed" in panel["source"])
        ck("panel credits both images",
           "Photograph:" in panel["source"] and "map:" in panel["source"])
        ck("facts include the retrograde rotation",
           any("retrograde" in f for f in panel["facts"]), panel["facts"])

        await pg.evaluate("window.SOE.runSearch('Saturn')")
        await pg.wait_for_timeout(700)
        facts = await pg.evaluate(
            "[...document.getElementById('infoFacts').children].map(li=>li.textContent)")
        ck("Saturn quotes the real ring extent",
           any("136,775 km" in f for f in facts), facts)

        ck("no 4xx or 5xx", not bad, bad[:4])
        ck("no console errors", not errs, errs[:3])
        await b.close()

    print(("%d failure(s)" % len(fails)) if fails else "all planet checks passed")
    sys.exit(1 if fails else 0)


asyncio.run(main())
