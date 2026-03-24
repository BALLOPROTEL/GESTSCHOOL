param(
  [Parameter(Mandatory = $true)]
  [string]$BackupFile,
  [string]$ContainerName = "gestschool-postgres",
  [string]$DatabaseName = "gestschool",
  [string]$DatabaseUser = "gestschool"
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  throw "Docker CLI is required."
}

if (-not (Test-Path $BackupFile)) {
  throw "Backup file not found: $BackupFile"
}

$fileName = Split-Path -Path $BackupFile -Leaf
$tmpPath = "/tmp/$fileName"

Write-Host "Copying backup file into container..."
docker cp $BackupFile "${ContainerName}:$tmpPath"

Write-Host "Restoring PostgreSQL backup..."
docker exec $ContainerName pg_restore -U $DatabaseUser -d $DatabaseName --clean --if-exists $tmpPath
docker exec $ContainerName rm -f $tmpPath

Write-Host "Restore completed for database '$DatabaseName'."
