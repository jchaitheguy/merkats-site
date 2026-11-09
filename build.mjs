import { marked } from "marked";
import { LANGUAGES, I18N } from "./i18n.mjs";
import { APP_STRINGS } from "./web/strings.mjs";
import { build as bundle } from "esbuild";
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, cpSync } from "node:fs";

const APP = ".";
mkdirSync("dist", { recursive: true });
for (const f of ["favicon.ico", "favicon.png", "apple-touch-icon.png", "appstore-badge.svg"]) {
  try { copyFileSync(f, `dist/${f}`); } catch {}
}

cpSync("images", "dist/images", { recursive: true });
cpSync("fonts", "dist/fonts", { recursive: true });

// Signed-in pages: one script and stylesheet, shared by every language.
mkdirSync("dist/assets", { recursive: true });
await bundle({ entryPoints: ["web/main.js"], bundle: true, minify: true, format: "iife", target: "es2020", outfile: "dist/assets/app.js", logLevel: "warning" });
copyFileSync("node_modules/leaflet/dist/leaflet.css", "dist/assets/leaflet.css");
copyFileSync("web/app.css", "dist/assets/app.css");
const PUBLIC_CONFIG = JSON.parse(readFileSync("public-config.json", "utf8")); // public by design: protected by database rules
const FEE_PERCENT = 10; // keep in step with PLATFORM_FEE_PERCENT on the Edge Functions

// BIMI brand logo — served at https://merkats.app/bimi/logo.svg, pointed at by
// the `default._bimi.merkats.app` DNS TXT record. SVG Tiny Portable/Secure.
mkdirSync("dist/bimi", { recursive: true });
try { copyFileSync("bimi-logo.svg", "dist/bimi/logo.svg"); } catch {}

// The animated Merkat — a DOM port of src/components/MeerkatLogo.js
// (blink + chew + a blade of grass grazed down out of the mouth and regrown).
const MEERKAT_CSS = `
.mk{position:relative;--s:120px}
.mk>div,.mk>.anim{position:absolute}
@keyframes mk-blink{0%,90%,100%{height:0}93%,96%{height:calc(var(--s)*0.15)}}
/* eyes glance around on the same 7s clock as the eating cycle -- both
   pupils move together (translate is screen-space, so it works the same
   whether the eye is positioned from the left or the right) */
@keyframes mk-look{
  0%,14.29%,85.71%,100%{transform:translate(0,0)}
  28.57%{transform:translate(calc(var(--s)*-0.018),calc(var(--s)*-0.012))}
  42.86%{transform:translate(calc(var(--s)*0.021),calc(var(--s)*0.006))}
  57.14%{transform:translate(0,calc(var(--s)*0.021))}
  71.43%{transform:translate(calc(var(--s)*-0.018),calc(var(--s)*0.012))}
}
/* jaw grinds in a small circle, panda-with-bamboo style, instead of a plain vertical open/close */
@keyframes mk-chew{
  0%,100%{transform:translate(calc(var(--s)*0.018),0) scale(1.05)}
  12.5%{transform:translate(calc(var(--s)*0.013),calc(var(--s)*0.013)) scale(1.15)}
  25%{transform:translate(0,calc(var(--s)*0.018)) scale(1.2)}
  37.5%{transform:translate(calc(var(--s)*-0.013),calc(var(--s)*0.013)) scale(1.1)}
  50%{transform:translate(calc(var(--s)*-0.018),0) scale(1)}
  62.5%{transform:translate(calc(var(--s)*-0.013),calc(var(--s)*-0.013)) scale(0.9)}
  75%{transform:translate(0,calc(var(--s)*-0.018)) scale(0.85)}
  87.5%{transform:translate(calc(var(--s)*0.013),calc(var(--s)*-0.013)) scale(0.95)}
}
/* 7s = exactly 7 chew beats (mk-chew/mk-stick run on a 1s loop), so every
   phase lands on a beat: quick regrow (beat 0), a held moment (beat 1), then
   4 beats of continuous eating -- each beat eases in (barely moves at first,
   then slides in quicker right at the end of that rotation) so it reads as
   one smooth retraction paced by the chewing, not a series of jumps -- then
   a beat of nothing before it springs back up. Ends fully at 0: no nub. */
@keyframes mk-graze{
  0%{height:0}
  14.29%{height:calc(var(--s)*0.22)}
  28.57%{height:calc(var(--s)*0.22);animation-timing-function:ease-in}
  42.86%{height:calc(var(--s)*0.165);animation-timing-function:ease-in}
  57.14%{height:calc(var(--s)*0.11);animation-timing-function:ease-in}
  71.43%{height:calc(var(--s)*0.055);animation-timing-function:ease-in}
  85.71%,100%{height:0}
}
/* the stick sways with the same rhythm as the jaw, like it's being tugged as it's chewed */
@keyframes mk-stick{0%,100%{transform:rotate(6deg)}25%{transform:rotate(9deg)}50%{transform:rotate(6deg)}75%{transform:rotate(3deg)}}
@keyframes mk-leaf{0%,12%,63%,100%{opacity:0}20%,57%{opacity:1}}
@media (prefers-reduced-motion:reduce){.mk .anim{animation:none!important}}
`;

