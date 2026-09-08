import os
HERE = os.path.dirname(os.path.abspath(__file__))
import urllib.request, urllib.parse, json, io, os, re
from PIL import Image
UA={"User-Agent":"soe-build/1.0 (jeevansiddhabhaktula@gmail.com)"}
PICK={
"M42":"File:Orion Nebula - Hubble 2006 mosaic.jpg",
"M16":"File:Pillars of Creation (NIRCam Image).jpg",
"NGC6543":"File:Looking at the Cat\u2019s Eye Nebula with Hubble (potm2602b).jpg",
"M57":"File:Hubble reveals the Ring Nebula\u2019s true shape.jpg",
"NGC7293":"File:NGC7293 (2004).jpg",
"M1":"File:Crab Nebula.jpg",
"NGC3372":"File:Carina Nebula by ESO.jpg",
"NGC6960":"File:Return to the Veil Nebula.jpg",
"M8":"File:Lagoon Nebula (ESO).jpg",
"B33":"File:Ic434 Horsehead Nebula B33 Flame Nebula Ngc2024.jpg",
"NGC5139":"File:Omega Centauri by ESO.jpg",
"M45":"File:Pleiades large.jpg",
"M104":"File:M104 ngc4594 sombrero galaxy hi-res.jpg",
"M51":"File:Messier51 sRGB.jpg",
"M20":"File:Trifid Nebula (M20) (gemini0207a).jpg",
"NGC7000":"File:NGC 7000- The North America Nebula and the Pelican Nebula (noao-n7000mosblock).jpg",
"M27":"File:Dumbbell Nebula (Messier 27).png",
"NGC2070":"File:Tarantula Nebula by JWST.jpg",
}
def strip(h):
    if not h: return ""
    t=re.sub(r"<[^>]+>"," ",h); t=re.sub(r"&amp;","&",t); t=re.sub(r"\s+"," ",t)
    return t.strip(" |;,")
titles=sorted(set(PICK.values()))
info={}
for i in range(0,len(titles),12):
    u="https://commons.wikimedia.org/w/api.php?"+urllib.parse.urlencode({
      "action":"query","format":"json","prop":"imageinfo","iiprop":"url|size|extmetadata",
      "iiurlwidth":"1000","titles":"|".join(titles[i:i+12])})
    d=json.loads(urllib.request.urlopen(urllib.request.Request(u,headers=UA),timeout=120).read())
    for p in d["query"]["pages"].values():
        ii=p.get("imageinfo")
        assert ii, "missing "+p["title"]
        em=ii[0].get("extmetadata",{})
        info[p["title"]]={"thumb":ii[0]["thumburl"],"page":ii[0]["descriptionurl"],
          "lic":em.get("LicenseShortName",{}).get("value","?"),
          "licurl":em.get("LicenseUrl",{}).get("value",""),
          "artist":strip(em.get("Artist",{}).get("value","")),
          "credit":strip(em.get("Credit",{}).get("value",""))}
os.makedirs(HERE + "/out",exist_ok=True)
manifest={}
for key,title in PICK.items():
    m=info[title]
    raw=urllib.request.urlopen(urllib.request.Request(m["thumb"],headers=UA),timeout=180).read()
    im=Image.open(io.BytesIO(raw)).convert("RGB")
    im.thumbnail((760,760), Image.LANCZOS)
    p=HERE + "/out/" + key + ".webp"; im.save(p,"WEBP",quality=78,method=6)
    manifest[key]={"file":f"{key}.webp","w":im.width,"h":im.height,"bytes":os.path.getsize(p),
                   "commons":title,"page":m["page"],"lic":m["lic"],"licurl":m["licurl"],
                   "artist":m["artist"][:200],"credit":m["credit"][:200]}
    print(f'{key:9s} {im.width}x{im.height} {os.path.getsize(p)//1024:4d} KB  {m["lic"]}')
json.dump(manifest,open(HERE + "/manifest.json","w"),indent=1)
print("TOTAL", sum(v["bytes"] for v in manifest.values())//1024, "KB")
