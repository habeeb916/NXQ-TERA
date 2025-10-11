#!/bin/bash
echo "Stopping any running Electron processes..."
pkill -f electron 2>/dev/null || true
sleep 1
echo "Starting HSM-TERA App..."
npm run dev


