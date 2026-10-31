# TIDDI 아이콘 그리기 (민트 바탕 + 노란 스펀지). 여러 크기의 PNG를 .ico 하나에 담아요
param([Parameter(Mandatory = $true)][string]$Out)
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

function Draw([int]$size) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = "AntiAlias"
  $g.Clear([System.Drawing.Color]::Transparent)
  $s = $size / 256.0

  function Round([float]$x, [float]$y, [float]$w, [float]$h, [float]$r) {
    $p = New-Object System.Drawing.Drawing2D.GraphicsPath
    $p.AddArc($x, $y, $r * 2, $r * 2, 180, 90)
    $p.AddArc($x + $w - $r * 2, $y, $r * 2, $r * 2, 270, 90)
    $p.AddArc($x + $w - $r * 2, $y + $h - $r * 2, $r * 2, $r * 2, 0, 90)
    $p.AddArc($x, $y + $h - $r * 2, $r * 2, $r * 2, 90, 90)
    $p.CloseFigure()
    return $p
  }

  # 민트 바탕
  $bg = Round (8 * $s) (8 * $s) (240 * $s) (240 * $s) (56 * $s)
  $g.FillPath((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 180, 234, 209))), $bg)
  # 스펀지 (노랑) + 아래 초록 수세미 면
  $sp = Round (52 * $s) (66 * $s) (152 * $s) (108 * $s) (26 * $s)
  $g.FillPath((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 255, 220, 120))), $sp)
  $sc = Round (52 * $s) (150 * $s) (152 * $s) (44 * $s) (18 * $s)
  $g.FillPath((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 63, 159, 120))), $sc)
  $g.FillRectangle((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 255, 220, 120))), 52 * $s, 140 * $s, 152 * $s, 14 * $s)
  # 스펀지 구멍
  $hole = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 232, 186, 78))
  foreach ($c in @(@(84, 96, 16), @(128, 86, 11), @(166, 104, 14), @(108, 126, 10), @(150, 130, 9))) {
    $g.FillEllipse($hole, ($c[0] - $c[2]) * $s, ($c[1] - $c[2]) * $s, $c[2] * 2 * $s, $c[2] * 2 * $s)
  }
  # 반짝이
  $spark = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
  $pts = @(
    (New-Object System.Drawing.PointF((206 * $s), (34 * $s))), (New-Object System.Drawing.PointF((214 * $s), (54 * $s))),
    (New-Object System.Drawing.PointF((234 * $s), (62 * $s))), (New-Object System.Drawing.PointF((214 * $s), (70 * $s))),
    (New-Object System.Drawing.PointF((206 * $s), (90 * $s))), (New-Object System.Drawing.PointF((198 * $s), (70 * $s))),
    (New-Object System.Drawing.PointF((178 * $s), (62 * $s))), (New-Object System.Drawing.PointF((198 * $s), (54 * $s)))
  )
  $g.FillPolygon($spark, [System.Drawing.PointF[]]$pts)
  $g.Dispose()
  $ms = New-Object System.IO.MemoryStream
  $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  return , $ms.ToArray()
}

$sizes = @(256, 64, 48, 32, 16)
$pngs = @($sizes | ForEach-Object { , (Draw $_) })
$fs = [System.IO.File]::Create($Out)
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
"아이콘 저장: $Out"
