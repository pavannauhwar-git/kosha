import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { BRAND_COLORS, BRAND_CSS_VARIABLES } from '../../../../src/lib/brandColors'

const ROOT = path.resolve(__dirname, '../../../..')
const css = fs.readFileSync(path.join(ROOT, 'src/index.css'), 'utf8')

function cssBlock(selector) {
  const start = css.indexOf(`\n${selector} {`)
  if (start === -1) throw new Error(`No "${selector} {" block in src/index.css`)
  return css.slice(start, css.indexOf('\n}', start))
}

function cssVariable(block, name) {
  const match = block.match(new RegExp(`\\s${name}:\\s*([^;]+);`))
  return match ? match[1].trim().toUpperCase() : null
}

describe('brand colours', () => {
  it.each([
    ['light', ':root'],
    ['dark', '.dark'],
  ])('match the %s theme variables in index.css', (mode, selector) => {
    const block = cssBlock(selector)
    for (const [key, variable] of Object.entries(BRAND_CSS_VARIABLES)) {
      expect({ variable, value: cssVariable(block, variable) })
        .toEqual({ variable, value: BRAND_COLORS[mode][key].toUpperCase() })
    }
  })

  it('are not hard-coded again in the MUI theme', () => {
    const source = fs.readFileSync(path.join(ROOT, 'src/lib/muiTheme.js'), 'utf8').toUpperCase()
    const brandHex = new Set(Object.values(BRAND_COLORS).flatMap((colors) => [
      colors.primary, colors.primaryDark, colors.primaryContainer,
    ]))
    for (const hex of brandHex) expect(source).not.toContain(hex.toUpperCase())
  })
})
