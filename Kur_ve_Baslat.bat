@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul 2>&1
cd /d "%~dp0"
title Antigravity Air Coloring Pro - Tek Tikla Kurulum ve Baslatici

set "KIOSK_MODE=0"
if /I "%~1"=="--kiosk" set "KIOSK_MODE=1"

echo.
echo ============================================================
echo   Antigravity Air Coloring Pro - Tek Tikla Kurulum ^& Baslat
echo ============================================================
echo.

:: 1. Node.js kontrolu (yoksa winget ile otomatik LTS kurulumu)
where node >nul 2>&1
if errorlevel 1 (
  echo [1/4] Node.js bulunamadi. Windows winget ile otomatik kuruluyor...
  where winget >nul 2>&1
  if errorlevel 1 (
    echo [HATA] Node.js ve winget bulunamadi.
    echo Lutfen https://nodejs.org adresinden Node.js LTS kurup bu dosyayi yeniden calistirin.
    start "" "https://nodejs.org"
    pause
    exit /b 1
  )
  winget install --id OpenJS.NodeJS.LTS -e --accept-source-agreements --accept-package-agreements
  set "PATH=%ProgramFiles%\nodejs;%LocalAppData%\Programs\nodejs;%PATH%"
  where node >nul 2>&1
  if errorlevel 1 (
    echo [UYARI] Node.js kuruldu ancak PATH guncellemesi icin bu pencereyi kapatip yeniden acmaniz gerekebilir.
    pause
    exit /b 1
  )
)
for /f "delims=" %%v in ('node -v') do set "NODE_VER=%%v"
echo [OK] Node.js hazir: %NODE_VER%

:: 2. .env yapilandirmasi (ilk kurulumda otomatik olustur + istege bagli Gemini Key)
if not exist ".env" (
  if exist ".env.example" (
    copy /Y ".env.example" ".env" >nul
    echo [2/4] .env dosyasi olusturuldu.
    set "USER_GEMINI_KEY="
    set /p "USER_GEMINI_KEY=Google Gemini API Key varsa yapistirin (Demo modu icin bos birakip Enter'a basin): "
    if not "!USER_GEMINI_KEY!"=="" (
      powershell -NoProfile -Command "$k = $env:USER_GEMINI_KEY.Trim(); (Get-Content '.env') -replace '^GEMINI_API_KEY=.*', ('GEMINI_API_KEY=' + $k) | Set-Content '.env'"
      echo [OK] GEMINI_API_KEY .env dosyasina kaydedildi.
    ) else (
      echo [BILGI] API anahtari bos birakildi; arayuzdeki AI Config veya Demo modu kullanilabilir.
    )
  )
) else (
  echo [OK] .env yapilandirmasi mevcut.
)

:: 3. npm paket kurulumu
if not exist "node_modules\.bin\tsx.cmd" (
  echo [3/4] Bagimliliklar yukleniyor ^(npm install^)...
  call npm install
  if errorlevel 1 (
    echo [HATA] npm install basarisiz oldu.
    pause
    exit /b 1
  )
) else (
  echo [OK] Bagimliliklar mevcut ^(node_modules^).
)

:: 4. Uretim derlemesi (dist yoksa otomatik build)
if not exist "dist\index.html" (
  echo [4/4] Arayuz derleniyor ^(npm run build^)...
  call npm run build
  if errorlevel 1 (
    echo [HATA] npm run build basarisiz oldu.
    pause
    exit /b 1
  )
) else (
  echo [OK] Uretim paketi hazir ^(dist^).
)

set "TARGET_URL=http://localhost:3001"

:: Eger dev arayuzu (5173) veya uretim sunucusu (3001) zaten ayaktaysa mevcut oturumu ac
powershell -NoProfile -Command "try { $r = Invoke-WebRequest 'http://localhost:5173/' -UseBasicParsing -TimeoutSec 2; if ($r.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }"
if %ERRORLEVEL%==0 (
  echo [BILGI] Gelistirme arayuzu ^(http://localhost:5173^) zaten acik. Tarayici aciliyor...
  call :OpenBrowser "http://localhost:5173"
  exit /b 0
)

powershell -NoProfile -Command "try { $r = Invoke-WebRequest 'http://localhost:3001/' -UseBasicParsing -TimeoutSec 2; if ($r.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }"
if %ERRORLEVEL%==0 (
  echo [BILGI] Uretim sunucusu ^(http://localhost:3001^) zaten calisiyor. Tarayici aciliyor...
  call :OpenBrowser "%TARGET_URL%"
  exit /b 0
)

:: Arka planda sunucu hazir olunca tarayiciyi acacak bekleyici baslat
start "" /b powershell -NoProfile -Command "for ($i=0; $i -lt 30; $i++) { try { $r = Invoke-RestMethod 'http://localhost:3001/api/health' -TimeoutSec 1; if ($r.ok) { break } } catch {}; Start-Sleep -Milliseconds 500 }; if ('%KIOSK_MODE%' -eq '1') { $chrome = Join-Path $env:ProgramFiles 'Google\Chrome\Application\chrome.exe'; $edge = Join-Path ${env:ProgramFiles(x86)} 'Microsoft\Edge\Application\msedge.exe'; if (Test-Path $chrome) { Start-Process $chrome @('--kiosk','%TARGET_URL%','--autoplay-policy=no-user-gesture-required') } elseif (Test-Path $edge) { Start-Process $edge @('--kiosk','%TARGET_URL%','--autoplay-policy=no-user-gesture-required') } else { Start-Process '%TARGET_URL%' } } else { Start-Process '%TARGET_URL%' }"

echo.
echo [BASLATILIYOR] Air Coloring Pro (%TARGET_URL%)
echo Kapatmak icin bu pencereyi kapatin veya Ctrl+C tuslarina basin.
echo.
set "NODE_ENV=production"
call "node_modules\.bin\tsx.cmd" server\index.ts
exit /b %ERRORLEVEL%

:OpenBrowser
if "%KIOSK_MODE%"=="1" (
  if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
    start "" "%ProgramFiles%\Google\Chrome\Application\chrome.exe" --kiosk "%~1" --autoplay-policy=no-user-gesture-required
    exit /b 0
  )
  if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" (
    start "" "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" --kiosk "%~1" --autoplay-policy=no-user-gesture-required
    exit /b 0
  )
)
start "" "%~1"
exit /b 0
