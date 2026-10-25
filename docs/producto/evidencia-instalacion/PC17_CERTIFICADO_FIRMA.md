# PC-17 · certificado de firma para Nexora POS en Windows

Fecha de verificación: 25-oct-2026. Investigación de fuentes oficiales; no se compró ni emitió ningún certificado y no se usaron credenciales.

## Decisión de compra

Comprar exactamente esta configuración:

| Campo del pedido | Selección |
|---|---|
| Proveedor | **DigiCert**, mediante CertCentral |
| Producto | **Code Signing Certificate** estándar, con validación de organización (**OV / CS — Code Signing Organization Validation**) |
| Validez inicial | **1 año**, con renovación anual; evita pagar varios años antes de validar el flujo real |
| Custodia de la clave | **DigiCert KeyLocker**, no archivo PFX exportable y no token USB |
| Algoritmo de clave | **RSA 3072** (la ficha oficial de KeyLocker lo especifica) |
| Identidad publicada | La **razón social registrada** que sea dueña y editora legal de Nexora; no usar solo «Nexora» ni «Grupo Macgen» mientras esa razón social siga sin documentar |
| Huella/hash de archivo | SHA-256 |
| Sello de tiempo | RFC 3161, `http://timestamp.digicert.com`, con SHA-256 |

En CertCentral: **Shop DigiCert → Code signing certificates → Validation: Code Signing/OV → Storage: KeyLocker → 1 certificate → 12 months**. DigiCert documenta que KeyLocker se selecciona como método de aprovisionamiento al pedir el certificado, que mantiene la clave privada en un HSM en la nube y que el plan normal asigna un firmante y 1.000 firmas por año. Fuentes: [compra y opciones de custodia](https://docs.digicert.com/en/certcentral/get-started/set-up-your-certcentral-subscription/add-a-code-signing-certificate-subscription.html), [KeyLocker](https://docs.digicert.com/en/digicert-keylocker.html), [licenciamiento](https://docs.digicert.com/en/digicert-keylocker/overview/licensing.html) y [ficha RSA 3072](https://www.digicert.com/content/dam/digicert/pdfs/datasheet/digicert-keylocker-datasheet-en.pdf).

## Por qué OV y no EV

Nexora firma una aplicación de escritorio y sus instaladores, no controladores de kernel. Microsoft indica que un certificado OV de una CA pública sirve para EXE/MSI/MSIX distribuidos fuera de Microsoft Store. Desde 2024, EV ya no obtiene confianza inmediata de SmartScreen: OV y EV deben construir reputación, por lo que pagar EV solo para evitar avisos no aporta ese beneficio. EV se reservaría si en el futuro se firma un controlador o un cliente empresarial lo exige contractualmente. Fuentes: [opciones oficiales de firma para Windows](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/code-signing-options) y [reputación de SmartScreen](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/smartscreen-reputation).

No comprar un certificado SSL/TLS, un certificado de documento ni uno autofirmado. Microsoft advierte que uno autofirmado no es de confianza pública; Tauri exige un certificado de **code signing** y no uno SSL. Fuentes: [Microsoft, opciones de firma](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/code-signing-options) y [Tauri, firma de Windows](https://v2.tauri.app/distribute/sign/windows/).

## Identidad y requisitos antes de pagar

El pedido todavía tiene un bloqueo administrativo real: el repositorio deja la razón social en blanco (`docs/legal/AVISO_PRIVACIDAD.md` y `docs/legal/NEGOCIO_DATOS_CHECKLIST.md`). La dueña debe definir la entidad legal que venderá Nexora antes de comprar. La identidad del certificado se muestra a Windows como editor verificado y no debe emitirse a nombre de una tienda cliente.

DigiCert valida:

1. razón social exacta, tipo de entidad, vigencia y domicilio legal en registros independientes;
2. teléfono empresarial verificable públicamente;
3. contacto autorizado que pueda aprobar el pedido y contestar la llamada;
4. ausencia en listas de fraude, phishing y entidades restringidas.

Preparar antes del pedido: registro mercantil vigente de la entidad, dirección legal, teléfono publicado por una fuente independiente y contacto autorizado. DigiCert puede solicitar documentación adicional. Fuentes: [validación OV](https://docs.digicert.com/en/certcentral/get-started/understand-how-certcentral-works/understand-certificate-validation/validation-levels-in-certcentral/organization-validation--ov-.html), [crear la organización](https://docs.digicert.com/es/certcentral/get-started/onboard-an-organization-in-certcentral/create-an-organization.html) y [solicitar el certificado](https://docs.digicert.com/en/certcentral/order-and-manage-certificates/request-certificates/request-a-code-signing-or-ev-code-signing-certificate/request-code-signing-certificate.html).

OV y EV están sujetos a la misma obligación de proteger la clave en hardware desde junio de 2023. Microsoft resume el requisito como HSM o token de hardware; DigiCert ofrece KeyLocker para cumplirlo sin exportar la clave privada. No guardar una clave de producción como PFX/Base64 en el repositorio ni en un secreto genérico de GitHub. Fuentes: [Microsoft](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/code-signing-options) y [DigiCert](https://www.digicert.com/signing/code-signing-certificates).

## Integración prevista, sin credenciales en el repositorio

KeyLocker se autentica con certificado de cliente y API key, exige 2FA y se integra con SignTool mediante sus herramientas/KSP. Las credenciales deben residir únicamente en el almacén seguro del ejecutor de publicación; este documento no define valores ni autoriza crear secretos. Fuentes: [requisitos de KeyLocker](https://docs.digicert.com/zf/digicert-keylocker/overview/requirements.html), [guía del firmante](https://docs.digicert.com/en/digicert-keylocker/get-started/signer-guide.html) y [firma con herramientas de terceros](https://docs.digicert.com/en/digicert-keylocker/code-signing.html).

Firmar, como mínimo, cada binario distribuido:

- ejecutable principal de Tauri;
- instalador Tauri NSIS `*-setup.exe` y, si se genera, MSI;
- instalador local NSIS `Nexora-POS-Local-Setup-*.exe` y su desinstalador/ejecutables auxiliares;
- un futuro MSIX y los EXE/DLL que incluya.

Microsoft recomienda firmar todos los binarios, incluidos EXE, DLL, instaladores temporales y desinstaladores. Tauri admite un `signCommand` personalizado para firmar sus ejecutables/instaladores; KeyLocker puede ser invocado por SignTool/KSP o por `smctl`. Fuentes: [Smart App Control](https://learn.microsoft.com/en-us/windows/security/book/application-security-application-and-driver-control), [configuración de Tauri](https://v2.tauri.app/reference/config/) y [herramientas de KeyLocker](https://docs.digicert.com/en/digicert-keylocker/client-tools/unsure-which-client-tools-you-need.html).

Parámetros criptográficos mínimos para SignTool:

```text
/fd SHA256 /tr http://timestamp.digicert.com /td SHA256
```

El sello RFC 3161 conserva la validez de la firma hecha mientras el certificado estaba vigente, aun después de que caduque. No publicar una versión si falla el timestamp. Fuentes: [Microsoft, timestamp Authenticode](https://learn.microsoft.com/en-us/windows/win32/seccrypto/time-stamping-authenticode-signatures), [SignTool](https://learn.microsoft.com/en-us/windows/win32/seccrypto/signtool) y [TSA oficial de DigiCert](https://knowledge.digicert.com/general-information/rfc3161-compliant-time-stamp-authority-server).

Para un futuro MSIX, el certificado debe admitir firma de código (`EKU 1.3.6.1.5.5.7.3.3`) y firma digital. El `Publisher` del manifiesto debe coincidir **exactamente**, incluidos orden y espacios, con el `Subject` emitido por DigiCert. Fuente: [Microsoft, requisitos de firma MSIX](https://learn.microsoft.com/en-us/windows/desktop/appxpkg/how-to-sign-a-package-using-signtool).

## Verificación obligatoria de cada publicación

En una máquina limpia con Windows 10 y otra con Windows 11:

```powershell
signtool verify /pa /all /v .\Nexora-POS-Local-Setup-<version>.exe
Get-AuthenticodeSignature .\Nexora-POS-Local-Setup-<version>.exe | Format-List Status,StatusMessage,SignerCertificate,TimeStamperCertificate
```

La publicación solo se acepta si SignTool devuelve código 0, la cadena es confiable, el editor mostrado es la razón social correcta, existe `TimeStamperCertificate` y cada artefacto final conserva la firma después del empaquetado. La firma debe ser el último paso que modifique cada archivo; cualquier cambio posterior la invalida.

## Alternativas descartadas en esta fase

- **Azure Artifact Signing:** Microsoft lo prefiere para distribución fuera de Store, pero su disponibilidad por país/tipo de entidad debe comprobarse. No se eligió para evitar diseñar la compra alrededor de una disponibilidad no confirmada para una entidad de República Dominicana.
- **Token USB:** cumple el requisito de hardware, pero dificulta la automatización, puede perderse y obliga a tener físicamente el token en el equipo firmante.
- **EV:** cuesta más y ya no salta la reputación inicial de SmartScreen; no hay controlador de Windows en el alcance actual.
- **Microsoft Store:** un MSIX publicado por Store es firmado de nuevo por Microsoft, pero el producto actual se distribuye como EXE/NSIS directo. Un EXE/MSI entregado incluso a través de Store sigue necesitando firma propia.

## Resultado PC-17

La especificación técnica queda cerrada: **DigiCert Code Signing OV de 1 año, RSA 3072, clave en DigiCert KeyLocker, firma SHA-256 y timestamp RFC 3161 SHA-256**. La compra queda pendiente únicamente de que la dueña defina y pueda validar la razón social editora de Nexora y apruebe el gasto. No se compró ni configuró nada en este trabajo.