// Not shown on any page for now. Call meerkat(size) in a page to bring it back.
const meerkat = (size) => `<div class="mk" style="--s:${size}px;width:${size}px;height:${size * 1.12}px" aria-label="Merkat">
  <div style="left:2%;top:20%;width:26%;height:26%;border-radius:50%;background:#B98A50"></div>
  <div style="right:2%;top:20%;width:26%;height:26%;border-radius:50%;background:#B98A50"></div>
  <div style="left:9%;top:16%;width:82%;height:72%;border-radius:44%;background:#D2A56B"></div>
  <div style="left:30%;top:50%;width:40%;height:36%;border-radius:50%;background:#F0DCBB"></div>
  <div style="left:19%;top:30%;width:24%;height:20%;border-radius:50%;background:#5E4327;opacity:.26"></div>
  <div style="right:19%;top:30%;width:24%;height:20%;border-radius:50%;background:#5E4327;opacity:.26"></div>
  <div style="left:24%;top:31%;width:18%;height:18%;border-radius:50%;background:#fff"></div>
  <div style="right:24%;top:31%;width:18%;height:18%;border-radius:50%;background:#fff"></div>
  <div class="anim" style="left:29%;top:35%;width:10%;height:10%;border-radius:50%;background:#241A0E;animation:mk-look 7s ease-in-out infinite"></div>
  <div class="anim" style="right:29%;top:35%;width:10%;height:10%;border-radius:50%;background:#241A0E;animation:mk-look 7s ease-in-out infinite"></div>
  <div class="anim" style="left:31%;top:36%;width:3.5%;height:3.5%;border-radius:50%;background:#fff;animation:mk-look 7s ease-in-out infinite"></div>
  <div class="anim" style="right:35%;top:36%;width:3.5%;height:3.5%;border-radius:50%;background:#fff;animation:mk-look 7s ease-in-out infinite"></div>
  <div class="anim" style="left:24%;top:31%;width:18%;height:0;border-radius:40%;background:#D2A56B;animation:mk-blink 4.6s infinite"></div>
  <div class="anim" style="right:24%;top:31%;width:18%;height:0;border-radius:40%;background:#D2A56B;animation:mk-blink 4.6s infinite"></div>
  <div style="left:16%;top:52%;width:14%;height:10%;border-radius:50%;background:#E79C93;opacity:.55"></div>
  <div style="right:16%;top:52%;width:14%;height:10%;border-radius:50%;background:#E79C93;opacity:.55"></div>
  <div style="left:44%;top:55%;width:12%;height:9%;border-radius:50%;background:#3B2A1B"></div>
  <div class="anim" style="left:38%;top:64%;width:24%;height:9%;overflow:hidden;animation:mk-chew 1s ease-in-out infinite">
    <div style="position:absolute;left:0;top:-70%;width:100%;height:200%;border-radius:50%;border:calc(var(--s)*0.02) solid #7A5A3A"></div>
  </div>
  <div class="anim" style="left:46%;top:72%;width:9%;height:calc(var(--s)*0.05);border-radius:45%;background:#6B3F26;animation:mk-chew 1s ease-in-out infinite"></div>
  <div class="anim" style="left:50%;bottom:30%;width:5%;height:0;transform-origin:bottom;animation:mk-graze 7s ease-in-out infinite,mk-stick 1s ease-in-out infinite;overflow:visible">
    <div style="position:absolute;bottom:0;width:100%;height:100%;border-radius:40%;background:#7FBF63"></div>
    <div class="anim" style="position:absolute;top:-6%;left:80%;width:130%;height:60%;border-radius:50%;background:#8FCE70;transform:rotate(28deg);animation:mk-leaf 7s infinite"></div>
  </div>
</div>`;

// Current language while building; set by the loop at the bottom.
let L = "en";
let T = I18N.en;
const prefix = (lang) => (lang === "en" ? "" : `/${lang}`);
const u = (path) => prefix(L) + path; // internal link in the current language

const nav = (active) => `<header class="nav">
  <a class="brand" href="${u("/")}"><img src="/images/logo.png" alt="" width="40" height="40">merkats</a>
  <nav>${[["/story.html", T.nav.story], ["/how-it-works.html", T.nav.how], ["/privacy.html", T.nav.privacy]].map(([h, t]) => `<a href="${u(h)}"${h === active ? ' aria-current="page"' : ""}>${t}</a>`).join("")}
  <a class="login" href="${u("/login.html")}"${active === "/login.html" ? ' aria-current="page"' : ""}>${T.nav.login}</a></nav>
</header>`;

