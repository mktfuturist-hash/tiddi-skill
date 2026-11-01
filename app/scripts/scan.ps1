# TIDDI 드라이브 훑기 (읽기만 해요. 파일 내용은 열지 않고, 목록에 딸려 오는 크기만 세요)
# 결과: -Out 파일에 한 줄씩 (D 폴더 / T 유형 / S 요약), 진행 상황: 표준 출력에 P 줄
param(
  [Parameter(Mandatory = $true)][string]$Root,
  [Parameter(Mandatory = $true)][string]$Out,
  [string]$OneDrive = "",
  [string]$UserHome = $env:USERPROFILE,
  # D 드라이브처럼 윈도우가 없는 자료 드라이브면: 드라이브 전체를 오래된 파일 후보로 봐요 (프로그램 · 게임 · 시스템 폴더 빼고)
  [switch]$Data
)
$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# 윈도우가 정해 둔 스크린샷 폴더 (OneDrive로 옮겨졌으면 그 경로)
$Shots = (Get-ItemProperty "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\User Shell Folders" -ErrorAction SilentlyContinue)."{B7BEDE81-DF94-4682-A7D8-57A52620B86F}"
if ($Shots) { $Shots = [Environment]::ExpandEnvironmentVariables($Shots) } else { $Shots = "" }

Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Text;

public static class TiddiScan {
  const int KeepDepth = 6;
  static long files, bytes, cloudFiles, cloudBytes, skipped, lastTick;
  static Dictionary<string, long> types = new Dictionary<string, long>();
  static Dictionary<string, string> ext = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
  static StreamWriter outw;
  static Stopwatch sw;
  static string oneDrive;
  // 「오래된 파일」 후보: 내 사용자 폴더 안(AppData · 숨김 폴더 · 개발 프로젝트 빼고)의 1MB 이상 파일
  static string home;
  const long OldMin = 1024 * 1024;
  // 자료 드라이브(D 등)면 드라이브 전체가 후보예요. 아래 이름의 폴더는 어느 깊이에 있든 빼요
  static bool dataDrive;
  static readonly HashSet<string> Protected = new HashSet<string>(StringComparer.OrdinalIgnoreCase) {
    "$recycle.bin", "system volume information", "windows", "program files", "program files (x86)", "programdata",
    "windowsapps", "recovery", "config.msi", "msocache", "steamlibrary", "steamapps", "xboxgames", "epic games", "riot games", "node_modules"
  };

  static void Group(string type, string list) {
    foreach (var e in list.Split(' ')) ext["." + e] = type;
  }

  static string TypeOf(string full, string extension) {
    if (full.IndexOf("\\node_modules\\", StringComparison.OrdinalIgnoreCase) >= 0 ||
        full.IndexOf("\\.git\\", StringComparison.OrdinalIgnoreCase) >= 0 ||
        full.IndexOf("\\.next\\", StringComparison.OrdinalIgnoreCase) >= 0) return "dev";
    string t;
    return ext.TryGetValue(extension, out t) ? t : "etc";
  }

  public static void Run(string root, string outPath, string oneDriveRoot, string shots, string userHome, bool data) {
    home = (userHome ?? "").TrimEnd('\\');
    dataDrive = data;
    Group("image", "png jpg jpeg gif webp heic bmp tif tiff svg psd ai raw cr2 nef");
    Group("video", "mp4 mov avi mkv wmv m4v webm mts");
    Group("doc", "pdf doc docx xls xlsx ppt pptx hwp hwpx txt md csv key pages numbers");
    Group("app", "exe dll sys msi msp cab mui pak");
    Group("archive", "zip rar 7z tar gz iso dmg");
    oneDrive = oneDriveRoot ?? "";
    outw = new StreamWriter(outPath, false, new UTF8Encoding(false));
    if (!string.IsNullOrEmpty(shots) && !dataDrive) outw.WriteLine("K\tscreenshots\t" + shots);
    sw = Stopwatch.StartNew();
    Walk(new DirectoryInfo(root), 0, dataDrive);
    foreach (var kv in types) outw.WriteLine("T\t" + kv.Key + "\t" + kv.Value);
    outw.WriteLine("S\t" + files + "\t" + bytes + "\t" + cloudFiles + "\t" + cloudBytes + "\t" + skipped + "\t" + sw.ElapsedMilliseconds);
    outw.Close();
  }

