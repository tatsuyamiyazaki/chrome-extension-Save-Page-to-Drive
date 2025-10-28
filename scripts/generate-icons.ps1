param(
  [string]$OutDir = "assets/icons"
)

Add-Type -AssemblyName System.Drawing

function New-Icon {
  param(
    [int]$Size,
    [string]$Bg = "#2D7FF9",
    [string]$Fg = "#FFFFFF",
    [string]$Text = "D",
    [string]$OutPath
  )
  $bmp = New-Object System.Drawing.Bitmap $Size, $Size
  $gfx = [System.Drawing.Graphics]::FromImage($bmp)
  $gfx.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $bgColor = [System.Drawing.ColorTranslator]::FromHtml($Bg)
  $fgColor = [System.Drawing.ColorTranslator]::FromHtml($Fg)
  $bgBrush = New-Object System.Drawing.SolidBrush $bgColor
  $gfx.FillRectangle($bgBrush, 0, 0, $Size, $Size)
  $bgBrush.Dispose()

  # Draw letter
  $fontSize = [int]([Math]::Max(8, $Size * 0.6))
  try {
    $font = [System.Drawing.Font]::new("Segoe UI", $fontSize, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  } catch {
    $font = [System.Drawing.Font]::new("Arial", $fontSize, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  }
  $textBrush = New-Object System.Drawing.SolidBrush $fgColor
  $strFormat = New-Object System.Drawing.StringFormat
  $strFormat.Alignment = [System.Drawing.StringAlignment]::Center
  $strFormat.LineAlignment = [System.Drawing.StringAlignment]::Center
  $gfx.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAlias
  $gfx.DrawString($Text, $font, $textBrush, ($Size/2), ($Size/2), $strFormat)
  $textBrush.Dispose(); $font.Dispose(); $gfx.Dispose()

  $dir = Split-Path -Parent $OutPath
  if (!(Test-Path $dir)) { New-Item -ItemType Directory -Path $dir | Out-Null }
  $bmp.Save($OutPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
}

New-Icon -Size 16 -OutPath (Join-Path $OutDir "16.png")
New-Icon -Size 32 -OutPath (Join-Path $OutDir "32.png")
New-Icon -Size 128 -OutPath (Join-Path $OutDir "128.png")

Write-Host "Icons generated in $OutDir"
