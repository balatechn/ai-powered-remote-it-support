#!/bin/bash
# ============================================================
# NexusIT — Manual Deploy Script
# Run this on the cloud server to pull latest and redeploy
# ============================================================

set -e

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
echo "=== NexusIT Deployment ==="
echo "Directory: $REPO_DIR"

cd "$REPO_DIR"

echo "--- Pulling latest from GitHub ---"
git pull origin main

echo "--- Rebuilding Docker containers ---"
docker compose up --build -d

echo "--- Cleaning up old images ---"
docker image prune -f

echo "--- Container status ---"
docker compose ps

echo "=== Deployment complete ==="
