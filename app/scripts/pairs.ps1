# TIDDI 스크린샷 짝 찾기 (읽기만 해요. 아무것도 옮기거나 지우지 않아요)
# 1) 스크린샷 폴더의 사진과, 내 폴더 곳곳의 사진 중 「비슷한 시각」에 생긴 것을 후보로 골라요
# 2) 두 사진을 9x8 크기로 줄여 밝기 무늬(지문)를 비교해서 「같은 장면」인지 확인해요
# 3) 사본 하나는 스크린샷 하나하고만 짝이 돼요 (비슷한 캡처 두 장이 같은 사본에 묶여 같이 지워지지 않게)
# 결과: -Out 파일에 P(짝) / U(유일본) / S(요약) 줄, 진행 상황: 표준 출력에 G 줄
param(
  [Parameter(Mandatory = $true)][string]$UserHome,
  [Parameter(Mandatory = $true)][string]$Out,
  [string]$OneDrive = "",
  [int]$WindowMinutes = 15,
  [int]$MaxDistance = 8
)
$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$Shots = (Get-ItemProperty "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\User Shell Folders" -ErrorAction SilentlyContinue)."{B7BEDE81-DF94-4682-A7D8-57A52620B86F}"
if ($Shots) { $Shots = [Environment]::ExpandEnvironmentVariables($Shots) } else { $Shots = Join-Path $UserHome "Pictures\Screenshots" }

Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.IO;
using System.Linq;
using System.Text;

public class Pic {
  public string Path; public long Size; public DateTime Write; public DateTime Create;
  public bool Hashed; public bool Ok; public ulong Hash; public double Aspect;
  public bool DimsRead; public int W; public int H;
  // 개발 프로젝트(package.json · .git이 있는 폴더) 안의 파일이면 true. 이런 파일은 절대 지우지 않아요
  public bool Project;
}

public static class TiddiPairs {
  static readonly HashSet<string> Exts = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { ".png", ".jpg", ".jpeg", ".bmp", ".gif" };
  // 「같은 사진 여러 벌」을 찾을 때 보는 사진 · 영상 확장자
  static readonly HashSet<string> MediaExts = new HashSet<string>(StringComparer.OrdinalIgnoreCase) {
    ".png", ".jpg", ".jpeg", ".bmp", ".gif", ".heic", ".webp", ".tif", ".tiff", ".mp4", ".mov", ".avi", ".mkv", ".m4v", ".wmv"
  };
  static readonly string[] SkipNames = { "appdata", "node_modules", ".git", ".next", "$recycle.bin" };
  static long lastTick;
  static System.Diagnostics.Stopwatch sw;

  static bool IsCloud(FileAttributes a) {
    int ia = (int)a;
    return (ia & 0x400000) != 0 || (ia & 0x40000) != 0 || (ia & 0x1000) != 0;
  }

  static void Tick(string msg) {
    if (sw.ElapsedMilliseconds - lastTick < 400) return;
    lastTick = sw.ElapsedMilliseconds;
    Console.Out.WriteLine("G\t" + msg);
    Console.Out.Flush();
  }

  static Pic ToPic(FileInfo f) {
    return new Pic { Path = f.FullName, Size = f.Length, Write = f.LastWriteTimeUtc, Create = f.CreationTimeUtc };
  }

  static void Collect(DirectoryInfo dir, string shots, string oneDrive, List<Pic> list, List<Pic> media, bool inProject) {
    List<FileSystemInfo> items;
    try { items = dir.EnumerateFileSystemInfos().ToList(); } catch { return; }
    bool project = inProject || items.Any(i => i.Name.Equals("package.json", StringComparison.OrdinalIgnoreCase) || i.Name.Equals(".git", StringComparison.OrdinalIgnoreCase));
    foreach (var it in items) {
      var a = it.Attributes;
      if ((a & FileAttributes.Directory) != 0) {
        string name = it.Name.ToLowerInvariant();
        if (SkipNames.Contains(name) || name.StartsWith(".")) continue;
        if (string.Equals(it.FullName.TrimEnd('\\'), shots, StringComparison.OrdinalIgnoreCase)) continue;
        bool reparse = (a & FileAttributes.ReparsePoint) != 0;
        if (reparse && (oneDrive.Length == 0 || !it.FullName.StartsWith(oneDrive, StringComparison.OrdinalIgnoreCase))) continue;
        Collect((DirectoryInfo)it, shots, oneDrive, list, media, project);
      } else if (MediaExts.Contains(it.Extension) && !IsCloud(a)) {
        var pic = ToPic((FileInfo)it);
        pic.Project = project;
        media.Add(pic);
        if (Exts.Contains(it.Extension)) list.Add(pic);
      }
    }
    Tick("사진 모으는 중\t" + list.Count + "\t" + dir.FullName);
  }

