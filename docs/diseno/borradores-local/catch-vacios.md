# Catch que ignoran el error (S7, tanda 3)

Borrador sin verificar. Fuente: `origin/producto-nexora` (`d6adc554`), rama `claude-pc/lote-local-tanda3`. Un `catch` cuenta si su bloque queda vacío o solo con comentarios en las líneas siguientes (awk sobre apps/ y packages/, sin pruebas). Se distinguen los que **devuelven un valor** en la misma línea (el error se pierde igual).

| Archivo:línea | Línea | Tipo |
|---|---|---|
| `apps/api/src/mcp-oauth-core.ts:11` | `} catch { return false; }` | devuelve valor, error ignorado |
| `apps/api/src/mcp-oauth-core.ts:25` | `} catch { return null; }` | devuelve valor, error ignorado |
| `apps/api/src/mcp.ts:62` | `} catch { bad("Solicitud OAuth inválida."); }` | vacío o solo comentarios |
| `apps/api/src/tenant-backup.ts:326` | `} catch (error) { callback(error as Error); }` | vacío o solo comentarios |
| `apps/api/src/tenant-context.ts:50` | `} catch {` | vacío o solo comentarios |
| `apps/api/src/tenant-lifecycle.ts:15` | `} catch { return { ok: false }; }` | devuelve valor, error ignorado |
| `apps/api/src/transfer-proof-review.ts:24` | `} catch { return null; }` | devuelve valor, error ignorado |
| `apps/web/src/CreditAccounts.tsx:325` | `catch { toast("No se pudo copiar. Selecciona el texto del mensaje.", true); }` | vacío o solo comentarios |
| `apps/web/src/DesktopPrinterControls.tsx:34` | `catch (error: any) { toast(String(error?.message ?? error), true); }` | vacío o solo comentarios |
| `apps/web/src/Management.tsx:4496` | `} catch {` | vacío o solo comentarios |
| `apps/web/src/McpAuthorize.tsx:45` | `} catch (cause: any) { setError(cause?.message ?? "No se pudo autorizar."); setBusy(false); }` | vacío o solo comentarios |
| `apps/web/src/POS.tsx:2161` | `} catch {` | vacío o solo comentarios |
| `apps/web/src/SupportAccess.tsx:70` | `catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo quitar el acceso."); }` | vacío o solo comentarios |

Total: 13.
