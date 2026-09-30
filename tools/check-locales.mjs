// Fails (exit 1) when fr/ and de/ are stale or their SEO tags are wrong.
//   node tools/check-locales.mjs
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildAll, loadDict, LOCALES } from './build-locales.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://webwerk.lu';
const PAGES = { en: '/', ...Object.fromEntries(Object.entries(LOCALES).map(([l, v]) => [l, v.path])) };
const errors = [];
const fail = (page, msg) => errors.push(`${page}: ${msg}`);
const norm = s => s.replace(/\r\n/g, '\n');

// 1. the committed pages are what the build makes now
for (const [file, want] of Object.entries(buildAll())) {
  const p = join(ROOT, file);
  if (!existsSync(p)) fail(file, 'missing; run node tools/build-locales.mjs');
  else if (norm(readFileSync(p, 'utf8')) !== norm(want)) fail(file, 'stale; run node tools/build-locales.mjs');
}

// 2. each page: lang, one h1, one self canonical, the full reciprocal hreflang set, no English left in a translated slot
const dict = loadDict();
for (const [lang, path] of Object.entries(PAGES)) {
  const file = path === '/' ? 'index.html' : path.slice(1) + 'index.html';
  if (!existsSync(join(ROOT, file))) continue;
  const html = readFileSync(join(ROOT, file), 'utf8');
  if (!html.includes(`<html lang="${lang}">`)) fail(file, `html lang is not ${lang}`);
  if (/^\s*<!--/.test(html)) fail(file, 'something precedes the doctype');
  const h1 = html.match(/<h1\b/g) || [];
  if (h1.length !== 1) fail(file, `${h1.length} <h1>`);
  const canon = [...html.matchAll(/<link rel="canonical" href="([^"]*)">/g)].map(m => m[1]);
  if (canon.length !== 1 || canon[0] !== SITE + path) fail(file, `canonical ${JSON.stringify(canon)}, want ${SITE + path}`);
  for (const [l, p] of Object.entries({ ...PAGES, 'x-default': '/' }))
    if (!html.includes(`<link rel="alternate" hreflang="${l}" href="${SITE + p}">`)) fail(file, `no hreflang ${l}`);
  const cur = html.match(/<a href="([^"]*)" aria-current="true" lang="([a-z]+)"/);
  if (!cur || cur[1] !== path || cur[2] !== lang) fail(file, 'language switch does not mark this page as current');
  for (const m of html.matchAll(/<(\w+)\b[^>]*\sdata-t="([a-z0-9_]+)"[^>]*>([^<]*)<\/\1>/g)) {
    if (!m[3].trim()) fail(file, `data-t="${m[2]}" renders empty`);
    if (lang !== 'en' && dict[lang][m[2]] && !m[0].includes('data-en=')) fail(file, `data-t="${m[2]}" not translated`);
  }
}

// 3. the sitemap lists every language with its alternates
const sm = readFileSync(join(ROOT, 'sitemap.xml'), 'utf8');
for (const p of Object.values(PAGES)) {
  if (!sm.includes(`<loc>${SITE + p}</loc>`)) fail('sitemap.xml', `no <loc> ${SITE + p}`);
  const n = sm.split(`hreflang="`).length - 1;
  if (n < Object.keys(PAGES).length ** 2) fail('sitemap.xml', `${n} xhtml:link alternates, want ${Object.keys(PAGES).length ** 2}+`);
}

if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log(`ok: ${Object.keys(PAGES).length} pages, fresh, tags and sitemap consistent`);
