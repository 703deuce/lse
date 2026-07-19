# Convert root-absolute internal links (href="/...") to relative paths for file:// preview
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

function Convert-PageLinks {
  param(
    [string]$Content,
    [bool]$IsRoot
  )

  if ($IsRoot) {
    $Content = $Content -replace 'href="/"', 'href="./"'
    $Content = $Content -replace 'href="/', 'href="'
  } else {
    $Content = $Content -replace 'href="/"', 'href="../"'
    $Content = $Content -replace 'href="/', 'href="../'
  }

  return $Content
}

$rootIndex = Join-Path $root 'index.html'
if (Test-Path $rootIndex) {
  $content = Get-Content -Raw $rootIndex
  $updated = Convert-PageLinks $content $true
  if ($updated -ne $content) {
    Set-Content -Path $rootIndex -Value $updated -NoNewline
    Write-Host 'Updated root index.html links'
  }
}

Get-ChildItem -Path $root -Filter 'index.html' -Recurse -File | Where-Object { $_.FullName -ne $rootIndex } | ForEach-Object {
  $content = Get-Content -Raw $_.FullName
  $updated = Convert-PageLinks $content $false
  if ($updated -ne $content) {
    Set-Content -Path $_.FullName -Value $updated -NoNewline
    Write-Host "Updated $($_.Directory.Name)/index.html links"
  }
}

Write-Host 'Relative link conversion complete.'
