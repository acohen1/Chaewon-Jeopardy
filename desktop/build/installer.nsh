; Custom NSIS hooks for the Chaewon Jeopardy installer.
;
; The sidecar (rhubarb-backend.exe - the exe kept its rename-era internal
; name on purpose; it ships in lockstep with the shell and users never see
; it) holding a file lock during an update makes NSIS silently skip locked
; files -> corrupt install -> "spawn UNKNOWN". The app's shell sweeps strays
; before quitting, but the INSTALLER is the only code guaranteed to be
; new-version regardless of how old the initiating app is - so it sweeps
; too. Runs in silent (auto-update) mode.
;
; BOTH sidecar names are swept: jeopardy-backend.exe (installs through
; v2.3.0 - the v2.3.0 -> v2.4.0 update is initiated by an old app whose own
; teardown only knows that name) and rhubarb-backend.exe (v2.4.0+, plus
; orphans from the brief unreleased Rhubarb dev era).

!macro customInit
  nsExec::Exec 'taskkill /IM rhubarb-backend.exe /F /T'
  nsExec::Exec 'taskkill /IM jeopardy-backend.exe /F /T'
  Sleep 600
!macroend

!macro customUnInit
  nsExec::Exec 'taskkill /IM rhubarb-backend.exe /F /T'
  nsExec::Exec 'taskkill /IM jeopardy-backend.exe /F /T'
  Sleep 600
!macroend

; Shortcut hygiene from the aborted rename: no released build ever created
; "Rhubarb" shortcuts, but a machine that ran unreleased dev builds may have
; hand-made ones pointing at an exe that no longer exists. Harmless no-ops
; everywhere else. (v2.3.0's "Chaewon Jeopardy" shortcuts are recreated by
; this installer under the same name, so they need no cleanup.)
!macro customInstall
  Delete "$DESKTOP\Rhubarb.lnk"
  Delete "$SMPROGRAMS\Rhubarb.lnk"
!macroend
