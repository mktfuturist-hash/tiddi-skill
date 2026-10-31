# C 드라이브 휴지통 정보를 읽어요 (읽기만 해요): 최대 크기(MB) · 휴지통이 꺼져 있는지 · 지금 든 용량(바이트)
$ErrorActionPreference = "SilentlyContinue"
$guid = [regex]::Match((mountvol C: /L | Out-String).Trim(), '\{[0-9a-fA-F-]+\}').Value
$p = Get-ItemProperty "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\BitBucket\Volume\$guid"
$used = 0
foreach ($i in @((New-Object -ComObject Shell.Application).Namespace(10).Items())) { $used += $i.Size }
"$($p.MaxCapacity)`t$($p.NukeOnDelete)`t$used"