  static bool StartsOld(DirectoryInfo child, bool parentPick) {
    if (dataDrive) {
      if (!parentPick) return false;
      if ((child.Attributes & (FileAttributes.Hidden | FileAttributes.System)) != 0) return false;
      return !child.Name.StartsWith(".") && !Protected.Contains(child.Name);
    }
    string full = child.FullName.TrimEnd('\\');
    if (home.Length > 0 && full.Equals(home, StringComparison.OrdinalIgnoreCase)) return true;
    if (!parentPick) return false;
    string name = child.Name;
    if (name.StartsWith(".") || name.Equals("node_modules", StringComparison.OrdinalIgnoreCase)) return false;
    if (full.Equals(home + "\\AppData", StringComparison.OrdinalIgnoreCase)) return false;
    return true;
  }

  static long[] Walk(DirectoryInfo dir, int depth, bool pick) {
    long size = 0, count = 0;
    var subdirs = new List<DirectoryInfo>();
    try {
      var items = new List<FileSystemInfo>(dir.EnumerateFileSystemInfos());
      // 개발 프로젝트 폴더(package.json · .git) 안은 오래된 파일 후보에서 빼요
      if (pick) {
        foreach (var x in items) {
          if (x.Name.Equals("package.json", StringComparison.OrdinalIgnoreCase) || x.Name.Equals(".git", StringComparison.OrdinalIgnoreCase)) { pick = false; break; }
        }
      }
      foreach (var it in items) {
        var a = it.Attributes;
        if ((a & FileAttributes.Directory) != 0) {
          // 정션 · 링크 폴더는 따라가지 않아요 (같은 폴더를 두 번 세지 않게). OneDrive 안의 폴더는 예외
          bool reparse = (a & FileAttributes.ReparsePoint) != 0;
          if (reparse && (oneDrive.Length == 0 || !it.FullName.StartsWith(oneDrive, StringComparison.OrdinalIgnoreCase))) continue;
          subdirs.Add((DirectoryInfo)it);
        } else {
          long len = ((FileInfo)it).Length;
          int ia = (int)a;
          // 클라우드에만 있는 OneDrive 파일은 내 컴퓨터 용량을 차지하지 않아요
          if ((ia & 0x400000) != 0 || (ia & 0x40000) != 0 || (ia & 0x1000) != 0) { cloudFiles++; cloudBytes += len; continue; }
          size += len; count++; files++; bytes += len;
          if (pick && len >= OldMin && (a & FileAttributes.Hidden) == 0 && (a & FileAttributes.System) == 0) {
            outw.WriteLine("F\t" + len + "\t" + ((FileInfo)it).LastWriteTimeUtc.ToString("o") + "\t" + it.FullName);
          }
          string t = TypeOf(it.FullName, it.Extension);
          long v;
          types.TryGetValue(t, out v);
          types[t] = v + len;
        }
      }
    } catch { skipped++; }

    if (sw.ElapsedMilliseconds - lastTick > 400) {
      lastTick = sw.ElapsedMilliseconds;
      Console.Out.WriteLine("P\t" + files + "\t" + bytes + "\t" + dir.FullName);
      Console.Out.Flush();
    }

    foreach (var sd in subdirs) {
      var r = Walk(sd, depth + 1, StartsOld(sd, pick));
      size += r[0];
      count += r[1];
    }
    if (depth <= KeepDepth) outw.WriteLine("D\t" + depth + "\t" + size + "\t" + count + "\t" + dir.FullName);
    return new long[] { size, count };
  }
}
'@

[TiddiScan]::Run($Root, $Out, $OneDrive, $Shots, $UserHome, $Data.IsPresent)
