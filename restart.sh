#!/bin/bash
echo "Stopping any running Electron processes..."
pkill -f electron 2>/dev/null || true
sleep 1
echo "Starting NXQ Chit Fund App..."
npm run dev


