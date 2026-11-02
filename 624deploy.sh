#!/usr/bin/env bash
# ============================================================================
# 624 Siteworks — 1-Click Cloudflare Pages Deployment CLI (macOS / zsh / bash)
# ============================================================================
# Usage:
#   ./624deploy.sh "Fox Valley Roofing LLC" [directory]
#   ./624deploy.sh                          # Defaults to current directory name
# ============================================================================

set -u

BIZ_NAME="${1:-}"
TARGET_DIR="${2:-.}"

# Resolve directory path
RESOLVED_DIR="$(cd "$TARGET_DIR" && pwd)"

if [[ -z "$BIZ_NAME" ]]; then
  BIZ_NAME="$(basename "$RESOLVED_DIR")"
fi

# Sanitize into a clean, lowercase, hyphenated project slug (max 50 chars)
SLUG="$(echo "$BIZ_NAME" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//' | cut -c1-50 | sed -E 's/-+$//')"

if [[ -z "$SLUG" ]]; then
  echo "❌ Error: Could not generate a valid project slug from '$BIZ_NAME'." >&2
  exit 1
fi

echo "============================================================"
echo " 🚀 624 Siteworks — Deploying Spec Site to Cloudflare Pages"
echo "============================================================"
echo " Business Name : $BIZ_NAME"
echo " Project Slug  : $SLUG"
echo " Source Folder : $RESOLVED_DIR"
echo "------------------------------------------------------------"

# Step 1: Create Cloudflare Pages project (ignore error if it already exists)
echo "[1/2] Ensuring Cloudflare Pages project '$SLUG' exists..."
npx wrangler pages project create "$SLUG" --production-branch=main >/dev/null 2>&1 || true

# Step 2: Deploy static build directory
echo "[2/2] Deploying static files to '$SLUG'..."
DEPLOY_OUTPUT="$(npx wrangler pages deploy "$RESOLVED_DIR" --project-name="$SLUG" --branch=main --commit-dirty=true 2>&1)"
DEPLOY_STATUS=$?
echo "$DEPLOY_OUTPUT"

if [[ $DEPLOY_STATUS -ne 0 ]]; then
  echo "❌ Cloudflare Pages deployment failed. Run 'npx wrangler login' if needed." >&2
  exit $DEPLOY_STATUS
fi

# Step 3: Extract root https://<slug>.pages.dev URL (stripping any deployment hash subdomain)
ROOT_URL="https://${SLUG}.pages.dev"
EXTRACTED_DOMAIN="$(echo "$DEPLOY_OUTPUT" | grep -Eo 'https://([a-z0-9]+\.)?[a-z0-9-]+\.pages\.dev' | head -n 1 | sed -E 's|https://([a-z0-9]+\.)?([a-z0-9-]+\.pages\.dev)|https://\2|')"
if [[ -n "$EXTRACTED_DOMAIN" ]]; then
  ROOT_URL="$EXTRACTED_DOMAIN"
fi

# Copy to system clipboard (pbcopy on macOS, clip.exe on WSL, xclip on Linux)
if command -v pbcopy >/dev/null 2>&1; then
  printf "%s" "$ROOT_URL" | pbcopy
elif command -v clip.exe >/dev/null 2>&1; then
  printf "%s" "$ROOT_URL" | clip.exe
elif command -v xclip >/dev/null 2>&1; then
  printf "%s" "$ROOT_URL" | xclip -selection clipboard
fi

echo ""
echo "============================================================"
echo " ✅ LIVE SPEC PREVIEW READY: $ROOT_URL"
echo " 📋 Copied to clipboard! Paste directly into Column T of your Google Sheet."
echo "============================================================"

