Unicode true
RequestExecutionLevel admin
SetCompressor /SOLID lzma
SetDatablockOptimize on

!include "MUI2.nsh"
!include "LogicLib.nsh"
!include "nsDialogs.nsh"
!include "FileFunc.nsh"
!include "x64.nsh"
!include "WinVer.nsh"

!ifndef VERSION
  !define VERSION "0.1.0-dev"
!endif
!ifndef PRODUCT_VERSION
  !define PRODUCT_VERSION "0.1.0.0"
!endif
!ifndef POSTGRES_MAJOR
  !define POSTGRES_MAJOR "18"
!endif
!ifndef PAYLOAD_DIR
  !error "Falta PAYLOAD_DIR. Usa instalador/build.ps1."
!endif
!ifndef OUTPUT_DIR
  !define OUTPUT_DIR "."
!endif

!define PRODUCT_NAME "Nexora POS"
!define PRODUCT_PUBLISHER "Grupo Macgen"
!define PRODUCT_KEY "Software\FitStore POS"
!define UNINSTALL_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\FitStorePOS"

Name "${PRODUCT_NAME}"
Caption "Instalar ${PRODUCT_NAME}"
OutFile "${OUTPUT_DIR}\Nexora-POS-Setup-${VERSION}.exe"
InstallDir "$PROGRAMFILES64\FitStore POS"
InstallDirRegKey HKLM "${PRODUCT_KEY}" "InstallLocation"
BrandingText "Nexora POS"
Icon "${PAYLOAD_DIR}\assets\fitstore.ico"
UninstallIcon "${PAYLOAD_DIR}\assets\fitstore.ico"
VIProductVersion "${PRODUCT_VERSION}"
VIAddVersionKey /LANG=1034 "ProductName" "Nexora POS"
VIAddVersionKey /LANG=1034 "CompanyName" "Grupo Macgen"
VIAddVersionKey /LANG=1034 "FileDescription" "Instalador de Nexora POS"
VIAddVersionKey /LANG=1034 "FileVersion" "${VERSION}"
VIAddVersionKey /LANG=1034 "LegalCopyright" "Copyright Grupo Macgen"

Var UpdateMode
Var OwnerDialog
Var OwnerNameField
Var OwnerEmailField
Var OwnerPasswordField
Var OwnerConfirmField
Var OwnerPinField
Var OwnerName
Var OwnerEmail
Var OwnerPassword
Var OwnerConfirm
Var OwnerPin
Var BackupDialog
Var BackupField
Var BackupBrowse
Var BackupPath
Var AnswerFile
Var PurgeData
Var ProgramDataDir
Var PowerShellExe
Var RollbackAttempted
Var UpdatePrepared
Var RollbackResult
Var InstallerMutex
Var InstallerOwnsMutex

!define MUI_ABORTWARNING
!define MUI_CUSTOMFUNCTION_ABORT TryRollbackUpdate
!define MUI_ICON "${PAYLOAD_DIR}\assets\fitstore.ico"
!define MUI_UNICON "${PAYLOAD_DIR}\assets\fitstore.ico"
!define MUI_FINISHPAGE_RUN "$WINDIR\explorer.exe"
!define MUI_FINISHPAGE_RUN_PARAMETERS "https://localhost:4173"
!define MUI_FINISHPAGE_RUN_TEXT "Abrir Nexora POS"

!insertmacro MUI_PAGE_WELCOME
Page custom OwnerPageCreate OwnerPageLeave
Page custom BackupPageCreate BackupPageLeave
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "Spanish"

