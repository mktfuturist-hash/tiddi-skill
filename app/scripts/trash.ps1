# TIDDI 휴지통으로 보내기. 영구 삭제는 하지 않아요 — 윈도우 휴지통으로만 보내요.
# -List: 보낼 파일 경로 목록(UTF-8, 한 줄에 하나). 서버가 안전 확인을 마친 파일만 들어와요
# -Out: 결과 (OK 경로 / ERR 경로 이유)
param(
  [Parameter(Mandatory = $true)][string]$List,
  [Parameter(Mandatory = $true)][string]$Out
)
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName Microsoft.VisualBasic

$w = New-Object System.IO.StreamWriter($Out, $false, (New-Object System.Text.UTF8Encoding($false)))
foreach ($p in [System.IO.File]::ReadAllLines($List, [System.Text.Encoding]::UTF8)) {
  if (-not $p) { continue }
  try {
    if (-not [System.IO.File]::Exists($p)) { throw "파일이 없어요" }
    [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile(
      $p,
      [Microsoft.VisualBasic.FileIO.UIOption]::OnlyErrorDialogs,
      [Microsoft.VisualBasic.FileIO.RecycleOption]::SendToRecycleBin
    )
    if ([System.IO.File]::Exists($p)) { throw "휴지통으로 옮겨지지 않았어요" }
    $w.WriteLine("OK`t$p")
  } catch {
    $w.WriteLine("ERR`t$p`t$($_.Exception.Message)")
  }
}
$w.Close()