const footerColumns = () => [
  [T.footer.support, [[T.footer.contact, u("/support.html")], [T.footer.request, u("/support.html#feature")], [T.footer.terms, u("/terms.html")], [T.footer.privacy, u("/privacy.html")]]],
  [T.footer.product, [[T.footer.host, u("/how-it-works.html#host")], [T.footer.ios, "https://apps.apple.com/us/app/merkats/id6806871553"], [T.footer.how, u("/how-it-works.html")], [T.footer.member, u("/login.html#signup")]]],
];
const INSTAGRAM_URL = "https://www.instagram.com/merka_ts/";
const CURRENCIES = [["usd", "$ USD"], ["eur", "€ EUR"], ["gbp", "£ GBP"]];
const select = (id, label, options, selected) => `<select id="${id}" aria-label="${label}">${options.map(([v, t]) => `<option value="${v}"${v === selected ? " selected" : ""}>${t}</option>`).join("")}</select>`;
const instagramIcon = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.3" cy="6.7" r="1" fill="currentColor" stroke="none"/></svg>`;
const footer = () => `<footer class="footer">
  <div class="cols">${footerColumns().map(([head, links]) => `<div><h4>${head}</h4><ul>${links.map(([t, h]) => `<li><a href="${h}"${h.startsWith("http") ? ' target="_blank" rel="noopener"' : ""}>${t}</a></li>`).join("")}</ul></div>`).join("")}</div>
  <a class="store-badge" href="https://apps.apple.com/us/app/merkats/id6806871553" target="_blank" rel="noopener" aria-label="${T.home.badge}"><img src="/appstore-badge.svg" alt="${T.home.badge}" width="150" height="50"></a>
  <div class="legal"><span>&copy; ${new Date().getFullYear()} Merkats</span>
    <div class="prefs">${select("pref-language", T.footer.language, LANGUAGES, L)}${select("pref-currency", T.footer.currency, CURRENCIES, "usd")}
      <a class="social" href="${INSTAGRAM_URL}" target="_blank" rel="noopener" aria-label="${T.footer.instagram}">${instagramIcon}</a></div>
  </div>
</footer>
<script>
(() => {
  const save = (key, value) => { try { localStorage.setItem("merkats." + key, value); } catch {} };
  // Language: go to the same page in the chosen language.
  const language = document.getElementById("pref-language");
  language.addEventListener("change", () => {
    save("language", language.value);
    let rest = location.pathname;
    for (const code of ${JSON.stringify(LANGUAGES.map(([c]) => c).filter((c) => c !== "en"))}) {
      if (rest === "/" + code || rest.startsWith("/" + code + "/")) rest = rest.slice(code.length + 1) || "/";
    }
    location.href = (language.value === "en" ? "" : "/" + language.value) + rest + location.hash;
  });
  // The back button can restore a changed select; this page's language wins.
  addEventListener("pageshow", () => { language.value = ${JSON.stringify(L)}; });
  // Signed in? The header's log-in link becomes a link to your account.
  try {
    const signedIn = Object.keys(localStorage).some((k) => k === "merkats.demo.session" || (k.startsWith("sb-") && k.endsWith("-auth-token")));
    if (signedIn) {
      const link = document.querySelector(".nav .login");
      link.textContent = ${JSON.stringify(T.nav.account)};
      link.href = ${JSON.stringify(u("/app.html"))};
    }
  } catch {}
  // Currency: remembered only, since the site doesn't show prices yet.
  const currency = document.getElementById("pref-currency");
  try { const v = localStorage.getItem("merkats.currency"); if (v && [...currency.options].some((o) => o.value === v)) currency.value = v; } catch {}
  currency.addEventListener("change", () => save("currency", currency.value));
})();
</script>`;

