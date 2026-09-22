$ErrorActionPreference = 'Stop'
$statePath = Join-Path $PSScriptRoot '.debug\processes.json'
if (-not (Test-Path -LiteralPath $statePath)) { Write-Output '没有记录中的手机调试会话。'; exit }
$state = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
foreach ($kind in @('tunnel','server')) {
    $pidValue = $state."${kind}Pid"
    $startedValue = $state."${kind}Started"
    $process = Get-Process -Id $pidValue -ErrorAction SilentlyContinue
    if ($process -and $process.StartTime.ToUniversalTime() -eq ([datetime]$startedValue).ToUniversalTime()) { Stop-Process -Id $pidValue }
}
Remove-Item -LiteralPath $statePath
Write-Output '手机调试服务与 HTTPS 连接已关闭。'
