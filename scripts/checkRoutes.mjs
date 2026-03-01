// scripts/checkRoutes.mjs
// Verifies that src/config/routes.js is the single source of truth for all routes.
// Fails if any route path is defined outside of routes.js.

import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

const ROUTES_FILE = 'src/config/routes.js'
const PAGES_DIR = 'src/pages'

const routesContent = readFileSync(ROUTES_FILE, 'utf8')

// Extract all paths from routes.js
const pathMatches = routesContent.matchAll(/path:\s*['"]([^'"]+)['"]/g)
const definedPaths = new Set([...pathMatches].map(m => m[1]))

console.log(`✓ Routes defined in ${ROUTES_FILE}:`, [...definedPaths])

// Recursively collect all .js/.jsx files under a directory
function collectFiles(dir) {
  const files = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      files.push(...collectFiles(full))
    } else if (entry.endsWith('.js') || entry.endsWith('.jsx')) {
      files.push(full)
    }
  }
  return files
}

const pageFiles = collectFiles(PAGES_DIR)

// Match hardcoded route paths used in React Router / anchor contexts:
//   to="/path"  href="/path"  navigate("/path")  navigate('/path')
// Excludes URLs (http/https) and Supabase function paths (/functions/v1/...)
const routeUsageRe = /(?:(?:\bto|href)=["']|navigate\(["'])(\/[a-z][a-z0-9/_-]*)["']/g

const violations = []

for (const file of pageFiles) {
  const content = readFileSync(file, 'utf8')
  for (const match of content.matchAll(routeUsageRe)) {
    const path = match[1]
    // Skip Supabase edge function paths and other non-route paths
    if (path.startsWith('/functions/')) continue
    if (!definedPaths.has(path)) {
      violations.push({ file, path })
    }
  }
}

if (violations.length > 0) {
  console.error('\n✗ Hardcoded route paths found outside routes.js:')
  for (const v of violations) {
    console.error(`  ${v.file}: "${v.path}"`)
  }
  console.error('\nAdd these paths to src/config/routes.js or use the ROUTES constant.\n')
  process.exit(1)
}

console.log(
  `✓ routes:check passed — ${definedPaths.size} routes verified, ` +
  `no hardcoded paths found across ${pageFiles.length} page files.`
)
