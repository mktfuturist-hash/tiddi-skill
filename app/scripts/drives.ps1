# 이 컴퓨터의 드라이브와 드라이브마다의 휴지통 정보를 읽어요 (읽기만 해요)
# 한 줄에 드라이브 하나: V 글자 종류 파일시스템 전체 남음 이름 USB여부 볼륨GUID 휴지통최대(MB) 휴지통꺼짐 휴지통에든양
$ErrorActionPreference = "SilentlyContinue"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# 휴지통에 든 것을 드라이브별로 더해요
$binUsed = @{}
foreach ($i in @((New-Object -ComObject Shell.Application).Namespace(10).Items())) {
  $l = ([string]$i.Path).Substring(0, 1).ToUpper()
  $binUsed[$l] = [int64]$binUsed[$l] + [int64]$i.Size
}

foreach ($d in [System.IO.DriveInfo]::GetDrives()) {
  if (-not $d.IsReady) { continue }
  $l = $d.Name.Substring(0, 1).ToUpper()
  # USB로 붙은 디스크인지 (외장 하드는 「고정 드라이브」로 보이기도 해요)
  $usb = 0
  try { if ((Get-Partition -DriveLetter $l -ErrorAction Stop | Get-Disk -ErrorAction Stop).BusType -eq 'USB') { $usb = 1 } } catch { }
  # 볼륨 GUID가 없으면 subst 같은 가상 드라이브예요 (휴지통이 없어요)
  $guid = [regex]::Match((mountvol "$($l):" /L 2>$null | Out-String).Trim(), '\{[0-9a-fA-F-]+\}').Value
  $max = ""; $nuke = ""
  if ($guid) {
    $p = Get-ItemProperty "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\BitBucket\Volume\$guid"
    if ($p) { $max = $p.MaxCapacity; $nuke = $p.NukeOnDelete }
  }
  $label = ($d.VolumeLabel -replace "`t", " ")
  "V`t$l`t$($d.DriveType)`t$($d.DriveFormat)`t$($d.TotalSize)`t$($d.AvailableFreeSpace)`t$label`t$usb`t$guid`t$max`t$nuke`t$([int64]$binUsed[$l])"
}