const SITE = "https://merkats.app";
const appHead = () => `<link rel="stylesheet" href="/assets/leaflet.css"><link rel="stylesheet" href="/assets/app.css">
<script>window.MERKATS = ${JSON.stringify({ t: APP_STRINGS[L], auth: { create: T.auth.create, welcome: T.auth.welcome }, lang: L, prefix: prefix(L), feePercent: FEE_PERCENT, config: PUBLIC_CONFIG }).replace(/</g, "\\u003c")};</script>
<script src="/assets/app.js" defer></script>`;
const shell = ({ title, body, path, hero = false, active = "", app = false }) => `<!doctype html>
<html lang="${T.htmlLang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<link rel="icon" href="/favicon.png" type="image/png">
<link rel="alternate icon" href="/favicon.ico" sizes="any">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
${app ? appHead() : ""}
<title>${title}</title>
${LANGUAGES.map(([c]) => `<link rel="alternate" hreflang="${I18N[c].htmlLang}" href="${SITE}${prefix(c)}${path}">`).join("\n")}
<link rel="alternate" hreflang="x-default" href="${SITE}${path}">
${L === "en" ? `<script>try { const s = localStorage.getItem("merkats.language"); if (${JSON.stringify(LANGUAGES.map(([c]) => c).filter((c) => c !== "en"))}.includes(s)) location.replace("/" + s + location.pathname + location.hash); } catch {}</script>` : ""}
<style>
  /* Self-hosted so visitors make no request to a third party. Regular weight
     only, so browsers shouldn't fake a bold. */
  @font-face { font-family: "IM Fell Great Primer"; src: url("/fonts/IMFellGreatPrimer_400Regular.ttf") format("truetype"); font-style: normal; font-display: swap; }
  :root { color-scheme: light; }
  /* The typeface has no Chinese glyphs, so Chinese uses a matching serif. */
  html[lang^="zh"] body { font-family: "IM Fell Great Primer", "Songti SC", "Noto Serif CJK SC", "Source Han Serif SC", SimSun, Georgia, serif; }
  html[lang^="zh"] .q h2 { max-width: 12em; line-height: 1.25; }
  .notice { font-size: 18px; color: #6E7D71; border-left: 3px solid #C77D7D; padding-left: 12px; margin: 0 0 22px; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #E5EEE4; color: #33403A;
    font: 21px/1.55 "IM Fell Great Primer", Georgia, "Times New Roman", serif; font-synthesis: none;
    -webkit-font-smoothing: antialiased; }
  a { color: #A85F5F; }
  ${MEERKAT_CSS}
  .page { max-width: 780px; margin: 0 auto; padding: 108px 22px 72px; }
  /* footer */
  .footer { background: #DCE8DB; border-top: 1px solid rgba(110,125,113,.25); padding: 44px max(24px, env(safe-area-inset-left)) 26px;
    font-size: 19px; scroll-snap-align: end; }
  .footer .cols, .footer .legal { max-width: 1040px; margin: 0 auto; }
  .footer .cols { display: grid; grid-template-columns: repeat(2, 1fr); gap: 28px; }
  .footer h4 { font-size: 21px; font-weight: 400; color: #33403A; margin: 0 0 12px; }
  .footer ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 9px; }
  .footer a { color: #4d5c54; text-decoration: none; }
  .footer a:hover { color: #33403A; text-decoration: underline; }
  .footer .legal { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 8px 20px; margin-top: 32px; padding-top: 18px;
    border-top: 1px solid rgba(110,125,113,.25); font-size: 17px; color: #6E7D71; }
  .footer .store-badge { display: block; max-width: 1040px; margin: 26px auto 0; }
  .footer .store-badge img { display: block; height: 46px; width: auto; }
  .footer .legal { align-items: center; }
  .footer .prefs { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; }
  .footer select { font: inherit; color: #4d5c54; border: 1px solid rgba(110,125,113,.45); border-radius: 9px; cursor: pointer;
    padding: 6px 34px 6px 14px; appearance: none; -webkit-appearance: none;
    background: transparent url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' fill='none' stroke='%234d5c54' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M1 1.5l5 5 5-5'/%3E%3C/svg%3E") no-repeat right 13px center; }
  .footer .social { display: flex; padding: 4px; color: #4d5c54; }
  .footer .social:hover { color: #33403A; }
  #host, .help { scroll-margin-top: 130px; }
  .help { background: #fff; border-radius: 14px; padding: 18px 20px; margin-top: 14px; box-shadow: 0 1px 3px rgba(51,64,58,.08); }
  .doc .help h2 { margin: 0 0 4px; font-size: 26px; }
  .help p { margin: 0 0 12px; }
  .help .cta { display: inline-block; background: #C77D7D; color: #fff; text-decoration: none; padding: 9px 16px; border-radius: 10px; }
  .help .cta:hover { background: #b56c6c; }
  .help-mail { margin-top: 18px; text-align: center; font-size: 18px; }
  @media (max-width: 640px) { .footer .cols { grid-template-columns: 1fr; gap: 0; }
    .footer .cols > div { padding: 18px 0; border-bottom: 1px solid rgba(110,125,113,.25); } .footer .cols > div:first-child { padding-top: 0; }
    .footer .cols > div:last-child { border-bottom: 0; } .footer .legal { margin-top: 6px; } }
  /* top nav */
  .nav { position: fixed; top: 0; left: 0; right: 0; z-index: 10; display: flex; align-items: center;
    justify-content: space-between; padding: 12px max(24px, env(safe-area-inset-left));
    background: rgba(229,238,228,.86); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
    border-bottom: 1px solid rgba(110,125,113,.15); }
  .nav nav { display: contents; }
  .nav .brand { display: flex; align-items: center; gap: 8px; text-decoration: none; color: #33403A; font-size: 28px; line-height: 1.2; font-weight: 700; font-synthesis: weight; }
  .nav nav a { color: #4d5c54; text-decoration: none; font-size: 20px; padding: 6px 12px; border-radius: 9px; white-space: nowrap; }
  .nav nav a:hover, .nav nav a[aria-current] { background: rgba(110,125,113,.14); color: #33403A; }
  .nav nav a.login { background: #C77D7D; color: #fff; }
  .nav nav a.login:hover { background: #b56c6c; }
  /* Phones: name on its own row, then the links spread across the next. */
  @media (max-width: 760px) {
    .nav { flex-wrap: wrap; gap: 4px 0; padding: 8px 12px; }
    .nav .brand { flex: 0 0 100%; justify-content: center; font-size: 24px; }
    .nav .brand img { width: 32px; height: 32px; }
    .nav nav a { font-size: 15px; padding: 5px 7px; }
    .page { padding-top: 118px !important; }
    .q { padding-top: 118px !important; }
  }
  /* Very narrow phones can wrap the links onto a second row. */
  @media (max-width: 340px) { .page, .q { padding-top: 150px !important; } }
  /* home: one question per screen */
  html.snap { scroll-snap-type: y mandatory; }
  .q { position: relative; min-height: 100vh; min-height: 100svh; scroll-snap-align: start; display: flex; flex-direction: column;
    align-items: center; justify-content: center; text-align: center; gap: 16px;
    padding: 90px max(28px, env(safe-area-inset-left)) 60px; }
  .q:nth-child(even) { background: #DCE8DB; }
  .q h2 { font-size: clamp(30px, 6vw, 52px); line-height: 1.12;
    margin: 0; max-width: 16ch; }
  .q p { font-size: clamp(21px, 2.6vw, 26px); color: #5b6b62; max-width: 32rem; margin: 0; }
  .q .cta { background: #C77D7D; color: #fff; text-decoration: none; padding: 12px 22px;
    border-radius: 12px; }
  .q .badge img { display: block; height: 52px; width: auto; }
  .hint { position: absolute; bottom: 26px; left: 0; right: 0; color: #6E7D71;
    font-size: 17px; animation: bob 2s ease-in-out infinite; }
  @keyframes bob { 0%,100% { transform: translateY(0) } 50% { transform: translateY(6px) } }
  .reveal > * { opacity: 0; transform: translateY(24px); transition: opacity .7s ease, transform .7s ease; }
  .reveal.in > * { opacity: 1; transform: none; }
  .reveal.in > *:nth-child(2) { transition-delay: .12s } .reveal.in > *:nth-child(3) { transition-delay: .24s }
  .reveal.in > *:nth-child(4) { transition-delay: .36s } .reveal.in > *:nth-child(5) { transition-delay: .48s }
  @media (prefers-reduced-motion: reduce) { .reveal > * { opacity: 1; transform: none; transition: none; } .hint { animation: none; } }
  /* home: line drawings that sketch themselves when a section comes into view */
  .sk { height: clamp(170px, 32vh, 300px); width: auto; max-width: 100%; fill: none; stroke: #044836; stroke-width: 3.5;
    stroke-linecap: round; stroke-linejoin: round; filter: url(#sk-rough); overflow: visible; }
  .sk .accent { stroke: #C77D7D; }
  .sk path { stroke-dasharray: 1 1; stroke-dashoffset: 1; opacity: 0; }
  .in .sk path { animation: sk-draw var(--t) ease-in-out var(--d) forwards; }
  @keyframes sk-draw { from { opacity: 1; stroke-dashoffset: 1; } to { opacity: 1; stroke-dashoffset: 0; } }
  @media (prefers-reduced-motion: reduce) { .sk path { opacity: 1; stroke-dashoffset: 0; } .in .sk path { animation: none; } }
  .sk-logo { filter: none; }
  .sk image { opacity: 0; }
  .in .sk image { animation: sk-fade var(--t) linear var(--d) forwards; }
  @keyframes sk-fade { to { opacity: 1; } }
  @media (prefers-reduced-motion: reduce) { .sk image { opacity: 1; } .in .sk image { animation: none; } }
  .q .actions { display: flex; flex-direction: column; align-items: center; gap: 6px; margin-top: 14px; }
  /* how it works */
  .doc ol { padding-left: 1.3em; margin: 24px 0 0; display: grid; gap: 14px; }
  .doc ol li { margin: 0 0 12px; padding: 14px 18px; background: #fff; border-radius: 14px; box-shadow: 0 1px 3px rgba(51,64,58,.08); }
  .doc ol strong { display: block; font-size: 24px; margin-bottom: 2px; color: #33403A; }
  /* story photos */
  .doc figure { margin: 22px 0; }
  .doc figure img, .photos img { display: block; width: 100%; border-radius: 14px; }
  .doc figcaption { font-size: 17px; color: #6E7D71; margin-top: 6px; text-align: center; }
  .photos { display: grid; gap: 10px; margin: 22px 0; }
  .photos.two { grid-template-columns: 1fr 1fr; } .photos.three { grid-template-columns: repeat(3, 1fr); }
  .photos img { height: 100%; object-fit: cover; } .photos.two img { aspect-ratio: 4/5; } .photos.three img { aspect-ratio: 1; }
  /* login */
  .auth { text-align: center; }
  .doc .auth h1 { font-size: clamp(44px, 9vw, 64px); line-height: 1.08; margin: 10px 0 0; }
  .auth form { display: grid; gap: 12px; max-width: 400px; margin: 24px auto 0; text-align: left; background: #fff;
    border-radius: 14px; padding: 18px; box-shadow: 0 1px 3px rgba(51,64,58,.08); }
  .auth form[hidden] { display: none; }
    .auth .req { color: #A85F5F; }
  .auth .row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .auth .fine { font-size: 16px; line-height: 1.45; color: #6E7D71; margin: 0; }
  .auth .fine a { color: #A85F5F; }
  .auth label { font-size: 17px; color: #4d5c54; display: grid; gap: 5px; }
  .auth input { font: inherit; padding: 12px 14px; border-radius: 12px; border: 1px solid #c4d4c8;
    background: #fff; color: #33403A; }
  .auth input:focus { outline: 2px solid #C77D7D; outline-offset: 1px; border-color: transparent; }
  .auth button { font: inherit; padding: 12px; border: 0; border-radius: 12px;
    background: #C77D7D; color: #fff; cursor: pointer; }
  .auth button:hover { background: #b56c6c; }
  .auth button.outline { background: transparent; color: #A85F5F; box-shadow: inset 0 0 0 1.5px #C77D7D; }
  .auth button.outline:hover { background: #f7ecec; }
  .auth .note { font-size: 17px; color: #6E7D71; text-align: center; margin: 0; }
  .auth .note:empty { display: none; }
  /* home */
  .hero { min-height: 90vh; display: flex; flex-direction: column; align-items: center;
    justify-content: center; text-align: center; gap: 14px;
    padding-left: max(24px, env(safe-area-inset-left));
    padding-right: max(24px, env(safe-area-inset-right)); }
  @media (max-width: 600px) { .hero { padding-left: max(28px, env(safe-area-inset-left));
    padding-right: max(28px, env(safe-area-inset-right)); } }
  .hero h1 { font-size: 34px; margin: 6px 0 0; }
  .hero p { color: #5b6b62; max-width: 30rem; margin: 0; }
  .hero .links { display: flex; gap: 12px; flex-wrap: wrap; justify-content: center; margin-top: 10px; }
  .hero .links a { background: #C77D7D; color: #fff; text-decoration: none;
    padding: 11px 20px; border-radius: 12px; }
  .hero .mail { color: #6E7D71; font-size: 14px; }
  .hero .badge { display: inline-block; margin-top: 6px; }
  .hero .badge img { display: block; height: 52px; width: auto; }
  /* legal docs — no card, plain on the ground */
  .doc h1 { font-size: 44px; line-height: 1.15; margin: 0 0 8px; }
  .doc h2 { font-size: 30px; line-height: 1.2; margin: 30px 0 8px; }
  .doc h3 { font-size: 24px; margin: 22px 0 6px; }
  .doc p, .doc li { color: #3d4a44; }
  .doc em { color: #6E7D71; font-style: normal; font-size: 18px; }
  .doc hr { border: none; border-top: 1px solid #cdddd2; margin: 26px 0; }
  .doc code { background: #dce8de; padding: 1px 5px; border-radius: 4px; font-size: 90%; }
  .back { display: inline-block; color: #6E7D71; text-decoration: none;
    font-size: 14px; margin-bottom: 22px; }
</style>
</head>
<body>
${nav(active)}
${hero ? body : `<div class="page doc">${body}</div>`}
${footer()}
</body>
</html>`;

