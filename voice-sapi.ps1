$ErrorActionPreference='Stop'
try {
  Add-Type -AssemblyName System.Speech
  [Console]::InputEncoding = New-Object System.Text.UTF8Encoding($false)
  $request = [Console]::In.ReadToEnd() | ConvertFrom-Json
  $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
  $voice = $synth.GetInstalledVoices() | Where-Object { $_.Enabled -and $_.VoiceInfo.Culture.Name -like 'zh*' } | Select-Object -First 1
  if (-not $voice) { throw 'No installed Chinese system voice' }
  $synth.SelectVoice($voice.VoiceInfo.Name)
  $stream = New-Object System.IO.MemoryStream
  $synth.SetOutputToWaveStream($stream)
  $synth.Speak([string]$request.text)
  [Console]::Out.Write([Convert]::ToBase64String($stream.ToArray()))
  $synth.Dispose(); $stream.Dispose()
} catch { [Console]::Error.Write('System Chinese speech synthesis failed'); exit 1 }
