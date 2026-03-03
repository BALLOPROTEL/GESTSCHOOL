param(
  [string]$ContainerName = "gestschool-postgres",
  [string]$DatabaseName = "gestschool",
  [string]$DatabaseUser = "gestschool",
  [string]$OutputDir = "infra/backups"
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  throw "Docker CLI is required."
}

if (-not (Test-Path $OutputDir)) {
  New-Item -Path $OutputDir -ItemType Directory | Out-Null
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$archiveName = "gestschool-$timestamp.dump"
$tmpPath = "/tmp/$archiveName"
$localPath = Join-Path $OutputDir $archiveName

Write-Host "Creating PostgreSQL backup inside container..."
docker exec $ContainerName pg_dump -U $DatabaseUser -d $DatabaseName -F c -f $tmpPath

Write-Host "Copying backup to local filesystem..."
docker cp "${ContainerName}:$tmpPath" $localPath
docker exec $ContainerName rm -f $tmpPath

Write-Host "Backup completed: $localPath"
