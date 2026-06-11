#!/usr/bin/env node
// Audit (and optionally trim) src/css/student-legacy.css.
//
// Finds rules whose selectors reference class/id names that never appear in the
// student page markup sources: index.html plus every JS module reachable from
// src/main.js (static and dynamic imports). The student-v2.css redesign layers
// over the legacy sheet, so anything the markup no longer references is dead
// weight on the render-blocking critical path.
//
// Usage:
//   node scripts/audit-legacy-css.mjs            # report only
//   node scripts/audit-legacy-css.mjs --write    # rewrite student-legacy.css without dead rules
//
// Conservative by design:
//   - a rule survives if ANY of its comma-separated selectors might match
//   - selectors with no class/id tokens (element, :root, attribute-only) always survive
//   - @font-face and @import always survive
//   - @keyframes survive if the animation name is referenced by any kept legacy
//     rule or anywhere in student-v2.css
// Dynamic class names built by string concatenation can still fool the audit —
// always follow a trim with the visual pass described in the repo docs.

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const LEGACY_CSS = resolve(ROOT, 'src/css/student-legacy.css')
const V2_CSS = resolve(ROOT, 'src/css/student-v2.css')
const ENTRY = resolve(ROOT, 'src/main.js')
const HTML = resolve(ROOT, 'index.html')

// ── Collect markup sources: index.html + main.js import graph ──

function collectStudentModules(entry) {
    const seen = new Set()
    const queue = [entry]
    while (queue.length) {
        const file = queue.pop()
        if (seen.has(file) || !existsSync(file)) continue
        seen.add(file)
        const source = readFileSync(file, 'utf8')
        const importRe = /import\s*(?:[\w${},*\s]*from\s*)?\(?\s*['"](\.[^'"]+)['"]\s*\)?/g
        for (const m of source.matchAll(importRe)) {
            if (!m[1].endsWith('.css')) {
                queue.push(resolve(dirname(file), m[1]))
            }
        }
    }
    return [...seen]
}

const modules = collectStudentModules(ENTRY)
const content = [HTML, ...modules].map((f) => readFileSync(f, 'utf8')).join('\n')
const usedTokens = new Set(content.match(/[A-Za-z0-9_-]+/g))

