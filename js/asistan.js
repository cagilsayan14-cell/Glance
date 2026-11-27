(function () {
  const { fmt, esc, T, B } = G;
  const $ = (s) => document.querySelector(s);
  let sym = "ETH", tf = "1h", prop = null, reasons = [], orders = [], ready = false, plan, chartRef = null, rt = "ls";
  const side$ = (s) => (s === "long" ? "Long" : "Short");

  // ---- Chart ----
  const drawTf = () => { $("#tf").innerHTML = ["15m", "1h", "4h", "1d"].map((t) => `<button type="button" class="chip" data-tf="${t}" aria-pressed="${t === tf}">${G.TF_LABEL[t]}</button>`).join(""); $("#tf").querySelectorAll("[data-tf]").forEach((b) => (b.onclick = () => { tf = b.dataset.tf; drawTf(); drawChart(); })); };
  const drawHead = () => { const c = G.coin(sym); $("#c-sym").textContent = c.inst; $("#c-px").innerHTML = `${fmt.price(c.p)} <span class="${G.cls(c.c)}">${fmt.pct(c.c)}</span>`; };
  const drawChart = () => {
    drawHead();
    const lv = prop && prop.sym === sym ? [[prop.entry, "entry"], [prop.stop, "stop"], [prop.target, "target"]] : [];
    if (chartRef) chartRef.remove();
    chartRef = G.chart($("#chart"), sym, tf, lv);
  };
  document.addEventListener("glance:theme", drawChart);

  // ---- Right panel ----
  const drawRight = () => {
    const c = G.coin(sym), box = $("#rbox");
    if (rt === "ls") {
      box.innerHTML = `<div class="big-ls"><div class="faint" style="font-size:.8rem">${c.s} ${T("hesap oranı · 1s", "account ratio · 1h")}${c.lsLive ? " · OKX" : ""}</div><div class="bar2"><i style="width:${c.l}%">Long ${fmt.pr(c.l)}</i><i style="width:${100 - c.l}%">${fmt.pr(100 - c.l)} Short</i></div></div>
      <div class="table-wrap" style="margin-top:12px"><table class="dense"><thead><tr><th>${T("Parite", "Pair")}</th><th>L/S</th></tr></thead><tbody>${G.COINS.slice(0, 8).map((x) => `<tr><td><b>${x.s}</b></td><td>${G.lsBar(x)}</td></tr>`).join("")}</tbody></table></div>`;
    } else if (rt === "liq") {
      box.innerHTML = `<div class="heat" id="heat"></div><div class="heat-legend">${T("az", "low")}<i></i>${T("çok", "high")}</div><p class="faint" style="font-size:.8rem;margin:8px 0 0">${T("Parlak bantlar toplu likidasyon seviyeleri. Fiyat genelde bu bölgelere çekilir.", "Bright bands are clustered liquidation levels; price tends to be pulled toward them.")} ${G.heatNote()}.</p>`;
      G.heatmap($("#heat"), sym);
    } else {
      box.innerHTML = `<div class="mini-stats"><div><span>Funding (8h)</span><b class="${G.cls(-c.f)}">${fmt.pct(c.f, 3)}</b></div><div><span>${T("24s hacim", "24h volume")}</span><b>${fmt.big(c.v)} USDT</b></div></div>
      <div class="table-wrap" style="margin-top:12px"><table class="dense"><thead><tr><th>${T("Parite", "Pair")}</th><th class="num">Funding</th></tr></thead><tbody>${G.COINS.slice(0, 8).map((x) => `<tr><td><b>${x.s}</b></td><td class="num ${G.cls(-x.f)}">${fmt.pct(x.f, 3)}</td></tr>`).join("")}</tbody></table></div>`;
    }
  };
  $("#rtabs").querySelectorAll("[data-t]").forEach((b) => (b.onclick = () => { rt = b.dataset.t; $("#rtabs").querySelectorAll("[data-t]").forEach((x) => x.setAttribute("aria-selected", x === b)); drawRight(); }));
  document.addEventListener("glance:data", () => { drawHead(); if (rt !== "liq") drawRight(); });

  // ---- Chat ----
  const convo = $("#convo");
  const say = (html, who = "ai") => { const d = document.createElement("div"); d.className = "bubble " + (who === "ai" ? "mentor" : "user"); d.innerHTML = (who === "ai" ? "<small>GLANCE</small>" : "") + html; convo.append(d); convo.scrollTop = convo.scrollHeight; return d; };
  const idle = () => ($("#agent-state").textContent = T("hazır", "ready"));
  const think = (ms, fn) => { $("#agent-state").textContent = T("veriye bakıyor…", "reading data…"); const d = say('<span class="typing"><i></i><i></i><i></i></span>'); setTimeout(async () => { await fn(d); idle(); }, ms); };
  const quick = () => {
    const opts = plan.pairs.slice(0, 3).map((s) => [T(`${s} için plan çıkar`, `Plan a ${s} trade`), () => propose(s)]).concat([[T("Piyasa özeti", "Market summary"), summary], [T("Neden bu stop?", "Why this stop?"), whyStop]]);
    $("#quick").innerHTML = opts.map(([t], i) => `<button type="button" class="chip" data-q="${i}">${t}</button>`).join("");
    $("#quick").querySelectorAll("[data-q]").forEach((b) => (b.onclick = () => { say(esc(opts[b.dataset.q][0]), "user"); opts[b.dataset.q][1](); }));
  };

  const summary = () => think(900, (d) => {
    d.remove();
    const top = [...G.COINS].sort((a, b) => b.l - a.l).slice(0, 2), neg = G.COINS.filter((c) => c.f < 0).slice(0, 3);
    const best = [...G.COINS].sort((a, b) => b.c - a.c)[0];
    say(T(`Kalabalık en çok <b>${top[0].s}</b> (${fmt.pr(top[0].l)} long) ve <b>${top[1].s}</b> (${fmt.pr(top[1].l)}) tarafında. 24 saatin en güçlüsü <b>${best.s}</b> (${fmt.pct(best.c)}). Funding negatif olanlar: ${neg.map((c) => c.s).join(", ") || "yok"}. Birini seçersen giriş, stop ve hedefi hesaplarım.`,
      `The crowd leans hardest on <b>${top[0].s}</b> (${fmt.pr(top[0].l)} long) and <b>${top[1].s}</b> (${fmt.pr(top[1].l)}). Strongest over 24h: <b>${best.s}</b> (${fmt.pct(best.c)}). Negative funding: ${neg.map((c) => c.s).join(", ") || "none"}. Pick one and I'll compute entry, stop and target.`));
  });
  const whyStop = () => think(700, (d) => {
    d.remove();
    if (!prop) return say(T("Henüz bir öneri yok. Önce bir parite için plan çıkaralım.", "No proposal yet. Let's plan a pair first."));
    say(T(`Stop, son ${G.HZ_NAME[plan.horizon].toLowerCase()} mumlarının ortalama oynaklığının 1,5 katı uzakta ve ${prop.side === "long" ? "alttaki" : "üstteki"} likidasyon kümesinin ötesinde. Böylece sıradan bir iğne pozisyonu kapatmaz.`,
      `The stop sits 1.5× the average range of recent ${G.HZ_NAME[plan.horizon].toLowerCase()} candles away, beyond the liquidation cluster ${prop.side === "long" ? "below" : "above"}. An ordinary wick won't close the position.`));
  });

  // ---- Proposal engine (demo logic on real or sample candles) ----
  const atr = (d, n = 14) => d.slice(-n).reduce((s, x) => s + (x.high - x.low), 0) / n;
  const propose = (s) => {
    sym = s; prop = null; $("#proposal-slot").innerHTML = ""; drawChart(); drawRight();
    think(1200, async (d) => {
      const c = G.coin(s), data = await G.getCandles(s, G.HZ_TF[plan.horizon]); d.remove();
      const last = c.live ? c.p : data.at(-1).close, ema = data.slice(-50).reduce((a, x) => a + x.close, 0) / Math.min(50, data.length);
      const side = (c.l >= 65 && c.f > 0.012) || last < ema * 0.985 ? "short" : "long";
      const dist = atr(data) * 1.5, rr = Math.max(plan.rr, 2.5);
      const entry = last, stop = side === "long" ? entry - dist : entry + dist;
      const fill = side === "long" ? entry * 1.0005 : entry * 0.9995;
      const target = side === "long" ? fill + Math.abs(fill - stop) * rr : fill - Math.abs(fill - stop) * rr;
      const riskUsd = 100 * plan.risk, qty = riskUsd / Math.abs(fill - stop);
      prop = { sym: s, side, entry, stop, target, qty, riskUsd, rr: Math.abs(target - fill) / Math.abs(fill - stop), notional: qty * fill };
      const hz = G.HZ_NAME[plan.horizon].toLowerCase();
      reasons = side === "long"
        ? [T(`Fiyat ${hz} grafikte son 50 mumun ortalamasının üstünde.`, `Price is above the 50-candle average on the ${hz} chart.`),
           T(`Long/short ${fmt.pr(c.l)}/${fmt.pr(100 - c.l)}: kalabalık aşırı tek tarafa yığılmamış.`, `Long/short ${fmt.pr(c.l)}/${fmt.pr(100 - c.l)}: positioning isn't overcrowded.`),
           T("Alt tarafta likidasyon kümesi var; stop onun altında.", "There's a liquidation cluster below; the stop sits under it.")]
        : [T(`Hesapların ${fmt.pr(c.l)}'i long ve funding ${fmt.pct(c.f, 3)}: long tarafı kalabalık.`, `${fmt.pr(c.l)} of accounts are long and funding is ${fmt.pct(c.f, 3)}: the long side is crowded.`),
           T("Fiyat ortalamanın altında, momentum aşağı.", "Price is below its average; momentum points down."),
           T("Stop üstteki likidasyon kümesinin ötesinde.", "The stop sits beyond the liquidation cluster above.")];
      say(T(`<b>${c.s}</b> için bir ${side} kurulumu var. Detaylar grafiğin altında; onaylarsan emir paper hesaba gider.`, `There's a ${side} setup on <b>${c.s}</b>. Details are under the chart; approve and the order goes to the paper account.`));
      renderProp(); drawChart();
    });
  };

  const renderProp = () => {
    const p = prop, open = orders.filter((o) => o.state === "open").length;
    const checks = [[T("Stop tanımlı", "Stop set"), true], [`R:R ${fmt.rr(p.rr)} ≥ ${fmt.rr(plan.rr)}`, p.rr >= plan.rr - 0.01], [`Risk ${fmt.usd(p.riskUsd, 0)} ≤ ${fmt.usd(100 * plan.risk, 0)} USDT`, true], [T(`Açık pozisyon ${open}/${plan.maxPos}`, `Open positions ${open}/${plan.maxPos}`), open < plan.maxPos], [T("Kayma dahil", "Slippage included"), true]];
    const ok = checks.every((x) => x[1]);
    $("#proposal-slot").innerHTML = `<div class="proposal">
      <header><h3>${p.sym}/USDT · <span class="${p.side === "long" ? "up" : "down"}">${side$(p.side)}</span> · ${G.HZ_NAME[plan.horizon]}</h3><span class="badge ${ok ? "badge-ok" : "badge-bad"}">${ok ? T("Risk kapısı geçti", "Risk gate passed") : T("Risk kapısı reddetti", "Risk gate rejected")}</span></header>
      <div class="lv"><div class="en"><span>${T("Giriş", "Entry")}</span><b>${fmt.price(p.entry)}</b></div><div class="st"><span>Stop</span><b>${fmt.price(p.stop)}</b></div><div class="tg"><span>${T("Hedef", "Target")}</span><b>${fmt.price(p.target)}</b></div><div><span>R:R</span><b>${fmt.rr(p.rr)}</b></div></div>
      <div class="lv"><div><span>${T("Büyüklük", "Size")}</span><b>${fmt.qty(p.qty)} ${p.sym}</b></div><div><span>${T("Pozisyon", "Notional")}</span><b>${fmt.usd(p.notional, 0)} USDT</b></div><div><span>Risk</span><b>${fmt.usd(p.riskUsd, 0)} USDT</b></div><div><span>${T("Kazanç", "Reward")}</span><b class="up">+${fmt.usd(p.riskUsd * p.rr, 0)} USDT</b></div></div>
      <ul class="why">${reasons.map((r) => `<li>${r}</li>`).join("")}</ul>
      <div class="gate">${checks.map(([t, v]) => `<span class="${v ? "" : "no"}">${v ? "✓" : "✕"} ${t}</span>`).join("")}</div>
      <div class="actions">
        <button class="btn btn-primary" id="p-ok" ${ok ? "" : "disabled"}>${T("Onayla ve gönder", "Approve & send")}</button>
        <div class="segment" role="group" aria-label="R:R">${[2, 2.5, 3, 4].map((v) => `<button type="button" data-rr="${v}" aria-pressed="${Math.abs(p.rr - v) < 0.05}">${fmt.rr(v)}</button>`).join("")}</div>
        <button class="btn btn-ghost" id="p-no">${T("İptal", "Cancel")}</button>
      </div></div>`;
    $("#p-ok").onclick = approve;
    $("#p-no").onclick = () => {
      G.log.add({ mode: "asistan", kind: "no", sym: p.sym, side: p.side, title: B(`Asistan · ${p.sym} iptal edildi`, `Assistant · ${p.sym} cancelled`), why: B("Kullanıcı öneriyi iptal etti. Emir gönderilmedi.", "The user cancelled the proposal. No order sent."), checks: [B("Kullanıcı iptali", "User cancelled")] });
      prop = null; $("#proposal-slot").innerHTML = ""; drawChart(); say(T("Tamam, iptal ettim. Kayda da yazdım.", "Done, cancelled and logged."));
    };
    $("#proposal-slot").querySelectorAll("[data-rr]").forEach((b) => (b.onclick = () => {
      const rr = +b.dataset.rr, fill = p.side === "long" ? p.entry * 1.0005 : p.entry * 0.9995, d = Math.abs(fill - p.stop);
      p.target = p.side === "long" ? fill + d * rr : fill - d * rr; p.rr = rr;
      renderProp(); drawChart();
    }));
  };

  const approve = () => {
    const p = prop;
    orders.unshift({ ...p, state: "open" });
    G.log.add({ mode: "asistan", kind: "ok", sym: p.sym, side: p.side, title: B(`Asistan · ${p.sym} ${p.side} onaylandı`, `Assistant · ${p.sym} ${p.side} approved`),
      why: B(`Kullanıcı onayı ile paper hesaba gönderildi. Giriş ${p.entry}, stop ${p.stop.toPrecision(6)}, hedef ${p.target.toPrecision(6)}.`, `Sent to the paper account after user approval. Entry ${p.entry}, stop ${p.stop.toPrecision(6)}, target ${p.target.toPrecision(6)}.`),
      checks: [B("Stop tanımlı", "Stop set"), `R:R 1:${p.rr.toFixed(1)}`, `Risk ${Math.round(p.riskUsd)} USDT`, B("Kullanıcı onayı", "User approval")] });
    G.toast(T(`<b>${p.sym}</b> emri gönderildi · paper`, `<b>${p.sym}</b> order sent · paper`));
    say(T('Emir gönderildi. Stop ve hedef emirleri de bekliyor. Kararı <a href="kayit.html">karar kaydına</a> yazdım.', 'Order sent, with stop and target orders resting. I wrote the decision to the <a href="kayit.html">decision log</a>.'));
    prop = null; $("#proposal-slot").innerHTML = ""; drawQueue(); drawChart();
  };
  const drawQueue = () => {
    $("#q-count").textContent = orders.length ? `${orders.length} ${T("emir", orders.length > 1 ? "orders" : "order")}` : "";
    $("#queue").innerHTML = orders.length ? orders.map((o, i) => `<div class="q-item"><div class="meta"><b>${o.sym}/USDT · <span class="${o.side === "long" ? "up" : "down"}">${side$(o.side)}</span></b><small>${T("giriş", "entry")} ${fmt.price(o.entry)} · stop ${fmt.price(o.stop)} · ${T("hedef", "target")} ${fmt.price(o.target)}</small></div><div class="actions"><span class="badge ${o.state === "open" ? "badge-ok" : "badge-muted"}">${o.state === "open" ? T("açık", "open") : T("kapandı", "closed")}</span>${o.state === "open" ? `<button class="btn btn-sm btn-ghost" data-close="${i}">${T("Kapat", "Close")}</button>` : ""}</div></div>`).join("") : `<p class="empty">${T("Henüz onaylanan emir yok.", "No approved orders yet.")}</p>`;
    $("#queue").querySelectorAll("[data-close]").forEach((b) => (b.onclick = () => { const o = orders[b.dataset.close]; o.state = "closed"; G.log.add({ mode: "asistan", kind: "info", sym: o.sym, side: o.side, title: B(`Asistan · ${o.sym} elle kapatıldı`, `Assistant · ${o.sym} closed manually`), why: B("Kullanıcı pozisyonu piyasa fiyatından kapattı.", "The user closed the position at market."), checks: [B("Kullanıcı isteği", "User request")] }); drawQueue(); }));
  };

  $("#composer").onsubmit = (e) => {
    e.preventDefault();
    const v = $("#msg").value.trim(); if (!v) return; $("#msg").value = "";
    say(esc(v), "user");
    const hit = G.COINS.find((c) => new RegExp(`\\b${c.s}\\b`, "i").test(v));
    if (hit) return propose(hit.s);
    if (/özet|piyasa|durum|summary|market/i.test(v)) return summary();
    if (/stop|neden|why/i.test(v)) return whyStop();
    think(700, (d) => { d.remove(); say(T("Bir parite adı yazarsan (örn. BTC, SOL) veri üzerinden plan çıkarırım. Planın ayarları solda.", "Name a pair (e.g. BTC, SOL) and I'll build a plan from the data. Your plan settings are on the left.")); });
  };

  G.ready.then(() => {
    plan = G.planPicker($("#picker"), { pairLimit: 10, value: { pairs: ["BTC", "ETH", "SOL"], horizon: "swing", rr: 2, risk: 1, maxPos: 2 }, onChange: (st) => { if (!ready) return; tf = G.HZ_TF[st.horizon]; drawTf(); drawChart(); quick(); } });
    tf = G.HZ_TF[plan.horizon];
    ready = true; idle(); drawTf(); drawChart(); drawRight(); drawQueue(); quick();
    say(T(`Merhaba. Planın: <b>${plan.pairs.join(", ")}</b>, ${G.HZ_NAME[plan.horizon].toLowerCase()}, en az ${fmt.rr(plan.rr)}. Hangi parite için bakayım?`, `Hi. Your plan: <b>${plan.pairs.join(", ")}</b>, ${G.HZ_NAME[plan.horizon].toLowerCase()}, min ${fmt.rr(plan.rr)}. Which pair should I look at?`));
  });
})();
