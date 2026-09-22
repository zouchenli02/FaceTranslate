$ErrorActionPreference = 'Stop'
$projectDir = $PSScriptRoot
$nodePath = (Get-Command node -ErrorAction Stop).Source
$tunnelPath = Join-Path $projectDir '.tools\cloudflared.exe'
$debugDir = Join-Path $projectDir '.debug'
if (-not (Test-Path -LiteralPath $tunnelPath)) { throw '缺少 .tools/cloudflared.exe，请从 Cloudflare 官方下载 Windows amd64 版本。' }
New-Item -ItemType Directory -Path $debugDir -Force | Out-Null
if (Test-Path (Join-Path $debugDir 'processes.json')) { throw '已有调试会话记录。先执行 stop-mobile.ps1，再重新启动。' }
$serverProcess = Start-Process -FilePath $nodePath -ArgumentList '--env-file-if-exists=.env','mobile-server.mjs' -WorkingDirectory $projectDir -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $debugDir 'server.log') -RedirectStandardError (Join-Path $debugDir 'server-error.log')
try {
    Start-Sleep -Seconds 1
    if ($serverProcess.HasExited) { throw '调试服务启动失败，检查 .debug/server-error.log' }
    $tunnelProcess = Start-Process -FilePath $tunnelPath -ArgumentList 'tunnel','--url','http://127.0.0.1:3101','--protocol','http2','--no-autoupdate' -WorkingDirectory $projectDir -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $debugDir 'tunnel.log') -RedirectStandardError (Join-Path $debugDir 'tunnel-error.log')
    @{ serverPid=$serverProcess.Id; serverStarted=$serverProcess.StartTime.ToUniversalTime().ToString('o'); tunnelPid=$tunnelProcess.Id; tunnelStarted=$tunnelProcess.StartTime.ToUniversalTime().ToString('o') } | ConvertTo-Json | Set-Content (Join-Path $debugDir 'processes.json')
    Write-Output '手机调试已启动。HTTPS 地址见 .debug/tunnel-error.log；用户名 debug；口令见 .debug/password.txt。'
} catch { if (-not $serverProcess.HasExited) { $serverProcess.Kill() }; throw }
