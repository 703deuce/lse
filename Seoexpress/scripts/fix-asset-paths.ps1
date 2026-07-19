# Fix CSS/JS paths: relative paths work locally (file://, Live Server) and on production
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

$rootIndex = Join-Path $root 'index.html'
if (Test-Path $rootIndex) {
  $content = Get-Content -Raw $rootIndex
  $content = $content -replace 'href="/css/', 'href="css/'
  $content = $content -replace 'src="/js/', 'src="js/'
  $content = $content -replace 'src="/images/', 'src="images/'
  Set-Content -Path $rootIndex -Value $content -NoNewline
  Write-Host 'Fixed root index.html'
}

Get-ChildItem -Path $root -Filter 'index.html' -Recurse -File | Where-Object { $_.DirectoryName -ne $root } | ForEach-Object {
  $content = Get-Content -Raw $_.FullName
  $content = $content -replace 'href="/css/', 'href="../css/'
  $content = $content -replace 'src="/js/', 'src="../js/'
  $content = $content -replace 'src="/images/', 'src="../images/'
  Set-Content -Path $_.FullName -Value $content -NoNewline
  Write-Host "Fixed $($_.Directory.Name)/index.html"
}

Write-Host 'Asset path fix complete.'
