/* Decision log: each entry carries the hash of the previous one. The demo keeps it in localStorage. */
(function () {
  const G = window.G;
  // Küçük, senkron SHA-256 (demo amaçlı).
  const K = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
  G.sha256 = (str) => {
    const b = new TextEncoder().encode(str), l = b.length, n = ((l + 9 + 63) >> 6) << 6, m = new Uint8Array(n);
    m.set(b); m[l] = 0x80; const dv = new DataView(m.buffer); dv.setUint32(n - 4, l * 8); dv.setUint32(n - 8, Math.floor(l / 2 ** 29));
    let H = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
    const w = new Uint32Array(64), r = (x, k) => (x >>> k) | (x << (32 - k));
    for (let o = 0; o < n; o += 64) {
      for (let i = 0; i < 16; i++) w[i] = dv.getUint32(o + i * 4);
      for (let i = 16; i < 64; i++) { const s0 = r(w[i-15],7) ^ r(w[i-15],18) ^ (w[i-15] >>> 3), s1 = r(w[i-2],17) ^ r(w[i-2],19) ^ (w[i-2] >>> 10); w[i] = (w[i-16] + s0 + w[i-7] + s1) | 0; }
      let [a, bb, c, d, e, f, g, h] = H;
      for (let i = 0; i < 64; i++) { const t1 = (h + (r(e,6) ^ r(e,11) ^ r(e,25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) | 0, t2 = ((r(a,2) ^ r(a,13) ^ r(a,22)) + ((a & bb) ^ (a & c) ^ (bb & c))) | 0; h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = bb; bb = a; a = (t1 + t2) | 0; }
      H = H.map((v, i) => (v + [a, bb, c, d, e, f, g, h][i]) | 0);
    }
    return H.map((v) => (v >>> 0).toString(16).padStart(8, "0")).join("");
  };

  const KEY = "glance-log-v2";
  const body = (e) => JSON.stringify([e.id, e.t, e.mode, e.kind, e.sym, e.side, e.title, e.prev]);
  const seed = () => {
    const now = Date.now(), H = 3600e3, out = [];
    const B = G.B;
    const S = [
      [-30, "algo", "ok", "BTC", "long", B("Orta risk · BTC long açıldı", "Medium risk · BTC long opened"), B("Fiyat 4s trendin üstünde, R:R 1:2,6 ≥ 1:2. Büyüklük 0,021 BTC, risk 100 USDT.", "Price above the 4h trend, R:R 1:2.6 ≥ 1:2. Size 0.021 BTC, risk 100 USDT."), [B("Stop tanımlı", "Stop set"), "R:R 1:2.6 ≥ 1:2", B("Risk 100 ≤ 100 USDT", "Risk 100 ≤ 100 USDT"), B("Açık pozisyon 1/3", "Open positions 1/3")]],
      [-26, "algo", "no", "SUI", "long", B("Orta risk · SUI reddedildi", "Medium risk · SUI rejected"), B("Hesaplanan R:R 1:1,4, profil en az 1:2 istiyor. Emir gönderilmedi.", "Computed R:R 1:1.4, the profile requires at least 1:2. No order sent."), [B("Stop tanımlı", "Stop set"), "✕ R:R 1:1.4 < 1:2"]],
      [-20, "asistan", "ok", "ETH", "long", B("Asistan · ETH long onaylandı", "Assistant · ETH long approved"), B("Kullanıcı onayı ile gönderildi. Likidasyon kümesi altta, stop onun altına kondu.", "Sent after user approval. A liquidation cluster sits below; the stop was placed under it."), [B("Stop tanımlı", "Stop set"), "R:R 1:2.5 ≥ 1:2", "Risk 100 ≤ 100 USDT", B("Kullanıcı onayı", "User approval")]],
      [-9, "algo", "info", "BTC", "long", B("BTC stop girişe çekildi", "BTC stop moved to entry"), B("Fiyat 1R yol aldı, kural gereği stop giriş seviyesine taşındı.", "Price moved 1R; by rule the stop was moved to break-even."), [B("Kural: 1R sonrası başabaş", "Rule: break-even after 1R")]],
      [-3, "asistan", "no", "PEPE", "short", B("Asistan · PEPE iptal edildi", "Assistant · PEPE cancelled"), B("Kullanıcı öneriyi iptal etti. Emir gönderilmedi.", "The user cancelled the proposal. No order sent."), [B("Kullanıcı iptali", "User cancelled")]],
    ];
    let prev = "0".repeat(64);
    S.forEach(([h, mode, kind, sym, side, title, why, checks], i) => {
      const e = { id: i + 1, t: now + h * H, mode, kind, sym, side, title, why, checks, prev };
      e.hash = G.sha256(body(e)); prev = e.hash; out.push(e);
    });
    return out;
  };
  G.log = {
    all() { try { const v = JSON.parse(G.store.get(KEY)); if (Array.isArray(v) && v.length) return v; } catch {} const s = seed(); G.store.set(KEY, JSON.stringify(s)); return s; },
    add(e) {
      const all = G.log.all(), last = all.at(-1);
      Object.assign(e, { id: last.id + 1, t: Date.now(), prev: last.hash });
      e.hash = G.sha256(body(e)); all.push(e); G.store.set(KEY, JSON.stringify(all)); return e;
    },
    verify() { const all = G.log.all(); let prev = "0".repeat(64); for (const e of all) { if (e.prev !== prev || G.sha256(body(e)) !== e.hash) return { ok: false, at: e.id }; prev = e.hash; } return { ok: true, n: all.length, head: prev }; },
    reset() { G.store.set(KEY, ""); return G.log.all(); },
    tamper() { const all = G.log.all(); const e = all[1]; if (e) { e.title = typeof e.title === "object" ? { tr: e.title.tr + " ✎", en: e.title.en + " ✎" } : e.title + " ✎"; e.kind = "ok"; G.store.set(KEY, JSON.stringify(all)); } },
  };
})();
