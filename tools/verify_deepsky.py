import asyncio, json, os, sys
from playwright.async_api import async_playwright
# Playwright's own bundled Chromium by default; set SOE_CHROME to override.
CHROME=os.environ.get("SOE_CHROME") or None
ARGS=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader","--no-sandbox"]
URL="http://127.0.0.1:8080/"
fails=[]
def ck(name, cond, extra=""):
    print(("PASS " if cond else "FAIL ")+name+("  "+str(extra) if extra else ""))
    if not cond: fails.append(name)

async def main():
    async with async_playwright() as pw:
        b=await pw.chromium.launch(executable_path=CHROME,args=ARGS)
        pg=await b.new_page(viewport={"width":1440,"height":900})
        errs=[]
        pg.on("console", lambda m: errs.append(m.text) if m.type=="error" else None)
        pg.on("pageerror", lambda e: errs.append(str(e)))
        bad=[]
        pg.on("response", lambda r: bad.append((r.status,r.url)) if r.status>=400 else None)
        await pg.goto(URL, wait_until="load")
        await pg.wait_for_function("window.SOE && window.SOE.deepSky", timeout=90000)

        ds=await pg.evaluate("window.SOE.deepSky")
        ck("18 deep-sky objects loaded", len(ds)==18, len(ds))
        ck("every object has an image path", all(o["image"].startswith("assets/deepsky/") for o in ds))
        ck("every object has a distance reference", all(o.get("dist_ref") for o in ds))

        # every level that owns objects must actually plot them
        plotted=await pg.evaluate("""() => {
          const out={};
          for (const o of window.SOE.deepSky) out[o.level]=(out[o.level]||0)+1;
          const got={};
          for (const lvl of Object.keys(out)) {
            const s=window.SOE.shellAt(Number(lvl));
            got[lvl]=(s.deepSky||[]).length;
          }
          return {want:out, got};
        }""")
        ck("all objects plotted on their shell", plotted["want"]==plotted["got"], plotted)

        ck("sprites are in the shell click list", await pg.evaluate("""() => {
          const s=window.SOE.shellAt(3);
          return (s.clickable||[]).filter(o=>o.userData.kind==='deepsky').length;
        }""")==8)

        # search a nebula by name
        await pg.evaluate("window.SOE.runSearch('Pillars of Creation')")
        await pg.wait_for_timeout(900)
        ck("search finds the Pillars of Creation",
           (await pg.text_content("#infoTitle"))=="Pillars of Creation",
           await pg.text_content("#infoTitle"))
        shot=await pg.get_attribute(".ds-shot","src")
        ck("info panel shows its photograph", shot=="assets/deepsky/M16.webp", shot)
        src=await pg.text_content("#infoSource")
        ck("credit and licence are shown", ("Public domain" in src or "CC BY" in src) and "not a render" in src)
        ck("distance reference is shown", "Gaia" in src or "et al" in src)

        # search by an alternative designation
        await pg.evaluate("window.SOE.runSearch('NGC 6543')")
        await pg.wait_for_timeout(900)
        ck("search finds it by NGC designation",
           (await pg.text_content("#infoTitle"))=="Cat's Eye Nebula",
           await pg.text_content("#infoTitle"))
        ck("caveat is surfaced where one exists", await pg.locator(".ds-caveat").count()==1)

        # textures actually decoded
        await pg.wait_for_timeout(1500)
        tex=await pg.evaluate("""() => {
          const s=window.SOE.shellAt(3);
          return (s.deepSky||[]).map(e=>({n:e.obj.name, img: !!(e.material.map && e.material.map.image && e.material.map.image.width)}));
        }""")
        ck("every orion-arm texture decoded", all(t["img"] for t in tex),
           [t["n"] for t in tex if not t["img"]])

        await pg.screenshot(path="ds-desk.png")
        ck("no 4xx/5xx responses", not bad, bad[:6])
        ck("no console errors", not errs, errs[:4])
        await b.close()
    print("FAILURES:", len(fails), fails)
    sys.exit(1 if fails else 0)
asyncio.run(main())
