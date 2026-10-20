@echo off
setlocal
cd /d "%~dp0"

where python >nul 2>nul
if errorlevel 1 (
  echo python is needed to run ascii cam
  pause
  exit /b 1
)

for /f %%P in ('powershell -NoProfile -Command "$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 0); $listener.Start(); $port = $listener.LocalEndpoint.Port; $listener.Stop(); Write-Output $port"') do set "APP_PORT=%%P"
if not defined APP_PORT (
  echo could not choose a local port
  pause
  exit /b 1
)

start "ascii cam server" /min python -m http.server %APP_PORT% --directory "%~dp0."
timeout /t 1 /nobreak >nul
set "APP_URL=http://localhost:%APP_PORT%"

set "EDGE_PATH=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if not exist "%EDGE_PATH%" set "EDGE_PATH=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
if exist "%EDGE_PATH%" (
  start "" "%EDGE_PATH%" --app=%APP_URL%
  exit /b 0
)

set "CHROME_PATH=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME_PATH%" set "CHROME_PATH=%LocalAppData%\Google\Chrome\Application\chrome.exe"
if exist "%CHROME_PATH%" (
  start "" "%CHROME_PATH%" --app=%APP_URL%
  exit /b 0
)

start "" "%APP_URL%"
endlocal