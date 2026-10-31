# TIDDI 실행기. 바탕화면 아이콘을 더블클릭하면 launch.vbs가 이 파일을 숨겨서 실행해요.
# 1) TIDDI 서버가 꺼져 있으면 창 없이 켜요 (운영 모드, 창을 다 닫고 10분 뒤 스스로 꺼짐)
# 2) TIDDI 창이 이미 있으면 새로 열지 않고 그 창을 앞으로 가져와요
# 3) 없으면 주소창 없는 Edge 앱 창으로 팝업을 화면 오른쪽 아래에 띄워요
param(
  [string]$Page = "mini",
  [switch]$NoOpen
)
$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
$port = 3737
$url = "http://127.0.0.1:$port"
$data = Join-Path $root "data"
New-Item -ItemType Directory -Force $data | Out-Null

# 아이콘을 두 번 연달아 눌러도 실행기는 하나만 돌아요
$mutex = New-Object System.Threading.Mutex($false, "Local\TIDDI-launcher")
if (-not $mutex.WaitOne(0)) { return }

Add-Type @'
using System; using System.Text; using System.Runtime.InteropServices;
public static class TiddiWin {
  public delegate bool EnumProc(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc f, IntPtr l);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] static extern bool IsIconic(IntPtr h);
  [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr h, int cmd);
  [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] static extern bool SetWindowPos(IntPtr h, IntPtr after, int x, int y, int w, int hh, uint flags);
  public static IntPtr Find() {
    IntPtr found = IntPtr.Zero;
    EnumWindows((h, l) => {
      if (!IsWindowVisible(h)) return true;
      var sb = new StringBuilder(64); GetWindowText(h, sb, 64);
      if (sb.ToString() == "TIDDI") { found = h; return false; }
      return true;
    }, IntPtr.Zero);
    return found;
  }
  public static void Front(IntPtr h) {
    if (IsIconic(h)) ShowWindow(h, 9);
    SetForegroundWindow(h);
  }
  public static void Place(IntPtr h, int x, int y, int w, int hh) { SetWindowPos(h, IntPtr.Zero, x, y, w, hh, 0x0004); }
}
'@

function Test-Up {
  try { $c = New-Object Net.Sockets.TcpClient; $c.Connect("127.0.0.1", $port); $c.Close(); return $true } catch { return $false }
}

function Show-Problem([string]$msg) {
  Add-Type -AssemblyName System.Windows.Forms
  [System.Windows.Forms.MessageBox]::Show($msg, "TIDDI", "OK", "Warning") | Out-Null
}

try {
  if (-not (Test-Up)) {
    $node = (Get-Command node -ErrorAction Stop).Source
    $next = Join-Path $root "node_modules\next\dist\bin\next"
    $env:NEXT_TELEMETRY_DISABLED = "1"
    # 처음이거나 빌드가 없으면 한 번 만들어요 (1분쯤)
    if (-not (Test-Path (Join-Path $root ".next\BUILD_ID"))) {
      $b = Start-Process -FilePath $node -ArgumentList @("`"$next`"", "build") -WorkingDirectory $root -WindowStyle Hidden -Wait -PassThru `
        -RedirectStandardOutput (Join-Path $data "build.log") -RedirectStandardError (Join-Path $data "build-error.log")
      if ($b.ExitCode -ne 0) { throw "TIDDI를 준비하지 못했어요. data\build-error.log를 Claude에게 보여 주세요." }
    }
    $env:TIDDI_IDLE_MINUTES = "10"
    Start-Process -FilePath $node -ArgumentList @("`"$next`"", "start", "-H", "127.0.0.1", "-p", "$port") -WorkingDirectory $root -WindowStyle Hidden `
      -RedirectStandardOutput (Join-Path $data "server.log") -RedirectStandardError (Join-Path $data "server-error.log") | Out-Null
    for ($i = 0; $i -lt 150 -and -not (Test-Up); $i++) { Start-Sleep -Milliseconds 200 }
    if (-not (Test-Up)) { throw "TIDDI 서버가 켜지지 않았어요. data\server-error.log를 Claude에게 보여 주세요." }
  }
  if ($NoOpen) { return }

  # 이미 열린 TIDDI 창이 있으면 그 창을 앞으로 (서버가 다시 켜지면 창이 스스로 다시 연결돼요)
  $existing = [TiddiWin]::Find()
  if ($existing -ne [IntPtr]::Zero) { [TiddiWin]::Front($existing); return }

  $edge = @("${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe", "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe") |
    Where-Object { Test-Path $_ } | Select-Object -First 1
  if (-not $edge) { Start-Process "$url/$Page"; return }

  Add-Type -AssemblyName System.Windows.Forms
  $area = [System.Windows.Forms.Screen]::PrimaryScreen.WorkingArea
  if ($Page -eq "mini") {
    $w = 440; $h = [Math]::Min(820, $area.Height - 40)
    $x = $area.Right - $w - 20; $y = $area.Bottom - $h - 20
  } else {
    $w = [Math]::Min(1280, $area.Width - 40); $h = [Math]::Min(880, $area.Height - 40)
    $x = $area.Left + [int](($area.Width - $w) / 2); $y = $area.Top + [int](($area.Height - $h) / 2)
  }
  Start-Process $edge -ArgumentList @("--app=$url/$Page", "--window-size=$w,$h", "--window-position=$x,$y")
  # Edge는 예전 창 크기를 기억하고 있을 수 있어서, 뜨면 크기 · 자리를 다시 맞춰요
  for ($i = 0; $i -lt 40; $i++) {
    Start-Sleep -Milliseconds 250
    $win = [TiddiWin]::Find()
    if ($win -ne [IntPtr]::Zero) { [TiddiWin]::Place($win, $x, $y, $w, $h); [TiddiWin]::Front($win); break }
  }
} catch {
  Show-Problem $_.Exception.Message
} finally {
  $mutex.ReleaseMutex()
}