const md = (f) => marked.parse(readFileSync(`${APP}/${f}`, "utf8"));

// Live on the App Store as of 2026-09-12. Badge is Apple's own official
// artwork (tools.applemediaservices.com badge generator) — don't recolor
// or reshape it, per their marketing guidelines.
const APP_STORE_URL = "https://apps.apple.com/us/app/merkats/id6806871553";

// Hand-drawn line scenes for the home page. Strokes draw one after another,
// starting when a section scrolls into view, and every scene runs SKETCH_SECONDS.
// A stroke is a path, or ["accent", path] for the rose colour.
const SKETCH_SECONDS = 4.4;
const circle = (cx, cy, r) => `M${cx - r} ${cy} a${r} ${r} 0 1 0 ${2 * r} 0 a${r} ${r} 0 1 0 ${-2 * r} 0`;
const SCENES = [
  // Eat out, cook for yourself, or someone cooks for you
  [
    "M22 134 L22 186 Q22 196 32 196 L112 196 Q122 196 122 186 L122 134 Z", "M22 165 L122 165",
    ["accent", "M32 134 Q44 112 58 134"], ["accent", "M60 134 Q72 106 84 134"], ["accent", "M88 134 Q100 116 112 134"],
    "M16 96 L16 88 Q16 78 26 78 L118 78 Q128 78 128 88 L128 96 Z",
    "M148 132 Q150 160 176 160 L216 160 Q234 160 236 132 Z", "M236 136 L276 124",
    ["accent", "M170 198 Q160 184 174 172 Q176 184 184 182 Q190 176 186 166 Q206 182 198 198 Q184 206 170 198"],
    "M172 118 Q162 104 174 92 Q184 80 174 66", "M204 118 Q194 104 206 92 Q216 80 206 66",
    "M284 186 Q336 200 392 186", "M294 180 Q296 116 338 116 Q380 116 382 180", circle(338, 108, 8),
    ["accent", "M338 76 C326 60 306 74 338 96 C370 74 350 60 338 76"],
  ],
  // Strangers around one pot, saying hi
  [
    "M70 196 L330 196", "M100 196 L90 236", "M300 196 L310 236",
    circle(60, 92, 21), "M26 196 Q28 128 60 124 Q92 128 94 196",
    circle(340, 92, 21), "M306 196 Q308 128 340 124 Q372 128 374 196",
    "M164 142 L170 192 L230 192 L236 142 Z", "M154 142 L246 142", "M164 156 L148 156", "M236 156 L252 156",
    "M90 156 Q118 170 150 132", "M150 132 L180 92", "M310 156 Q282 170 250 150",
    "M190 126 Q182 112 192 100", "M214 126 Q206 112 216 100",
    ["accent", "M92 42 Q92 20 122 20 L152 20 Q174 20 174 42 Q174 62 152 62 L122 62 L102 78 L106 60 Q92 56 92 42"],
    ["accent", "M118 32 L118 52 M118 42 Q128 34 134 42 L134 52"], ["accent", "M150 40 L150 52 M150 30 L150 32"],
  ],
  // Following a recipe: tick each step, then mix it in the bowl
  [
    "M44 28 L184 28 Q194 28 194 38 L194 214 Q194 224 184 224 L44 224 Q34 224 34 214 L34 38 Q34 28 44 28 Z", "M58 56 L140 56",
    "M58 82 L78 82 L78 102 L58 102 Z", "M92 92 L176 92", ["accent", "M62 92 L67 98 L76 84"],
    "M58 124 L78 124 L78 144 L58 144 Z", "M92 134 L176 134", ["accent", "M62 134 L67 140 L76 126"],
    "M58 166 L78 166 L78 186 L58 186 Z", "M92 176 L176 176", ["accent", "M62 176 L67 182 L76 168"],
    ["accent", "M208 122 Q226 108 246 120"], ["accent", "M236 110 L247 120 L234 128"],
    "M254 146 L398 146", "M262 146 Q264 216 326 216 Q388 216 390 146", "M300 216 L352 216",
    "M336 144 L372 62", circle(378, 50, 13),
    ["accent", "M286 164 Q306 154 326 166 Q346 178 366 164"],
  ],
  // A chef's hat, and getting paid to lead
  [
    "M46 222 L354 222",
    "M92 138 Q50 138 50 100 Q50 62 90 68 Q98 30 146 30 Q192 30 202 68 Q244 62 244 100 Q244 138 202 138",
    "M92 138 L92 196 Q147 206 202 196 L202 138", "M92 168 Q147 178 202 168", "M124 78 L124 118", "M170 78 L170 118",
    "M262 208 a34 12 0 1 0 68 0 a34 12 0 1 0 -68 0", "M262 208 L262 186", "M330 208 L330 186", "M262 186 a34 12 0 1 0 68 0 a34 12 0 1 0 -68 0",
    "M262 186 L262 164", "M330 186 L330 164", "M262 164 a34 12 0 1 0 68 0 a34 12 0 1 0 -68 0",
    ["accent", circle(296, 74, 26)], ["accent", "M306 64 Q296 54 286 64 Q282 74 296 75 Q310 76 306 86 Q296 96 286 86"], ["accent", "M296 50 L296 98"],
    ["accent", "M296 112 L296 134"],
  ],
];
const sketch = (strokes, label) => {
  const list = strokes.map((st) => (Array.isArray(st) ? { accent: true, d: st[1] } : { d: st }));
  const total = list.reduce((sum, { d }) => sum + d.length, 0);
  let start = 0;
  const paths = list.map(({ d, accent }) => {
    const time = (SKETCH_SECONDS * d.length) / total;
    const path = `<path d="${d}" pathLength="1"${accent ? ' class="accent"' : ""} style="--d:${start.toFixed(2)}s;--t:${time.toFixed(2)}s"/>`;
    start += time;
    return path;
  });
  return `<svg class="sk" viewBox="0 0 400 244" role="img" aria-label="${label}">${paths.join("")}</svg>`;
};

