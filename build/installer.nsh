!macro customInit
  # Releases through 0.2.30 allowed Next's image optimizer to write beneath
  # the installed app. Some generated paths exceed MAX_PATH, which makes the
  # old NSIS uninstaller abort its atomic rename with exit code 2. Use cmd's
  # extended-length path support to remove only this disposable legacy cache
  # before electron-builder invokes the old uninstaller.
  !define LEGACY_NEXT_CACHE "resources\app.asar.unpacked\.next\standalone\.next\cache"

  IfFileExists "$INSTDIR\${LEGACY_NEXT_CACHE}\*" 0 legacy_cache_cleanup_done
    DetailPrint "Removing legacy BladeVault runtime cache..."
    nsExec::ExecToLog '"$SYSDIR\cmd.exe" /D /C rd /S /Q "\\?\$INSTDIR\${LEGACY_NEXT_CACHE}"'
    Pop $0
    ${If} $0 != 0
      DetailPrint "Legacy runtime cache cleanup returned exit code $0."
    ${EndIf}

  legacy_cache_cleanup_done:
  !undef LEGACY_NEXT_CACHE
!macroend
