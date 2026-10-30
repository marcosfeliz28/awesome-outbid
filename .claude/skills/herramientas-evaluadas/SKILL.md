---
name: herramientas-evaluadas
description: Herramientas externas que la dueña propone (conectores, plugins, repos) y la decisión tomada para cada una. Léelo antes de instalar o conectar algo nuevo; agrega una fila por cada propuesta nueva con motivo y quién la instala.
---

# Herramientas evaluadas (criterio: gastar menos token, no dar más acceso a datos de dinero, no meter código de terceros sin revisar)

Regla: nada se instala ni se conecta a la tienda en vivo sin revisar (a) qué acceso da, (b) si ya tenemos algo igual, (c) si sube el gasto de tokens. Solo la dueña conecta conectores (claude.ai) o instala en su laptop.

| Fecha | Herramienta (fuente) | Decisión | Motivo | Quién la instala |
|---|---|---|---|---|
| 30-oct | **Chrome DevTools MCP** (Google; reel @fernandods.ia, enchufe 4) | SÍ, solo en la laptop (Claude PC) | Depurar pantallas a 390 px, consola y rendimiento sin gastar tokens extra; es local y de lectura. No se instala en la nube. | Dueña, en la laptop, desde el repositorio oficial de Google |
| 30-oct | **Supabase** (conector; enchufe 1) | NO por ahora | La tienda usa PostgreSQL en Render; Supabase da acceso a crear/pausar proyectos y bases (con costo). Duplica y amplía el acceso a datos de dinero. Solo si un día el producto se monta sobre Supabase. | — |
| 30-oct | **Vercel** (conector; enchufe 2) | NO | Desplegamos en Render (solo Claude nube con las llaves). Un segundo sitio de despliegue duplica controles. | — |
| 30-oct | **Oh My Claude Code** (repo de terceros, orquestación multiagente; enchufe 3) | NO por ahora | Más agentes = más tokens, y la orden es menos sesiones. Es código de terceros con permisos sobre el repo de dinero (riesgo de cadena de suministro; el skill seguridad-20 pide revisar dependencias y paquetes). Claude PC ya reparte agentes locales baratos. Reevaluar si hay mediciones de ahorro. | — |