Function .onInit
  StrCpy $InstallerOwnsMutex "0"
  System::Call 'kernel32::CreateMutexW(p 0, i 0, w "Global\FitStorePOSInstaller") p .r9 ?e'
  Pop $0
  StrCpy $InstallerMutex $9
  ${If} $InstallerMutex == 0
    MessageBox MB_ICONSTOP "Windows no pudo crear el bloqueo exclusivo del instalador de Nexora POS. No se modificó la aplicación."
    SetErrorLevel 3
    Abort
  ${ElseIf} $0 == 183
    MessageBox MB_ICONSTOP "Ya hay otra instalación, actualización o desinstalación de Nexora POS en curso. Espera a que termine antes de volver a intentarlo."
    SetErrorLevel 3
    Abort
  ${EndIf}
  StrCpy $InstallerOwnsMutex "1"
  SetRegView 64
  SetShellVarContext all
  ReadEnvStr $ProgramDataDir "ProgramData"
  StrCpy $PowerShellExe "$WINDIR\Sysnative\WindowsPowerShell\v1.0\powershell.exe"
  ${GetParameters} $0
  ${GetOptions} $0 "/ANSWER=" $1
  ${If} $1 != ""
    ${IfNot} ${FileExists} "$1"
      SetErrorLevel 2
      Abort
    ${EndIf}
    ReadINIStr $OwnerName $1 "Setup" "OwnerName"
    ReadINIStr $OwnerEmail $1 "Setup" "OwnerEmail"
    ReadINIStr $OwnerPassword $1 "Setup" "OwnerPassword"
    ReadINIStr $OwnerConfirm $1 "Setup" "OwnerPasswordConfirm"
    ReadINIStr $OwnerPin $1 "Setup" "OwnerPin"
    ReadINIStr $BackupPath $1 "Setup" "BackupPath"
    StrCpy $1 ""
  ${EndIf}
  ${IfNot} ${RunningX64}
    MessageBox MB_ICONSTOP "Nexora POS requiere Windows de 64 bits."
    Abort
  ${EndIf}
  ${IfNot} ${AtLeastWin10}
    MessageBox MB_ICONSTOP "Nexora POS requiere Windows 10 o Windows 11. Se recomienda Windows 11."
    Abort
  ${EndIf}
  StrCpy $UpdateMode "nuevo"
  StrCpy $RollbackAttempted "0"
  StrCpy $UpdatePrepared "0"
  StrCpy $RollbackResult "no-aplica"
  ReadRegStr $0 HKLM "${PRODUCT_KEY}" "InstallLocation"
  ${If} $0 != ""
    StrCpy $INSTDIR $0
    StrCpy $UpdateMode "actualizar"
  ${ElseIf} ${FileExists} "$ProgramDataDir\FitStore POS\DESINSTALADO_LEEME.txt"
    StrCpy $UpdateMode "reinstalar"
  ${EndIf}
FunctionEnd

Function TryRollbackUpdate
  ${If} $InstallerOwnsMutex == "1"
  ${AndIf} $UpdateMode == "actualizar"
  ${AndIf} $RollbackAttempted != "1"
  ${AndIf} $UpdatePrepared == "1"
    StrCpy $RollbackAttempted "1"
    ${If} ${FileExists} "$PLUGINSDIR\Rollback-FitStoreUpdate.ps1"
      nsExec::ExecToLog '"$PowerShellExe" -NoProfile -ExecutionPolicy Bypass -File "$PLUGINSDIR\Rollback-FitStoreUpdate.ps1" -InstallDir "$INSTDIR" -InstallerSession "$PLUGINSDIR"'
      Pop $0
      ${If} $0 == 0
        StrCpy $RollbackResult "correcto"
      ${Else}
        StrCpy $RollbackResult "fallido"
      ${EndIf}
    ${Else}
      StrCpy $RollbackResult "no-disponible"
    ${EndIf}
  ${EndIf}
FunctionEnd

Function .onInstFailed
  Call TryRollbackUpdate
FunctionEnd

Function OwnerPageCreate
  ${If} $UpdateMode != "nuevo"
    Abort
  ${EndIf}
  nsDialogs::Create 1018
  Pop $OwnerDialog
  ${If} $OwnerDialog == error
    Abort
  ${EndIf}
  ${NSD_CreateLabel} 0 0 100% 26u "Crea el usuario dueño. No hay contraseña de demostración: elige credenciales reales y guárdalas en un lugar seguro."
  ${NSD_CreateLabel} 0 35u 31% 12u "Nombre completo"
  ${NSD_CreateText} 33% 32u 67% 13u ""
  Pop $OwnerNameField
  ${NSD_CreateLabel} 0 57u 31% 12u "Correo"
  ${NSD_CreateText} 33% 54u 67% 13u ""
  Pop $OwnerEmailField
  ${NSD_CreateLabel} 0 79u 31% 12u "Contraseña"
  ${NSD_CreatePassword} 33% 76u 67% 13u ""
  Pop $OwnerPasswordField
  ${NSD_CreateLabel} 0 101u 31% 12u "Repetir contraseña"
  ${NSD_CreatePassword} 33% 98u 67% 13u ""
  Pop $OwnerConfirmField
  ${NSD_CreateLabel} 0 123u 31% 12u "PIN (6 dígitos)"
  ${NSD_CreatePassword} 33% 120u 35% 13u ""
  Pop $OwnerPinField
  ${NSD_CreateLabel} 0 145u 100% 22u "La contraseña debe tener al menos 12 caracteres. El PIN se usa para autorizaciones rápidas en caja."
  nsDialogs::Show
