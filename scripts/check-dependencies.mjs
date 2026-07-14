import fs from 'node:fs'

const lock = JSON.parse(fs.readFileSync(new URL('../package-lock.json', import.meta.url)))
const root = lock.packages[''].dependencies

if (root['@actual-app/api'] !== '26.7.0') {
  throw new Error('@actual-app/api must be exactly 26.7.0')
}

const formData = lock.packages['node_modules/form-data']?.version
if (!formData || formData.localeCompare('4.0.6', undefined, { numeric: true }) < 0) {
  throw new Error('form-data must be 4.0.6 or newer')
}
