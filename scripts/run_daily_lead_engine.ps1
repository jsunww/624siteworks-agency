# ============================================================================
# 624 Siteworks Autonomous Scheduled Lead Engine Runner
# ============================================================================

$ErrorActionPreference = "Continue"

$ScriptDir = "F:\624 SITEWORKS\My Sites\624siteworks.com\scripts"
$ProjectDir = "F:\624 SITEWORKS\My Sites\624siteworks.com"
$LogFile = Join-Path $ScriptDir "daily_run.log"

Set-Location -Path $ProjectDir

# Load .env file into environment if present
$EnvFile = Join-Path $ProjectDir ".env"
if (Test-Path $EnvFile) {
    Get-Content $EnvFile | ForEach-Object {
        $line = $_.Trim()
        if ($line -and -not $line.StartsWith("#") -and $line.Contains("=")) {
            $parts = $line.Split("=", 2)
            $name = $parts[0].Trim()
            $val = $parts[1].Trim()
            [System.Environment]::SetEnvironmentVariable($name, $val, "Process")
        }
    }
}

$Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
Write-Output "[$Timestamp] Starting 624 Autonomous Lead Engine..." | Tee-Object -FilePath $LogFile -Append

& node (Join-Path $ScriptDir "autonomous_lead_engine.js") 2>&1 | Tee-Object -FilePath $LogFile -Append

$FinishTime = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
Write-Output "[$FinishTime] Completed 624 Autonomous Lead Engine run." | Tee-Object -FilePath $LogFile -Append
