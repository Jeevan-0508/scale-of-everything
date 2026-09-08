"""Checks the two speculative shells: the multiverse is a foam of soap films in
contact rather than scattered wireframes, ours is the one distinct bubble, the
crossfade reaches zero, and the omniverse stays an empty dashed box."""
import asyncio, os
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
        await pg.goto(URL, wait_until="load")
        await pg.wait_for_function("window.SOE && window.SOE.shells", timeout=90000)
        await pg.evaluate("window.SOE.goTo(8)")
        await pg.wait_for_timeout(1200)

        m = await pg.evaluate("""() => {
          const s = window.SOE.shells[8];
          const films = s.bubbles.map(x => x.mesh);
          const kinds = films.map(x => x.userData.kind);
          // A bubble counts as in contact when a neighbour's surface is within
          // the sum of the radii but not half inside it.
          let touching = 0;
          for (let i = 0; i < films.length; i++) {
            const ri = films[i].geometry.parameters.radius;
            let hit = false;
            for (let j = 0; j < films.length; j++) {
              if (i === j) continue;
              const rj = films[j].geometry.parameters.radius;
              const d = films[i].position.distanceTo(films[j].position);
              if (d < ri + rj && d >= (ri + rj) * 0.5) hit = true;
            }
            if (hit) touching++;
          }
          return {
            n: films.length,
            shaders: films.filter(x => x.material.type === 'ShaderMaterial').length,
            wireframe: films.filter(x => x.material.wireframe).length,
            ours: kinds.filter(k => k === 'our-universe').length,
            touching,
            tints: films.map(x => x.material.uniforms.uTint.value.getHexString()),
          };
        }""")
        ck("multiverse is a foam of soap films, not wireframes",
           m["shaders"] == m["n"] and m["wireframe"] == 0, m)
        ck("exactly one bubble is ours", m["ours"] == 1)
        ck("ours is the cyan one, the rest hypothesis violet",
           m["tints"][0] == "7ef0ff" and set(m["tints"][1:]) == {"a78bfa"})
        ck("most bubbles touch a neighbour, as a foam does",
           m["touching"] >= m["n"] * 0.8, str(m["touching"]) + "/" + str(m["n"]))

        # The films carry their own opacity uniform; if the crossfade did not
        # reach it the shell would never leave the screen.
        await pg.evaluate("window.SOE.shells[8].setOpacity(0)")
        faded = await pg.evaluate(
            "window.SOE.shells[8].bubbles.every(b => b.mesh.material.uniforms.uFade.value === 0)")
        ck("the level crossfade drives the film uniform", faded)

        await pg.evaluate("window.SOE.goTo(9)")
        await pg.wait_for_timeout(1200)
        omni = await pg.evaluate("""() => {
          const s = window.SOE.shells[9]; let meshes = 0, lines = 0;
          s.group.traverse(o => { if (o.isMesh) meshes++; else if (o.isLine || o.isLineSegments) lines++; });
          return {meshes, lines};
        }""")
        ck("omniverse stays an empty frame, nothing solid inside",
           omni["meshes"] == 0 and omni["lines"] >= 6, omni)
        ck("no console errors", not errs, errs)
        await b.close()
    print("FAILURES:", len(fails), fails)
    raise SystemExit(1 if fails else 0)


asyncio.run(main())
