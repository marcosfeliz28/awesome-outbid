#!/usr/bin/env python3
"""Reportes y revisión de anomalías de Nexora POS (Claude nube). Sin secretos en el código.

Requisito: haber corrido `python3 entrar.py` (deja el token en /tmp/nexora_tok).
Necesita: pip install reportlab matplotlib
Uso:
  python3 reportes.py diario    2026-10-11 [carpeta_salida]   → PDF de cierre diario + hallazgos
  python3 reportes.py anomalias 2026-10-11                    → solo los hallazgos (texto)
  python3 reportes.py mensual   2026-10             [carpeta]  → PDF con gráficos del mes
  python3 reportes.py semanal   2026-10-20          [carpeta]  → PDF de los 7 días con descuadres de caja
Reglas: margen = (precio − costo) / precio SIN restar ITBIS. Hora de la tienda = UTC−4.
Los hallazgos son señales para REVISAR, no acusaciones: cada uno trae el dato que lo causó.
"""
import calendar, collections, datetime as dt, json, os, sys, urllib.request

B = os.environ.get("NEXORA_API", "https://nexora-pos-web.onrender.com/api")
MARGEN_MIN = 0.15
DESC_VENDEDOR = 0.10      # el vendedor no debe pasar de 10 % sin aprobación
DESC_ALTO = 0.30          # cualquier descuento ≥ 30 % se revisa siempre
HORA_ABRE, HORA_CIERRA = 8, 21
RUIDO = {"low_stock", "out_of_stock", "receivable", "credit_reminder"}  # avisos operativos, no anomalías
TOK = open("/tmp/nexora_tok").read().strip()


def api(path):
    r = urllib.request.Request(B + path, headers={"Authorization": "Bearer " + TOK})
    try:
        return json.load(urllib.request.urlopen(r, timeout=90))
    except urllib.error.HTTPError as e:
        if e.code == 401:
            sys.exit("Token vencido: corre `python3 entrar.py` otra vez.")
        raise


def local(ts):
    return dt.datetime.fromisoformat(ts.replace("Z", "+00:00")) - dt.timedelta(hours=4)


def rd(x):
    return f"RD$ {float(x):,.2f}"


def f(x):
    return float(x or 0)


# ---------------------------------------------------------------- datos
def cargar_dia(dia):
    ventas = api(f"/sales?date={dia}&limit=500")
    ventas = ventas if isinstance(ventas, list) else ventas.get("data") or ventas.get("items") or []
    return ventas


def catalogo():
    cat, pag = {}, 1
    while True:
        r = api(f"/products?limit=200&page={pag}")
        lote = r if isinstance(r, list) else r.get("data") or r.get("items") or []
        for p in lote:
            for v in p.get("variants", []):
                cat[v["id"]] = (p["category"]["name"], p["name"])
        if len(lote) < 200:
            return cat
        pag += 1


def usuarios():
    return {u["id"]: u["name"] for u in api("/users")}


def clientes():
    r = api("/customers?limit=500")
    r = r if isinstance(r, list) else r.get("data") or r.get("items") or []
    return {c["id"]: c["name"] for c in r}


def cajas_del_dia(dia, hasta=None):
    """Cajas abiertas o cerradas ese día (o entre dia y hasta, inclusive)."""
    hasta = hasta or dia
    r = api("/cash-sessions?limit=500")
    r = r if isinstance(r, list) else r.get("data") or r.get("items") or []
    out = []
    for c in r:
        a = local(c["openedAt"]).strftime("%Y-%m-%d")
        b = local(c["closedAt"]).strftime("%Y-%m-%d") if c.get("closedAt") else None
        if dia <= a <= hasta or (b and dia <= b <= hasta):
            out.append(c)
    return out


# ---------------------------------------------------------------- cálculo
METODO = {"cash": "Efectivo", "card": "Tarjeta", "transfer": "Transferencia", "cod": "Crédito", "credit": "Crédito"}


