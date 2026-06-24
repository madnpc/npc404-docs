# Initialize one scoped planning workspace under docs/.planning/<plan-id>/.
# Usage: .\init-session.ps1 [-ProjectName <name>] [-Autonomous] [-Gated]

param(
    [string]$ProjectName = "untitled",
    [string]$Template = "default",
    [switch]$Autonomous,
    [switch]$Gated
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$SkillRoot = Split-Path -Parent $ScriptDir
$TemplateDir = Join-Path $SkillRoot "templates"
$PlanRoot = Join-Path (Get-Location) "docs/.planning"
$Date = Get-Date -Format "yyyy-MM-dd"

if ($Template -ne "default") {
    Write-Warning "Only the default template is bundled; using it instead of '$Template'."
}

function ConvertTo-PlanSlug {
    param([string]$Name)

    $slug = $Name.ToLowerInvariant() -replace "[^a-z0-9]+", "-"
    $slug = $slug.Trim("-")
    if ([string]::IsNullOrWhiteSpace($slug)) {
        $slug = "untitled-" + [guid]::NewGuid().ToString("N").Substring(0, 8)
    }
    return $slug.Substring(0, [Math]::Min($slug.Length, 40))
}

$BaseId = "$Date-$(ConvertTo-PlanSlug $ProjectName)"
$PlanId = $BaseId
$Suffix = 2
while (Test-Path (Join-Path $PlanRoot $PlanId)) {
    $PlanId = "$BaseId-$Suffix"
    $Suffix++
}

$PlanDir = Join-Path $PlanRoot $PlanId
New-Item -ItemType Directory -Path $PlanDir -Force | Out-Null

function Initialize-PlanFile {
    param([string]$FileName, [string]$Fallback)

    $Target = Join-Path $PlanDir $FileName
    if (Test-Path -LiteralPath $Target) {
        Write-Host "$Target already exists; skipping"
        return
    }

    $Source = Join-Path $TemplateDir $FileName
    if (Test-Path -LiteralPath $Source) {
        Copy-Item -LiteralPath $Source -Destination $Target
    } else {
        Set-Content -LiteralPath $Target -Value $Fallback -Encoding utf8
    }
    Write-Host "Created $Target"
}

Initialize-PlanFile "task_plan.md" "# Task Plan`n`n## Goal`n[Describe the intended end state]"
Initialize-PlanFile "findings.md" "# Findings`n"
Initialize-PlanFile "progress.md" "# Progress Log`n"
Set-Content -LiteralPath (Join-Path $PlanRoot ".active_plan") -Value $PlanId -NoNewline -Encoding ascii

$Attest = Join-Path $ScriptDir "attest-plan.ps1"
if (Test-Path -LiteralPath $Attest) {
    $PreviousPlanId = $env:PLAN_ID
    $env:PLAN_ID = $PlanId
    try { & $Attest *> $null } finally { $env:PLAN_ID = $PreviousPlanId }
}

$Mode = if ($Gated) { "autonomous gate" } elseif ($Autonomous) { "autonomous" } else { "" }
if ($Mode) {
    Set-Content -LiteralPath (Join-Path $PlanDir ".mode") -Value $Mode -Encoding ascii
    Set-Content -LiteralPath (Join-Path $PlanDir ".stop_blocks") -Value "0" -Encoding ascii
    Set-Content -LiteralPath (Join-Path $PlanDir ".nonce") -Value ([guid]::NewGuid().ToString("N").Substring(0, 16)) -NoNewline -Encoding ascii
    if (Test-Path -LiteralPath $Attest) {
        $PreviousPlanId = $env:PLAN_ID
        $env:PLAN_ID = $PlanId
        try { & $Attest *> $null } finally { $env:PLAN_ID = $PreviousPlanId }
    }
}

Write-Host "Planning workspace initialized: $PlanDir"
Write-Host "Active plan: $PlanId"
Write-Host "To pin this session: `$env:PLAN_ID = '$PlanId'"
