import fs from 'fs'
import path from 'path'

function walk(dir) {
  let results = []
  const list = fs.readdirSync(dir)
  for (const file of list) {
    const filePath = path.join(dir, file)
    const stat = fs.statSync(filePath)
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(filePath))
    } else if (filePath.endsWith('.js')) {
      results.push(filePath)
    }
  }
  return results
}

const files = [...walk('src/lib'), ...walk('src/hooks')]

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8')
  let changed = false
  
  // Replace `from '../...'` or `from './...'` with `.js`
  content = content.replace(/from\s+['"](\.[^'"]+)['"]/g, (match, p1) => {
    if (!p1.endsWith('.js') && !p1.endsWith('.json') && !p1.endsWith('.jsx')) {
      changed = true
      return `from '${p1}.js'`
    }
    return match
  })

  if (changed) {
    fs.writeFileSync(file, content)
    console.log(`Updated ${file}`)
  }
}
