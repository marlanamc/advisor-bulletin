#!/usr/bin/env node
/**
 * Builds a print-ready industry briefing from workforce-report.json
 * and writes a Letter-size PDF.
 *
 * Usage (from repo root):
 *   node scripts/export-industry-report-pdf.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const JSON_PATH = path.join(ROOT, 'public/data/workforce/workforce-report.json');
const HTML_PATH = path.join(ROOT, 'public/data/workforce/industry-report-print.html');
const PDF_PATH = path.join(ROOT, 'docs/FY26-Industry-Interest-Report.pdf');
const PDF_PUBLIC_PATH = path.join(ROOT, 'public/data/workforce/FY26-Industry-Interest-Report.pdf');

const ESOL_LABELS = {
    '1': 'L1',
    '2': 'L2',
    '3': 'L3',
    '4': 'L4',
    '5': 'L5',
    hse: 'HSE',
    unknown: 'Unknown',
};

const DOC_LABELS = {
    yes_unspecified: 'Has work docs',
    no: 'No work docs',
    other_unparsed: 'Other',
    unknown: 'Unknown',
};

const DOC_COLORS = {
    yes_unspecified: '#0f7a5a',
    no: '#8a93a3',
    other_unparsed: '#c3c2b7',
    unknown: '#d8d7cf',
};

function esc(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function rich(text) {
    return String(text || '')
        .split(/\*\*(.+?)\*\*/)
        .map((part, index) => (index % 2 === 1 ? `<strong>${esc(part)}</strong>` : esc(part)))
        .join('');
}

function fmt(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n.toLocaleString('en-US') : '0';
}

