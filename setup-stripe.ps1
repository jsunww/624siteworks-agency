<#
.SYNOPSIS
    624 Siteworks - 1-Click Automatic Stripe Products & Payment Links Setup
.DESCRIPTION
    Opens Stripe API Keys in your browser, pops up a Windows input box for your
    Stripe Secret Key (sk_live_... or sk_test_... or rk_...), creates all 5 products
    and 6 Payment Links via the official Stripe API, and writes the live
    https://buy.stripe.com/... URLs directly into claim.html.
#>

param(
    [Parameter(Mandatory = $false)]
    [string]$StripeSecretKey = ""
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($StripeSecretKey)) {
    # Open Stripe API Keys page in default browser
    cmd /c start "" "https://dashboard.stripe.com/apikeys"

    # Show native Windows GUI InputBox so user can paste their key easily
    Add-Type -AssemblyName Microsoft.VisualBasic
    $PromptText = "1. In the Stripe browser tab that just opened (dashboard.stripe.com/apikeys), copy your 'Secret key' (starts with sk_live_... or sk_test_... or rk_...).`n`n2. Paste it below and click OK (your key is only used in memory and is NEVER saved to disk):"
    $StripeSecretKey = [Microsoft.VisualBasic.Interaction]::InputBox($PromptText, "624 Siteworks - Automatic Stripe Setup", "")
    $StripeSecretKey = $StripeSecretKey.Trim()
}

if ([string]::IsNullOrWhiteSpace($StripeSecretKey)) {
    Write-Error "No Stripe Secret Key provided. Exiting."
    exit 1
}

$Headers = @{
    "Authorization" = "Bearer $StripeSecretKey"
    "Content-Type"  = "application/x-www-form-urlencoded"
}

function Invoke-StripePost {
    param([string]$Endpoint, [hashtable]$FormFields)
    $Pairs = foreach ($k in $FormFields.Keys) {
        "$([uri]::EscapeDataString($k))=$([uri]::EscapeDataString([string]$FormFields[$k]))"
    }
    $Body = $Pairs -join "&"
    return Invoke-RestMethod -Method Post -Uri "https://api.stripe.com/v1/$Endpoint" -Headers $Headers -Body $Body
}

Write-Host "`n[1/3] Creating 624 Siteworks Products & Prices in Stripe..." -ForegroundColor Cyan

# 1. Starter Website Build ($595 one-off)
$StarterProd = Invoke-StripePost "products" @{
    "name"        = "Starter Website Build (624 Siteworks)"
    "description" = "Custom 4-page mobile-optimized static website build (Home + up to 3 additional pages), lead capture form, and local SEO setup."
}
$StarterPrice = Invoke-StripePost "prices" @{
    "product"     = $StarterProd.id
    "unit_amount" = "59500"
    "currency"    = "usd"
}
Write-Host "  + Created Starter Website Build ($595)" -ForegroundColor Green

# 2. Pro Website Build ($995 one-off)
$ProProd = Invoke-StripePost "products" @{
    "name"        = "Pro Website Build (624 Siteworks)"
    "description" = "Custom website build (Home + up to 6 additional pages), advanced local SEO & JSON-LD schema, and Lighthouse performance tuning."
}
$ProPrice = Invoke-StripePost "prices" @{
    "product"     = $ProProd.id
    "unit_amount" = "99500"
    "currency"    = "usd"
}
Write-Host "  + Created Pro Website Build ($995)" -ForegroundColor Green

# 3. Premium Website Build ($1,695 one-off)
$PremiumProd = Invoke-StripePost "products" @{
    "name"        = "Premium Website Build (624 Siteworks)"
    "description" = "Up to 10 custom pages, on-site drone & team photography, Google Business Profile setup, and 6 months of the Peace of Mind Plan included."
}
$PremiumPrice = Invoke-StripePost "prices" @{
    "product"     = $PremiumProd.id
    "unit_amount" = "169500"
    "currency"    = "usd"
}
Write-Host "  + Created Premium Website Build ($1,695)" -ForegroundColor Green

# 4. Peace of Mind Hosting & Care Plan ($89/mo recurring)
$CareProd = Invoke-StripePost "products" @{
    "name"        = "Peace of Mind Website Hosting & Care Plan"
    "description" = "Global CDN hosting, enterprise SSL security, domain management, and minor monthly content updates."
}
$CarePrice = Invoke-StripePost "prices" @{
    "product"              = $CareProd.id
    "unit_amount"          = "8900"
    "currency"             = "usd"
    "recurring[interval]"  = "month"
}
Write-Host "  + Created Peace of Mind Monthly Care Plan ($89/mo)" -ForegroundColor Green

Write-Host "`n[2/3] Generating 6 Stripe Payment Links..." -ForegroundColor Cyan
$CustomConfirmMsg = "Thank you! Jason from 624 Siteworks will reach out within 1 business day to schedule your customization & domain launch call."

