param(
    [int]$MaxPhases = 20,
    [string]$RoadmapPath = "docs/grade3-mastery-map-roadmap.md",
    [string]$SkillPath = ".claude/skills/next-grade3-phase/SKILL.md",
    [string]$BranchName = "feature/grade3-mastery-map-auto",
    [switch]$Push,
    [switch]$AllowDirty
)

$ErrorActionPreference = "Stop"

function Run-Cmd {
    param(
        [string]$Command,
        [switch]$IgnoreExitCode
    )

    Write-Host ""
    Write-Host ">>> $Command" -ForegroundColor Cyan

    cmd /c $Command
    $code = $LASTEXITCODE

    if ($code -ne 0 -and -not $IgnoreExitCode) {
        throw "Command failed with exit code $code`: $Command"
    }

    return $code
}

function Get-GitOutput {
    param([string]$Command)

    $output = cmd /c $Command
    if ($LASTEXITCODE -ne 0) {
        throw "Git command failed: $Command"
    }
    return ($output | Out-String).Trim()
}

function Has-UncommittedChanges {
    $status = Get-GitOutput "git status --porcelain"
    return -not [string]::IsNullOrWhiteSpace($status)
}

function Get-NextTodoPhase {
    param([string]$Path)

    if (-not (Test-Path $Path)) {
        throw "Roadmap file not found: $Path"
    }

    $text = Get-Content $Path -Raw

    # Find first section that looks like:
    # ### Phase 7 — ...
    # ...
    # Status: TODO
    $match = [regex]::Match(
        $text,
        "(?ms)^###\s+Phase\s+(\d+).*?^\s*Status:\s*TODO\s*$"
    )

    if ($match.Success) {
        return [int]$match.Groups[1].Value
    }

    return $null
}

function Invoke-ClaudeForOnePhase {
    param(
        [int]$Phase,
        [string]$SkillPath,
        [string]$LogPath
    )

    $prompt = @"
Read $SkillPath and execute it exactly.

Automation context:
- Implement only the next TODO phase from docs/grade3-mastery-map-roadmap.md.
- The next phase should be Phase $Phase.
- Do not ask me questions.
- Make reasonable small implementation choices if needed.
- Do not implement future phases.
- Do not commit changes; the PowerShell script will commit after CI passes.
- If CI fails, fix failures caused by your changes if possible.
"@

    Write-Host ""
    Write-Host "=== Running Claude for Phase $Phase ===" -ForegroundColor Yellow

    $output = & claude -p $prompt 2>&1
    $exitCode = $LASTEXITCODE

    $output | Tee-Object -FilePath $LogPath

    if ($exitCode -ne 0) {
        throw "Claude failed with exit code $exitCode. See log: $LogPath"
    }
}

# ─────────────────────────────────────────────────────────────
# Preflight
# ─────────────────────────────────────────────────────────────

Write-Host "MathFan Grade 3 auto-runner" -ForegroundColor Green

if (-not (Test-Path $RoadmapPath)) {
    throw "Missing roadmap: $RoadmapPath"
}

if (-not (Test-Path $SkillPath)) {
    throw "Missing skill: $SkillPath"
}

Run-Cmd "git rev-parse --is-inside-work-tree" | Out-Null

$currentBranch = Get-GitOutput "git branch --show-current"
Write-Host "Current branch: $currentBranch"

if ((Has-UncommittedChanges) -and -not $AllowDirty) {
    throw "Working tree is not clean. Commit/stash your changes first, or rerun with -AllowDirty."
}

# Create/switch branch if not already on target branch
if ($currentBranch -ne $BranchName) {
    $branches = Get-GitOutput "git branch --list $BranchName"
    if ([string]::IsNullOrWhiteSpace($branches)) {
        Run-Cmd "git checkout -b $BranchName"
    } else {
        Run-Cmd "git checkout $BranchName"
    }
}

if (-not (Test-Path "logs")) {
    New-Item -ItemType Directory -Path "logs" | Out-Null
}

# Optional baseline CI before automation
Write-Host ""
Write-Host "Running baseline CI..." -ForegroundColor Yellow
Run-Cmd "npm run ci"

# ─────────────────────────────────────────────────────────────
# Main loop
# ─────────────────────────────────────────────────────────────

$completed = 0

for ($i = 1; $i -le $MaxPhases; $i++) {
    $phase = Get-NextTodoPhase $RoadmapPath

    if ($null -eq $phase) {
        Write-Host ""
        Write-Host "No TODO phases remain. Done." -ForegroundColor Green
        break
    }

    $beforeHead = Get-GitOutput "git rev-parse HEAD"
    $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $logPath = "logs/grade3-phase-$phase-$timestamp.log"

    Invoke-ClaudeForOnePhase -Phase $phase -SkillPath $SkillPath -LogPath $logPath

    Write-Host ""
    Write-Host "Running CI after Phase $phase..." -ForegroundColor Yellow
    Run-Cmd "npm run ci"

    $nextPhaseAfter = Get-NextTodoPhase $RoadmapPath

    if ($nextPhaseAfter -eq $phase) {
        throw "Phase $phase still appears as TODO after Claude finished. Stop for manual inspection. Log: $logPath"
    }

    if (-not (Has-UncommittedChanges)) {
        $afterHead = Get-GitOutput "git rev-parse HEAD"

        if ($afterHead -eq $beforeHead) {
            throw "No file changes and no commit detected for Phase $phase. Stop for manual inspection."
        }

        Write-Host "Phase $phase appears already committed by Claude." -ForegroundColor Green
    } else {
        Run-Cmd "git add ."
        Run-Cmd "git commit -m `"feat: complete grade3 mastery map phase $phase`""
    }

    $commit = Get-GitOutput "git rev-parse --short HEAD"
    Write-Host "Completed Phase $phase at commit $commit" -ForegroundColor Green

    if ($Push) {
        Run-Cmd "git push -u origin $BranchName"
    }

    $completed++
}

Write-Host ""
Write-Host "Automation finished. Phases completed in this run: $completed" -ForegroundColor Green
Write-Host "Current branch: $(Get-GitOutput "git branch --show-current")"
Write-Host "Latest commit: $(Get-GitOutput "git log --oneline -1")"