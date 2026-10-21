param(
  [string]$ArtifactDirectory = (Join-Path $PSScriptRoot "..\artifacts\phase4a-title-starter")
)

$ErrorActionPreference = "Stop"
$artifactRoot = [System.IO.Path]::GetFullPath($ArtifactDirectory)
if (-not (Test-Path -LiteralPath $artifactRoot -PathType Container)) {
  throw "Artifact directory does not exist: $artifactRoot"
}

$powerPoint = New-Object -ComObject PowerPoint.Application
try {
  Get-ChildItem -LiteralPath $artifactRoot -Filter "*.pptx" -File | ForEach-Object {
    $output = Join-Path $artifactRoot ("rendered\" + $_.BaseName)
    New-Item -ItemType Directory -Force -Path $output | Out-Null
    Get-ChildItem -LiteralPath $output -Filter "Slide*.PNG" -File -ErrorAction SilentlyContinue | Remove-Item -Force
    $presentation = $powerPoint.Presentations.Open($_.FullName, $true, $true, $false)
    try {
      $presentation.Export($output, "PNG", 1600, 900)
    } finally {
      $presentation.Close()
      [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($presentation)
    }
  }
} finally {
  $powerPoint.Quit()
  [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($powerPoint)
  [GC]::Collect()
  [GC]::WaitForPendingFinalizers()
}