def resumen(ventas, usr, cat):
    act = [s for s in ventas if s["status"] != "voided"]
    anu = [s for s in ventas if s["status"] == "voided"]
    r = {"act": act, "anu": anu, "vendido": sum(f(s["total"]) for s in act),
         "costo": sum(f(s["costTotal"]) for s in act), "pend": sum(f(s["creditBalance"]) for s in act)}
    r["ganancia"] = r["vendido"] - r["costo"]
    met, por_u, por_c = collections.Counter(), collections.defaultdict(collections.Counter), collections.Counter()
    for s in act:
        u = usr.get(s["sellerId"], "—")
        por_u[u]["n"] += 1
        por_u[u]["total"] += f(s["total"])
        por_u[u]["credito"] += f(s["creditBalance"])
        for p in s["payments"]:
            if p["entryType"] != "sale" or p["status"] in ("voided", "rejected"):
                continue
            m = METODO.get(p["method"], p["method"])
            met[m] += f(p["amount"])
            por_u[u][m] += f(p["amount"])
        for i in s["items"]:
            por_c[cat.get(i["variantId"], ("Sin categoría",))[0]] += f(i["lineTotal"])
    r.update(met=met, por_u=por_u, por_c=por_c)
    r["cobrado"] = sum(v for k, v in met.items() if k != "Crédito")
    return r


def hallazgos(ventas, cajas, usr, cat):
    H = []  # (severidad, titulo, detalle)
    act = [s for s in ventas if s["status"] != "voided"]
    anu = [s for s in ventas if s["status"] == "voided"]
    tot = sum(f(s["total"]) for s in ventas) or 1
    # 1. anulaciones
    por = collections.defaultdict(list)
    for s in anu:
        por[usr.get(s["sellerId"], "—")].append(s)
    for u, l in por.items():
        monto = sum(f(s["total"]) for s in l)
        sev = "Alta" if len(l) >= 3 or monto / tot > 0.30 else "Media" if len(l) >= 2 else "Baja"
        H.append((sev, f"Anulaciones de {u}: {len(l)} factura(s) por {rd(monto)}",
                  "; ".join(f"{s['number']} {rd(s['total'])} ({(s.get('voidedReason') or 'sin motivo')[:50]})" for s in l)))
    for s in act:
        u = usr.get(s["sellerId"], "—")
        sub = f(s["subtotal"]) or 1
        d = f(s["discountTotal"]) / sub
        # 2. descuentos
        if d >= DESC_ALTO:
            H.append(("Alta", f"{s['number']}: descuento de {d*100:.0f} % ({rd(s['discountTotal'])})",
                      f"Vendedor {u}; aprobó {s.get('discountApprovedName') or '—'} ({s.get('discountApprovedRole') or '—'}); motivo: {(s.get('discountReason') or 'sin motivo')[:80]}"))
        elif d > DESC_VENDEDOR and s.get("discountApprovedRole") == "seller":
            H.append(("Media", f"{s['number']}: descuento de {d*100:.0f} % aprobado por el propio vendedor",
                      f"{u}; motivo: {(s.get('discountReason') or 'sin motivo')[:80]}"))
        # 3. margen
        tc = f(s["costTotal"])
        if f(s["total"]) > 0 and tc > 0:
            m = (f(s["total"]) - tc) / f(s["total"])
            if m < 0:
                H.append(("Alta", f"{s['number']}: vendida POR DEBAJO DEL COSTO", f"Total {rd(s['total'])}, costo {rd(tc)} ({u})"))
            elif m < MARGEN_MIN:
                H.append(("Media", f"{s['number']}: margen {m*100:.1f} % (< 15 %)", f"Total {rd(s['total'])}, costo {rd(tc)} ({u})"))
        # 4. crédito
        if f(s["creditBalance"]) > 0 and not s.get("customerId"):
            H.append(("Alta", f"{s['number']}: crédito SIN cliente registrado", f"Saldo {rd(s['creditBalance'])} ({u})"))
        # 5. fuera de horario
        h = local(s["createdAt"]).hour
        if h < HORA_ABRE or h >= HORA_CIERRA:
            H.append(("Media", f"{s['number']}: venta fuera de horario ({local(s['createdAt']):%H:%M})", f"{u}, {rd(s['total'])}"))
        # 6. devoluciones
        if s.get("returns"):
            H.append(("Media", f"{s['number']}: tiene {len(s['returns'])} devolución(es)", f"{u}, total {rd(s['total'])}"))
    # 7. cajas
    for c in cajas:
        for k, n in (("differenceCash", "efectivo"), ("differenceCard", "tarjeta"), ("differenceTransfer", "transferencia")):
            d = f(c.get(k))
            if abs(d) >= 1:
                H.append(("Alta" if d < 0 else "Media", f"Caja {c['registerName']} ({c['userName']}): diferencia en {n} de {rd(d)}",
                          "Faltante" if d < 0 else "Sobrante"))
        if c.get("closedAt") is None:
            H.append(("Baja", f"Caja {c['registerName']} ({c['userName']}) sigue ABIERTA", "Debe cerrarse al terminar el turno"))
    # 8. alertas del sistema del día
    try:
        al = api("/alerts?status=all&limit=200")
        al = al if isinstance(al, list) else al.get("data") or al.get("items") or []
        dia = local(ventas[0]["createdAt"]).strftime("%Y-%m-%d") if ventas else None
        for a in al:
            if a.get("type") in RUIDO:
                continue
            if dia and local(a["createdAt"]).strftime("%Y-%m-%d") == dia:
                H.append(("Media", f"Alerta del sistema: {a.get('title') or a.get('type')}", (a.get("message") or "")[:140]))
    except Exception:
        pass
    orden = {"Alta": 0, "Media": 1, "Baja": 2}
    return sorted(H, key=lambda x: orden[x[0]])


