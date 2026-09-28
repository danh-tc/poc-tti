# Package compare-fn (production deps only) and zip-deploy it to the Function App in azure.json.
#   powershell -File scripts/deploy.ps1
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$cfg = Get-Content "$root\azure.json" | ConvertFrom-Json
$az = (Get-Command az -ErrorAction SilentlyContinue).Source
if (-not $az) { $az = 'C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd' }

$build = Join-Path $root '.deploy'
$zip = Join-Path $root 'deploy.zip'
Remove-Item $build, $zip -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory $build | Out-Null

Copy-Item "$root\src" "$build\src" -Recurse
Copy-Item "$root\host.json", "$root\package.json", "$root\package-lock.json" $build
Push-Location $build
npm ci --omit=dev --omit=optional --no-audit --no-fund
if ($LASTEXITCODE) { throw 'npm ci failed' }
Pop-Location

# tar keeps forward slashes in entry paths (Compress-Archive on PS 5.1 writes backslashes, which break on Linux)
Push-Location $build
& "$env:SystemRoot\System32\tar.exe" -a -c -f $zip *
if ($LASTEXITCODE) { throw 'zip failed' }
Pop-Location
& $az functionapp deployment source config-zip -g $cfg.resourceGroup -n $cfg.functionApp --src $zip -o none
if ($LASTEXITCODE) { throw 'deploy failed' }

Remove-Item $build, $zip -Recurse -Force
Write-Host "Deployed to https://$($cfg.functionApp).azurewebsites.net/api/compare"
