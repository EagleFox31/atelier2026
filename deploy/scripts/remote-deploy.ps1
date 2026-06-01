param (

    [string]$RemoteHost = "root@94.237.59.178",

    [string]$RemoteDir = "/opt/atelier2026",

    [string]$SshKey = $(Join-Path $env:USERPROFILE ".ssh\id_ed25519_upcloud")

)



$ErrorActionPreference = "Stop"



function Invoke-SshCommand {

    param([string[]]$ExtraArgs, [string]$Remote, [string]$Command)

    & ssh @ExtraArgs $Remote $Command

    if ($LASTEXITCODE -ne 0) {

        throw "ssh a echoue (code $LASTEXITCODE) : $Command"

    }

}



function Invoke-ScpCommand {

    param([string[]]$ExtraArgs, [string[]]$ScpArgs)

    & scp @ExtraArgs @ScpArgs

    if ($LASTEXITCODE -ne 0) {

        throw "scp a echoue (code $LASTEXITCODE)"

    }

}



$RootDir = Resolve-Path "$PSScriptRoot\..\.."



# Pas de ControlMaster sur Windows (getsockname failed: Not a socket) — voir Win32-OpenSSH #405

$SshArgs = @()

$ScpArgs = @()

if ($SshKey -and (Test-Path $SshKey)) {

    $SshArgs = @("-i", $SshKey, "-o", "IdentitiesOnly=yes")

    $ScpArgs = @("-i", $SshKey, "-o", "IdentitiesOnly=yes")

    Write-Host "==> Cle SSH : $SshKey" -ForegroundColor DarkGray

    Write-Host "    (passphrase demandee a chaque ssh/scp sous Windows - 5 fois max)" -ForegroundColor DarkGray

} else {

    Write-Warning "Cle SSH introuvable ($SshKey) - ssh utilisera les cles par defaut."

}



Write-Host "==> Verification du fichier deploy\.env.prod" -ForegroundColor Cyan

if (-Not (Test-Path "$RootDir\deploy\.env.prod")) {

    Write-Error "Erreur: deploy\.env.prod manquant. Veuillez le creer."

    exit 1

}



Write-Host "==> Preparation du dossier distant ${RemoteHost}:${RemoteDir}" -ForegroundColor Cyan

Invoke-SshCommand -ExtraArgs $SshArgs -Remote $RemoteHost -Command "mkdir -p $RemoteDir"



Write-Host "==> Compression du projet local (exclusion des dossiers inutiles)..." -ForegroundColor Cyan

Set-Location $RootDir

tar.exe -czf atelier2026.tar.gz --exclude="node_modules" --exclude=".next" --exclude="dist" --exclude=".git" --exclude=".stryker-tmp" --exclude="deploy/.env.prod" --exclude="atelier2026.tar.gz" .

if ($LASTEXITCODE -ne 0) {

    throw "tar a echoue (code $LASTEXITCODE)"

}



Write-Host '==> Envoi de l''archive vers le serveur distant...' -ForegroundColor Cyan

Invoke-ScpCommand -ExtraArgs $ScpArgs -ScpArgs @("atelier2026.tar.gz", "$($RemoteHost):$RemoteDir/atelier2026.tar.gz")



Write-Host "==> Extraction sur le serveur distant..." -ForegroundColor Cyan

Invoke-SshCommand -ExtraArgs $SshArgs -Remote $RemoteHost -Command "cd $RemoteDir && tar -xzf atelier2026.tar.gz && rm atelier2026.tar.gz"



Write-Host "==> Copie de deploy/.env.prod (secrets)..." -ForegroundColor Cyan

Invoke-ScpCommand -ExtraArgs $ScpArgs -ScpArgs @("$RootDir\deploy\.env.prod", "$($RemoteHost):$RemoteDir/deploy/.env.prod")



Write-Host "==> Build + Demarrage de Docker Compose sur le serveur..." -ForegroundColor Cyan

Invoke-SshCommand -ExtraArgs $SshArgs -Remote $RemoteHost -Command "cd $RemoteDir && docker compose -f deploy/docker/docker-compose.prod.yml --env-file deploy/.env.prod up -d --build"



Write-Host "==> Nettoyage local..." -ForegroundColor Cyan

Remove-Item "$RootDir\atelier2026.tar.gz" -Force



Write-Host "==> Statut des conteneurs..." -ForegroundColor Cyan

Invoke-SshCommand -ExtraArgs $SshArgs -Remote $RemoteHost -Command "cd $RemoteDir && docker compose -f deploy/docker/docker-compose.prod.yml ps"



$IP = $RemoteHost.Split("@")[1]

Write-Host "`nDeploiement termine. Ouvrir : http://$IP" -ForegroundColor Green

if ($SshKey -and (Test-Path $SshKey)) {

    $keyHint = "ssh -i `"$SshKey`" $RemoteHost"

} else {

    $keyHint = "ssh $RemoteHost"

}

$remoteLogs = "cd $RemoteDir && docker compose -f deploy/docker/docker-compose.prod.yml logs -f api"

Write-Host ("Pour voir les logs API : {0} {1}" -f $keyHint, $remoteLogs) -ForegroundColor Yellow