FunctionEnd

Function OwnerPageLeave
  ${If} $UpdateMode != "nuevo"
    Return
  ${EndIf}
  ${NSD_GetText} $OwnerNameField $OwnerName
  ${NSD_GetText} $OwnerEmailField $OwnerEmail
  ${NSD_GetText} $OwnerPasswordField $OwnerPassword
  ${NSD_GetText} $OwnerConfirmField $OwnerConfirm
  ${NSD_GetText} $OwnerPinField $OwnerPin
  StrLen $0 $OwnerName
  ${If} $0 < 2
    MessageBox MB_ICONEXCLAMATION "Escribe el nombre completo."
    Abort
  ${EndIf}
  StrLen $0 $OwnerEmail
  ${If} $0 < 5
    MessageBox MB_ICONEXCLAMATION "Escribe un correo válido."
    Abort
  ${EndIf}
  StrLen $0 $OwnerPassword
  ${If} $0 < 12
    MessageBox MB_ICONEXCLAMATION "La contraseña debe tener al menos 12 caracteres."
    Abort
  ${EndIf}
  ${If} $OwnerPassword != $OwnerConfirm
    MessageBox MB_ICONEXCLAMATION "Las contraseñas no coinciden."
    Abort
  ${EndIf}
  StrLen $0 $OwnerPin
  ${If} $0 < 4
  ${OrIf} $0 > 6
    MessageBox MB_ICONEXCLAMATION "El PIN debe tener 6 dígitos."
    Abort
  ${EndIf}
FunctionEnd

Function BackupPageCreate
  nsDialogs::Create 1018
  Pop $BackupDialog
  ${If} $BackupDialog == error
    Abort
  ${EndIf}
  ${NSD_CreateLabel} 0 0 100% 40u "Elige dónde guardar el respaldo diario. Recomendado: una carpeta de OneDrive o una memoria USB que normalmente esté conectada. Se conservarán 30 días."
  ${If} $UpdateMode == "nuevo"
    StrCpy $BackupPath "$ProgramDataDir\FitStore POS\Backups"
  ${Else}
    StrCpy $BackupPath ""
  ${EndIf}
  ${NSD_CreateDirRequest} 0 52u 78% 14u "$BackupPath"
  Pop $BackupField
  ${NSD_CreateBrowseButton} 80% 52u 20% 14u "Elegir..."
  Pop $BackupBrowse
  ${NSD_OnClick} $BackupBrowse BackupBrowseClick
  ${If} $UpdateMode != "nuevo"
    ${NSD_CreateLabel} 0 78u 100% 26u "Actualización detectada. Deja el campo vacío para conservar la carpeta configurada actualmente."
  ${Else}
    ${NSD_CreateLabel} 0 78u 100% 26u "Si el destino externo no está disponible, FitStore guardará temporalmente una copia local."
  ${EndIf}
  nsDialogs::Show
FunctionEnd

Function BackupBrowseClick
  ${NSD_GetText} $BackupField $BackupPath
  nsDialogs::SelectFolderDialog "Carpeta para respaldos de FitStore" "$BackupPath"
  Pop $0
  ${If} $0 != error
    ${NSD_SetText} $BackupField $0
  ${EndIf}
FunctionEnd

Function BackupPageLeave
  ${NSD_GetText} $BackupField $BackupPath
  ${If} $UpdateMode == "nuevo"
  ${AndIf} $BackupPath == ""
    MessageBox MB_ICONEXCLAMATION "Elige una carpeta de respaldo."
    Abort
  ${EndIf}
FunctionEnd