function buildHtml(report) {
    const demand = report.industry_demand || [];
    const maxDemand = Math.max(...demand.map((row) => row.students), 1);
    const goals = report.education_goals || [];
    const maxGoal = Math.max(...goals.map((row) => row.students), 1);
    const gaps = report.current_vs_desired || [];

    const summaryItems = (report.analysis_summary || []).filter((item) => !/program fit/i.test(item));

    const esol = report.industry_by_esol_level_stacked || { rows: [], segment_order: [], segment_meta: {} };
    const docs = report.industry_by_work_docs_stacked || { rows: [], segment_order: [], segment_meta: {} };
    const esolMax = Math.max(...(esol.rows || []).map((row) => row.total), 1);
    const docsMax = Math.max(...(docs.rows || []).map((row) => row.total), 1);

    const demandRows = demand.map((row) => `
      <div class="barrow">
        <span class="label">${esc(row.label)}</span>
        <span class="track"><span class="fill" style="width:${((row.students / maxDemand) * 100).toFixed(1)}%"></span></span>
        <span class="val">${fmt(row.students)}</span>
      </div>`).join('');

    const goalRows = goals.map((row) => `
      <div class="barrow">
        <span class="label">${esc(row.label)}</span>
        <span class="track"><span class="fill" style="width:${((row.students / maxGoal) * 100).toFixed(1)}%"></span></span>
        <span class="val">${fmt(row.students)}</span>
      </div>`).join('');

    const gapRows = gaps.map((row) => `
      <div class="grouprow">
        <span class="label">${esc(row.label)}</span>
        <span class="tracks">
          <span class="track"><span class="fill current" style="width:${((row.current_scale || 0) * 100).toFixed(1)}%"></span></span>
          <span class="track"><span class="fill desired" style="width:${((row.desired_scale || 0) * 100).toFixed(1)}%"></span></span>
        </span>
        <span class="pair"><span>${fmt(row.currently_work_in)}</span><span>${fmt(row.want_to_work_in)}</span></span>
      </div>`).join('');

    function stackLegend(chart, labels, colors) {
        const order = chart.segment_order || [];
        const metaMap = chart.segment_meta || {};
        return order.map((key) => {
            const color = (colors && colors[key]) || metaMap[key]?.color || '#c3c2b7';
            const label = (labels && labels[key]) || metaMap[key]?.label || key;
            return `<span class="legend-item"><span class="sw" style="background:${esc(color)}"></span>${esc(label)}</span>`;
        }).join('');
    }

    function stackRows(chart, maxTotal, labels, colors) {
        const order = chart.segment_order || [];
        const metaMap = chart.segment_meta || {};
        return (chart.rows || []).map((row) => {
            const segs = order.map((key) => {
                const value = Number(row.segments?.[key] || 0);
                if (value <= 0) return '';
                const color = (colors && colors[key]) || metaMap[key]?.color || '#c3c2b7';
                const showNum = value >= maxTotal * 0.08;
                const light = isLight(color);
                return `<span class="seg${light ? ' is-light' : ''}" style="flex:${value} 0 0;background:${esc(color)}">${showNum ? fmt(value) : ''}</span>`;
            }).join('');
            return `
        <div class="stackrow">
          <span class="label">${esc(row.label)}</span>
          <div class="stack-wrap">
            <div class="stack-track" style="width:${((row.total / maxTotal) * 100).toFixed(1)}%">${segs}</div>
          </div>
        </div>`;
        }).join('');
    }

    function isLight(color) {
        const hex = String(color || '').replace('#', '');
        if (hex.length !== 6) return false;
        const r = parseInt(hex.slice(0, 2), 16);
        const g = parseInt(hex.slice(2, 4), 16);
        const b = parseInt(hex.slice(4, 6), 16);
        return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.72;
    }

    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Industry snapshot · EBHCS</title>
  <style>
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body {
      background: #fff;
      color: #0d1b35;
      font: 400 12px/1.45 "Source Sans 3", "Segoe UI", Helvetica, Arial, sans-serif;
      print-color-adjust: exact;
      -webkit-print-color-adjust: exact;
    }
    .toolbar {
      max-width: 8.5in;
      margin: 16px auto;
      padding: 0 16px;
      display: flex;
      justify-content: flex-end;
    }
    .toolbar button {
      appearance: none;
      border: 1px solid #0a1f44;
      background: #0a1f44;
      color: #fff;
      font: 600 13px "Segoe UI", sans-serif;
      padding: 8px 14px;
      cursor: pointer;
    }
    .page { max-width: 8.5in; margin: 0 auto; padding: 0 0.5in 0.4in; }
    h1 { font-size: 16px; font-weight: 700; margin: 0 0 12px; }
    h2 { font-size: 13px; font-weight: 700; margin: 0 0 6px; }
    .desc { margin: 0 0 8px; color: #4d6d90; font-size: 11px; }
    .callout { border: 1px solid #d7e0ee; padding: 8px 12px; margin: 0 0 16px; }
    .callout ul { margin: 0; padding-left: 1.15rem; }
    .callout li { margin: 3px 0; }
    .section { margin-bottom: 16px; }
    .barchart { display: flex; flex-direction: column; gap: 5px; }
    .barrow { display: grid; grid-template-columns: 150px 1fr 32px; align-items: center; gap: 8px; }
    .barrow .label, .grouprow .label { font-size: 11px; color: #3d5a80; }
    .barrow .track, .grouprow .track { height: 10px; background: #eef2f7; }
    .barrow .fill { display: block; height: 100%; background: #1a56db; }
    .barrow .val { font-size: 11px; text-align: right; font-variant-numeric: tabular-nums; }
    .legend { display: flex; gap: 16px; margin: 0 0 8px; font-size: 11px; color: #3d5a80; }
    .sw { display: inline-block; width: 9px; height: 9px; margin-right: 5px; vertical-align: -1px; }
    .grouprows { display: flex; flex-direction: column; gap: 6px; }
    .grouprow { display: grid; grid-template-columns: 150px 1fr 36px; align-items: center; gap: 8px; }
    .grouprow .tracks { display: flex; flex-direction: column; gap: 2px; }
    .grouprow .fill { display: block; height: 100%; }
    .grouprow .fill.current { background: #9aa7b8; }
    .grouprow .fill.desired { background: #059669; }
    .grouprow .pair { display: flex; flex-direction: column; align-items: flex-end; font-size: 10px; font-variant-numeric: tabular-nums; color: #4d6d90; line-height: 1.2; }
    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
    .stack-legend { display: flex; flex-wrap: wrap; gap: 6px 10px; margin: 0 0 8px; font-size: 10px; color: #3d5a80; }
    .legend-item { display: inline-flex; align-items: center; gap: 4px; }
    .legend-item .sw { margin: 0; }
    .stackrow { display: grid; grid-template-columns: 120px 1fr; align-items: center; gap: 8px; margin-bottom: 5px; }
    .stackrow .label { font-size: 10.5px; color: #3d5a80; }
    .stack-wrap { min-width: 0; }
    .stack-track { display: flex; height: 12px; background: #eef2f7; }
    .seg { display: flex; align-items: center; justify-content: center; min-width: 0; font-size: 8px; font-weight: 600; color: #fff; font-variant-numeric: tabular-nums; }
    .seg.is-light { color: #0d1b35; }
    .fineprint { margin: 8px 0 0; color: #5a7394; font-size: 10px; }
    @page { size: letter; margin: 0.5in; }
    @media print {
      .toolbar { display: none !important; }
      .page { max-width: none; padding: 0; }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <button type="button" onclick="window.print()">Print / Save as PDF</button>
  </div>
  <main class="page">
    <h1>Industry snapshot · EBHCS · FY26</h1>

    <section class="section">
      <h2>At a glance</h2>
      <div class="callout">
        <ul>
          ${summaryItems.map((item) => `<li>${rich(item)}</li>`).join('')}
        </ul>
      </div>
    </section>

    <section class="section">
      <h2>Desired industries</h2>
      <p class="desc">Top industries students want.</p>
      <div class="barchart">${demandRows}</div>
    </section>

    <section class="section">
      <h2>Current vs. desired</h2>
      <p class="desc">Grey = current job. Green = desired job. Same scale across rows.</p>
      <div class="legend">
        <span><span class="sw" style="background:#9aa7b8"></span>Current job</span>
        <span><span class="sw" style="background:#059669"></span>Desired job</span>
      </div>
      <div class="grouprows">${gapRows}</div>
    </section>

    <div class="two-col">
      <section class="section">
        <h2>Industry by ESOL level</h2>
        <p class="desc">Top 8 industries, split by ESOL level.</p>
        <div class="stack-legend">${stackLegend(esol, ESOL_LABELS)}</div>
        ${stackRows(esol, esolMax, ESOL_LABELS)}
      </section>
      <section class="section">
        <h2>Industry by work docs</h2>
        <p class="desc">Work doc status for top industries.</p>
        <div class="stack-legend">${stackLegend(docs, DOC_LABELS, DOC_COLORS)}</div>
        ${stackRows(docs, docsMax, DOC_LABELS, DOC_COLORS)}
      </section>
    </div>

    <section class="section">
      <h2>Education goals</h2>
      <p class="desc">Primary education goal.</p>
      <div class="barchart">${goalRows}</div>
    </section>

    <p class="fineprint">Aggregate counts only. No names. Education level is self-reported.</p>
  </main>
</body>
</html>`;
}

const report = JSON.parse(readFileSync(JSON_PATH, 'utf8'));
const html = buildHtml(report);
mkdirSync(path.dirname(HTML_PATH), { recursive: true });
mkdirSync(path.dirname(PDF_PATH), { recursive: true });
writeFileSync(HTML_PATH, html);
console.log(`Wrote ${path.relative(ROOT, HTML_PATH)}`);

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(pathToFileURL(HTML_PATH).href, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.emulateMedia({ media: 'print' });
const pdfOptions = {
    format: 'Letter',
    printBackground: true,
    preferCSSPageSize: true,
    margin: { top: '0.42in', bottom: '0.42in', left: '0.5in', right: '0.5in' },
};
await page.pdf({ path: PDF_PATH, ...pdfOptions });
await page.pdf({ path: PDF_PUBLIC_PATH, ...pdfOptions });
await browser.close();
console.log(`Wrote ${path.relative(ROOT, PDF_PATH)}`);
console.log(`Wrote ${path.relative(ROOT, PDF_PUBLIC_PATH)}`);
