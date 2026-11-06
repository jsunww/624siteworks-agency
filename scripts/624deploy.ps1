<#
.SYNOPSIS
    624 Siteworks 1-Click Cloudflare Pages Deployment CLI (Windows PowerShell)
.DESCRIPTION
    Deploys a static spec-website directory to Cloudflare Pages (.pages.dev),
    automatically creates the project if needed, strips deployment-hash subdomains,
    and copies the clean root https://<slug>.pages.dev URL directly to your clipboard.
.EXAMPLE
    .\624deploy.ps1 "Delrar Inc." "F:\624 SITEWORKS\Client Sites\delrar-inc"
#>

param(
    [Parameter(Position = 0, Mandatory = $false)]
    [string]$BusinessName = "",

    [Parameter(Position = 1, Mandatory = $false)]
    [string]$Directory = "."
)

$ErrorActionPreference = "Continue"

# Resolve target directory
$ResolvedDir = (Resolve-Path -Path $Directory).Path

# Default business name to current directory name if not provided
if ([string]::IsNullOrWhiteSpace($BusinessName)) {
    $BusinessName = Split-Path -Path $ResolvedDir -Leaf
}

# Sanitize into a clean, lowercase, hyphenated project slug (max 50 chars)
$Slug = $BusinessName.ToLower() -replace '[^a-z0-9]+', '-'
$Slug = $Slug -replace '^-+|-+$', ''
if ($Slug.Length -gt 50) {
    $Slug = $Slug.Substring(0, 50) -replace '-+$', ''
}

if ([string]::IsNullOrWhiteSpace($Slug)) {
    Write-Error "Could not generate a valid project slug from '$BusinessName'."
    exit 1
}

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " 624 Siteworks - Deploying Spec Site to Cloudflare Pages" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " Business Name : $BusinessName"
Write-Host " Project Slug  : $Slug"
Write-Host " Source Folder : $ResolvedDir"
Write-Host "------------------------------------------------------------" -ForegroundColor DarkGray

# Remove any accidental Worker wrangler.jsonc inside the static client directory
Remove-Item (Join-Path $ResolvedDir "wrangler.jsonc"), (Join-Path $ResolvedDir ".assetsignore") -Force -ErrorAction SilentlyContinue

# Step 1: Ensure Cloudflare Pages project exists (use --force to create a classic .pages.dev project)
Write-Host "`n[1/2] Ensuring Cloudflare Pages project '$Slug' exists..." -ForegroundColor Yellow
cmd /c "npx wrangler pages project create $Slug --production-branch=main --force >nul 2>&1"
Remove-Item (Join-Path $ResolvedDir "wrangler.jsonc"), (Join-Path $ResolvedDir ".assetsignore") -Force -ErrorAction SilentlyContinue

# Step 2: Deploy static directory to production branch (.pages.dev)
Write-Host "[2/2] Deploying static files to '$Slug.pages.dev'..." -ForegroundColor Yellow
$DeployLines = cmd /c "npx wrangler pages deploy `"$ResolvedDir`" --project-name=$Slug --branch=main --commit-dirty=true 2>&1"
$DeployExitCode = $LASTEXITCODE
$DeployText = $DeployLines -join "`n"
Write-Host $DeployText

if ($DeployExitCode -ne 0) {
    Write-Error "Cloudflare Pages deployment failed. Make sure you are logged in via 'npx wrangler login'."
    exit $DeployExitCode
}

# Step 3: Extract root https://<slug>.pages.dev URL (stripping any deployment hash subdomain)
$RootUrl = "https://$Slug.pages.dev"
$RegexMatch = [regex]::Match($DeployText, 'https://(?:[a-z0-9]+\.)?([a-z0-9-]+\.pages\.dev)')
if ($RegexMatch.Success) {
    $RootUrl = "https://$($RegexMatch.Groups[1].Value)"
}

# Copy directly to Windows clipboard
Set-Clipboard -Value $RootUrl

Write-Host "`n============================================================" -ForegroundColor Green
Write-Host " LIVE SPEC PREVIEW READY: $RootUrl" -ForegroundColor Green
Write-Host " Copied to clipboard! Paste directly into Column T of your Google Sheet." -ForegroundColor Green
Write-Host "============================================================`n" -ForegroundColor Green
