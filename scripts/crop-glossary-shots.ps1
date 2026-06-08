Add-Type -AssemblyName System.Drawing

$src = Join-Path $PSScriptRoot "..\docs\reference\images\glossary\00-full-diagram-example-2.png"
$outDir = Join-Path $PSScriptRoot "..\docs\reference\images\glossary"
$img = [System.Drawing.Image]::FromFile((Resolve-Path $src))

function Save-Crop($name, $x, $y, $w, $h) {
  $rect = New-Object System.Drawing.Rectangle($x, $y, $w, $h)
  $crop = New-Object System.Drawing.Bitmap($w, $h)
  $g = [System.Drawing.Graphics]::FromImage($crop)
  $g.DrawImage($img, 0, 0, $rect, [System.Drawing.GraphicsUnit]::Pixel)
  $g.Dispose()
  $path = Join-Path $outDir $name
  $crop.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $crop.Dispose()
  Write-Output "saved $name ($w x $h at $x,$y)"
}

$W = $img.Width
$H = $img.Height
# Fractions tuned for Example #2 fit-view layout (full viewport capture).
Save-Crop "01-left-cable-and-labels.png" 0 ([int]($H * 0.12)) ([int]($W * 0.42)) ([int]($H * 0.55))
Save-Crop "02-center-splice-zone.png" ([int]($W * 0.28)) ([int]($H * 0.12)) ([int]($W * 0.44)) ([int]($H * 0.55))
Save-Crop "03-right-labels-and-handles.png" ([int]($W * 0.58)) ([int]($H * 0.12)) ([int]($W * 0.40)) ([int]($H * 0.55))

$img.Dispose()