Section "Nexora POS" SecMain
  SetRegView 64
  SetShellVarContext all
  InitPluginsDir

  ${If} $UpdateMode == "actualizar"
    SetOutPath "$PLUGINSDIR"
    File /oname=FitStore.Common.ps1 "${PAYLOAD_DIR}\scripts\FitStore.Common.ps1"
    File /oname=Preflight-FitStore.ps1 "${PAYLOAD_DIR}\scripts\Preflight-FitStore.ps1"
    File /oname=Rollback-FitStoreUpdate.ps1 "${PAYLOAD_DIR}\scripts\Rollback-FitStoreUpdate.ps1"
    ; Preflight puede detener servicios o escribir el marcador antes de fallar.
    ; El rollback valida la sesion: habilitarlo ahora no autoriza marcadores viejos.
    StrCpy $UpdatePrepared "1"
    nsExec::ExecToLog '"$PowerShellExe" -NoProfile -ExecutionPolicy Bypass -File "$PLUGINSDIR\Preflight-FitStore.ps1" -ExistingInstallDir "$INSTDIR" -ExpectedPostgresMajor "${POSTGRES_MAJOR}" -InstallerSession "$PLUGINSDIR"'
    Pop $0
    ${If} $0 != 0
    MessageBox MB_ICONSTOP "No se pudo completar la preparación de la actualización. Se intentará recuperar la instalación anterior si existe una transacción válida de esta ejecución. Revisa el registro de FitStore."
      SetErrorLevel 1
      Abort
    ${EndIf}
  ${EndIf}

  SetOutPath "$INSTDIR"
  File /r "${PAYLOAD_DIR}\*"
  WriteUninstaller "$INSTDIR\Uninstall.exe"

  StrCpy $AnswerFile "$PLUGINSDIR\fitstore-respuesta.ini"
  FileOpen $0 $AnswerFile w
  FileClose $0
  nsExec::ExecToStack '"$SYSDIR\icacls.exe" "$AnswerFile" /inheritance:r /grant:r "*S-1-5-18:(F)" "*S-1-5-32-544:(F)"'
  Pop $1
  Pop $2
  ${If} $1 != 0
    MessageBox MB_ICONSTOP "No se pudo proteger el archivo temporal de credenciales. La instalación se canceló."
    Delete $AnswerFile
    SetErrorLevel 1
    Abort
  ${EndIf}
  WriteINIStr $AnswerFile "Setup" "Mode" "$UpdateMode"
  WriteINIStr $AnswerFile "Setup" "OwnerName" "$OwnerName"
  WriteINIStr $AnswerFile "Setup" "OwnerEmail" "$OwnerEmail"
  WriteINIStr $AnswerFile "Setup" "OwnerPassword" "$OwnerPassword"
  WriteINIStr $AnswerFile "Setup" "OwnerPasswordConfirm" "$OwnerConfirm"
  WriteINIStr $AnswerFile "Setup" "OwnerPin" "$OwnerPin"
  WriteINIStr $AnswerFile "Setup" "BackupPath" "$BackupPath"

  nsExec::ExecToLog '"$PowerShellExe" -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$INSTDIR\scripts\Install-FitStore.ps1" -InstallDir "$INSTDIR" -RespuestaPath "$AnswerFile" -Version "${VERSION}"'
  Pop $0
  Delete $AnswerFile
  StrCpy $OwnerPassword ""
  StrCpy $OwnerConfirm ""
  StrCpy $OwnerPin ""
  ${If} $0 != 0
    Call TryRollbackUpdate
    ${If} $RollbackResult == "correcto"
      MessageBox MB_ICONSTOP "La actualización no terminó. Se restauró y verificó automáticamente la versión anterior. Revisa: $ProgramDataDir\FitStore POS\logs\instalador.log"
    ${ElseIf} $UpdateMode == "actualizar"
      MessageBox MB_ICONSTOP "La actualización no terminó y el rollback automático necesita revisión. No continúes usando la aplicación hasta revisar: $ProgramDataDir\FitStore POS\logs\instalador.log"
    ${Else}
      MessageBox MB_ICONSTOP "La configuración de Nexora POS no terminó. Los datos existentes no se borraron. Revisa: $ProgramDataDir\FitStore POS\logs\instalador.log"
    ${EndIf}
    SetErrorLevel 1
    Abort
  ${EndIf}

  WriteRegStr HKLM "${PRODUCT_KEY}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKLM "${PRODUCT_KEY}" "Version" "${VERSION}"
  WriteRegStr HKLM "${UNINSTALL_KEY}" "DisplayName" "${PRODUCT_NAME}"
  WriteRegStr HKLM "${UNINSTALL_KEY}" "DisplayVersion" "${VERSION}"
  WriteRegStr HKLM "${UNINSTALL_KEY}" "Publisher" "${PRODUCT_PUBLISHER}"
  WriteRegStr HKLM "${UNINSTALL_KEY}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKLM "${UNINSTALL_KEY}" "DisplayIcon" "$INSTDIR\assets\fitstore.ico"
  WriteRegStr HKLM "${UNINSTALL_KEY}" "UninstallString" '"$INSTDIR\Uninstall.exe"'
  WriteRegStr HKLM "${UNINSTALL_KEY}" "QuietUninstallString" '"$INSTDIR\Uninstall.exe" /S'
  WriteRegDWORD HKLM "${UNINSTALL_KEY}" "NoModify" 1
  WriteRegDWORD HKLM "${UNINSTALL_KEY}" "NoRepair" 1
