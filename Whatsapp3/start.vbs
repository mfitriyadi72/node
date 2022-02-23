Set WshShell = CreateObject("WScript.Shell") 
WshShell.Run chr(34) & "D:\Node\Whatsapp3\run.bat" & Chr(34), 0
WshShell.SendKeys "exit {ENTER}"
Set WshShell = Nothing