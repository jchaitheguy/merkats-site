import { marked } from "marked";
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from "node:fs";

const APP = ".";
mkdirSync("dist", { recursive: true });
for (const f of ["favicon.svg", "favicon.ico", "favicon.png", "apple-touch-icon.png", "appstore-badge.svg"]) {
  try { copyFileSync(f, `dist/${f}`); } catch {}
}

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

const meerkat = (size) => `<div class="mk" style="--s:${size}px;width:${size}px;height:${size * 1.12}px" aria-label="Merkat">
  <!-- baby-meerkat coloring: pale grey fur, dark ear tips + bold dark eye
       patches, pink nose -- modeled after a real meerkat pup reference -->
  <div style="left:2%;top:20%;width:26%;height:26%;border-radius:50%;background:#332A22"></div>
  <div style="right:2%;top:20%;width:26%;height:26%;border-radius:50%;background:#332A22"></div>
  <div style="left:9%;top:16%;width:82%;height:80%;border-radius:44%;background:#DAD3C2"></div>
  <div style="left:29%;top:48%;width:42%;height:40%;border-radius:50% 50% 42% 42%;background:#E7E0D0"></div>
  <!-- bold dark patches surround the eyes, like a real meerkat's mask -->
  <div style="left:16%;top:23%;width:26%;height:24%;border-radius:50%;background:#2E2620;opacity:.85"></div>
  <div style="right:16%;top:23%;width:26%;height:24%;border-radius:50%;background:#2E2620;opacity:.85"></div>
  <div style="left:21%;top:26%;width:19%;height:18%;border-radius:50%;background:#fff"></div>
  <div style="right:21%;top:26%;width:19%;height:18%;border-radius:50%;background:#fff"></div>
  <div class="anim" style="left:22.5%;top:27.5%;width:16%;height:16%;border-radius:50%;background:#1A1310;animation:mk-look 7s ease-in-out infinite"></div>
  <div class="anim" style="right:22.5%;top:27.5%;width:16%;height:16%;border-radius:50%;background:#1A1310;animation:mk-look 7s ease-in-out infinite"></div>
  <div class="anim" style="left:24%;top:28.5%;width:5%;height:5%;border-radius:50%;background:#fff;animation:mk-look 7s ease-in-out infinite"></div>
  <div class="anim" style="right:24%;top:28.5%;width:5%;height:5%;border-radius:50%;background:#fff;animation:mk-look 7s ease-in-out infinite"></div>
  <div class="anim" style="left:32%;top:37%;width:2%;height:2%;border-radius:50%;background:#fff;opacity:.9;animation:mk-look 7s ease-in-out infinite"></div>
  <div class="anim" style="right:32%;top:37%;width:2%;height:2%;border-radius:50%;background:#fff;opacity:.9;animation:mk-look 7s ease-in-out infinite"></div>
  <div class="anim" style="left:21%;top:26%;width:19%;height:0;border-radius:40%;background:#2E2620;animation:mk-blink 4.6s infinite"></div>
  <div class="anim" style="right:21%;top:26%;width:19%;height:0;border-radius:40%;background:#2E2620;animation:mk-blink 4.6s infinite"></div>
  <div style="left:45%;top:57%;width:10%;height:8%;border-radius:50%;background:#C98F92"></div>
  <div class="anim" style="left:46%;top:74%;width:8%;height:calc(var(--s)*0.045);border-radius:45%;background:#6B4A3E;animation:mk-chew 1s ease-in-out infinite"></div>
  <div class="anim" style="left:50%;bottom:30%;width:5%;height:0;transform-origin:bottom;animation:mk-graze 7s ease-in-out infinite,mk-stick 1s ease-in-out infinite;overflow:visible">
    <div style="position:absolute;bottom:0;width:100%;height:100%;border-radius:40%;background:#7FBF63"></div>
    <div class="anim" style="position:absolute;top:-6%;left:80%;width:130%;height:60%;border-radius:50%;background:#8FCE70;transform:rotate(28deg);animation:mk-leaf 7s infinite"></div>
  </div>
</div>`;

