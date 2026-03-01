// src/lib/csv/parseRfc4180.js
// RFC 4180 compliant CSV parser shared between Import.jsx and unit tests.

/**
 * RFC 4180 CSV parser. Returns a 2-D array of string cells.
 * Handles: quoted fields, escaped double-quotes (""), CRLF and LF.
 * @param {string} text
 * @returns {string[][]}
 */
export function parseRfc4180(text) {
  const records = []
  let row = []
  let i = 0
  const n = text.length

  while (i < n) {
    // Quoted field
    if (text[i] === '"') {
      i++ // skip opening quote
      let field = ''
      while (i < n) {
        if (text[i] === '"') {
          if (text[i + 1] === '"') {
            field += '"'  // escaped quote
            i += 2
          } else {
            i++  // closing quote
            break
          }
        } else {
          field += text[i++]
        }
      }
      row.push(field)
      // Skip delimiter or line ending after closing quote
      if (text[i] === ',') i++
      else if (text[i] === '\r' && text[i + 1] === '\n') { records.push(row); row = []; i += 2 }
      else if (text[i] === '\n') { records.push(row); row = []; i++ }
    } else {
      // Unquoted field — read until comma or line ending
      let field = ''
      while (i < n && text[i] !== ',' && text[i] !== '\r' && text[i] !== '\n') {
        field += text[i++]
      }
      row.push(field.trim())
      if (text[i] === ',') i++
      else if (text[i] === '\r' && text[i + 1] === '\n') { records.push(row); row = []; i += 2 }
      else if (text[i] === '\n') { records.push(row); row = []; i++ }
      else if (i >= n && row.length > 0) { records.push(row); row = [] }
    }
  }

  if (row.length > 0) records.push(row)
  return records
}

/**
 * Parse CSV text into headers + row objects using the RFC 4180 parser.
 * @param {string} text
 * @returns {{ headers: string[], rows: Record<string, string>[] }}
 */
export function parseCsvToRows(text) {
  if (!text?.trim()) return { headers: [], rows: [] }

  const records = parseRfc4180(text)
  if (records.length < 2) return { headers: [], rows: [] }

  const headers = records[0].map(h => h.trim())
  const rows = records.slice(1)
    .filter(cells => cells.some(c => c !== ''))  // skip blank lines
    .map(cells => {
      const obj = {}
      headers.forEach((h, i) => { obj[h] = cells[i] ?? '' })
      return obj
    })

  return { headers, rows }
}