SectionEnd

Function un.onInit
  StrCpy $InstallerOwnsMutex "0"
  System::Call 'kernel32::CreateMutexW(p 0, i 0, w "Global\FitStorePOSInstaller") p .r9 ?e'
  Pop $0
  StrCpy $InstallerMutex $9
  ${If} $InstallerMutex == 0
    MessageBox MB_ICONSTOP "Windows no pudo crear el bloqueo exclusivo del desinstalador. No se modificó FitStore POS."
    SetErrorLevel 3
    Abort
  ${ElseIf} $0 == 183
    MessageBox MB_ICONSTOP "Ya hay otra instalación, actualización o desinstalación de FitStore POS en curso. Espera a que termine antes de volver a intentarlo."
    SetErrorLevel 3
    Abort
  ${EndIf}
  StrCpy $InstallerOwnsMutex "1"
  SetRegView 64
  SetShellVarContext all
  ReadEnvStr $ProgramDataDir "ProgramData"
  StrCpy $PowerShellExe "$WINDIR\Sysnative\WindowsPowerShell\v1.0\powershell.exe"
  StrCpy $PurgeData "0"
FunctionEnd

Section "Uninstall"
  ${If} $INSTDIR != "$PROGRAMFILES64\FitStore POS"
    MessageBox MB_ICONSTOP "La ruta de instalación no pasó la comprobación de seguridad. No se eliminó nada."
    SetErrorLevel 1
    Abort
  ${EndIf}
  MessageBox MB_YESNO|MB_DEFBUTTON2|MB_ICONQUESTION "Por seguridad, la base y los respaldos se conservarán. ¿Quieres solicitar también el borrado permanente de los datos locales? Los respaldos externos nunca se borran." /SD IDNO IDNO KeepData
  MessageBox MB_YESNO|MB_DEFBUTTON2|MB_ICONEXCLAMATION "CONFIRMACIÓN FINAL: ¿borrar permanentemente la base local, configuración, certificados y respaldos guardados dentro de esta PC?" /SD IDNO IDNO KeepData
  StrCpy $PurgeData "1"
KeepData:
  ${If} $PurgeData == "1"
    nsExec::ExecToLog '"$PowerShellExe" -NoProfile -ExecutionPolicy Bypass -File "$INSTDIR\scripts\Uninstall-FitStore.ps1" -InstallDir "$INSTDIR" -PurgeData'
  ${Else}
    nsExec::ExecToLog '"$PowerShellExe" -NoProfile -ExecutionPolicy Bypass -File "$INSTDIR\scripts\Uninstall-FitStore.ps1" -InstallDir "$INSTDIR"'
  ${EndIf}
  Pop $0
  ${If} $0 != 0
    MessageBox MB_ICONSTOP "La desinstalación segura no terminó. No se eliminaron los archivos del programa."
    SetErrorLevel 1
    Abort
  ${EndIf}
  DeleteRegKey HKLM "${UNINSTALL_KEY}"
  DeleteRegKey HKLM "${PRODUCT_KEY}"
  Delete "$INSTDIR\Uninstall.exe"
  RMDir /r "$INSTDIR"
SectionEnd
