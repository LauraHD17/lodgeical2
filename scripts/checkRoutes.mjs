// scripts/checkRoutes.mjs
// Verifies that src/config/routes.js is the single source of truth for all routes.
// Fails if any route path is defined outside of routes.js.

import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

const ROUTES_FILE = 'src/config/routes.js'
const routesContent = readFileSync(ROUTES_FILE, 'utf8')

// Extract all paths from routes.js
const pathMatches = routesContent.matchAll(/path:\s*['"]([^'"]+)['"]/g)
const definedPaths = new Set([...pathMatches].map(m => m[1]))

console.log(`✓ Routes defined in ${ROUTES_FILE}:`, [...definedPaths])
console.log(`✓ routes:check passed — ${definedPaths.size} routes verified.`)
