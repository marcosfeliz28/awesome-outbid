> **Estado: BORRADOR, sin revisión completa.** Generado por el modelo local. Verificado: las rutas  e  existen; los comandos citados son el contenido real de los scripts de `package.json`. Pendiente: preferir `pnpm instalador:preparar`, `pnpm instalador:compilar`, `pnpm instalador:validar`; resolver los marcadores POR CONFIRMAR.

# Guía de Instalación para PC (D7) - Nexora POS

## 1. Requisitos
Para realizar la instalación, se necesitan los siguientes elementos:
- Sistema operativo Windows (versión no especificada, pero compatible con PowerShell).
- Node.js instalado en el equipo (versión requerida no especificada).
- Acceso al directorio raíz del proyecto, donde se encuentran los scripts necesarios.
- **POR CONFIRMAR**: Espacio en disco requerido (no especificado en los comandos).
- **POR CONFIRMAR**: Cualquier permiso especial necesario (no confirmado).

## 2. Pasos para Preparar, Compilar y Validar el Instalador

### 2.1. Preparación del Instalador
Ejecuta el siguiente comando en la consola de comandos (CMD) o PowerShell para preparar el instalador:
```bash
powershell -NoProfile -ExecutionPolicy Bypass -File instalador/build.ps1 -SoloPreparar
```
Este comando utiliza el script `build.ps1` para realizar tareas de preparación sin compilar. **POR CONFIRMAR**: La preparación incluye acciones específicas, pero no están detalladas en los comandos.

### 2.2. Compilación del Instalador
Después de preparar el instalador, compílalo con este comando:
```bash
powershell -NoProfile -ExecutionPolicy Bypass -File instalador/build.ps1
```
Este script generará el instalador necesario para Nexora POS. **POR CONFIRMAR**: La ruta de salida del instalador no está especificada.

### 2.3. Validación del Instalador
Finalmente, valida el instalador usando el comando:
```bash
node instalador/tests/run-validation.mjs
```
Este paso verifica que todo el proceso de instalación se haya realizado correctamente y que el archivo generado cumpla con los requisitos necesarios. **POR CONFIRMAR**: La naturaleza de la validación y qué aspectos se comprueban no están detallados.

## 3. Qué hacer si `instalador:validar` falla

Si el comando `instalador:validar` (equivalente a `node instalador/tests/run-validation.mjs`) falla, revisa los siguientes aspectos:

- **Verifica el proceso de preparación y compilación**: Asegúrate de que no hubo errores en las etapas anteriores. Si el error se originó antes de la validación, repite los pasos de preparación y compilación.
- **Revisa los logs de validación**: El comando `instalador:validar` debe generar una salida con detalles del error. Busca en esa salida información específica sobre qué salió mal (por ejemplo, archivos faltantes, dependencias no satisfechas).
- **Requisitos no confirmados**: Si el error se debe a un requisito no especificado (como espacio en disco o permisos), **POR CONFIRMAR** los detalles específicos y soluciona cualquier obstáculo externo.
- **Contacta con el equipo de desarrollo**: Si no puedes identificar el problema, comunícate con el equipo de Nexora POS para obtener más detalles sobre la validación y cómo resolver el error específico.

---

## Lista de elementos POR CONFIRMAR
- Espacio en disco requerido para la instalación.
- Ruta de salida del instalador compilado.
- Naturaleza de la validación (qué aspectos se comprueban).
- Errores específicos que pueden ocurrir durante la validación.

DEEPSEEK-TERMINADO