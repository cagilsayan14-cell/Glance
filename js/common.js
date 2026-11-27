/* GLANCE shared layer: language (EN/TR), live OKX data with sample fallback, header, theme, charts, plan picker. */
(function () {
  const G = (window.G = {});
  const store = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };
  G.store = store;
  G.esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // ---------- Language ----------
  const lang = (G.lang = store.get("glance-lang") === "tr" ? "tr" : "en");
  const T = (G.T = (tr, en) => (lang === "en" ? en : tr));
  G.B = (tr, en) => ({ tr, en }); // bilingual value, stored in the decision log
  G.tx = (v) => (v && typeof v === "object" && "en" in v ? v[lang] : v);
  const LOC = (G.locale = lang === "en" ? "en-US" : "tr-TR");
  document.documentElement.lang = lang;
  // Static HTML is written in English; elements carry their Turkish text in data-tr (and data-tr-ph for placeholders).
  if (lang === "tr") {
    document.querySelectorAll("[data-tr]").forEach((el) => (el.innerHTML = el.dataset.tr));
    document.querySelectorAll("[data-tr-ph]").forEach((el) => (el.placeholder = el.dataset.trPh));
    document.querySelectorAll("[data-tr-title]").forEach((el) => (el.title = el.dataset.trTitle));
  }

  // ---------- Formatting ----------
  const nf = (d) => new Intl.NumberFormat(LOC, { minimumFractionDigits: d, maximumFractionDigits: d });
  G.dec = (p) => (p >= 1000 ? 1 : p >= 10 ? 2 : p >= 1 ? 4 : p >= 0.01 ? 5 : 8);
  G.fmt = {
    price: (p) => nf(G.dec(p)).format(p),
    usd: (v, d = 2) => nf(d).format(v),
    pct: (v, d = 2) => (v > 0 ? "+" : "") + nf(d).format(v) + "%",
    pr: (v) => (lang === "en" ? nf(v % 1 ? 1 : 0).format(v) + "%" : "%" + nf(v % 1 ? 1 : 0).format(v)),
    big: (v) => (v >= 1e9 ? nf(2).format(v / 1e9) + T(" mr", "B") : v >= 1e6 ? nf(0).format(v / 1e6) + T(" mn", "M") : nf(0).format(v)),
    rr: (v) => "1:" + nf(1).format(v),
    qty: (q) => nf(q < 1 ? 4 : q < 100 ? 2 : 0).format(q),
  };
  G.cls = (v) => (v > 0 ? "up" : v < 0 ? "down" : "");

  // ---------- Market data: sample values, replaced by OKX live data when reachable ----------
  // [symbol, price, 24h %, 24h volume USDT, long %, funding % (8h)]
  G.COINS = [
    ["BTC", 97180, 1.21, 2.41e9, 61, 0.010], ["ETH", 3418.6, 2.42, 1.37e9, 66, 0.014],
    ["SOL", 182.4, 4.12, 6.12e8, 58, -0.003], ["XRP", 2.1508, 0.37, 4.02e8, 55, 0.006],
    ["BNB", 718.27, 1.86, 2.9e8, 52, 0.004], ["DOGE", 0.38214, -2.21, 3.31e8, 48, -0.012],
    ["AVAX", 24.1007, -1.64, 1.48e8, 71, 0.021], ["LINK", 15.1633, 4.55, 9.6e7, 63, 0.009],
    ["SUI", 2.7794, -4.41, 1.33e8, 67, 0.018], ["ADA", 0.9212, 0.84, 1.12e8, 57, 0.005],
    ["DOT", 4.4194, 10.46, 7.4e7, 44, -0.008], ["LTC", 86.7638, -1.07, 6.1e7, 59, 0.007],
    ["ARB", 0.44733, 20.91, 8.8e7, 39, -0.021], ["OP", 0.78773, 11.39, 5.9e7, 42, -0.006],
    ["AAVE", 239.45, 19.25, 7.7e7, 64, 0.016], ["PEPE", 0.0000100, -3.53, 2.1e8, 73, 0.034],
  ].map(([s, p, c, v, l, f]) => ({ s, inst: s + "/USDT", p, c, v, l, f, live: false, lsLive: false, fLive: false }));
  G.coin = (s) => G.COINS.find((c) => c.s === s);
  G.dataMode = "sample";

  const OKX = "https://www.okx.com";
  const viaServer = /^https?:/.test(location.protocol) && /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  G.okx = async (path, ms = 5000) => {
    for (const u of viaServer ? ["/okx" + path, OKX + path] : [OKX + path]) {
      try {
        const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), ms);
        const r = await fetch(u, { signal: ctl.signal }); clearTimeout(t);
        if (!r.ok) continue;
        const j = await r.json();
        if (j && j.code === "0") return j.data;
      } catch {}
    }
    throw new Error("okx unreachable");
  };
  const loadTickers = async () => {
    const data = await G.okx("/api/v5/market/tickers?instType=SPOT");
    const map = new Map(data.map((t) => [t.instId, t]));
    let n = 0;
    G.COINS.forEach((c) => {
      const t = map.get(c.s + "-USDT"); if (!t) return;
      const last = +t.last, open = +t.open24h;
      if (!(last > 0)) return;
      c.p = last; c.c = open > 0 ? (last / open - 1) * 100 : 0; c.v = +t.volCcy24h || c.v; c.live = true; n++;
    });
    if (!n) throw new Error("no tickers");
    G.dataMode = "live"; G.updatedAt = new Date();
  };
  const loadFunding = () => Promise.allSettled(G.COINS.map(async (c) => {
    const d = await G.okx(`/api/v5/public/funding-rate?instId=${c.s}-USDT-SWAP`);
    if (d[0] && d[0].fundingRate !== "") { c.f = +d[0].fundingRate * 100; c.fLive = true; }
  }));
  // OKX rubik endpoints allow ~5 requests / 2 s, so long/short ratios are fetched one by one in the background.
  const loadLS = async () => {
    for (const c of G.COINS) {
      try {
        const d = await G.okx(`/api/v5/rubik/stat/contracts/long-short-account-ratio?ccy=${c.s}&period=1H`);
        const ratio = d && d[0] ? +d[0][1] : NaN;
        if (ratio > 0) { c.l = Math.round((ratio / (1 + ratio)) * 100); c.lsLive = true; document.dispatchEvent(new CustomEvent("glance:data")); }
      } catch {}
      await new Promise((r) => setTimeout(r, 450));
    }
  };
  G.ready = (async () => {
    try { await loadTickers(); } catch { G.dataMode = "sample"; }
    if (G.dataMode === "live") {
      await Promise.race([loadFunding(), new Promise((r) => setTimeout(r, 2500))]);
      loadLS();
      setInterval(async () => { try { await loadTickers(); paintTicker(); document.dispatchEvent(new CustomEvent("glance:data")); } catch {} }, 20000);
    }
    paintTicker(); paintDataBadge();
  })();

  // ---------- Candles ----------
  const seeded = (seed) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const TF = { "15m": 900, "1h": 3600, "4h": 14400, "1d": 86400 };
  const BAR = { "15m": "15m", "1h": "1H", "4h": "4H", "1d": "1Dutc" };
  const tzShift = -new Date().getTimezoneOffset() * 60; // chart shows local time
  G.TF_LABEL = { "15m": T("15dk", "15m"), "1h": T("1s", "1h"), "4h": T("4s", "4h"), "1d": T("1g", "1D") };
  G.sampleCandles = (sym, tf = "4h", n = 160, drift = 0.0012) => {
    let h = 7; for (const ch of sym + tf) h = (h * 31 + ch.charCodeAt(0)) % 2147483647;
    const r = seeded(h || 1), step = TF[tf], now = Math.floor(Date.now() / 1000 / step) * step;
    const vol = tf === "1d" ? 0.03 : tf === "4h" ? 0.016 : tf === "1h" ? 0.009 : 0.005;
    let p = 100; const raw = [];
    for (let i = 0; i < n; i++) {
      const o = p, c = o * (1 + (r() - 0.5 + drift * 40) * vol * 2);
      raw.push({ o, c, h: Math.max(o, c) * (1 + r() * vol * 0.6), l: Math.min(o, c) * (1 - r() * vol * 0.6), v: 40 + r() * 100 });
      p = c;
    }
    const k = G.coin(sym).p / raw.at(-1).c;
    return raw.map((x, i) => ({ time: now - (n - 1 - i) * step + tzShift, open: x.o * k, high: x.h * k, low: x.l * k, close: x.c * k, value: x.v }));
  };
  const cache = {};
  G.getCandles = async (sym, tf) => {
    const key = sym + tf;
    if (cache[key] && Date.now() - cache[key].at < 60000) return cache[key].data;
    if (G.dataMode === "live") {
      try {
        const d = await G.okx(`/api/v5/market/candles?instId=${sym}-USDT&bar=${BAR[tf]}&limit=200`);
        const data = d.slice().reverse().map((k) => ({ time: Math.floor(+k[0] / 1000) + tzShift, open: +k[1], high: +k[2], low: +k[3], close: +k[4], value: +k[7] || +k[6] || +k[5] }));
        if (data.length > 10) { cache[key] = { at: Date.now(), data }; return data; }
      } catch {}
    }
    return G.sampleCandles(sym, tf);
  };
  G.candles = (sym, tf) => (cache[sym + tf] ? cache[sym + tf].data : G.sampleCandles(sym, tf));

  // ---------- Chart (TradingView Lightweight Charts) ----------
  const css = (v) => getComputedStyle(document.body).getPropertyValue(v).trim();
  G.chart = (box, sym, tf, levels = []) => {
    box.innerHTML = "";
    const LC = window.LightweightCharts;
    const dec = G.dec(G.coin(sym).p);
    const chart = LC.createChart(box, {
      autoSize: true,
      layout: { background: { type: "solid", color: "transparent" }, textColor: css("--muted"), fontFamily: "system-ui, sans-serif" },
      grid: { vertLines: { color: "rgba(120,130,160,.16)" }, horzLines: { color: "rgba(120,130,160,.16)" } },
      rightPriceScale: { borderColor: "rgba(120,130,160,.4)" },
      timeScale: { borderColor: "rgba(120,130,160,.4)", timeVisible: tf !== "1d" },
      localization: { locale: LOC },
      crosshair: { mode: 0 },
    });
    const main = chart.addSeries(LC.CandlestickSeries, { upColor: "#2fbf71", downColor: "#f06a66", borderVisible: false, wickUpColor: "#2fbf71", wickDownColor: "#f06a66", priceFormat: { type: "price", precision: dec, minMove: 1 / 10 ** dec } });
    const vol = chart.addSeries(LC.HistogramSeries, { priceScaleId: "vol", priceFormat: { type: "volume" }, lastValueVisible: false, priceLineVisible: false, color: "rgba(120,130,160,.35)" });
    chart.priceScale("vol").applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
    const COL = { entry: "#f2a93b", stop: "#f06a66", target: "#2fbf71" };
    const NAME = { entry: T("giriş", "entry"), stop: "stop", target: T("hedef", "target") };
    levels.forEach(([price, k]) => main.createPriceLine({ price, color: COL[k] || "#8796ae", lineWidth: k === "entry" ? 2 : 1, lineStyle: k === "entry" ? 0 : 2, title: NAME[k] || k }));
    const ref = { chart, removed: false };
    ref.loaded = G.getCandles(sym, tf).then((data) => {
      if (ref.removed) return data;
      main.setData(data); vol.setData(data.map((d) => ({ time: d.time, value: d.value, color: d.close >= d.open ? "rgba(47,191,113,.35)" : "rgba(240,106,102,.35)" })));
      chart.timeScale().fitContent();
      return data;
    });
    ref.remove = () => { ref.removed = true; chart.remove(); };
    return ref;
  };

  // Liquidation heatmap (modelled around the live price; the real product would use a paid feed such as Coinglass).
  G.heatmap = (box, sym) => {
    const W = box.clientWidth || 320, H = box.clientHeight || 220, cols = 48, rows = 30, m = { l: 0, r: 84, t: 4, b: 4 };
    const c = G.coin(sym), lo = c.p * 0.9, hi = c.p * 1.1, cw = (W - m.l - m.r) / cols, rh = (H - m.t - m.b) / rows;
    const clusters = [[c.p * 1.042, 1], [c.p * 0.955, 0.95], [c.p * 1.078, 0.55], [c.p * 0.921, 0.6]];
    const r = seeded(c.s.charCodeAt(0) * 97);
    let g = "";
    for (let y = 0; y < rows; y++) {
      const pr = hi - ((y + 0.5) / rows) * (hi - lo);
      for (let x = 0; x < cols; x++) {
        let v = 0; for (const [cp, w] of clusters) v += w * Math.exp(-(((pr - cp) / (c.p * 0.007)) ** 2)) * (0.3 + 0.7 * (x / cols));
        v = Math.min(1, v + r() * 0.16);
        const col = v > 0.7 ? "#fde047" : v > 0.45 ? "#f59e0b" : v > 0.22 ? "#7c3aed" : "#1e1b4b";
        g += `<rect x="${(m.l + x * cw).toFixed(1)}" y="${(m.t + y * rh).toFixed(1)}" width="${(cw + 0.6).toFixed(1)}" height="${(rh + 0.6).toFixed(1)}" fill="${col}" opacity="${(0.35 + v * 0.65).toFixed(2)}"/>`;
      }
    }
    const yp = (v) => m.t + ((hi - v) / (hi - lo)) * (H - m.t - m.b);
    const lab = (v, t, col) => `<text x="${W - m.r + 6}" y="${yp(v) + 4}" fill="${col}" font-size="11" font-family="ui-monospace,monospace">${t}</text>`;
    g += `<line x1="0" x2="${W - m.r}" y1="${yp(c.p)}" y2="${yp(c.p)}" stroke="#fff" stroke-width="1.5" stroke-dasharray="4 3"/>` + lab(c.p, G.fmt.price(c.p), "currentColor") + lab(clusters[0][0], G.fmt.price(clusters[0][0]), "#f59e0b") + lab(clusters[1][0], G.fmt.price(clusters[1][0]), "#f59e0b");
    box.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="100%" height="100%" role="img" aria-label="${sym} ${T("likidasyon ısı haritası", "liquidation heatmap")}">${g}</svg>`;
    return { shortCluster: clusters[0][0], longCluster: clusters[1][0] };
  };
  G.heatNote = () => T("Tahmini · gerçek fiyat etrafında modellenmiştir", "Estimated · modelled around the live price");

  G.lsBar = (c) => `<span class="lsrow${c.lsLive || G.dataMode !== "live" ? "" : " est"}" title="${c.lsLive ? "OKX" : T("tahmini", "estimate")}"><span class="lsb"><i style="width:${c.l}%"></i><i style="width:${100 - c.l}%"></i></span><span class="mono">${c.l}/${100 - c.l}</span></span>`;

  // ---------- Header, mode switch, theme, language, ticker ----------
  const ICON = {
    sun: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
    moon: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>',
    menu: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
  };
  const page = document.body.dataset.page || "";
  const pageMode = { algo: "pro", asistan: "basic", home: "basic" }[page];
  const mode = pageMode || (store.get("glance-mode") === "algo" ? "pro" : "basic");
  document.body.dataset.mode = mode;
  if (pageMode && page !== "home") store.set("glance-mode", page);
  const mq = window.matchMedia ? window.matchMedia("(prefers-color-scheme: light)") : null;
  const t0 = store.get("glance-theme");
  document.body.dataset.theme = t0 === "light" || t0 === "dark" ? t0 : mq && mq.matches ? "light" : "dark";

  const LINKS = [["asistan.html", T("Asistan", "Assistant"), "asistan"], ["algo.html", T("Algo trade", "Algo trading"), "algo"], ["piyasa.html", T("Piyasa verisi", "Market data"), "piyasa"], ["kayit.html", T("Karar kaydı", "Decision log"), "kayit"]];
  const links = LINKS.map(([h, t, p]) => `<li><a href="${h}"${p === page ? ' aria-current="page"' : ""}>${t}</a></li>`).join("");
  const isAlgo = mode === "pro";
  const header = document.createElement("header");
  header.className = "site-header";
  header.innerHTML = `
    <a class="skip-link" href="#main">${T("İçeriğe geç", "Skip to content")}</a>
    <nav class="nav" aria-label="${T("Ana gezinme", "Main navigation")}">
      <a class="brand" href="index.html"><img src="img/logo.svg" alt="" width="34" height="34"><span>GLANCE</span></a>
      <ul class="nav-links">${links}</ul>
      <div class="nav-right">
        <div class="segment mode-switch" role="group" aria-label="${T("Çalışma modu", "Mode")}"><button type="button" data-go="asistan.html" aria-pressed="${!isAlgo}">${T("Asistan", "Assistant")}</button><button type="button" data-go="algo.html" aria-pressed="${isAlgo}">Algo</button></div>
        <span class="badge badge-muted data-badge" id="data-badge">…</span>
        <button type="button" class="theme-btn lang-btn" id="lang-btn" aria-label="${T("Switch to English", "Türkçeye geç")}">${lang === "en" ? "TR" : "EN"}</button>
        <button type="button" class="theme-btn" id="theme-btn"></button>
        <button class="menu-btn" type="button" aria-expanded="false" aria-controls="mobile-menu" aria-label="${T("Menüyü aç", "Open menu")}">${ICON.menu}</button>
      </div>
    </nav>
    <div class="mobile-menu" id="mobile-menu"><ul>${links}</ul></div>
    <div class="ticker-strip" aria-hidden="true"><div class="ticker-track" id="ticker-track"></div></div>`;
  document.body.prepend(header);
  function paintTicker() {
    const items = G.COINS.map((c) => `<span>${c.s}<b>${G.fmt.price(c.p)}</b><em class="${G.cls(c.c)}">${G.fmt.pct(c.c)}</em></span>`).join("");
    header.querySelector("#ticker-track").innerHTML = items + items;
  }
  function paintDataBadge() {
    const b = header.querySelector("#data-badge"), f = document.querySelector("#foot-data");
    if (G.dataMode === "live") {
      b.className = "badge badge-ok data-badge"; b.innerHTML = `<span class="dot"></span>${T("Canlı · OKX", "Live · OKX")}`;
      b.title = T("Fiyat, mum, funding ve long/short OKX public API'den geliyor. Isı haritası tahminidir.", "Prices, candles, funding and long/short come from the OKX public API. The heatmap is an estimate.");
    } else {
      b.className = "badge badge-warn data-badge"; b.textContent = T("Örnek veri", "Sample data");
      b.title = T("OKX'e ulaşılamadı, örnek veri gösteriliyor.", "OKX could not be reached, showing sample data.");
    }
    if (f) f.textContent = G.dataMode === "live" ? T("Piyasa verisi: OKX public API (canlı)", "Market data: OKX public API (live)") : T("Piyasa verisi: örnek veri", "Market data: sample data");
  }

  const reduced = () => window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  header.querySelectorAll("[data-go]").forEach((b) => b.addEventListener("click", () => {
    if (b.getAttribute("aria-pressed") === "true") return;
    const ov = document.createElement("div");
    ov.className = `mode-overlay${reduced() ? " still" : ""}`;
    ov.setAttribute("role", "status");
    ov.innerHTML = `${reduced() ? "" : '<img src="img/logo.svg" alt="" width="72" height="72">'}<p>${b.dataset.go === "algo.html" ? T("Algo trade moduna geçiliyor…", "Switching to algo trading…") : T("Asistan moduna geçiliyor…", "Switching to assistant…")}</p>`;
    document.body.append(ov);
    setTimeout(() => (location.href = b.dataset.go), 420);
  }));
  const themeBtn = header.querySelector("#theme-btn");
  const paint = () => { const light = document.body.dataset.theme === "light"; themeBtn.innerHTML = light ? ICON.moon : ICON.sun; themeBtn.setAttribute("aria-label", light ? T("Gece moduna geç", "Dark mode") : T("Gündüz moduna geç", "Light mode")); };
  paint();
  themeBtn.addEventListener("click", () => { const next = document.body.dataset.theme === "light" ? "dark" : "light"; store.set("glance-theme", next); document.body.dataset.theme = next; paint(); document.dispatchEvent(new CustomEvent("glance:theme")); });
  header.querySelector("#lang-btn").addEventListener("click", () => { store.set("glance-lang", lang === "en" ? "tr" : "en"); location.reload(); });
  const menuBtn = header.querySelector(".menu-btn");
  menuBtn.addEventListener("click", () => { const m = header.querySelector("#mobile-menu"); const open = !m.classList.contains("open"); m.classList.toggle("open", open); menuBtn.setAttribute("aria-expanded", String(open)); });

  const footer = document.createElement("footer");
  footer.className = "site-footer";
  footer.innerHTML = `<div class="row"><span class="badge badge-dry">Paper trade</span><span id="foot-data"></span><span>· ${T("Demo · yatırım tavsiyesi değildir.", "Demo · not investment advice.")}</span></div>`;
  document.body.append(footer);

  G.toast = (msg, kind = "") => {
    let wrap = document.querySelector(".toast-wrap");
    if (!wrap) { wrap = document.createElement("div"); wrap.className = "toast-wrap"; wrap.setAttribute("aria-live", "polite"); document.body.append(wrap); }
    const t = document.createElement("div"); t.className = "toast " + kind; t.innerHTML = msg; wrap.append(t);
    setTimeout(() => t.remove(), 4200);
  };

  // ---------- Plan picker (no typing, selections only) ----------
  G.HZ_TF = { scalp: "15m", swing: "1h", pozisyon: "4h" };
  G.HZ_NAME = { scalp: T("Kısa vade", "Short-term"), swing: "Swing", pozisyon: T("Uzun vade", "Long-term") };
  G.planPicker = (box, opts = {}) => {
    const st = Object.assign({ pairs: ["BTC", "ETH"], horizon: "swing", rr: 2, risk: 1, maxPos: 2 }, opts.value || {});
    const HZ = [["scalp", T("15dk – 1s · saatler", "15m – 1h · hours")], ["swing", T("1s – 4s · günler", "1h – 4h · days")], ["pozisyon", T("4s – 1g · haftalar", "4h – 1D · weeks")]];
    const draw = () => {
      box.innerHTML = `
      <div class="pick-group"><div class="pick-h">${T("Pariteler", "Pairs")} <span class="faint">${st.pairs.length} ${T("seçili", "selected")}</span></div>
        <div class="pick-pairs">${G.COINS.slice(0, opts.pairLimit || 12).map((c) => `<button type="button" class="chip pick" data-pair="${c.s}" aria-pressed="${st.pairs.includes(c.s)}">${c.s}<em class="${G.cls(c.c)}">${G.fmt.pct(c.c, 1)}</em></button>`).join("")}</div></div>
      <div class="pick-group"><div class="pick-h">${T("İşlem vadesi", "Horizon")}</div>
        <div class="pick-cards">${HZ.map(([k, d]) => `<button type="button" class="pick-card" data-hz="${k}" aria-pressed="${st.horizon === k}"><b>${G.HZ_NAME[k]}</b><span>${d}</span></button>`).join("")}</div></div>
      <div class="pick-row">
        <div class="pick-group"><div class="pick-h">${T("En az R:R", "Min R:R")}</div><div class="segment">${[1.5, 2, 3, 4].map((v) => `<button type="button" data-rr="${v}" aria-pressed="${st.rr === v}">${G.fmt.rr(v)}${v === 4 ? "+" : ""}</button>`).join("")}</div></div>
        <div class="pick-group"><div class="pick-h">${T("İşlem başına risk", "Risk per trade")}</div><div class="segment">${[0.5, 1, 2].map((v) => `<button type="button" data-risk="${v}" aria-pressed="${st.risk === v}">${G.fmt.pr(v)}</button>`).join("")}</div></div>
        <div class="pick-group"><div class="pick-h">${T("Aynı anda en fazla", "Max open")}</div><div class="stepper"><button type="button" data-step="-1" aria-label="-">−</button><b>${st.maxPos}</b><button type="button" data-step="1" aria-label="+">+</button></div></div>
      </div>
      <p class="faint pick-note">${T(`Bakiye 10.000 USDT · her işlemde en fazla ${G.fmt.usd(100 * st.risk, 0)} USDT risk · stop zorunlu`, `Balance 10,000 USDT · max ${G.fmt.usd(100 * st.risk, 0)} USDT risk per trade · stop required`)}</p>`;
      box.querySelectorAll("[data-pair]").forEach((b) => (b.onclick = () => { const s = b.dataset.pair; st.pairs = st.pairs.includes(s) ? st.pairs.filter((x) => x !== s) : st.pairs.concat(s); if (!st.pairs.length) st.pairs = [s]; draw(); }));
      box.querySelectorAll("[data-hz]").forEach((b) => (b.onclick = () => { st.horizon = b.dataset.hz; draw(); }));
      box.querySelectorAll("[data-rr]").forEach((b) => (b.onclick = () => { st.rr = +b.dataset.rr; draw(); }));
      box.querySelectorAll("[data-risk]").forEach((b) => (b.onclick = () => { st.risk = +b.dataset.risk; draw(); }));
      box.querySelectorAll("[data-step]").forEach((b) => (b.onclick = () => { st.maxPos = Math.min(6, Math.max(1, st.maxPos + +b.dataset.step)); draw(); }));
      opts.onChange && opts.onChange(st);
    };
    draw();
    st.redraw = draw;
    return st;
  };
})();
