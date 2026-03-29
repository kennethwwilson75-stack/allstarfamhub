const fs = require('fs')

const env = fs.readFileSync('.env', 'utf8')
const lines = env.split('\n')

lines.forEach(line => {
  if (line.startsWith('DATABASE_URL') || line.startsWith('DIRECT_URL')) {
    console.log(JSON.stringify(line))
  }
})