# Link 1: Starter + $89/mo Care Plan
$LinkStarterCare = Invoke-StripePost "payment_links" @{
    "line_items[0][price]"                          = $StarterPrice.id
    "line_items[0][quantity]"                       = "1"
    "line_items[1][price]"                          = $CarePrice.id
    "line_items[1][quantity]"                       = "1"
    "phone_number_collection[enabled]"              = "true"
    "after_completion[type]"                        = "hosted_confirmation"
    "after_completion[hosted_confirmation][custom_message]" = $CustomConfirmMsg
}

# Link 2: Starter Build Only ($595)
$LinkStarterOnly = Invoke-StripePost "payment_links" @{
    "line_items[0][price]"                          = $StarterPrice.id
    "line_items[0][quantity]"                       = "1"
    "phone_number_collection[enabled]"              = "true"
    "after_completion[type]"                        = "hosted_confirmation"
    "after_completion[hosted_confirmation][custom_message]" = $CustomConfirmMsg
}

# Link 3: Pro + $89/mo Care Plan
$LinkProCare = Invoke-StripePost "payment_links" @{
    "line_items[0][price]"                          = $ProPrice.id
    "line_items[0][quantity]"                       = "1"
    "line_items[1][price]"                          = $CarePrice.id
    "line_items[1][quantity]"                       = "1"
    "phone_number_collection[enabled]"              = "true"
    "after_completion[type]"                        = "hosted_confirmation"
    "after_completion[hosted_confirmation][custom_message]" = $CustomConfirmMsg
}

# Link 4: Pro Build Only ($995)
$LinkProOnly = Invoke-StripePost "payment_links" @{
    "line_items[0][price]"                          = $ProPrice.id
    "line_items[0][quantity]"                       = "1"
    "phone_number_collection[enabled]"              = "true"
    "after_completion[type]"                        = "hosted_confirmation"
    "after_completion[hosted_confirmation][custom_message]" = $CustomConfirmMsg
}

# Link 5: Premium Build ($1,695)
$LinkPremium = Invoke-StripePost "payment_links" @{
    "line_items[0][price]"                          = $PremiumPrice.id
    "line_items[0][quantity]"                       = "1"
    "phone_number_collection[enabled]"              = "true"
    "after_completion[type]"                        = "hosted_confirmation"
    "after_completion[hosted_confirmation][custom_message]" = $CustomConfirmMsg
}

# Link 6: Standalone $89/mo Care Plan
$LinkCareOnly = Invoke-StripePost "payment_links" @{
    "line_items[0][price]"                          = $CarePrice.id
    "line_items[0][quantity]"                       = "1"
    "phone_number_collection[enabled]"              = "true"
    "after_completion[type]"                        = "hosted_confirmation"
    "after_completion[hosted_confirmation][custom_message]" = $CustomConfirmMsg
}

Write-Host "`n[3/3] Updating claim.html with your live Stripe Payment Links..." -ForegroundColor Cyan

$ClaimPath = Join-Path $PSScriptRoot "claim.html"
$ClaimHtml = Get-Content -Path $ClaimPath -Raw -Encoding UTF8

$ClaimHtml = $ClaimHtml -replace "starterWithCarePlan:\s*'[^']*'", "starterWithCarePlan: '$($LinkStarterCare.url)'"
$ClaimHtml = $ClaimHtml -replace "starterBuildOnly:\s*'[^']*'",    "starterBuildOnly:    '$($LinkStarterOnly.url)'"
$ClaimHtml = $ClaimHtml -replace "proWithCarePlan:\s*'[^']*'",     "proWithCarePlan:     '$($LinkProCare.url)'"
$ClaimHtml = $ClaimHtml -replace "proBuildOnly:\s*'[^']*'",        "proBuildOnly:        '$($LinkProOnly.url)'"
$ClaimHtml = $ClaimHtml -replace "premiumBuild:\s*'[^']*'",        "premiumBuild:        '$($LinkPremium.url)'"
$ClaimHtml = $ClaimHtml -replace "standaloneCarePlan:\s*'[^']*'",  "standaloneCarePlan:  '$($LinkCareOnly.url)'"

Set-Content -Path $ClaimPath -Value $ClaimHtml -Encoding UTF8

Write-Host "`n============================================================" -ForegroundColor Green
Write-Host " SUCCESS! All 6 Stripe Payment Links created & wired into claim.html!" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host " Starter + $89/mo : $($LinkStarterCare.url)"
Write-Host " Starter ($595)   : $($LinkStarterOnly.url)"
Write-Host " Pro + $89/mo     : $($LinkProCare.url)"
Write-Host " Pro ($995)       : $($LinkProOnly.url)"
Write-Host " Premium ($1,695) : $($LinkPremium.url)"
Write-Host " Care Only ($89/m): $($LinkCareOnly.url)"
Write-Host "============================================================`n" -ForegroundColor Green
