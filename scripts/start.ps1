# Запуск BARS Barber Club одной командой (Windows).
# Двойной клик по start.cmd в корне проекта: проверяет Node.js, готовит .env,
# ставит зависимости, применяет миграции, запускает API + сайт и открывает браузер.
# Ctrl+C в окне — остановить всё.

param(
  [switch]$Seed,       # заполнить базу демо-данными (услуги, мастера, товары)
  [switch]$NoBrowser   # не открывать браузер
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root
$env:COREPACK_ENABLE_DOWNLOAD_PROMPT = '0'

function Step($text) { Write-Host "`n==> $text" -ForegroundColor Yellow }
function Ok($text) { Write-Host "    $text" -ForegroundColor Green }
function Fail($text) {
  Write-Host "`n[!] $text" -ForegroundColor Red
  Read-Host "`nНажмите Enter, чтобы закрыть"
  exit 1
}

function New-Secret {
  $bytes = New-Object byte[] 32
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  -join ($bytes | ForEach-Object { $_.ToString('x2') })
}

# UTF-8 без BOM: BOM в начале .env ломает первую переменную
function Write-Utf8($file, [string[]]$lines) {
  [System.IO.File]::WriteAllLines($file, $lines, (New-Object System.Text.UTF8Encoding $false))
}

function Set-EnvValue($file, $key, $value) {
  $lines = @(Get-Content $file -Encoding UTF8)
  $line = $key + '="' + $value + '"'
  if ($lines -match "^$key=") { $lines = $lines -replace "^$key=.*$", $line } else { $lines += $line }
  Write-Utf8 $file $lines
}

Write-Host '  BARS Barber Club — локальный запуск' -ForegroundColor Cyan

# ── 1. Node.js ────────────────────────────────────────────────────────
Step 'Проверяю Node.js'
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) { Fail 'Node.js не найден. Установите Node.js 22 или 24 LTS: https://nodejs.org и запустите снова.' }
$ver = [version]((node -v).TrimStart('v'))
if ($ver -lt [version]'22.13.0' -or $ver.Major -ge 25) {
  Fail "Нужен Node.js 22.13+ или 24 (у вас $ver). Скачайте LTS: https://nodejs.org"
}
Ok "Node.js $ver"

# ── 2. Переменные окружения ───────────────────────────────────────────
Step 'Проверяю настройки (.env)'
$apiEnv = Join-Path $Root 'backend\.env'
$webEnv = Join-Path $Root 'frontend\.env.local'

if (-not (Test-Path $apiEnv)) {
  Copy-Item (Join-Path $Root '.env.example') $apiEnv
  Set-EnvValue $apiEnv 'JWT_SECRET' (New-Secret)
  Set-EnvValue $apiEnv 'STORAGE_SIGNING_SECRET' (New-Secret)
  Set-EnvValue $apiEnv 'AI_PROVIDER' 'mock'
  Ok 'Создан backend\.env из .env.example (секреты сгенерированы)'
}
if (-not (Test-Path $webEnv)) {
  Write-Utf8 $webEnv @('NEXT_PUBLIC_API_URL="http://localhost:3001"', 'NEXT_PUBLIC_SITE_URL="http://localhost:3000"')
  Ok 'Создан frontend\.env.local'
}

$dbLine = (Get-Content $apiEnv -Encoding UTF8 | Where-Object { $_ -match '^DATABASE_URL=' }) -join ''
if (-not $dbLine -or $dbLine -match 'USER:PASSWORD|@HOST|=""') {
  Write-Host "`n    В backend\.env не указана база данных (DATABASE_URL и DIRECT_URL)." -ForegroundColor Red
  Write-Host '    Вставьте строки подключения Neon (console.neon.tech → Connect), сохраните файл и запустите снова.'
  Start-Process notepad.exe $apiEnv
  Read-Host "`nНажмите Enter, чтобы закрыть"
  exit 1
}
Ok 'Настройки на месте'

# ── 3. Зависимости ────────────────────────────────────────────────────
Step 'Проверяю зависимости'
$modules = Join-Path $Root 'node_modules\.modules.yaml'
$lock = Join-Path $Root 'pnpm-lock.yaml'
if (-not (Test-Path $modules) -or (Get-Item $lock).LastWriteTime -gt (Get-Item $modules).LastWriteTime) {
  Ok 'Устанавливаю пакеты (первый раз — несколько минут)...'
  corepack pnpm install --frozen-lockfile
  if ($LASTEXITCODE -ne 0) { Fail 'Не удалось установить зависимости (см. ошибку выше).' }
} else {
  Ok 'Зависимости установлены'
}

# ── 4. База данных ────────────────────────────────────────────────────
Step 'Готовлю базу данных'
corepack pnpm --filter @barbershop/shared build | Out-Null
if ($LASTEXITCODE -ne 0) { Fail 'Не удалось собрать общий пакет @barbershop/shared.' }
corepack pnpm --filter @barbershop/api exec prisma generate | Out-Null
if ($LASTEXITCODE -ne 0) { Fail 'prisma generate завершился с ошибкой.' }
corepack pnpm --filter @barbershop/api exec prisma migrate deploy
if ($LASTEXITCODE -ne 0) { Fail 'Не удалось применить миграции. Проверьте DATABASE_URL и DIRECT_URL в backend\.env.' }
if ($Seed) {
  Ok 'Заполняю демо-данными...'
  corepack pnpm db:seed
  if ($LASTEXITCODE -ne 0) { Fail 'Сид завершился с ошибкой.' }
}
Ok 'База готова'

# ── 5. Порты и кэш ────────────────────────────────────────────────────
Step 'Освобождаю порты 3000 и 3001'
foreach ($port in 3000, 3001) {
  $conns = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
  foreach ($c in $conns) {
    $proc = Get-CimInstance Win32_Process -Filter "ProcessId=$($c.OwningProcess)"
    if ($proc.CommandLine -and $proc.CommandLine -like "*$Root*") {
      Stop-Process -Id $c.OwningProcess -Force
      Ok "Остановлен прошлый запуск на порту $port"
    } else {
      Fail "Порт $port занят другой программой ($($proc.Name)). Закройте её и запустите снова."
    }
  }
}
# OneDrive превращает кэш Next.js в «облачные заглушки», из-за которых dev-сервер падает
Remove-Item (Join-Path $Root 'frontend\.next') -Recurse -Force -ErrorAction SilentlyContinue
Ok 'Готово'

# ── 6. Запуск ─────────────────────────────────────────────────────────
Step 'Запускаю API (http://localhost:3001) и сайт (http://localhost:3000)'
Write-Host '    Остановить: Ctrl+C в этом окне' -ForegroundColor DarkGray

if (-not $NoBrowser) {
  # Открываем сайт, когда он начнёт отвечать (первая компиляция ~20–40 с)
  Start-Job -ScriptBlock {
    for ($i = 0; $i -lt 120; $i++) {
      try {
        Invoke-WebRequest 'http://localhost:3000' -UseBasicParsing -TimeoutSec 60 | Out-Null
        Start-Process 'http://localhost:3000'
        return
      } catch { Start-Sleep -Seconds 2 }
    }
  } | Out-Null
}

# Только API и сайт: watch общего пакета чистит его сборку на старте и мешает им запуститься
corepack pnpm --filter @barbershop/api --filter @barbershop/web --parallel --stream run dev
