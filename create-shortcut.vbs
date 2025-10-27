Set oWS = WScript.CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
currentDir = fso.GetAbsolutePathName(".")

sLinkFile = oWS.SpecialFolders("Desktop") & "\HSM-TERA.lnk"
Set oLink = oWS.CreateShortcut(sLinkFile)
oLink.TargetPath = currentDir & "\dist\win-unpacked\HSM-TERA.exe"
oLink.WorkingDirectory = currentDir & "\dist\win-unpacked"
oLink.IconLocation = currentDir & "\dist\win-unpacked\HSM-TERA.exe"
oLink.Save
WScript.Echo "Desktop shortcut created successfully!"

