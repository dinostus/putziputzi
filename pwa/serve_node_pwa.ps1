$ErrorActionPreference = 'Stop'

node -e "eval(require('fs').readFileSync('server.js','utf8'))"
