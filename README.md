# GLANCE demo

Clickable demo of GLANCE, a two-mode AI trading agent (Assistant + Algo trading). English by default, Turkish via the TR button.
Orders never reach an exchange (paper trading).

## Run

- **Easiest:** double-click `GLANCE-ac.html`. No install needed.
- **With the local server (Node.js 18+):** double-click `baslat-windows.bat` on Windows, or run `npm start` and open http://localhost:3000.
  The server forwards market-data requests to OKX, so live data is most reliable this way.

## Data

| Data | Source |
|---|---|
| Price, 24h change, volume | OKX public API, refreshed every 20 s |
| Candles | OKX public API |
| Funding | OKX public API |
| Long/short account ratio | OKX public API (pairs without data show a faded estimate) |
| Liquidation heatmap | Estimated, modelled around the live price (a paid feed such as Coinglass in the real product) |

If OKX can't be reached, the demo falls back to sample data and the header shows **Sample data** instead of **Live · OKX**.
No API keys are used; only public, read-only endpoints.

## Pages

| Page | Content |
|---|---|
| `index.html` | Home: the two modes |
| `asistan.html` | Assistant: plan picker, agent chat, proposal card, approve / adjust / cancel |
| `algo.html` | Algo trading: High / Medium / Low risk and Manual profiles, live terminal after Start |
| `piyasa.html` | Long/short table, liquidation heatmap, funding |
| `kayit.html` | Hash-chained decision log with "Why?" details and chain verification |

Charts: TradingView Lightweight Charts (Apache 2.0), bundled in `public/vendor`.