// The closing sketch redraws the real logo. logo-sketch.json holds its traced
// lines; the original image fades in over them as the last step, so the finished
// drawing is exactly the logo.
const logoSketch = (label) => {
  const { width, height, lineWidth, strokes } = JSON.parse(readFileSync("logo-sketch.json", "utf8"));
  const FADE = 0.3;
  const drawing = SKETCH_SECONDS - FADE;
  const total = strokes.reduce((sum, st) => sum + st.len, 0);
  let start = 0;
  const paths = strokes.map(({ d, len }) => {
    const time = (drawing * len) / total;
    const path = `<path d="${d}" pathLength="1" style="--d:${start.toFixed(2)}s;--t:${time.toFixed(2)}s"/>`;
    start += time;
    return path;
  });
  return `<svg class="sk sk-logo" viewBox="0 0 ${width} ${height}" style="stroke-width:${lineWidth * 0.85}" role="img" aria-label="${label}">${paths.join("")}<image href="/images/logo-large.png" width="${width}" height="${height}" style="--d:${drawing.toFixed(2)}s;--t:${FADE}s"/></svg>`;
};

const home = () => {
  const h = T.home;
  const hint = `<span class="hint">${h.scroll} &darr;</span>`;
  const q = (n, title, rest) => `<section class="q reveal">
  ${sketch(SCENES[n - 1], h.sketches[n - 1])}
  <h2>${title}</h2>
  ${rest}
  ${hint}
</section>`;
  return `<main>
${q(1, h.q1, `<p>${h.chips.join(" ")}</p>`)}
${q(2, h.q2, `<p>${h.q2p}</p>`)}
${q(3, h.q3, `<p>${h.q3p}</p>`)}
${q(4, h.q4, `<p>${h.q4p}</p>`)}
<section class="q reveal">
  ${logoSketch(h.sketches[4])}
  <h2>${h.end}</h2>
  <div class="actions"><a class="cta" href="${u("/how-it-works.html")}">${h.cta}</a></div>
</section>
<svg width="0" height="0" style="position:absolute" aria-hidden="true"><filter id="sk-rough"><feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="4"/><feDisplacementMap in="SourceGraphic" scale="3"/></filter></svg>
</main>
<script>
document.documentElement.classList.add("snap");
const io = new IntersectionObserver((es) => es.forEach((e) => e.target.classList.toggle("in", e.isIntersecting)), { threshold: 0.35 });
document.querySelectorAll(".reveal").forEach((el) => io.observe(el));
</script>`;
};

