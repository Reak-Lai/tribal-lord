#!/bin/sh
set -e
cat /workspace/v1a-src/part1.js /workspace/v1a-src/part2.js /workspace/v1a-src/part3.js > /workspace/tribal-lord/game.js
node -e "new Function(require('fs').readFileSync('/workspace/tribal-lord/game.js','utf8'))"
cd /workspace/tribal-lord-test && node build-single.js 2>&1 | grep -v "FFTM"
