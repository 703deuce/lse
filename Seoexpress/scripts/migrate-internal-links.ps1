# Migrate internal links from .html filenames to root-relative trailing-slash URLs
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

$replacements = [ordered]@{
  'href="index.html"' = 'href="/"'
  'href="local-seo-services.html"' = 'href="/local-seo-services/"'
  'href="local-seo-packages.html"' = 'href="/local-seo-packages/"'
  'href="google-maps-seo-services.html"' = 'href="/google-maps-seo-services/"'
  'href="local-seo-for-plumbers.html"' = 'href="/local-seo-for-plumbers/"'
  'href="local-seo-for-dentists.html"' = 'href="/local-seo-for-dentists/"'
  'href="local-seo-services-for-small-business.html"' = 'href="/local-seo-services-for-small-business/"'
  'href="citation-building-services.html"' = 'href="/citation-building-services/"'
  'href="about.html"' = 'href="/about/"'
  'href="contact.html"' = 'href="/contact/"'
  'href="privacy-policy.html"' = 'href="/privacy-policy/"'
  'href="terms-of-service.html"' = 'href="/terms-of-service/"'
  'data-nav="index.html"' = 'data-nav="home"'
  'data-nav="local-seo-services.html"' = 'data-nav="local-seo-services"'
  'data-nav="local-seo-packages.html"' = 'data-nav="local-seo-packages"'
  'data-nav="google-maps-seo-services.html"' = 'data-nav="google-maps-seo-services"'
  'data-nav="local-seo-for-plumbers.html"' = 'data-nav="local-seo-for-plumbers"'
  'data-nav="local-seo-for-dentists.html"' = 'data-nav="local-seo-for-dentists"'
  'data-nav="local-seo-services-for-small-business.html"' = 'data-nav="local-seo-services-for-small-business"'
  'data-nav="citation-building-services.html"' = 'data-nav="citation-building-services"'
  'data-nav="about.html"' = 'data-nav="about"'
  'data-nav="contact.html"' = 'data-nav="contact"'
}

$htmlFiles = Get-ChildItem -Path $root -Filter "*.html" -File -Recurse:$false
foreach ($file in $htmlFiles) {
  $content = Get-Content -Raw $file.FullName
  $original = $content
  foreach ($pair in $replacements.GetEnumerator()) {
    $content = $content.Replace($pair.Key, $pair.Value)
  }
  if ($content -ne $original) {
    Set-Content -Path $file.FullName -Value $content -NoNewline
    Write-Host "Updated links in $($file.Name)"
  }
}

Write-Host "Link migration complete."
