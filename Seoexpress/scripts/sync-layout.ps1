# Sync shared header/footer partials into all HTML pages
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$headerInner = Get-Content -Raw (Join-Path $root "partials\site-header.html")
$footerInner = Get-Content -Raw (Join-Path $root "partials\site-footer.html")
$headerRoot = Get-Content -Raw (Join-Path $root "partials\site-header-root.html")
$footerRoot = Get-Content -Raw (Join-Path $root "partials\site-footer-root.html")

$rootIndex = Join-Path $root "index.html"
$htmlFiles = @()
if (Test-Path $rootIndex) { $htmlFiles += Get-Item $rootIndex }
$htmlFiles += Get-ChildItem -Path $root -Filter "index.html" -Recurse -File | Where-Object { $_.FullName -ne $rootIndex }

foreach ($file in $htmlFiles) {
    $content = Get-Content -Raw $file.FullName
    $isRoot = ($file.FullName -eq $rootIndex)
    $header = if ($isRoot) { $headerRoot } else { $headerInner }
    $footer = if ($isRoot) { $footerRoot } else { $footerInner }

    $content = [regex]::Replace(
        $content,
        '<header class="site-header"[\s\S]*?</header>',
        $header.TrimEnd(),
        1
    )

    $content = [regex]::Replace(
        $content,
        '<footer class="site-footer"[\s\S]*?</footer>',
        $footer.TrimEnd(),
        1
    )

    Set-Content -Path $file.FullName -Value $content -NoNewline
    $label = if ($isRoot) { 'index.html (root)' } else { "$($file.Directory.Name)/index.html" }
    Write-Host "Updated $label"
}

Write-Host "Done. Synced header/footer to $($htmlFiles.Count) pages."
