#!/usr/bin/env node
/**
 * Convierte un archivo Markdown (.md) en una página HTML lista para leer
 * e imprimir a PDF (Ctrl+P → "Guardar como PDF").
 *
 * USO:
 *   node scripts/md-to-html.mjs docs/SEGURIDAD_DOSSIER_LOGITECH.md
 *
 * Genera el archivo .html junto al original. Ábrelo con doble clic.
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { marked } from 'marked'

const input = process.argv[2]
if (!input) {
  console.error('Uso: node scripts/md-to-html.mjs <archivo.md>')
  process.exit(1)
}

const md   = readFileSync(input, 'utf8')
const body = marked.parse(md)
const title = (md.match(/^#\s+(.+)$/m)?.[1] ?? 'Documento').trim()
const output = input.replace(/\.md$/i, '.html')

const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>
  :root { --tinta:#1a2332; --suave:#5b6472; --linea:#e4e8ee; --acento:#2563eb; }
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    color: var(--tinta); line-height: 1.6; max-width: 820px;
    margin: 40px auto; padding: 0 24px; background: #fff;
  }
  h1 { font-size: 1.9rem; border-bottom: 3px solid var(--acento); padding-bottom: .4em; }
  h2 { font-size: 1.35rem; margin-top: 2em; border-bottom: 1px solid var(--linea); padding-bottom: .3em; }
  h3 { font-size: 1.1rem; margin-top: 1.5em; color: var(--acento); }
  blockquote { border-left: 4px solid var(--acento); background: #f4f7fb; margin: 1em 0;
    padding: .6em 1em; color: var(--suave); border-radius: 0 6px 6px 0; }
  table { border-collapse: collapse; width: 100%; margin: 1em 0; font-size: .92rem; }
  th, td { border: 1px solid var(--linea); padding: 8px 12px; text-align: left; vertical-align: top; }
  th { background: #f4f7fb; font-weight: 600; }
  code { background: #f0f2f5; padding: 2px 6px; border-radius: 4px; font-size: .88em; }
  pre { background: #f7f9fc; border: 1px solid var(--linea); border-radius: 8px;
    padding: 14px; overflow-x: auto; font-size: .82rem; line-height: 1.4; }
  pre code { background: none; padding: 0; }
  ul, ol { padding-left: 1.4em; }
  a { color: var(--acento); }
  hr { border: none; border-top: 1px solid var(--linea); margin: 2em 0; }
  @media print { body { margin: 0; max-width: none; } h2 { page-break-after: avoid; } table, pre { page-break-inside: avoid; } }
</style>
</head>
<body>
${body}
<hr>
<p style="color:#9aa3b0;font-size:.8rem">Generado desde ${input} · Para PDF: Ctrl/Cmd + P → Guardar como PDF</p>
</body>
</html>`

writeFileSync(output, html, 'utf8')
console.log(`✓ Generado: ${output}`)
console.log('  Ábrelo con doble clic. Para PDF: Ctrl+P → Guardar como PDF.')