const support = () => {
  const t = T.support;
  const card = (id, title, body, btn, subject) => `<section class="help" id="${id}"><h2>${title}</h2><p>${body}</p>
    <a class="cta" href="mailto:support@merkats.app?subject=${encodeURIComponent(subject)}">${btn}</a></section>`;
  return `<h1>${t.title}</h1><p>${t.intro}</p>
  ${card("contact", t.contactTitle, t.contactBody, t.contactBtn, "Support request")}
  ${card("feature", t.featureTitle, t.featureBody, t.featureBtn, "Feature request")}
  ${card("abuse", t.abuseTitle, t.abuseBody, t.abuseBtn, "Abuse report")}
  <p class="help-mail"><a href="mailto:support@merkats.app">support@merkats.app</a></p>`;
};

const field = (label, attrs) => `<label><span>${label} <span class="req">*</span></span><input ${attrs} required></label>`;
const login = () => {
  const a = T.auth;
  const s = APP_STRINGS[L].auth;
  const link = (path, text) => `<a href="${u(path)}">${text}</a>`;
  const role = (value, label, desc, checked) => `<label class="role-option"><input type="radio" name="role" value="${value}"${checked ? " checked" : ""}><span><strong>${label}</strong><small class="muted">${desc}</small></span></label>`;
  return `<div class="auth">
  <h1 id="auth-title">${a.welcome}</h1>
  <form id="signin">
    ${field(s.identifier, `name="username" placeholder="${a.username}" autocomplete="username" autocapitalize="none"`)}
    ${field(a.password, `name="password" type="password" placeholder="${a.password}" autocomplete="current-password"`)}
    <p class="note" role="status"></p>
    <div class="row"><button type="submit">${a.login}</button><button type="button" class="outline" id="to-signup">${a.signup}</button></div>
  </form>
  <form id="signup" hidden>
    <fieldset><legend>${s.roleQ}</legend>${role("member", s.member, s.memberDesc, true)}${role("host", s.host, s.hostDesc, false)}</fieldset>
    ${field(a.name, `name="name" placeholder="${a.name}" autocomplete="name"`)}
    ${field(a.usernameUnique, `name="username" placeholder="${a.username}" autocomplete="username" autocapitalize="none"`)}
    ${field(a.email, `name="email" type="email" placeholder="${a.email}" autocomplete="email" autocapitalize="none"`)}
    ${field(a.password, `name="password" type="password" placeholder="${a.passwordMin}" autocomplete="new-password" minlength="6"`)}
    <p class="fine">${a.optional}</p>
    <p class="fine">${a.agree(link("/terms.html", a.termsLink), link("/privacy.html", a.privacyLink))}</p>
    <p class="note" role="status"></p>
    <div class="row"><button type="button" class="outline" id="to-signin">${a.back}</button><button type="submit">${a.createBtn}</button></div>
  </form>
</div>`;
};

