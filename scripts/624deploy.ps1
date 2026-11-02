<#
.SYNOPSIS
    624 Siteworks 1-Click Cloudflare Deployment CLI (Windows PowerShell)
.DESCRIPTION
    Deploys a static spec-website directory to the latest version of Cloudflare Pages
    (now part of Cloudflare Workers), automatically creates the project config if needed,
    and copies the clean live URL directly to your clipboard.
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
Write-Host " 624 Siteworks - Deploying Spec Site to Cloudflare" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " Business Name : $BusinessName"
Write-Host " Project Slug  : $Slug"
Write-Host " Source Folder : $ResolvedDir"
Write-Host "------------------------------------------------------------" -ForegroundColor DarkGray

Push-Location $ResolvedDir
try {
    # Ensure wrangler.jsonc exists for static assets deployment
    $WranglerConfigPath = Join-Path $ResolvedDir "wrangler.jsonc"
    if (-not (Test-Path $WranglerConfigPath)) {
        $CompatDate = (Get-Date).ToString("yyyy-MM-dd")
        $ConfigJson = @"
{
  "name": "$Slug",
  "compatibility_date": "$CompatDate",
  "assets": {
    "directory": "."
  }
}
"@
        Set-Content -Path $WranglerConfigPath -Value $ConfigJson -Encoding UTF8
    }

    Write-Host "`nDeploying static files for '$Slug' via wrangler deploy..." -ForegroundColor Yellow
    $DeployLines = cmd /c "npx wrangler deploy 2>&1"
    $DeployExitCode = $LASTEXITCODE
    $DeployText = $DeployLines -join "`n"
    Write-Host $DeployText
} finally {
    Pop-Location
}

if ($DeployExitCode -ne 0) {
    Write-Error "Cloudflare deployment failed. Make sure you are logged in via 'npx wrangler login'."
    exit $DeployExitCode
}

# Extract live URL (.workers.dev or .pages.dev)
$LiveUrl = "https://$Slug.jsunww.workers.dev"
$RegexMatch = [regex]::Match($DeployText, 'https://[a-z0-9.-]+\.(?:workers|pages)\.dev')
if ($RegexMatch.Success) {
    $LiveUrl = $RegexMatch.Value
}

# Copy directly to Windows clipboard
Set-Clipboard -Value $LiveUrl

Write-Host "`n============================================================" -ForegroundColor Green
Write-Host " LIVE SPEC PREVIEW READY: $LiveUrl" -ForegroundColor Green
Write-Host " Copied to clipboard! Paste directly into Column T of your Google Sheet." -ForegroundColor Green
Write-Host "============================================================`n" -ForegroundColor Green
