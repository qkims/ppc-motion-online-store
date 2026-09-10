"""Freeze template-build.html at an exact phase of its 12.8s clock and screenshot
the stage.  Everything on the page -- storefront build, cart, kit visibility --
is a CSS animation on that one clock, so setting currentTime on every animation
and pausing it is a deterministic freeze.  The three product clips are <video>,
so they are seeked to whatever film.js would have put them at for that phase.

film.js is rAF-driven, so it has to be disarmed first or it fights the seek."""
import base64, json, os, sys, time
sys.path.insert(0, ".tools")
import cdpws

PORT, SRV = 9411, 56639
LOOP = 12.8
WIN  = {1: (11.950, 3.150), 2: (3.150, 7.150), 3: (7.150, 11.950)}

# phase (s) within the 12.8s loop.  "arrive" = first instant the panel is fully
# centred (--bd-shift back to 0); "settled" = last instant it is still centred
# with its cart panel fully in, i.e. the finished website.
SHOTS = [
    ("opt1", "arrive",  12.500), ("opt1", "settled",  2.800),
    ("opt2", "arrive",   3.700), ("opt2", "settled",  6.800),
    ("opt3", "arrive",   7.700), ("opt3", "settled", 11.600),
]
SCALE = 3

ws = cdpws.WS(open(".tools/ws44.txt").read().strip(), timeout=120)
ws.call("Page.enable"); ws.call("Runtime.enable")
ws.call("Emulation.setDeviceMetricsOverride", width=1600, height=1400,
        deviceScaleFactor=1, mobile=False)

def ev(expr):
    r = ws.call("Runtime.evaluate", expression=expr, returnByValue=True,
                awaitPromise=True)
    if "exceptionDetails" in r:
        raise RuntimeError(json.dumps(r["exceptionDetails"])[:600])
    return r["result"].get("value")

ws.call("Page.navigate", url=f"http://127.0.0.1:{SRV}/template-build.html")
print(ev("""(async () => {
  const t0 = Date.now();
  while (document.readyState !== 'complete' && Date.now()-t0 < 20000)
    await new Promise(r => setTimeout(r, 80));
  const vs = [...document.querySelectorAll('video[data-film]')];
  while (Date.now()-t0 < 25000 &&
         !vs.every(v => v.readyState >= 2 && v.duration > 0 && v.seekable.length > 0))
    await new Promise(r => setTimeout(r, 80));
  if (!vs.every(v => v.seekable.length > 0))
    throw new Error('no seekable range -- server is not answering byte ranges');
  // disarm film.js: it reschedules itself through the global rAF, so nulling
  // that global kills the loop after its current tick and hands us the videos.
  window.__raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = () => 0;
  await new Promise(r => setTimeout(r, 250));
  return 'ready + film.js disarmed in ' + (Date.now()-t0) + 'ms';
})()"""))

FREEZE = r"""(async (T) => {
  const LOOP = 12.8, WIN = {1:[11.950,3.150], 2:[3.150,7.150], 3:[7.150,11.950]};
  const on = (u,w) => (w[0] < w[1] ? (u >= w[0] && u < w[1]) : (u >= w[0] || u < w[1]));
  // freeze every animation on the page at phase T
  const anims = document.getAnimations();
  for (const a of anims) { try { a.pause(); a.currentTime = T * 1000; } catch (e) {} }
  // put each clip where film.js would have it at phase T
  const u = ((T % LOOP) + LOOP) % LOOP;
  const rep = [];
  await Promise.all([...document.querySelectorAll('video[data-film]')].map(v => {
    const n = +v.dataset.film, w = WIN[n], d = v.duration;
    let want = 0, live = on(u, w);
    if (live) { want = (u - w[0] + LOOP) % LOOP; if (want >= d) want = d; }
    v.pause();
    return new Promise(res => {
      const done = () => { rep.push({film:n, live, want:+want.toFixed(4),
                                     got:+v.currentTime.toFixed(4), dur:+d.toFixed(4)}); res(); };
      if (Math.abs(v.currentTime - want) < 1e-4) return done();
      v.addEventListener('seeked', done, {once:true});
      v.currentTime = want;
      setTimeout(done, 3000);   // never hang the run on a seek that never fires
    });
  }));
  // two real composited frames so the seek and the frozen styles are painted
  await new Promise(r => window.__raf(() => window.__raf(r)));
  await new Promise(r => setTimeout(r, 120));
  const r = document.querySelector('.stage').getBoundingClientRect();
  return {rect:{x:r.x, y:r.y, w:r.width, h:r.height},
          vids: rep.sort((a,b)=>a.film-b.film),
          paused: [...document.getAnimations()].every(a => a.playState === 'paused'),
          nAnims: anims.length,
          shift: [1,2,3].map(n => getComputedStyle(
            document.querySelector('.hv-al--'+n+' > .hv-storefront')).getPropertyValue('--bd-shift').trim()),
          cut:  getComputedStyle(document.querySelector('.bd-word')).getPropertyValue('--bd-cut').trim()};
})(__T__)"""

os.makedirs("assets/stills/_raw", exist_ok=True)
rows = []
for opt, kind, T in SHOTS:
    info = ev(FREEZE.replace("__T__", repr(T)))
    r = info["rect"]
    shot = ws.call("Page.captureScreenshot", format="png", captureBeyondViewport=True,
                   clip={"x": r["x"], "y": r["y"], "width": r["w"],
                         "height": r["h"], "scale": SCALE})
    path = f"assets/stills/_raw/{opt}-{kind}.png"
    data = base64.b64decode(shot["data"])
    open(path, "wb").write(data)
    v = [x for x in info["vids"] if x["film"] == int(opt[-1])][0]
    rows.append((opt, kind, T, len(data), v, info["shift"], info["cut"], info["paused"]))
    print(f"  {opt}/{kind:7s} T={T:6.3f}s  {len(data):8d} B  "
          f"vid live={str(v['live']):5s} t={v['got']:.3f}/{v['dur']:.3f}  "
          f"shift={info['shift']}  cut={info['cut']}  allPaused={info['paused']}")

json.dump([{"opt":o,"kind":k,"T":t,"bytes":b,"vid":v,"shift":s,"cut":c,"paused":p}
           for o,k,t,b,v,s,c,p in rows], open("assets/stills/_raw/report.json","w"), indent=1)
print("\nwrote", len(rows), "stills to assets/stills/_raw/")
