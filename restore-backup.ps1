<#
    restore-backup.ps1
    Восстанавливает файлы из .bak, созданных apply-patches.ps1.

    Использование:
      powershell -ExecutionPolicy Bypass -File .\restore-backup.ps1
      powershell -ExecutionPolicy Bypass -File .\restore-backup.ps1 -File engine.js
#>

param(
    [string[]]$File
)

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

if ($File) {
    $targets = $File | ForEach-Object { Join-Path $scriptDir $_ }
} else {
    $targets = Get-ChildItem -Path $scriptDir -Filter "*.bak" -File |
               ForEach-Object { $_.FullName -replace '\.bak$', '' }
}

$restored = 0

foreach ($target in $targets) {
    $backup = "$target.bak"
    if (Test-Path $backup) {
        Copy-Item $backup $target -Force
        Remove-Item $backup -Force
        Write-Host "[OK] $target восстановлен" -ForegroundColor Green
        $restored++
    } else {
        Write-Host "[SKIP] нет бэкапа для $target" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "Восстановлено: $restored" -ForegroundColor Cyan