// Class names built by template interpolation (e.g. `category-${bulletin.category}`)
// never appear whole in source. Treat any CSS class token starting with such a
// literal prefix as potentially used. Prefixes are only honored in their own
// context: class="..." interpolations protect class selectors, everything else
// (ids, hashes) protects id selectors — so an id like `bulletin-${id}` doesn't
// falsely keep dead .bulletin-* class rules.
const classPrefixes = new Set()
for (const attr of content.matchAll(/class=["']([^"']*)["']/g)) {
    for (const m of attr[1].matchAll(/([A-Za-z0-9_-]+-)\$\{/g)) {
        classPrefixes.add(m[1])
    }
}
const idPrefixes = new Set()
for (const m of content.matchAll(/([A-Za-z0-9_-]+-)\$\{/g)) {
    if (!classPrefixes.has(m[1])) idPrefixes.add(m[1])
}

function tokenUsed(token, kind) {
    if (usedTokens.has(token)) return true
    const prefixes = kind === 'id' ? idPrefixes : classPrefixes
    for (const prefix of prefixes) {
        if (token.startsWith(prefix)) return true
    }
    return false
}

// ── Parse CSS into a rule tree (flat rules + @media groups) ──

function parseRules(css, offset = 0) {
    const rules = []
    let i = 0
    while (i < css.length) {
        const open = css.indexOf('{', i)
        if (open === -1) break
        const header = css.slice(i, open)
        // Find the matching close brace.
        let depth = 1
        let j = open + 1
        while (j < css.length && depth > 0) {
            if (css[j] === '{') depth++
            else if (css[j] === '}') depth--
            j++
        }
        const body = css.slice(open + 1, j - 1)
        const selector = header.trim().replace(/^\/\*[\s\S]*?\*\//g, '').trim()
        rules.push({
            selector,
            body,
            start: offset + i,
            end: offset + j,
            children: /^@(media|supports)/.test(selector) ? parseRules(body, offset + open + 1) : null,
        })
        i = j
    }
    return rules
}

// ── Decide which rules are dead ──

function selectorTokens(selector) {
    // Strip pseudo-classes/elements and attribute selectors before tokenizing.
    const cleaned = selector
        .replace(/\[[^\]]*\]/g, ' ')
        .replace(/::?[a-zA-Z-]+(\([^)]*\))?/g, ' ')
    return [...cleaned.matchAll(/([.#])([A-Za-z0-9_-]+)/g)]
        .map((m) => ({ name: m[2], kind: m[1] === '#' ? 'id' : 'class' }))
}

function selectorIsLive(selector) {
    const tokens = selectorTokens(selector)
    if (tokens.length === 0) return true // element / :root / attribute selectors
    return tokens.every((t) => tokenUsed(t.name, t.kind))
}

const legacySource = readFileSync(LEGACY_CSS, 'utf8')
const v2Source = readFileSync(V2_CSS, 'utf8')
const tree = parseRules(legacySource)

const deadRules = []

function markDead(rules) {
    for (const rule of rules) {
        if (/^@(font-face|import|charset)/.test(rule.selector)) continue
        if (/^@keyframes\s/.test(rule.selector)) continue // resolved after the main pass
        if (rule.children) {
            markDead(rule.children)
            if (rule.children.length > 0 && rule.children.every((c) => c.dead)) {
                rule.dead = true
                rule.children.forEach((c) => { c.dead = false })
            }
            continue
        }
        const selectors = rule.selector.split(',').map((s) => s.trim()).filter(Boolean)
        if (selectors.length > 0 && selectors.every((s) => !selectorIsLive(s))) {
            rule.dead = true
        }
    }
}
markDead(tree)

// Keyframes: keep only animations referenced by surviving legacy rules or v2.
function liveBodies(rules, acc) {
    for (const rule of rules) {
        if (rule.dead) continue
        if (rule.children) liveBodies(rule.children, acc)
        else acc.push(rule.body)
    }
    return acc
}
const liveCss = liveBodies(tree, []).join('\n') + v2Source
for (const rule of tree) {
    const m = rule.selector.match(/^@keyframes\s+([A-Za-z0-9_-]+)/)
    if (m && !new RegExp(`animation[^;]*\\b${m[1]}\\b`).test(liveCss)) {
        rule.dead = true
    }
}

function collectDead(rules) {
    for (const rule of rules) {
        if (rule.dead) deadRules.push(rule)
        else if (rule.children) collectDead(rule.children)
    }
}
collectDead(tree)

// ── Report ──

deadRules.sort((a, b) => a.start - b.start)
const deadBytes = deadRules.reduce((sum, r) => sum + (r.end - r.start), 0)

console.log(`Student modules scanned: ${modules.length}`)
console.log(`Dynamic class prefixes honored: ${[...classPrefixes].join(', ') || '(none)'}`)
console.log(`Legacy CSS size: ${(legacySource.length / 1024).toFixed(1)} KB`)
console.log(`Dead rules: ${deadRules.length} (${(deadBytes / 1024).toFixed(1)} KB)`)
console.log('')
for (const rule of deadRules) {
    const label = rule.selector.replace(/\s+/g, ' ').slice(0, 100)
    console.log(`  - ${label}  [${rule.end - rule.start} bytes]`)
}

// ── Optional rewrite ──

if (process.argv.includes('--write')) {
    let out = ''
    let cursor = 0
    for (const rule of deadRules) {
        out += legacySource.slice(cursor, rule.start)
        cursor = rule.end
    }
    out += legacySource.slice(cursor)
    // Collapse the whitespace gaps left behind.
    out = out.replace(/\n{3,}/g, '\n\n')
    writeFileSync(LEGACY_CSS, out)
    console.log(`\nWrote trimmed file: ${(out.length / 1024).toFixed(1)} KB (was ${(legacySource.length / 1024).toFixed(1)} KB)`)
}