  // 파일 앞부분(머리말)만 읽어 가로 · 세로를 알아내요. 사진을 통째로 열지 않아서 빨라요
  static bool ReadDims(Pic p) {
    if (p.DimsRead) return p.W > 0 && p.H > 0;
    p.DimsRead = true;
    try {
      using (var fs = new FileStream(p.Path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete)) {
        var b = new byte[26];
        if (fs.Read(b, 0, 26) < 26) return false;
        if (b[0] == 0x89 && b[1] == 0x50) {
          p.W = (b[16] << 24) | (b[17] << 16) | (b[18] << 8) | b[19];
          p.H = (b[20] << 24) | (b[21] << 16) | (b[22] << 8) | b[23];
        } else if (b[0] == 'G' && b[1] == 'I') {
          p.W = b[6] | (b[7] << 8);
          p.H = b[8] | (b[9] << 8);
        } else if (b[0] == 'B' && b[1] == 'M') {
          p.W = BitConverter.ToInt32(b, 18);
          p.H = Math.Abs(BitConverter.ToInt32(b, 22));
        } else if (b[0] == 0xFF && b[1] == 0xD8) {
          fs.Position = 2;
          while (fs.Position < fs.Length) {
            int ff = fs.ReadByte();
            if (ff != 0xFF) return false;
            int marker = fs.ReadByte();
            while (marker == 0xFF) marker = fs.ReadByte();
            if (marker < 0) return false;
            if (marker == 0x01 || (marker >= 0xD0 && marker <= 0xD8)) continue;
            int len = (fs.ReadByte() << 8) | fs.ReadByte();
            if (marker >= 0xC0 && marker <= 0xCF && marker != 0xC4 && marker != 0xC8 && marker != 0xCC) {
              fs.ReadByte();
              p.H = (fs.ReadByte() << 8) | fs.ReadByte();
              p.W = (fs.ReadByte() << 8) | fs.ReadByte();
              break;
            }
            fs.Position += len - 2;
          }
        }
      }
    } catch { }
    return p.W > 0 && p.H > 0;
  }

  // shot = 스크린샷, copy = 사본 후보. 비율이 같아야 하고, 사본이 원본보다 클 수는 없어요 (휴대폰 사진이 여기서 걸러져요)
  static bool SameShape(Pic shot, Pic copy) {
    double rs = (double)shot.W / shot.H, rc = (double)copy.W / copy.H;
    return Math.Abs(rs - rc) / rs <= 0.03 && copy.W <= shot.W * 1.02;
  }

  // 9x8로 줄인 흑백 그림에서 「왼쪽이 오른쪽보다 밝은가」 64칸을 비트로 (dHash)
  static void HashPic(Pic p) {
    if (p.Hashed) return;
    p.Hashed = true;
    try {
      using (var fs = new FileStream(p.Path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete))
      using (var img = Image.FromStream(fs, false, false))
      using (var small = new Bitmap(9, 8))
      using (var g = Graphics.FromImage(small)) {
        p.Aspect = (double)img.Width / img.Height;
        g.InterpolationMode = InterpolationMode.HighQualityBilinear;
        g.DrawImage(img, 0, 0, 9, 8);
        ulong h = 0; int bit = 0;
        for (int y = 0; y < 8; y++) {
          for (int x = 0; x < 8; x++) {
            Color l = small.GetPixel(x, y), r = small.GetPixel(x + 1, y);
            double gl = l.R * 0.299 + l.G * 0.587 + l.B * 0.114;
            double gr = r.R * 0.299 + r.G * 0.587 + r.B * 0.114;
            if (gl > gr) h |= 1UL << bit;
            bit++;
          }
        }
        p.Hash = h;
        p.Ok = true;
      }
    } catch { p.Ok = false; }
  }

  // 앞 64KB + 뒤 64KB만 읽은 지문 (크기가 같은 파일끼리 빠르게 걸러요)
  static string QuickKey(Pic p) {
    try {
      using (var fs = new FileStream(p.Path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete))
      using (var sha = System.Security.Cryptography.SHA256.Create()) {
        int n = (int)Math.Min(65536, fs.Length);
        var buf = new byte[n * 2];
        int got = fs.Read(buf, 0, n);
        if (fs.Length > n) { fs.Seek(-n, SeekOrigin.End); got += fs.Read(buf, n, n); }
        return BitConverter.ToString(sha.ComputeHash(buf, 0, got));
      }
    } catch { return null; }
  }

  // 파일 전체 지문 (SHA-256). 이게 같으면 내용이 100% 같아요
  static string FullKey(Pic p) {
    try {
      using (var fs = new FileStream(p.Path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete))
      using (var sha = System.Security.Cryptography.SHA256.Create()) {
        return BitConverter.ToString(sha.ComputeHash(fs));
      }
    } catch { return null; }
  }

  static int Distance(ulong a, ulong b) {
    ulong x = a ^ b; int c = 0;
    while (x != 0) { x &= x - 1; c++; }
    return c;
  }

