$ErrorActionPreference = 'Stop'
$statePath = Join-Path $PSScriptRoot '.debug\processes.json'
if (-not (Test-Path -LiteralPath $statePath)) { Write-Output 'No recorded mobile debug session.'; exit }
$state = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
foreach ($kind in @('tunnel','server')) {
    $pidValue = $state."${kind}Pid"
    $startedValue = $state."${kind}Started"
    $process = Get-Process -Id $pidValue -ErrorAction SilentlyContinue
    if ($process -and $process.StartTime.ToUniversalTime() -eq ([datetime]$startedValue).ToUniversalTime()) { Stop-Process -Id $pidValue }
}
Remove-Item -LiteralPath $statePath
Write-Output 'Mobile debug server and HTTPS tunnel stopped.'
