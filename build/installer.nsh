; Extra install steps for Oak (electron-builder NSIS include). Everything is per user (HKCU, LOCALAPPDATA),
; so no admin rights are needed, and the uninstaller removes exactly what is added here.

!macro customInstall
  ; Explorer: right-click a folder, or the empty space inside one, -> "Open with Oak"
  WriteRegStr HKCU "Software\Classes\Directory\shell\Oak" "" "Open with Oak"
  WriteRegStr HKCU "Software\Classes\Directory\shell\Oak" "Icon" "$INSTDIR\Oak.exe"
  WriteRegStr HKCU "Software\Classes\Directory\shell\Oak\command" "" '"$INSTDIR\Oak.exe" "%1"'
  WriteRegStr HKCU "Software\Classes\Directory\Background\shell\Oak" "" "Open with Oak"
  WriteRegStr HKCU "Software\Classes\Directory\Background\shell\Oak" "Icon" "$INSTDIR\Oak.exe"
  WriteRegStr HKCU "Software\Classes\Directory\Background\shell\Oak\command" "" '"$INSTDIR\Oak.exe" "%V"'

  ; Terminal: `oak .` / `oak C:\path\to\repo`. WindowsApps is already on every user's PATH, so the
  ; installer never has to edit PATH itself.
  CreateDirectory "$LOCALAPPDATA\Microsoft\WindowsApps"
  FileOpen $0 "$LOCALAPPDATA\Microsoft\WindowsApps\oak.cmd" w
  FileWrite $0 '@echo off$\r$\n'
  FileWrite $0 'start "" "$INSTDIR\Oak.exe" %*$\r$\n'
  FileClose $0
!macroend

!macro customUnInstall
  DeleteRegKey HKCU "Software\Classes\Directory\shell\Oak"
  DeleteRegKey HKCU "Software\Classes\Directory\Background\shell\Oak"
  Delete "$LOCALAPPDATA\Microsoft\WindowsApps\oak.cmd"
!macroend