# ---------------------------------------------------------------- PDF
def estilos():
    from reportlab.lib import colors
    from reportlab.lib.styles import ParagraphStyle
    S = lambda n, **k: ParagraphStyle(n, fontName=k.pop("fn", "Helvetica"), **k)
    N = colors.HexColor("#1F2A44")
    return colors, N, {
        "h1": S("h1", fontSize=20, textColor=N, leading=24, fn="Helvetica-Bold"),
        "h2": S("h2", fontSize=12.5, textColor=N, leading=16, spaceBefore=10, spaceAfter=4, fn="Helvetica-Bold"),
        "p": S("p", fontSize=9, leading=12), "sm": S("sm", fontSize=7.5, leading=10, textColor=colors.HexColor("#555555"))}


def tabla(datos, anchos, der=(), total=False):
    from reportlab.lib import colors
    from reportlab.platypus import Table, TableStyle
    N, BAND = colors.HexColor("#1F2A44"), colors.HexColor("#F3F5F9")
    t = Table(datos, colWidths=anchos, repeatRows=1)
    st = [("BACKGROUND", (0, 0), (-1, 0), N), ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
          ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"), ("FONTSIZE", (0, 0), (-1, -1), 8),
          ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, BAND]),
          ("GRID", (0, 0), (-1, -1), .25, colors.HexColor("#D5D9E2")), ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
          ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4)]
    st += [("ALIGN", (c, 0), (c, -1), "RIGHT") for c in der]
    if total:
        st += [("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"), ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#E7EBF3"))]
    t.setStyle(TableStyle(st))
    return t


def cabecera(titulo, sub):
    from reportlab.lib import colors
    from reportlab.lib.units import mm
    from reportlab.platypus import Paragraph, Spacer, Table, TableStyle
    colors_, N, E = estilos()
    st = __import__("reportlab.lib.styles", fromlist=["ParagraphStyle"]).ParagraphStyle
    band = Table([[Paragraph('<font color="white"><b>GRUPO MACGEN</b></font>', st("b", fontName="Helvetica", fontSize=15, leading=18)),
                   Paragraph('<font color="white">Plaza Lope de Vega · Santo Domingo, R. D.</font>', st("b2", fontName="Helvetica", fontSize=8.5, leading=11, alignment=2))]],
                 colWidths=[100 * mm, 78 * mm])
    band.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), N), ("LINEBELOW", (0, 0), (-1, -1), 3, colors.HexColor("#B8924A")),
                              ("TOPPADDING", (0, 0), (-1, -1), 10), ("BOTTOMPADDING", (0, 0), (-1, -1), 10), ("LEFTPADDING", (0, 0), (-1, -1), 10)]))
    return [band, Spacer(1, 8), Paragraph(titulo, E["h1"]), Paragraph(sub, E["p"]), Spacer(1, 6)]


