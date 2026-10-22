param([switch]$StopOnly)

$readerApp = Get-CimInstance Win32_Process | Where-Object {
  $_.Name -eq 'DeepSeek Harness.exe' -and $_.CommandLine -match 'remote-debugging-port=9237' -and $_.CommandLine -notmatch '--type='
}
$readerDirectory = [IO.Path]::GetFullPath("$PSScriptRoot\..\.cache\desktop-user")
if (@($readerApp).Count -gt 1) { throw 'Multiple test processes; refusing to stop.' }
if ($readerApp) {
  $readerArgument = [regex]::Match($readerApp.CommandLine, '--user-data-dir=("[^"]+"|\S+)').Groups[1].Value.Trim('"')
  if (-not $readerArgument -or [IO.Path]::GetFullPath($readerArgument) -ne $readerDirectory) { throw 'Unexpected test application directory; refusing to stop.' }
  $readerChildren = Get-CimInstance Win32_Process | Where-Object { $_.ParentProcessId -eq $readerApp.ProcessId }
  Stop-Process -Id $readerApp.ProcessId
  $readerChildren | ForEach-Object { Stop-Process -Id $_.ProcessId -ErrorAction SilentlyContinue }
}
if (-not $StopOnly) {
  Start-Process -FilePath "$env:LOCALAPPDATA\Programs\DeepSeek Harness\DeepSeek Harness.exe" -ArgumentList '--remote-debugging-port=9237',"--user-data-dir=$readerDirectory" -WindowStyle Hidden
}
