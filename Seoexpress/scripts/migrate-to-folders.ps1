# Move flat *.html pages into folder/index.html so /page/ URLs work without rewrite rules
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

$pages = @(
  'about',
  'contact',
  'local-seo-services',
  'local-seo-packages',
  'google-maps-seo-services',
  'local-seo-for-plumbers',
  'local-seo-for-dentists',
  'local-seo-services-for-small-business',
  'citation-building-services',
  'privacy-policy',
  'terms-of-service'
)

function Fix-RootAssetPaths {
  param([string]$Content)
  $Content = $Content -replace 'href="css/', 'href="/css/'
  $Content = $Content -replace 'src="js/', 'src="/js/'
  $Content = $Content -replace 'href="images/', 'href="/images/'
  $Content = $Content -replace 'src="images/', 'src="/images/'
  return $Content
}

foreach ($slug in $pages) {
  $src = Join-Path $root "$slug.html"
  if (-not (Test-Path $src)) {
    Write-Host "Skip (missing): $slug.html"
    continue
  }
  $dir = Join-Path $root $slug
  New-Item -ItemType Directory -Force -Path $dir | Out-Null
  $dest = Join-Path $dir 'index.html'
  $content = Get-Content -Raw $src
  $content = Fix-RootAssetPaths $content
  Set-Content -Path $dest -Value $content -NoNewline
  Remove-Item $src
  Write-Host "Moved $slug.html -> $slug/index.html"
}

$indexPath = Join-Path $root 'index.html'
if (Test-Path $indexPath) {
  Write-Host "Root index.html asset paths unchanged (css/, js/)"
}

Write-Host "Folder migration complete."
