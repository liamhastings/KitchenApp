# ralph.ps1 - controlled agent loop. Run from the repo root on a feature branch.
# Usage: .\ralph.ps1 -MaxIterations 5 -TestCommand "npm test"
param(
    [int]$MaxIterations = 5,
    [string]$TestCommand = "npm test"
)

# Safety: never loop on main
$branch = git branch --show-current
if ($branch -eq "main" -or $branch -eq "master") {
    Write-Error "You're on '$branch'. Create a feature branch first (git switch -c feat/<name>)."
    exit 1
}

if (-not (Test-Path TASK.md)) {
    Write-Error "TASK.md not found in this folder."
    exit 1
}

for ($i = 1; $i -le $MaxIterations; $i++) {
    Write-Host "`n=== Iteration $i of $MaxIterations ===" -ForegroundColor Cyan

    # Fresh Claude session each pass; it reads TASK.md + PROGRESS.md to pick up where it left off.
    # acceptEdits lets it edit files; only the listed shell commands are allowed without asking.
    Get-Content -Raw TASK.md | claude -p `
        --permission-mode acceptEdits `
        --allowedTools "Bash($TestCommand*)" "Bash(git add:*)" "Bash(git commit:*)" "Bash(git status)" "Bash(git diff:*)"

    # The loop, not the agent, decides when we're done
    Invoke-Expression $TestCommand
    if ($LASTEXITCODE -eq 0) {
        Write-Host "`nTests pass - done after $i iteration(s). Review with: git log --oneline main..HEAD" -ForegroundColor Green
        exit 0
    }
}

Write-Host "`nHit the $MaxIterations-iteration cap without passing tests. Check PROGRESS.md and git log." -ForegroundColor Yellow
exit 1
