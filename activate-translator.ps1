$ErrorActionPreference = 'Stop'
Push-Location $PSScriptRoot
try {
    $nodePath = (Get-Command node -ErrorAction Stop).Source
    & $nodePath --env-file-if-exists=.env check-translator.mjs
    if ($LASTEXITCODE -ne 0) { throw '真实翻译验证失败，现有调试服务未改动。' }
    $statePath = Join-Path $PSScriptRoot '.debug\processes.json'
    if (-not (Test-Path -LiteralPath $statePath)) { throw '尚未启动手机调试，请运行 start-mobile.ps1。' }
    $state = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
    $running = Get-Process -Id $state.serverPid -ErrorAction Stop
    if ($running.StartTime.ToUniversalTime() -ne ([datetime]$state.serverStarted).ToUniversalTime()) { throw '服务进程记录不匹配，未执行重启。' }
    Stop-Process -Id $running.Id
    $replacement = Start-Process -FilePath $nodePath -ArgumentList '--env-file-if-exists=.env','mobile-server.mjs' -WorkingDirectory $PSScriptRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $PSScriptRoot '.debug\server.log') -RedirectStandardError (Join-Path $PSScriptRoot '.debug\server-error.log')
    $state.serverPid = $replacement.Id
    $state.serverStarted = $replacement.StartTime.ToUniversalTime().ToString('o')
    $state | ConvertTo-Json | Set-Content -LiteralPath $statePath
    Start-Sleep -Seconds 1
    if ($replacement.HasExited) { throw '服务未成功启动，请检查 .debug/server-error.log。' }
    $passwordValue = (Get-Content -LiteralPath (Join-Path $PSScriptRoot '.debug\password.txt') -Raw).Trim()
    $authValue = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes('debug:' + $passwordValue))
    $statusValue = Invoke-RestMethod -Uri 'http://127.0.0.1:3101/api/status' -Headers @{Authorization='Basic '+$authValue}
    if ($statusValue.mode -ne 'live') { throw '服务尚未加载真实翻译配置。' }
    Write-Output '手机服务已切换到真实翻译。HTTPS 地址与登录口令不变，请刷新 Safari 页面。'
} finally { Pop-Location }
