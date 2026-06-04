#!/usr/bin/env sh
set -u

cd "$(dirname "$0")" || exit 1

printf '\n'
printf 'CrewCanvas macOS launcher\n'
printf '=========================\n'
printf '\n'

if ! command -v node >/dev/null 2>&1; then
  printf 'Node.js was not found.\n'
  printf 'Install the LTS version from https://nodejs.org/ and run this file again.\n'
  printf '\n'
  printf 'If you installed Node with Homebrew, reopen Terminal and try again.\n'
  printf '\n'
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  printf 'npm was not found. Reinstall Node.js from https://nodejs.org/ and run this file again.\n'
  printf '\n'
  exit 1
fi

if [ ! -x "node_modules/.bin/vite" ]; then
  printf 'Installing dependencies. This may take a few minutes the first time...\n'
  if ! npm ci; then
    printf 'npm ci failed. Trying npm install instead...\n'
    npm install || {
      printf '\n'
      printf 'Dependency installation failed.\n'
      exit 1
    }
  fi
  printf '\n'
fi

printf 'Starting CrewCanvas...\n'
printf 'The browser should open automatically. Keep this Terminal window open while using the app.\n'
printf 'Press Ctrl+C in this Terminal window to stop the server.\n'
printf '\n'

npm run dev -- --host 127.0.0.1 --open /

printf '\n'
printf 'CrewCanvas stopped.\n'
printf 'You can close this Terminal window now.\n'
