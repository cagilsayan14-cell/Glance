(function () {
  const { fmt, T, B } = G;
  const $ = (s) => document.querySelector(s);
  let P, pick = G.store.get("glance-prof") || "mid", manual = null;
  const build = () => {
    const byVol = [...G.COINS].sort((a, b) => b.v - a.v).map((c) => c.s);
    P = {
      hi: { name: T("Yüksek risk", "High risk"), lvl: 4, desc: T("Agresif. Kısa vade, çok parite, geniş R:R aralığı.", "Aggressive. Short-term, many pairs, wide R:R range."), risk: 2, rrMin: 1.5, rrMax: 5, rrTxt: "1:1.5 – 1:5", pairsTxt: T("Hacimde ilk 30", "Top 30 by volume"), pairs: byVol, tf: "15m", tfTxt: T("15dk – 1s", "15m – 1h"), hold: T("≤ 12 saat", "≤ 12 hours"), maxPos: 5 },
      mid: { name: T("Orta risk", "Medium risk"), lvl: 3, desc: T("Dengeli. Swing işlemler, büyük pariteler.", "Balanced. Swing trades on major pairs."), risk: 1, rrMin: 2, rrMax: 3.5, rrTxt: "1:2 – 1:3.5", pairsTxt: T("Hacimde ilk 10", "Top 10 by volume"), pairs: byVol.slice(0, 10), tf: "1h", tfTxt: T("1s – 4s", "1h – 4h"), hold: T("≤ 3 gün", "≤ 3 days"), maxPos: 3 },
      lo: { name: T("Düşük risk", "Low risk"), lvl: 2, desc: T("Sakin. Sadece BTC ve ETH, uzun vade, az işlem.", "Calm. BTC and ETH only, long-term, few trades."), risk: 0.5, rrMin: 2.5, rrMax: 3, rrTxt: "1:2.5 – 1:3", pairsTxt: "BTC, ETH", pairs: ["BTC", "ETH"], tf: "4h", tfTxt: T("4s – 1g", "4h – 1D"), hold: T("≤ 2 hafta", "≤ 2 weeks"), maxPos: 2 },
      man: { name: T("Manuel", "Manual"), lvl: 0, desc: T("Pariteleri, vadeyi ve R:R'ı sen seç; sistem planını uygular.", "You pick pairs, horizon and R:R; the system executes your plan."), manual: true },
    };
    if (G.lang === "tr") Object.values(P).forEach((p) => p.rrTxt && (p.rrTxt = p.rrTxt.replace(/\./g, ",")));
  };
  const yours = T("senin seçimin", "your choice");

  const drawProfiles = () => {
    $("#profiles").innerHTML = Object.entries(P).map(([k, p]) => `<button type="button" class="prof ${k}" data-p="${k}" aria-pressed="${k === pick}">
      <h3><span class="dotc"></span>${p.name}</h3>
      <div class="meter">${[1, 2, 3, 4].map((i) => `<i class="${i <= p.lvl ? "on" : ""}"></i>`).join("")}</div>
      <p>${p.desc}</p>
      ${p.manual ? `<dl class="spec"><div><dt>${T("Parite", "Pairs")}</dt><dd>${yours}</dd></div><div><dt>${T("Vade", "Horizon")}</dt><dd>${yours}</dd></div><div><dt>R:R</dt><dd>${yours}</dd></div><div><dt>${T("Risk / işlem", "Risk / trade")}</dt><dd>${yours}</dd></div></dl>`
        : `<dl class="spec"><div><dt>${T("Risk / işlem", "Risk / trade")}</dt><dd>${fmt.pr(p.risk)}</dd></div><div><dt>R:R</dt><dd>${p.rrTxt}</dd></div><div><dt>${T("Parite", "Pairs")}</dt><dd>${p.pairsTxt}</dd></div><div><dt>${T("Zaman dilimi", "Timeframe")}</dt><dd>${p.tfTxt}</dd></div><div><dt>${T("Tutma süresi", "Holding time")}</dt><dd>${p.hold}</dd></div><div><dt>${T("Aynı anda", "Max open")}</dt><dd>${p.maxPos} ${T("pozisyon", "positions")}</dd></div></dl>`}
    </button>`).join("");
    $("#profiles").querySelectorAll("[data-p]").forEach((b) => (b.onclick = () => { pick = b.dataset.p; G.store.set("glance-prof", pick); drawProfiles(); }));
    $("#manual").hidden = pick !== "man";
    if (pick === "man" && !manual) manual = G.planPicker($("#picker"), { pairLimit: 16, value: { pairs: ["BTC", "SOL", "LINK"], horizon: "swing", rr: 2, risk: 1, maxPos: 3 }, onChange: drawSum });
    drawSum();
  };
  const cfg = () => {
    if (pick !== "man") return P[pick];
    const m = manual;
    return { name: P.man.name, risk: m.risk, rrMin: m.rr, rrMax: m.rr * 1.8, rrTxt: `${T("en az", "min")} ${fmt.rr(m.rr)}`, pairsTxt: m.pairs.join(", "), pairs: m.pairs, tf: G.HZ_TF[m.horizon], tfTxt: G.HZ_NAME[m.horizon], maxPos: m.maxPos };
  };
  function drawSum() {
    if (pick === "man" && !manual) return;
    const c = cfg();
    $("#sum").innerHTML = `<span>${T("Profil", "Profile")} <b>${c.name}</b></span><span>${T("Parite", "Pairs")} <b>${c.pairsTxt.length > 30 ? c.pairs.length : c.pairsTxt}</b></span><span>R:R <b>${c.rrTxt}</b></span><span>Risk <b>${fmt.pr(c.risk)} · ${fmt.usd(100 * c.risk, 0)} USDT</b></span><span>Stop <b>${T("zorunlu", "required")}</b></span>`;
  }

  // ---------- Running ----------
  let C, timer, sym, tf, positions, feed, bal, nDec, chartRef, bt = "pos", rt = "risk";
  const start = () => {
    C = cfg(); sym = C.pairs[0]; tf = C.tf; positions = []; feed = []; bal = 10000; nDec = 0;
    document.body.classList.add("term-page"); $("#main").classList.add("term-main");
    $("#setup").hidden = true; $("#run").hidden = false;
    $("#run-title").textContent = G.dataMode === "live" ? T(`${C.name} çalışıyor · paper · PnL gerçek OKX fiyatıyla`, `${C.name} running · paper · PnL on real OKX prices`) : T(`${C.name} çalışıyor · paper · simülasyon`, `${C.name} running · paper · simulated`);
    G.log.add({ mode: "algo", kind: "info", sym: "—", side: "", title: B(`Algo başlatıldı · ${C.name}`, `Algo started · ${C.name}`), why: B(`${C.pairs.length} parite, R:R ${C.rrTxt}, işlem başına ${100 * C.risk} USDT risk, en fazla ${C.maxPos} pozisyon.`, `${C.pairs.length} pairs, R:R ${C.rrTxt}, ${100 * C.risk} USDT risk per trade, max ${C.maxPos} positions.`), checks: [B("Profil kuralları yüklendi", "Profile rules loaded"), B("Stop zorunlu", "Stop required")] });
    push("info", "GLANCE", T(`Profil yüklendi: ${C.name}. ${C.pairs.length} parite taranıyor.`, `Profile loaded: ${C.name}. Scanning ${C.pairs.length} pairs.`));
    drawWatch(); drawTf(); drawChart(); drawBottom(); drawRight(); kpis();
    timer = setInterval(tick, 2200); setTimeout(tick, 600);
    window.scrollTo(0, 0);
  };
  const stop = () => {
    clearInterval(timer);
    G.log.add({ mode: "algo", kind: "info", sym: "—", side: "", title: B(`Algo durduruldu · ${C.name}`, `Algo stopped · ${C.name}`), why: B(`${positions.length} açık pozisyon stop ve hedef emirleriyle korunmaya devam ediyor.`, `${positions.length} open positions remain protected by their stop and target orders.`), checks: [B("Kullanıcı isteği", "User request")] });
    document.body.classList.remove("term-page"); $("#main").classList.remove("term-main");
    $("#run").hidden = true; $("#setup").hidden = false;
    G.toast(T("Algo durduruldu. Açık pozisyonların stopları yerinde.", "Algo stopped. Stops on open positions stay in place."));
  };
  $("#start").onclick = start; $("#stop").onclick = stop;

  const push = (k, s, txt) => { feed.unshift({ k, s, txt, t: new Date() }); feed = feed.slice(0, 60); nDec++; if (bt === "feed") drawBottom(); kpis(); };
  const atr = (d) => d.slice(-14).reduce((s, x) => s + (x.high - x.low), 0) / 14;
  const sideTxt = (s) => (s === "long" ? "Long" : "Short");

  let busy = false;
  const tick = async () => { if (busy) return; busy = true; try { await tickInner(); } finally { busy = false; } };
  const tickInner = async () => {
    // Live mode: marks follow the real OKX last price. Sample mode: a symmetric random walk.
    if (G.dataMode === "live") {
      await Promise.allSettled([...new Set(positions.map((p) => p.sym))].map(async (s) => {
        const d = await G.okx(`/api/v5/market/ticker?instId=${s}-USDT`, 3000);
        if (d[0] && +d[0].last > 0) G.coin(s).p = +d[0].last;
      }));
    }
    positions.forEach((p) => {
      if (G.dataMode === "live") p.mark = G.coin(p.sym).p;
      else p.mark *= 1 + (Math.random() - 0.5) * 0.004 * (C.risk + 0.5);
      if ((p.side === "long" && p.mark <= p.stop) || (p.side === "short" && p.mark >= p.stop)) p.close = "stop";
      if ((p.side === "long" && p.mark >= p.target) || (p.side === "short" && p.mark <= p.target)) p.close = "target";
    });
    positions.filter((p) => p.close).forEach((p) => {
      const pnl = p.close === "target" ? p.risk * p.rr : -p.risk; bal += pnl;
      const what = p.close === "target" ? T("Hedef", "Target") : "Stop";
      push(p.close === "target" ? "ok" : "no", p.sym, T(`${what} çalıştı · ${pnl > 0 ? "+" : ""}${fmt.usd(pnl, 0)} USDT`, `${what} hit · ${pnl > 0 ? "+" : ""}${fmt.usd(pnl, 0)} USDT`));
      G.log.add({ mode: "algo", kind: p.close === "target" ? "ok" : "no", sym: p.sym, side: p.side, title: B(`${C.name} · ${p.sym} ${p.close === "target" ? "hedef" : "stop"} ile kapandı`, `${C.name} · ${p.sym} closed at ${p.close}`), why: B(`Sonuç ${Math.round(pnl)} USDT. Plan dışına çıkılmadı.`, `Result ${Math.round(pnl)} USDT. The plan was followed.`), checks: [p.close === "target" ? B("Hedef emri doldu", "Target order filled") : B("Stop emri doldu", "Stop order filled")] });
    });
    positions = positions.filter((p) => !p.close);

    // New scan on real (or sample) candles.
    const s = C.pairs[Math.floor(Math.random() * C.pairs.length)], c = G.coin(s);
    const data = await G.getCandles(s, C.tf), last = c.live ? c.p : data.at(-1).close, d = atr(data) * (1.2 + Math.random());
    const side = (c.l >= 65 && c.f > 0.012) || c.c < -2 ? "short" : "long";
    const rr = +(C.rrMin * 0.75 + Math.random() * (C.rrMax - C.rrMin * 0.75)).toFixed(1);
    const r = Math.random();
    if (r < 0.35) push("info", s, T("Kurulum yok, bekleniyor.", "No setup, waiting."));
    else if (rr < C.rrMin) {
      push("no", s, T(`Reddedildi · R:R ${fmt.rr(rr)} < ${fmt.rr(C.rrMin)}`, `Rejected · R:R ${fmt.rr(rr)} < ${fmt.rr(C.rrMin)}`));
      if (Math.random() < 0.4) G.log.add({ mode: "algo", kind: "no", sym: s, side, title: B(`${C.name} · ${s} reddedildi`, `${C.name} · ${s} rejected`), why: B(`Hesaplanan R:R 1:${rr}, profil en az 1:${C.rrMin} istiyor. Emir gönderilmedi.`, `Computed R:R 1:${rr}, the profile requires at least 1:${C.rrMin}. No order sent.`), checks: [B("Stop tanımlı", "Stop set"), `✕ R:R 1:${rr} < 1:${C.rrMin}`] });
    } else if (positions.length >= C.maxPos) push("no", s, T(`Reddedildi · açık pozisyon ${positions.length}/${C.maxPos}`, `Rejected · open positions ${positions.length}/${C.maxPos}`));
    else if (positions.some((p) => p.sym === s)) push("info", s, T("Bu paritede zaten pozisyon var.", "Already in a position on this pair."));
    else {
      const risk = 100 * C.risk, fill = side === "long" ? last * 1.0005 : last * 0.9995, stopP = side === "long" ? last - d : last + d;
      const target = side === "long" ? fill + Math.abs(fill - stopP) * rr : fill - Math.abs(fill - stopP) * rr, qty = risk / Math.abs(fill - stopP);
      positions.push({ sym: s, side, entry: fill, mark: fill, stop: stopP, target, qty, risk, rr });
      push("ok", s, T(`${sideTxt(side)} açıldı · R:R ${fmt.rr(rr)} · risk ${fmt.usd(risk, 0)} USDT`, `${sideTxt(side)} opened · R:R ${fmt.rr(rr)} · risk ${fmt.usd(risk, 0)} USDT`));
      G.log.add({ mode: "algo", kind: "ok", sym: s, side, title: B(`${C.name} · ${s} ${side} açıldı`, `${C.name} · ${s} ${side} opened`), why: B(`Giriş ${fill.toPrecision(6)}, stop ${stopP.toPrecision(6)}, hedef ${target.toPrecision(6)}. Büyüklük risk ÷ (giriş − stop) ile hesaplandı.`, `Entry ${fill.toPrecision(6)}, stop ${stopP.toPrecision(6)}, target ${target.toPrecision(6)}. Size = risk ÷ (entry − stop).`), checks: [B("Stop tanımlı", "Stop set"), `R:R 1:${rr} ≥ 1:${C.rrMin}`, `Risk ${risk} USDT`, B(`Açık pozisyon ${positions.length}/${C.maxPos}`, `Open positions ${positions.length}/${C.maxPos}`)] });
      if (positions.length === 1 || s === sym) { sym = s; drawChart(); }
      drawWatch();
    }
    kpis(); if (bt === "pos") drawBottom(); if (rt === "risk") drawRight();
  };

  const upnl = (p) => (p.side === "long" ? p.mark - p.entry : p.entry - p.mark) * p.qty;
  const kpis = () => {
    const op = positions.reduce((s, p) => s + upnl(p), 0);
    $("#k-bal").textContent = fmt.usd(bal, 0) + " USDT";
    $("#k-pnl").innerHTML = `<span class="${G.cls(op)}">${op >= 0 ? "+" : ""}${fmt.usd(op, 2)}</span>`;
    $("#k-pos").textContent = `${positions.length}/${C.maxPos}`;
    $("#k-dec").textContent = nDec;
  };
  const drawWatch = () => {
    $("#w-n").textContent = `${C.pairs.length} ${T("parite", "pairs")}`;
    $("#watch").innerHTML = C.pairs.map((s) => { const c = G.coin(s); return `<tr data-s="${s}" class="${s === sym ? "sel" : ""}"><td><b>${s}</b>${positions.some((p) => p.sym === s) ? ` <span class="tag ok">${T("açık", "open")}</span>` : ""}</td><td class="num">${fmt.price(c.p)}</td><td class="num ${G.cls(c.c)}">${fmt.pct(c.c)}</td></tr>`; }).join("");
    $("#watch").querySelectorAll("[data-s]").forEach((tr) => (tr.onclick = () => { sym = tr.dataset.s; drawWatch(); drawChart(); drawRight(); }));
  };
  const drawTf = () => { $("#tf").innerHTML = ["15m", "1h", "4h", "1d"].map((t) => `<button type="button" class="chip" data-tf="${t}" aria-pressed="${t === tf}">${G.TF_LABEL[t]}</button>`).join(""); $("#tf").querySelectorAll("[data-tf]").forEach((b) => (b.onclick = () => { tf = b.dataset.tf; drawTf(); drawChart(); })); };
  const drawHead = () => { const c = G.coin(sym); $("#c-sym").textContent = c.inst; $("#c-px").innerHTML = `${fmt.price(c.p)} <span class="${G.cls(c.c)}">${fmt.pct(c.c)}</span>`; };
  const drawChart = () => {
    const p = positions.find((x) => x.sym === sym);
    drawHead();
    if (chartRef) chartRef.remove();
    chartRef = G.chart($("#chart"), sym, tf, p ? [[p.entry, "entry"], [p.stop, "stop"], [p.target, "target"]] : []);
  };
  document.addEventListener("glance:theme", () => { if (!$("#run").hidden) drawChart(); });
  document.addEventListener("glance:data", () => { if (!$("#run").hidden) { drawHead(); drawWatch(); if (rt === "ls") drawRight(); } });
  const drawBottom = () => {
    const box = $("#bbox");
    if (bt === "pos") {
      box.innerHTML = positions.length ? `<div class="table-wrap"><table class="dense"><thead><tr><th>${T("Parite", "Pair")}</th><th>${T("Yön", "Side")}</th><th class="num">${T("Giriş", "Entry")}</th><th class="num">Stop</th><th class="num">${T("Hedef", "Target")}</th><th class="num">R:R</th><th class="num">PnL</th></tr></thead><tbody>${positions.map((p) => { const u = upnl(p); return `<tr><td><b>${p.sym}</b></td><td class="${p.side === "long" ? "up" : "down"}">${sideTxt(p.side)}</td><td class="num">${fmt.price(p.entry)}</td><td class="num down">${fmt.price(p.stop)}</td><td class="num up">${fmt.price(p.target)}</td><td class="num">${fmt.rr(p.rr)}</td><td class="num ${G.cls(u)}">${u >= 0 ? "+" : ""}${fmt.usd(u, 2)}</td></tr>`; }).join("")}</tbody></table></div>` : `<p class="empty">${T("Açık pozisyon yok. Sistem kurulum arıyor.", "No open positions. The system is scanning for setups.")}</p>`;
    } else {
      box.innerHTML = `<ul class="feed">${feed.map((f, i) => `<li class="${i === 0 ? "new" : ""}"><time>${f.t.toLocaleTimeString(G.locale, { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}</time><span><span class="tag ${f.k}">${f.s}</span>${f.txt}</span></li>`).join("")}</ul>`;
    }
  };
  $("#btabs").querySelectorAll("[data-t]").forEach((b) => (b.onclick = () => { bt = b.dataset.t; $("#btabs").querySelectorAll("[data-t]").forEach((x) => x.setAttribute("aria-selected", x === b)); drawBottom(); }));
  const drawRight = () => {
    const box = $("#rbox"), c = G.coin(sym);
    if (rt === "risk") {
      const used = positions.reduce((s, p) => s + p.risk, 0), cap = C.maxPos * 100 * C.risk;
      box.innerHTML = `<div class="usage">
        <div class="bar-row"><header><span>${T("Açık risk", "Open risk")}</span><b class="mono">${fmt.usd(used, 0)} / ${fmt.usd(cap, 0)} USDT</b></header><div class="bar ${used / cap > 0.8 ? "warn" : ""}"><span style="width:${Math.min(100, (used / cap) * 100)}%"></span></div></div>
        <div class="bar-row"><header><span>${T("Pozisyon", "Positions")}</span><b class="mono">${positions.length} / ${C.maxPos}</b></header><div class="bar"><span style="width:${(positions.length / C.maxPos) * 100}%"></span></div></div>
        <dl class="spec"><div><dt>${T("Profil", "Profile")}</dt><dd>${C.name}</dd></div><div><dt>R:R</dt><dd>${C.rrTxt}</dd></div><div><dt>${T("Risk / işlem", "Risk / trade")}</dt><dd>${fmt.usd(100 * C.risk, 0)} USDT</dd></div><div><dt>${T("Zaman dilimi", "Timeframe")}</dt><dd>${C.tfTxt}</dd></div><div><dt>Stop</dt><dd>${T("zorunlu", "required")}</dd></div><div><dt>${T("API anahtarı", "API key")}</dt><dd>${T("çekim izni yok", "no withdrawals")}</dd></div></dl>
        <p class="faint" style="font-size:.8rem;margin:0">${T("Üst üste 3 API hatası olursa ya da kayıt zinciri bozulursa sistem kendini durdurur.", "The system halts itself after 3 consecutive API errors or if the log chain breaks.")}</p></div>`;
    } else if (rt === "liq") {
      box.innerHTML = `<div class="faint" style="font-size:.8rem;margin-bottom:6px">${c.s} · ${G.heatNote()}</div><div class="heat" id="heat" style="height:300px"></div><div class="heat-legend">${T("az", "low")}<i></i>${T("çok", "high")}</div>`;
      G.heatmap($("#heat"), sym);
    } else {
      box.innerHTML = `<div class="big-ls"><div class="bar2"><i style="width:${c.l}%">${fmt.pr(c.l)}</i><i style="width:${100 - c.l}%">${fmt.pr(100 - c.l)}</i></div></div><div class="table-wrap" style="margin-top:10px"><table class="dense"><thead><tr><th>${T("Parite", "Pair")}</th><th>L/S</th><th class="num">Funding</th></tr></thead><tbody>${C.pairs.slice(0, 12).map((s) => { const x = G.coin(s); return `<tr><td><b>${s}</b></td><td>${G.lsBar(x)}</td><td class="num ${G.cls(-x.f)}">${fmt.pct(x.f, 3)}</td></tr>`; }).join("")}</tbody></table></div>`;
    }
  };
  $("#rtabs").querySelectorAll("[data-t]").forEach((b) => (b.onclick = () => { rt = b.dataset.t; $("#rtabs").querySelectorAll("[data-t]").forEach((x) => x.setAttribute("aria-selected", x === b)); drawRight(); }));

  G.ready.then(() => { build(); if (!P[pick]) pick = "mid"; drawProfiles(); });
})();