def kpis(vals):
    from reportlab.lib import colors
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.lib.units import mm
    from reportlab.platypus import Paragraph, Table, TableStyle
    N = colors.HexColor("#1F2A44")
    a = ParagraphStyle("k", fontName="Helvetica-Bold", fontSize=12, textColor=N, leading=15, alignment=1)
    b = ParagraphStyle("kl", fontName="Helvetica", fontSize=7, textColor=colors.HexColor("#666"), leading=9, alignment=1)
    n = len(vals)
    t = Table([[Paragraph(v, a) for v, _ in vals], [Paragraph(l, b) for _, l in vals]], colWidths=[178 / n * mm] * n)
    t.setStyle(TableStyle([("BOX", (0, 0), (-1, -1), .5, colors.HexColor("#D5D9E2")), ("INNERGRID", (0, 0), (-1, -1), .25, colors.HexColor("#E5E8EF")),
                           ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F3F5F9")), ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 6)]))
    return t


def alerta_descuadre(cajas, usr):
    """Dueña (21-oct): falte o sobre dinero, el descuadre va arriba, grande y en rojo."""
    from reportlab.lib import colors
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.lib.units import mm
    from reportlab.platypus import Paragraph, Table, TableStyle
    R = colors.HexColor("#DC2626")
    t1 = ParagraphStyle("dt", fontName="Helvetica-Bold", fontSize=16, textColor=R, leading=20, alignment=1)
    t2 = ParagraphStyle("dl", fontName="Helvetica-Bold", fontSize=12, textColor=R, leading=15)
    t3 = ParagraphStyle("dn", fontName="Helvetica", fontSize=8.5, textColor=colors.HexColor("#111"), leading=11)
    filas = []
    for c in cajas:
        det = c.get("closeDetails") or {}
        for k, forma, quien in (("differenceCash", "EN EFECTIVO", "cashApprovedBy"), ("differenceCard", "EN TARJETA", "cardApprovedBy")):
            v = f(c.get(k) or 0)
            if not v:
                continue
            aprobo = usr.get(det.get(quien)) or ("SIN APROBAR" if c.get("closedAt") else "caja abierta")
            just = det.get("differenceReason") or c.get("notes") or "SIN JUSTIFICACIÓN"
            filas.append([Paragraph(f"{'FALTAN' if v < 0 else 'SOBRAN'} {rd(abs(v))} {forma}", t2)])
            from xml.sax.saxutils import escape
            cuando = local(c["closedAt"]).strftime("%d/%m") if c.get("closedAt") else "abierta"
            filas.append([Paragraph(escape(f"{cuando} · {c['registerName']} · {c['userName']} · aprobó: {aprobo} · justificación: {just}"), t3)])
    if not filas:
        return []
    t = Table([[Paragraph("¡ DESCUADRE DE CAJA !", t1)]] + filas, colWidths=[178 * mm])
    t.setStyle(TableStyle([("BOX", (0, 0), (-1, -1), 2, R), ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#FEF2F2")),
                           ("TOPPADDING", (0, 0), (-1, -1), 3), ("BOTTOMPADDING", (0, 0), (-1, -1), 3)]))
    return [Spacer_(6), t]


def Spacer_(h):
    from reportlab.platypus import Spacer
    return Spacer(1, h)


def diario(dia, salida="."):
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import mm
    from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer
    usr, cat, cli = usuarios(), catalogo(), clientes()
    ventas, cajas = cargar_dia(dia), cajas_del_dia(dia)
    r = resumen(ventas, usr, cat)
    H = hallazgos(ventas, cajas, usr, cat)
    _, _, E = estilos()
    fecha = dt.date.fromisoformat(dia)
    out = os.path.join(salida, f"CIERRE-DIARIO-{dia}.pdf")
    doc = SimpleDocTemplate(out, pagesize=A4, leftMargin=16 * mm, rightMargin=16 * mm, topMargin=14 * mm, bottomMargin=16 * mm, title=f"Cierre diario {dia}", author="Grupo Macgen")
    el = cabecera("Reporte de cierre diario", f"{fecha:%A %d} de {fecha:%B de %Y} · generado con los datos del sistema Nexora POS")
    el += [kpis([(rd(r["vendido"]), "VENDIDO (activas)"), (rd(r["cobrado"]), "COBRADO"), (rd(r["pend"]), "PENDIENTE A CRÉDITO"), (rd(r["ganancia"]), "GANANCIA")]),
           Spacer(1, 3), Paragraph(f"{len(r['act'])} facturas activas · {len(r['anu'])} anuladas. Ganancia = precio − costo, sin descontar ITBIS.", E["sm"])]
    el += alerta_descuadre(cajas, usr)
    el += [Paragraph("1. Ventas por forma de pago", E["h2"])]
    d = [["Forma de pago", "Monto"]] + [[k, rd(v)] for k, v in r["met"].items()] + [["Total vendido", rd(r["vendido"])]]
    el += [tabla(d, [120 * mm, 58 * mm], [1], True), Paragraph("Banco = tarjeta + transferencia. Efectivo: ver «Cajas». El crédito es dinero por cobrar, no recibido.", E["sm"])]
    el += [Paragraph("2. Ventas por categoría", E["h2"])]
    tc = sum(r["por_c"].values()) or 1
    el += [tabla([["Categoría", "Monto", "%"]] + [[c, rd(v), f"{v/tc*100:.0f} %"] for c, v in r["por_c"].most_common()] + [["Total", rd(tc), "100 %"]], [90 * mm, 50 * mm, 38 * mm], [1, 2], True)]
    el += [Paragraph("3. Por usuario", E["h2"])]
    d = [["Usuario", "Fact.", "Vendido", "Efectivo", "Transf.", "Tarjeta", "A crédito"]]
    for u, c in r["por_u"].items():
        d.append([u, int(c["n"]), rd(c["total"]), rd(c["Efectivo"]), rd(c["Transferencia"]), rd(c["Tarjeta"]), rd(c["credito"])])
    el += [tabla(d, [30 * mm, 12 * mm, 28 * mm, 26 * mm, 26 * mm, 24 * mm, 32 * mm], [1, 2, 3, 4, 5, 6])]
    el += [Paragraph("4. Cajas", E["h2"])]
    d = [["Caja", "Cajero", "Apertura", "Cierre", "Esperado", "Contado", "Dif. efect.", "Dif. tarj."]]
    for c in cajas:
        ex = (c.get("expected") or {}).get("cash")
        d.append([c["registerName"], c["userName"], local(c["openedAt"]).strftime("%d/%m %H:%M"),
                  local(c["closedAt"]).strftime("%d/%m %H:%M") if c.get("closedAt") else "Abierta",
                  rd(ex) if ex is not None else "—", rd(c["countedCash"]) if c.get("countedCash") is not None else "—",
                  rd(c["differenceCash"]) if c.get("differenceCash") is not None else "—",
                  rd(c["differenceCard"]) if c.get("differenceCard") is not None else "—"])
    el += [tabla(d, [30 * mm, 24 * mm, 20 * mm, 20 * mm, 24 * mm, 24 * mm, 18 * mm, 18 * mm], [4, 5, 6, 7])]
    el += [Paragraph("5. Créditos: quién debe", E["h2"])]
    d = [["Factura", "Cliente", "Vendedor", "Saldo"]]
    for s in r["act"]:
        if f(s["creditBalance"]) > 0:
            d.append([s["number"], cli.get(s["customerId"], "—"), usr.get(s["sellerId"], "—"), rd(s["creditBalance"])])
    d.append(["", "", "Total por cobrar", rd(r["pend"])])
    el += [tabla(d, [28 * mm, 55 * mm, 45 * mm, 50 * mm], [3], True)]
    el += [Paragraph("6. Hallazgos para revisar", E["h2"]),
           Paragraph("Señales automáticas del sistema. No son acusaciones: cada una trae el dato que la causó para que la administración la verifique.", E["sm"])]
    if H:
        el += [tabla([["Nivel", "Hallazgo", "Detalle"]] + [[a, Paragraph(b, E["p"]), Paragraph(c, E["sm"])] for a, b, c in H], [16 * mm, 80 * mm, 82 * mm])]
    else:
        el += [Paragraph("Sin hallazgos hoy.", E["p"])]
    el += [Spacer(1, 8), Paragraph("Documento interno de control, sujeto a revisión de la administración.", E["sm"])]
    doc.build(el, onFirstPage=lambda c, d_: (c.setFont("Helvetica", 7), c.drawRightString(194 * mm, 9 * mm, f"Cierre diario {dia} · Pág. 1")),
              onLaterPages=lambda c, d_: (c.setFont("Helvetica", 7), c.drawRightString(194 * mm, 9 * mm, f"Cierre diario {dia} · Pág. {d_.page}")))
    print(out)
    return out, H


def mensual(mes, salida="."):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import mm
    from reportlab.platypus import Image, Paragraph, SimpleDocTemplate, Spacer
    y, m = map(int, mes.split("-"))
    usr, cat = usuarios(), catalogo()
    dias = []
    for d in range(1, calendar.monthrange(y, m)[1] + 1):
        dia = f"{y:04d}-{m:02d}-{d:02d}"
        if dt.date.fromisoformat(dia) > dt.date.today():
            break
        dias.append((dia, cargar_dia(dia)))
    por_dia = {dia: resumen(v, usr, cat) for dia, v in dias}
    todas = [s for _, v in dias for s in v]
    R = resumen(todas, usr, cat)
    prod = collections.Counter()
    for s in R["act"]:
        for i in s["items"]:
            prod[cat.get(i["variantId"], ("", "?"))[1][:38]] += f(i["lineTotal"])
    os.makedirs(salida, exist_ok=True)
    azul, dorado = "#1F2A44", "#B8924A"

    def png(nombre, fn):
        plt.figure(figsize=(7.2, 3.0)); fn(); plt.tight_layout(); p = os.path.join(salida, nombre); plt.savefig(p, dpi=130); plt.close(); return p
    x = [d[-2:] for d, _ in dias]
    g1 = png("g1.png", lambda: (plt.bar(x, [por_dia[d]["vendido"] for d, _ in dias], color=azul, label="Vendido"),
                                plt.plot(x, [por_dia[d]["ganancia"] for d, _ in dias], color=dorado, marker="o", label="Ganancia"),
                                plt.title("Ventas y ganancia por día"), plt.legend()))
    g2 = png("g2.png", lambda: (plt.pie([v for v in R["met"].values()] or [1], labels=list(R["met"].keys()) or ["—"], autopct="%1.0f%%", colors=[azul, dorado, "#6B7BA4", "#C9CEDB"]), plt.title("Cómo se pagó")))
    g3 = png("g3.png", lambda: (plt.barh([c for c, _ in R["por_c"].most_common()][::-1], [v for _, v in R["por_c"].most_common()][::-1], color=azul), plt.title("Ventas por categoría")))
    g4 = png("g4.png", lambda: (plt.barh([p for p, _ in prod.most_common(8)][::-1], [v for _, v in prod.most_common(8)][::-1], color=dorado), plt.title("Los 8 productos que más vendieron")))
    _, _, E = estilos()
    out = os.path.join(salida, f"REPORTE-MENSUAL-{mes}.pdf")
    doc = SimpleDocTemplate(out, pagesize=A4, leftMargin=16 * mm, rightMargin=16 * mm, topMargin=14 * mm, bottomMargin=16 * mm, title=f"Reporte mensual {mes}")
    el = cabecera("Reporte mensual", f"{calendar.month_name[m]} {y} · ventas, ganancias y resultados")
    el += [kpis([(rd(R["vendido"]), "VENDIDO"), (rd(R["cobrado"]), "COBRADO"), (rd(R["pend"]), "POR COBRAR"), (rd(R["ganancia"]), "GANANCIA BRUTA")]),
           Paragraph(f"{len(R['act'])} facturas · {len(R['anu'])} anuladas ({sum(f(s['total']) for s in R['anu']):,.0f} RD$). Ganancia bruta = precio − costo, sin ITBIS; no incluye gastos.", E["sm"])]
    el += alerta_descuadre(cajas_del_dia(dias[0][0], dias[-1][0]) if dias else [], usr)
    for g in (g1, g2, g3, g4):
        el += [Image(g, width=170 * mm, height=70 * mm)]
    el += [Paragraph("Por usuario", E["h2"]),
           tabla([["Usuario", "Facturas", "Vendido", "A crédito"]] + [[u, int(c["n"]), rd(c["total"]), rd(c["credito"])] for u, c in R["por_u"].items()], [60 * mm, 25 * mm, 45 * mm, 48 * mm], [1, 2, 3]),
           Paragraph("Propuestas de mejora", E["h2"]),
           Paragraph("Se agregan después de revisar las cifras con la administración (rotación, productos sin venta, precios, promociones).", E["p"])]
    doc.build(el)
    print(out)
    return out


def semanal(fin, salida="."):
    """Los 7 días que terminan en `fin`: totales, descuadres de caja y vendedoras."""
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import mm
    from reportlab.platypus import Paragraph, SimpleDocTemplate
    usr, cat = usuarios(), catalogo()
    f_fin = dt.date.fromisoformat(fin)
    dias = [(f_fin - dt.timedelta(days=i)).isoformat() for i in range(6, -1, -1)]
    R = resumen([s for d in dias for s in cargar_dia(d)], usr, cat)
    _, _, E = estilos()
    out = os.path.join(salida, f"REPORTE-SEMANAL-{dias[0]}-a-{fin}.pdf")
    doc = SimpleDocTemplate(out, pagesize=A4, leftMargin=16 * mm, rightMargin=16 * mm, topMargin=14 * mm, bottomMargin=16 * mm, title=f"Reporte semanal {fin}")
    el = cabecera("Reporte semanal", f"Del {dias[0]} al {fin} · ventas, cajas y descuadres")
    el += [kpis([(rd(R["vendido"]), "VENDIDO"), (rd(R["cobrado"]), "COBRADO"), (rd(R["pend"]), "POR COBRAR"), (rd(R["ganancia"]), "GANANCIA")])]
    el += alerta_descuadre(cajas_del_dia(dias[0], fin), usr)
    el += [Paragraph("Por usuario", E["h2"]),
           tabla([["Usuario", "Facturas", "Vendido", "A crédito"]] + [[u, int(c["n"]), rd(c["total"]), rd(c["credito"])] for u, c in R["por_u"].items()], [60 * mm, 25 * mm, 45 * mm, 48 * mm], [1, 2, 3])]
    doc.build(el)
    print(out)
    return out


if __name__ == "__main__":
    a = sys.argv[1:]
    if len(a) < 2:
        sys.exit(__doc__)
    if a[0] == "diario":
        diario(a[1], a[2] if len(a) > 2 else ".")
    elif a[0] == "anomalias":
        usr, cat = usuarios(), catalogo()
        for s, t, d in hallazgos(cargar_dia(a[1]), cajas_del_dia(a[1]), usr, cat):
            print(f"[{s}] {t} — {d}")
    elif a[0] == "mensual":
        mensual(a[1], a[2] if len(a) > 2 else ".")
    elif a[0] == "semanal":
        semanal(a[1], a[2] if len(a) > 2 else ".")
    else:
        sys.exit(__doc__)
