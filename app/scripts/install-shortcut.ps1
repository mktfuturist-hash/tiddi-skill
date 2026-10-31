# 바탕화면에 TIDDI 아이콘(바로가기)을 만들어요. 다시 실행하면 같은 이름으로 새로 만들어요
$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
$desktop = [Environment]::GetFolderPath("Desktop")
$path = Join-Path $desktop "TIDDI.lnk"

$shell = New-Object -ComObject WScript.Shell
$lnk = $shell.CreateShortcut($path)
$lnk.TargetPath = Join-Path $env:WINDIR "System32\wscript.exe"
$lnk.Arguments = "`"$(Join-Path $root 'scripts\launch.vbs')`""
$lnk.WorkingDirectory = $root
$lnk.IconLocation = "$(Join-Path $root 'assets\tiddi.ico'),0"
$lnk.Description = "TIDDI · 저장공간 정리"
$lnk.Save()
"바로가기 만듦: $path"
