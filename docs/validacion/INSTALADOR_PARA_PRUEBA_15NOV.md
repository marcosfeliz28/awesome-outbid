# Instalador que corresponde a la prueba limpia (orden 127)

Registrado por Claude nube el 15-nov-2026. Solo información; no autoriza instalar, activar TPM o licencias, tocar la VM ni desplegar.

## Qué instalador
- Commit: `8ed8f781dfeb62183bca9147e32b0220cf747b8d` de `nexora-cloud` (incluye el arreglo de acentos con BOM, COM-03, DIS-02 y EFI-01).
- CI: run 43682897126, los 3 jobs en verde; en `windows-installer`, «Instalar NSIS», «Compilar el instalador (sin firma)» y la subida del artefacto terminaron en `success` (comprobado por API).
- Artefacto: id 14149622315, nombre `Nexora-POS-Setup-0.1.1-prueba`, 141,768,000 bytes (es el ZIP del artefacto).
- Digest del artefacto (API): `sha256:f6aae83874f10819c9986e7f3f76e7badfd01de2911df64d697c5b7791b477f5`. Es el digest del ZIP, **no** del `.exe`. El SHA-256 del `.exe` hay que calcularlo tras descomprimir y anotarlo antes de instalar.
- Reemplaza al del run 43638258124 (`c05f40bc`), que no tiene los cambios de hoy.

## Límites
- **Caduca el 22-nov-2026** (retención de 7 días). Si la prueba no se hace antes, hay que volver a compilar con un push a `nexora-cloud`.
- Sin firma: Windows mostrará «editor desconocido» (aprobación limitada a la VM, orden 126).
- Un `windows-installer` verde en ramas `mejora/*` no compila el instalador; solo compila en `nexora-cloud`, `claude-pc/*` y `chatgpt-*`.
- Todavía no hay prueba de instalación en una máquina limpia: la VM `FitStore-INST2-Win11` sigue vacía (Windows 11 sin instalar).
- Requisito de `docs/INSTALADOR.md`: Windows 11.