// English originals use the plain filename; translations add the language code.
const localized = (name) => md(L === "en" ? `${name}.md` : `${name}.${L}.md`);
// Terms and Privacy are English only, under a translated note.
const legal = (file) => `${T.legalNotice ? `<p class="notice">${T.legalNotice}</p>` : ""}<div lang="en">${md(file)}</div>`;

for (const [code] of LANGUAGES) {
  L = code;
  T = I18N[code];
  const out = `dist${prefix(code)}`;
  mkdirSync(out, { recursive: true });
  const page = (path, title, active, body, opts = {}) => writeFileSync(`${out}${path === "/" ? "/index.html" : path}`,
    shell({ title: title ? `Merkats — ${title}` : "Merkats", path, active, body, hero: path === "/", ...opts }));
  page("/", "", "", home());
  page("/how-it-works.html", T.titles.how, "/how-it-works.html", localized("HOW"));
  page("/login.html", T.titles.login, "/login.html", login(), { app: true });
  page("/app.html", T.nav.account, "/app.html", `<main id="app" class="app-wrap"></main>`, { app: true, hero: true });
  page("/story.html", T.titles.story, "/story.html", localized("STORY"));
  page("/support.html", T.titles.support, "", support());
  page("/privacy.html", T.titles.privacy, "/privacy.html", legal("PRIVACY.md"));
  page("/terms.html", T.titles.terms, "", legal("TERMS.md"));
}
console.log(`built dist/ in ${LANGUAGES.map(([c]) => c).join(", ")}: index, story, how-it-works, login, support, privacy, terms; plus bimi/logo.svg`);
