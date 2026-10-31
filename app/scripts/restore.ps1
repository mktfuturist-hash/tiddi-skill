# TIDDI 되살리기. 윈도우 휴지통에서 원래 자리로 되돌려요 (휴지통의 「복원」과 같아요).
# -List: 되살릴 원래 경로 목록(UTF-8, 한 줄에 하나)
# -Out: 결과 (OK 경로 / ERR 경로 이유)
param(
  [Parameter(Mandatory = $true)][string]$List,
  [Parameter(Mandatory = $true)][string]$Out
)
$ErrorActionPreference = "Stop"

# 휴지통의 $I 파일(작은 메모)에서 원래 경로와 지운 시각을 읽어요. 읽기만 해요
function Read-Origin([string]$infoPath) {
  $b = [System.IO.File]::ReadAllBytes($infoPath)
  $version = [BitConverter]::ToInt64($b, 0)
  $deleted = [DateTime]::FromFileTimeUtc([BitConverter]::ToInt64($b, 16))
  if ($version -ge 2) {
    $len = [BitConverter]::ToInt32($b, 24)
    $path = [System.Text.Encoding]::Unicode.GetString($b, 28, ($len - 1) * 2)
  } else {
    $path = [System.Text.Encoding]::Unicode.GetString($b, 24, 520).TrimEnd([char]0)
  }
  return @{ Path = $path; Deleted = $deleted }
}

$want = @{}
foreach ($p in [System.IO.File]::ReadAllLines($List, [System.Text.Encoding]::UTF8)) {
  if ($p) { $want[$p.ToLowerInvariant()] = $p }
}

$shell = New-Object -ComObject Shell.Application
$bin = $shell.Namespace(10)
$found = @{}
foreach ($item in @($bin.Items())) {
  try {
    $r = $item.Path
    $leaf = Split-Path $r -Leaf
    if (-not $leaf.StartsWith('$R')) { continue }
    $info = Join-Path (Split-Path $r) ('$I' + $leaf.Substring(2))
    $origin = Read-Origin $info
    $key = $origin.Path.ToLowerInvariant()
    if (-not $want.ContainsKey($key)) { continue }
    # 같은 경로가 여러 번 지워졌으면 가장 최근 것을 되살려요
    if (-not $found.ContainsKey($key) -or $found[$key].Deleted -lt $origin.Deleted) {
      $found[$key] = @{ Item = $item; Deleted = $origin.Deleted }
    }
  } catch { }
}

$w = New-Object System.IO.StreamWriter($Out, $false, (New-Object System.Text.UTF8Encoding($false)))
foreach ($key in $want.Keys) {
  $p = $want[$key]
  try {
    if (-not $found.ContainsKey($key)) { throw "휴지통에서 찾지 못했어요 (이미 되살렸거나 휴지통을 비웠어요)" }
    if ([System.IO.File]::Exists($p)) { throw "원래 자리에 같은 이름의 파일이 이미 있어요" }
    $item = $found[$key].Item
    $item.InvokeVerb("undelete")
    for ($i = 0; $i -lt 30 -and -not [System.IO.File]::Exists($p); $i++) { Start-Sleep -Milliseconds 100 }
    if (-not [System.IO.File]::Exists($p)) {
      $verb = @($item.Verbs()) | Where-Object { $_.Name -match '복원|Restore' } | Select-Object -First 1
      if ($verb) { $verb.DoIt() }
      for ($i = 0; $i -lt 30 -and -not [System.IO.File]::Exists($p); $i++) { Start-Sleep -Milliseconds 100 }
    }
    if (-not [System.IO.File]::Exists($p)) { throw "되살리지 못했어요. 윈도우 휴지통에서 직접 「복원」해 주세요" }
    $w.WriteLine("OK`t$p")
  } catch {
    $w.WriteLine("ERR`t$p`t$($_.Exception.Message)")
  }
}
$w.Close()