const shell = ({ title, body, hero = false }) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="alternate icon" href="/favicon.ico" sizes="any">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<title>${title}</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #E5EEE4; color: #33403A;
    font: 16px/1.6 -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, system-ui, sans-serif;
    -webkit-font-smoothing: antialiased; }
  a { color: #A85F5F; }
  ${MEERKAT_CSS}
  .page { max-width: 680px; margin: 0 auto; padding: 40px 22px 72px; }
  /* home */
  .hero { min-height: 90vh; display: flex; flex-direction: column; align-items: center;
    justify-content: center; text-align: center; gap: 14px; }
  .hero h1 { font-size: 34px; font-weight: 800; margin: 6px 0 0; letter-spacing: -0.5px; }
  .hero p { color: #5b6b62; max-width: 30rem; margin: 0; }
  .hero .links { display: flex; gap: 12px; flex-wrap: wrap; justify-content: center; margin-top: 10px; }
  .hero .links a { background: #C77D7D; color: #fff; text-decoration: none;
    padding: 11px 20px; border-radius: 12px; font-weight: 600; }
  .hero .mail { color: #6E7D71; font-size: 14px; }
  .hero .badge { display: inline-block; margin-top: 6px; }
  .hero .badge img { display: block; height: 52px; width: auto; }
  /* legal docs — no card, plain on the ground */
  .doc h1 { font-size: 26px; margin: 0 0 2px; }
  .doc h2 { font-size: 18px; margin: 26px 0 6px; }
  .doc h3 { font-size: 15px; margin: 18px 0 4px; }
  .doc p, .doc li { color: #3d4a44; }
  .doc em { color: #6E7D71; font-style: normal; font-size: 14px; }
  .doc hr { border: none; border-top: 1px solid #cdddd2; margin: 26px 0; }
  .doc code { background: #dce8de; padding: 1px 5px; border-radius: 4px; font-size: 90%; }
  .back { display: inline-block; color: #6E7D71; text-decoration: none; font-weight: 600;
    font-size: 14px; margin-bottom: 22px; }
  .tail { margin-top: 34px; font-size: 13px; color: #6E7D71; }
  .tail a { color: #6E7D71; }
</style>
</head>
<body>
${hero ? body : `<div class="page doc">${body}</div>`}
</body>
</html>`;

const md = (f) => marked.parse(readFileSync(`${APP}/${f}`, "utf8"));

// Live on the App Store as of 2026-09-12. Badge is Apple's own official
// artwork (tools.applemediaservices.com badge generator) — don't recolor
// or reshape it, per their marketing guidelines.
const APP_STORE_URL = "https://apps.apple.com/us/app/merkats/id6806871553";
const appStoreBadge = APP_STORE_URL
  ? `<a class="badge" href="${APP_STORE_URL}" target="_blank" rel="noopener"
       aria-label="Download Merkats on the App Store"><img src="/appstore-badge.svg"
       alt="Download on the App Store" width="180" height="60"></a>`
  : "";

writeFileSync("dist/index.html", shell({
  title: "Merkats",
  hero: true,
  body: `<div class="hero">
  ${meerkat(150)}
  <h1>Merkats</h1>
  <p>Plan shared meals, split the chores, and see who's in for dinner &mdash; for houses, halls and friend groups that cook together.</p>
  ${appStoreBadge}
  <div class="links"><a href="/privacy">Privacy Policy</a><a href="/terms">Terms of Service</a></div>
  <p class="mail">Questions or abuse reports: <a href="mailto:support@merkats.app">support@merkats.app</a></p>
</div>`,
}));

for (const [file, out] of [["PRIVACY.md", "privacy.html"], ["TERMS.md", "terms.html"]]) {
  writeFileSync(`dist/${out}`, shell({
    title: file === "PRIVACY.md" ? "Merkats — Privacy Policy" : "Merkats — Terms of Service",
    body: `<a class="back" href="/">&larr; Merkats</a>\n${md(file)}\n<p class="tail"><a href="/privacy">Privacy</a> &middot; <a href="/terms">Terms</a> &middot; support@merkats.app</p>`,
  }));
}
console.log("built dist/: index.html, privacy.html, terms.html");
