<#
    apply-patches.ps1  v2.0
    Применяет набор патчей (find → replace) к файлам проекта.
    После успешного применения patches.json автоматически
    перемещается в подпапку applied/ с таймстампом.

    Формат патчей: patches.json в той же папке.

    Использование:
      powershell -ExecutionPolicy Bypass -File .\apply-patches.ps1
      powershell -ExecutionPolicy Bypass -File .\apply-patches.ps1 -DryRun
      powershell -ExecutionPolicy Bypass -File .\apply-patches.ps1 -PatchesFile my.json
      powershell -ExecutionPolicy Bypass -File .\apply-patches.ps1 -NoArchive

    Флаги:
      -DryRun       превью без записи
      -PatchesFile  имя файла (по умолчанию patches.json)
      -NoArchive    не архивировать patches.json после успеха
#>

param(
    [string]$PatchesFile = "patches.json",
    [switch]$DryRun,
    [switch]$NoArchive
)

$ErrorActionPreference = 'Stop'
$scriptDir   = Split-Path -Parent $MyInvocation.MyCommand.Path
$patchesPath = Join-Path $scriptDir $PatchesFile

if (-not (Test-Path $patchesPath)) {
    Write-Host "ОШИБКА: файл не найден: $patchesPath" -ForegroundColor Red
    exit 1
}

$json = Get-Content -Path $patchesPath -Raw -Encoding UTF8 | ConvertFrom-Json
if (-not $json.patches -or $json.patches.Count -eq 0) {
    Write-Host "ОШИБКА: в JSON нет непустого массива 'patches'" -ForegroundColor Red
    exit 1
}

function Read-FileSafe($path) {
    $bytes = [System.IO.File]::ReadAllBytes($path)
    $hasBOM = ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF)
    $enc  = New-Object System.Text.UTF8Encoding $false
    $text = $enc.GetString($bytes)
    if ($hasBOM) { $text = $text.Substring(1) }
    return @{ Text = $text; HasBOM = $hasBOM }
}

function Write-FileSafe($path, $text, $hasBOM) {
    $enc = New-Object System.Text.UTF8Encoding $false
    $outText = if ($hasBOM) { [char]0xFEFF + $text } else { $text }
    $bytes = $enc.GetBytes($outText)
    [System.IO.File]::WriteAllBytes($path, $bytes)
}

$applied = 0
$skipped = 0
$failed  = 0
$backedUp = @{}

Write-Host ""
Write-Host "=== apply-patches.ps1 v2.0 ===" -ForegroundColor Cyan
Write-Host "Файл патчей : $PatchesFile"
Write-Host "Рабочая папка: $scriptDir"
if ($DryRun) { Write-Host "Режим: DRY RUN (без записи)" -ForegroundColor Yellow }
Write-Host ""

$i = 0
foreach ($p in $json.patches) {
    $i++
    $num = $i.ToString("00")

    if (-not $p.file -or $null -eq $p.find -or $null -eq $p.replace) {
        Write-Host "[$num/FAIL] Некорректный патч — нет file/find/replace" -ForegroundColor Red
        $failed++
        continue
    }

    $label = if ($p.label) { $p.label } else { $p.file }
    $path  = Join-Path $scriptDir $p.file

    if (-not (Test-Path $path)) {
        Write-Host "[$num/FAIL] $label : файл не найден ($($p.file))" -ForegroundColor Red
        $failed++
        continue
    }

    $readResult = Read-FileSafe $path
    $content    = $readResult.Text
    $isCRLF     = $content.Contains("`r`n")

    $findLF    = $p.find.Replace("`r`n", "`n").Replace("`r", "")
    $replaceLF = $p.replace.Replace("`r`n", "`n").Replace("`r", "")

    if ($isCRLF) {
        $find    = $findLF.Replace("`n", "`r`n")
        $replace = $replaceLF.Replace("`n", "`r`n")
    } else {
        $find    = $findLF
        $replace = $replaceLF
    }

    $idx = $content.IndexOf($find)
    if ($idx -lt 0) {
        Write-Host "[$num/SKIP] $label : шаблон не найден в $($p.file)" -ForegroundColor Yellow
        $skipped++
        continue
    }

    if ($DryRun) {
        Write-Host "[$num/DRY ] $label : будет применён к $($p.file)" -ForegroundColor Cyan
        continue
    }

    if (-not $backedUp.ContainsKey($p.file)) {
        $backup = "$path.bak"
        Copy-Item $path $backup -Force
        $backedUp[$p.file] = $true
        Write-Host "         [BAK] $($p.file).bak" -ForegroundColor DarkGray
    }

    $count      = ([regex]::Matches($content, [regex]::Escape($find))).Count
    $newContent = $content.Replace($find, $replace)
    Write-FileSafe $path $newContent $readResult.HasBOM

    Write-Host "[$num/OK  ] $label : $($p.file) ($count совпад.)" -ForegroundColor Green
    $applied++
}

if (-not $DryRun -and -not $NoArchive -and $applied -gt 0 -and $failed -eq 0) {
    $archiveDir = Join-Path $scriptDir "applied"
    if (-not (Test-Path $archiveDir)) {
        New-Item -ItemType Directory -Path $archiveDir | Out-Null
    }
    $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $baseName = [System.IO.Path]::GetFileNameWithoutExtension($PatchesFile)
    $archivePath = Join-Path $archiveDir "$baseName-$stamp.json"
    Move-Item $patchesPath $archivePath -Force
    Write-Host ""
    Write-Host "[ARCH] $PatchesFile → applied/$baseName-$stamp.json" -ForegroundColor DarkCyan
}

Write-Host ""
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host ("  ПРИМЕНЕНО: {0}    ПРОПУЩЕНО: {1}    ОШИБОК: {2}" -f $applied, $skipped, $failed) -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host ""

if ($failed -gt 0)  { exit 2 }
if ($skipped -gt 0) { exit 1 }
exit 0