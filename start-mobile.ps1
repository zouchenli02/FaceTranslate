param([Parameter(Mandatory=$false)][string]$NodePath)
$ErrorActionPreference = 'Stop'
$projectDir = $PSScriptRoot
if ([string]::IsNullOrWhiteSpace($NodePath)) {
    $command = Get-Command node -ErrorAction SilentlyContinue
    if ($command) { $NodePath = $command.Source }
}
if ([string]::IsNullOrWhiteSpace($NodePath) -or -not (Test-Path -LiteralPath $NodePath)) { throw 'Node.js was not found. Run start-mobile.cmd instead of start-mobile.ps1.' }
$tunnelPath = Join-Path $projectDir '.tools\cloudflared.exe'
$debugDir = Join-Path $projectDir '.debug'
if (-not (Test-Path -LiteralPath $tunnelPath)) { throw 'Missing .tools/cloudflared.exe. Download the Windows amd64 build from Cloudflare.' }
New-Item -ItemType Directory -Path $debugDir -Force | Out-Null
if (Test-Path (Join-Path $debugDir 'processes.json')) { throw 'A mobile debug session is already recorded. Run stop-mobile.cmd first.' }
$accessPath = Join-Path $debugDir 'OPEN-THIS-URL.txt'
Remove-Item -LiteralPath $accessPath -Force -ErrorAction SilentlyContinue
$serverProcess = Start-Process -FilePath $NodePath -ArgumentList '--env-file-if-exists=.env','mobile-server.mjs' -WorkingDirectory $projectDir -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $debugDir 'server.log') -RedirectStandardError (Join-Path $debugDir 'server-error.log')
try {
    Start-Sleep -Seconds 1
    if ($serverProcess.HasExited) { throw 'The debug server failed to start. Check .debug/server-error.log.' }
    $tunnelProcess = $null
    $mobileUrl = $null
    $passwordValue = (Get-Content (Join-Path $debugDir 'password.txt') -Raw).Trim()
    $authValue = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes('debug:' + $passwordValue))
    for ($attempt = 1; $attempt -le 4 -and -not $mobileUrl; $attempt++) {
        Remove-Item -LiteralPath (Join-Path $debugDir 'tunnel.log') -Force -ErrorAction SilentlyContinue
        Remove-Item -LiteralPath (Join-Path $debugDir 'tunnel-error.log') -Force -ErrorAction SilentlyContinue
        Write-Output ('Starting HTTPS tunnel (attempt ' + $attempt + '/4)...')
        $tunnelProcess = Start-Process -FilePath $tunnelPath -ArgumentList 'tunnel','--url','http://127.0.0.1:3101','--protocol','http2','--no-autoupdate' -WorkingDirectory $projectDir -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $debugDir 'tunnel.log') -RedirectStandardError (Join-Path $debugDir 'tunnel-error.log')
        $deadline = (Get-Date).AddSeconds(60)
        do {
            Start-Sleep -Milliseconds 750
            if ($tunnelProcess.HasExited) { break }
            $tunnelLog = Get-Content (Join-Path $debugDir 'tunnel-error.log') -Raw -ErrorAction SilentlyContinue
            $urlMatch = [regex]::Match($tunnelLog, 'https://[a-z0-9-]+\.trycloudflare\.com')
            if ($urlMatch.Success -and $tunnelLog -match 'Registered tunnel connection') {
                try {
                    $candidateUrl = $urlMatch.Value
                    $statusValue = Invoke-RestMethod -Uri ($candidateUrl + '/api/status') -Headers @{ Authorization = 'Basic ' + $authValue } -TimeoutSec 8
                    if ($statusValue.mode -eq 'live') { $mobileUrl = $candidateUrl }
                } catch { }
            }
        } until ($mobileUrl -or (Get-Date) -gt $deadline)
        if (-not $mobileUrl) {
            if ($tunnelProcess -and -not $tunnelProcess.HasExited) { $tunnelProcess.Kill() }
            if ($attempt -lt 4) { Start-Sleep -Seconds 2 }
        }
    }
    if (-not $mobileUrl) { throw 'Could not create a reachable HTTPS tunnel after 4 attempts. Check the network and .debug/tunnel-error.log.' }
    @{ serverPid=$serverProcess.Id; serverStarted=$serverProcess.StartTime.ToUniversalTime().ToString('o'); tunnelPid=$tunnelProcess.Id; tunnelStarted=$tunnelProcess.StartTime.ToUniversalTime().ToString('o') } | ConvertTo-Json | Set-Content (Join-Path $debugDir 'processes.json')
    @(
        'CURRENT MOBILE DEBUG ADDRESS'
        $mobileUrl
        ''
        'Username: debug'
        ('Password: ' + $passwordValue)
        ''
        'This temporary address changes after every restart. Do not reuse an older URL.'
    ) | Set-Content -LiteralPath $accessPath -Encoding UTF8
    Write-Output ('Mobile debugging is ready: ' + $mobileUrl)
    Write-Output ('Access details were saved to: ' + $accessPath)
} catch {
    if ($tunnelProcess -and -not $tunnelProcess.HasExited) { $tunnelProcess.Kill() }
    if (-not $serverProcess.HasExited) { $serverProcess.Kill() }
    Remove-Item -LiteralPath (Join-Path $debugDir 'processes.json') -Force -ErrorAction SilentlyContinue
    throw
}
