# 그림 한 장으로 TIDDI 아이콘을 만들어요: 정사각형으로 자르고 → 모서리를 둥글게(바깥은 투명) → 여러 크기를 .ico 하나에
# -Source 원본 그림 · -Ico 바탕화면 아이콘(.ico) · -Png 화면 로고용 256px PNG
param(
  [Parameter(Mandatory = $true)][string]$Source,
  [Parameter(Mandatory = $true)][string]$Ico,
  [Parameter(Mandatory = $true)][string]$Png
)
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$src = [System.Drawing.Image]::FromFile($Source)
$side = [Math]::Min($src.Width, $src.Height)
$crop = New-Object System.Drawing.Rectangle ([int](($src.Width - $side) / 2)), ([int](($src.Height - $side) / 2)), $side, $side

function Rounded([int]$size) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.Clear([System.Drawing.Color]::Transparent)
  $g.SmoothingMode = "AntiAlias"
  $g.InterpolationMode = "HighQualityBicubic"
  $g.PixelOffsetMode = "HighQuality"
  # 원본을 이 크기로 줄인 그림을 붓으로 써서 둥근 사각형을 칠해요 (모서리가 매끈해져요)
  $scaled = New-Object System.Drawing.Bitmap $size, $size
  $sg = [System.Drawing.Graphics]::FromImage($scaled)
  $sg.InterpolationMode = "HighQualityBicubic"
  $sg.PixelOffsetMode = "HighQuality"
  $sg.DrawImage($src, (New-Object System.Drawing.Rectangle 0, 0, $size, $size), $crop, [System.Drawing.GraphicsUnit]::Pixel)
  $sg.Dispose()
  $r = [float]($size * 0.22)
  $p = New-Object System.Drawing.Drawing2D.GraphicsPath
  $p.AddArc(0, 0, $r * 2, $r * 2, 180, 90)
  $p.AddArc($size - $r * 2, 0, $r * 2, $r * 2, 270, 90)
  $p.AddArc($size - $r * 2, $size - $r * 2, $r * 2, $r * 2, 0, 90)
  $p.AddArc(0, $size - $r * 2, $r * 2, $r * 2, 90, 90)
  $p.CloseFigure()
  $brush = New-Object System.Drawing.TextureBrush $scaled
  $g.FillPath($brush, $p)
  $brush.Dispose(); $scaled.Dispose(); $g.Dispose()
  return $bmp
}

function PngBytes($bmp) {
  $ms = New-Object System.IO.MemoryStream
  $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
  return , $ms.ToArray()
}

$big = Rounded 256
$big.Save($Png, [System.Drawing.Imaging.ImageFormat]::Png)

$sizes = @(256, 64, 48, 32, 16)
$pngs = @($sizes | ForEach-Object { $b = if ($_ -eq 256) { $big } else { Rounded $_ }; , (PngBytes $b) })
$fs = [System.IO.File]::Create($Ico)
$w = New-Object System.IO.BinaryWriter $fs
$w.Write([UInt16]0); $w.Write([UInt16]1); $w.Write([UInt16]$sizes.Count)
$offset = 6 + 16 * $sizes.Count
for ($i = 0; $i -lt $sizes.Count; $i++) {
  $d = if ($sizes[$i] -ge 256) { 0 } else { $sizes[$i] }
  $w.Write([byte]$d); $w.Write([byte]$d); $w.Write([byte]0); $w.Write([byte]0)
  $w.Write([UInt16]1); $w.Write([UInt16]32)
  $w.Write([UInt32]$pngs[$i].Length); $w.Write([UInt32]$offset)
  $offset += $pngs[$i].Length
}
foreach ($p in $pngs) { $w.Write($p) }
$w.Close()
$src.Dispose()
"원본 $($crop.Width)x$($crop.Height) → 아이콘 저장: $Ico · 로고 PNG: $Png"