  public static void Run(string home, string shots, string outPath, string oneDrive, int windowMinutes, int maxDistance) {
    sw = System.Diagnostics.Stopwatch.StartNew();
    shots = shots.TrimEnd('\\');
    var outw = new StreamWriter(outPath, false, new UTF8Encoding(false));
    outw.WriteLine("K\tscreenshots\t" + shots);

    var shotList = new List<Pic>();
    var shotDir = new DirectoryInfo(shots);
    if (shotDir.Exists) {
      foreach (var f in shotDir.EnumerateFiles("*", SearchOption.AllDirectories)) {
        if (Exts.Contains(f.Extension) && !IsCloud(f.Attributes)) shotList.Add(ToPic(f));
      }
    }
    var others = new List<Pic>();
    var media = new List<Pic>();
    Collect(new DirectoryInfo(home), shots, oneDrive ?? "", others, media, false);

    // 시각 순으로 정렬해 두고, 사본 후보마다 앞뒤 windowMinutes 안의 스크린샷만 비교해요
    var byTime = shotList.OrderBy(s => s.Write).ToList();
    var times = byTime.Select(s => s.Write.Ticks).ToArray();
    long win = TimeSpan.FromMinutes(windowMinutes).Ticks;
    var matches = new List<Tuple<int, Pic, Pic>>();
    int done = 0;
    foreach (var o in others) {
      done++;
      Tick("같은 장면 비교 중\t" + done + "/" + others.Count + "\t" + o.Path);
      var near = new List<Pic>();
      foreach (var t in new[] { o.Create.Ticks, o.Write.Ticks }) {
        int i = Array.BinarySearch(times, t - win);
        if (i < 0) i = ~i;
        for (; i < times.Length && times[i] <= t + win; i++) if (!near.Contains(byTime[i])) near.Add(byTime[i]);
      }
      if (near.Count == 0) continue;
      if (!ReadDims(o)) continue;
      near = near.Where(s => ReadDims(s) && SameShape(s, o)).ToList();
      if (near.Count == 0) continue;
      HashPic(o);
      if (!o.Ok) continue;
      foreach (var s in near) {
        HashPic(s);
        if (!s.Ok) continue;
        if (Math.Abs(s.Aspect - o.Aspect) / s.Aspect > 0.03) continue;
        int d = Distance(s.Hash, o.Hash);
        if (d <= maxDistance) matches.Add(Tuple.Create(d, s, o));
      }
    }

    // 가장 닮은 짝부터 하나씩. 스크린샷 하나 = 사본 하나
    var usedShot = new HashSet<Pic>();
    var usedCopy = new HashSet<Pic>();
    int pairs = 0;
    foreach (var m in matches.OrderBy(m => m.Item1).ThenBy(m => Math.Abs((m.Item2.Write - m.Item3.Write).Ticks))) {
      if (usedShot.Contains(m.Item2) || usedCopy.Contains(m.Item3)) continue;
      usedShot.Add(m.Item2); usedCopy.Add(m.Item3); pairs++;
      outw.WriteLine("P\t" + m.Item2.Path + "\t" + m.Item2.Size + "\t" + m.Item2.Write.ToString("o") + "\t" + m.Item3.Path + "\t" + m.Item3.Size + "\t" + m.Item1);
    }
    foreach (var s in shotList) {
      if (!usedShot.Contains(s)) outw.WriteLine("U\t" + s.Path + "\t" + s.Size + "\t" + s.Write.ToString("o"));
    }
    // 같은 사진 여러 벌: 크기 → 앞뒤 지문 → 전체 지문이 모두 같은 것끼리 한 묶음
    int groups = 0;
    var sizeGroups = media.Where(m => m.Size >= 20 * 1024).GroupBy(m => m.Size).Where(g => g.Count() > 1).ToList();
    int checkedGroups = 0;
    foreach (var bySize in sizeGroups) {
      checkedGroups++;
      Tick("같은 사진 여러 벌 찾는 중\t" + checkedGroups + "/" + sizeGroups.Count + "\t" + bySize.First().Path);
      var quick = bySize.Select(m => new { m, k = QuickKey(m) }).Where(x => x.k != null).GroupBy(x => x.k).Where(g => g.Count() > 1);
      foreach (var q in quick) {
        var members = q.Select(x => x.m).ToList();
        var full = members[0].Size <= 131072
          ? new List<List<Pic>> { members }
          : members.Select(m => new { m, k = FullKey(m) }).Where(x => x.k != null).GroupBy(x => x.k).Where(g => g.Count() > 1).Select(g => g.Select(x => x.m).ToList()).ToList();
        foreach (var grp in full) {
          groups++;
          foreach (var m in grp) {
            outw.WriteLine("D\t" + groups + "\t" + m.Path + "\t" + m.Size + "\t" + m.Write.ToString("o") + "\t" + (m.Project ? 1 : 0));
          }
        }
      }
    }
    outw.WriteLine("S\t" + shotList.Count + "\t" + others.Count + "\t" + pairs + "\t" + sw.ElapsedMilliseconds + "\t" + groups);
    outw.Close();
  }
}
'@

[TiddiPairs]::Run($UserHome, $Shots, $Out, $OneDrive, $WindowMinutes, $MaxDistance)
