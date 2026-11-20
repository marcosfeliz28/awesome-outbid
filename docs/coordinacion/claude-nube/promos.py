#!/usr/bin/env python3
"""Carga masiva de precios de oferta (promoción special_price) desde un Excel.

Hecha para la «Liquidación total» de la dueña (20-nov-2026). No cambia el precio
del producto: crea una promoción por SKU y la caja aplica el descuento.

Por defecto SOLO MUESTRA lo que haría; con --aplicar crea las promociones.
  python3 promos.py liquidacion LIQUIDACION_SUPLEMENTOS_15PCT.xlsx \
      --desde 2026-11-21 --hasta 2026-11-30 [--nombre "Liquidación total"] [--aplicar]
  python3 promos.py ver ["Liquidación total"]     # promociones vigentes con ese nombre
  python3 promos.py apagar "Liquidación total" [--aplicar]
  python3 promos.py prueba                        # autoprueba sin red

El Excel necesita las columnas «SKU» y una que empiece por «Precio liquidación».
Antes de crear, compara cada fila con el sistema (precio y costo actuales) y
rechaza la fila si el margen queda bajo el mínimo, si la oferta no baja el
precio o si ya hay una promoción activa para ese SKU. Margen de la dueña:
(precio − costo) ÷ precio, sin restar ITBIS. Mínimo 15 %.
Usa el token de entrar.py (lo renueva solo si venció).
"""
import argparse, datetime, json, os, subprocess, sys, urllib.request

B = os.environ.get("NEXORA_API", "https://nexora-pos-web.onrender.com/api")
AQUI = os.path.dirname(os.path.abspath(__file__))
RD = datetime.timezone(datetime.timedelta(hours=-4))
MARGEN_MIN = 15.0


def call(method, path, body=None, renovar=True):
    tok = open("/tmp/nexora_tok").read().strip() if os.path.exists("/tmp/nexora_tok") else ""
    req = urllib.request.Request(B + path, method=method, data=json.dumps(body).encode() if body is not None else None,
                                 headers={"Authorization": "Bearer " + tok, "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=90) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        if e.code == 401 and renovar:
            subprocess.run([sys.executable, os.path.join(AQUI, "entrar.py")], check=True, stdout=subprocess.DEVNULL)
            return call(method, path, body, False)
        sys.exit("ERROR %s %s: %s" % (e.code, path, e.read().decode()[:300]))


def margen(precio, costo):
    return (precio - costo) / precio * 100 if precio > 0 else -100.0


def revisar(fila, v, activas):
    """Devuelve (ok, motivo). v = variante del sistema o None."""
    sku, oferta = fila
    if v is None:
        return False, "SKU no existe o no está activo"
    precio, costo = float(v["price"]), float(v["costAvg"] or 0)
    if costo <= 0:
        return False, "sin costo en el sistema"
    if oferta >= precio:
        return False, "la oferta %.0f no baja el precio %.0f" % (oferta, precio)
    m = margen(oferta, costo)
    if m < MARGEN_MIN:
        return False, "margen %.1f %% bajo el mínimo (costo %.0f)" % (m, costo)
    if v["id"] in activas:
        return False, "ya tiene promoción activa: %s" % activas[v["id"]]
    return True, "margen %.1f %%, %.0f %% de descuento" % (m, (1 - oferta / precio) * 100)


def leer_excel(ruta):
    import openpyxl
    ws = openpyxl.load_workbook(ruta, data_only=True).worksheets[0]
    filas = list(ws.iter_rows(values_only=True))
    cab = [str(c or "").strip() for c in filas[0]]
    try:
        i_sku = cab.index("SKU")
        i_of = next(i for i, c in enumerate(cab) if c.lower().startswith("precio liquidación"))
    except (ValueError, StopIteration):
        sys.exit("El Excel necesita las columnas «SKU» y «Precio liquidación…». Tiene: %s" % cab)
    out = []
    for f in filas[1:]:
        if f[i_sku] in (None, ""):
            continue
        out.append((str(f[i_sku]).strip(), float(f[i_of])))
    skus = [s for s, _ in out]
    rep = sorted({s for s in skus if skus.count(s) > 1})
    if rep:
        sys.exit("SKU repetidos en el Excel: %s" % ", ".join(rep))
    return out


def fecha(d, fin):
    t = datetime.datetime.strptime(d, "%Y-%m-%d").replace(tzinfo=RD)
    if fin:
        t = t.replace(hour=23, minute=59, second=59)
    return t.astimezone(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")


def activas_por_variante():
    ahora = datetime.datetime.now(datetime.timezone.utc).isoformat()
    out = {}
    for p in call("GET", "/promotions"):
        vid = (p.get("scope") or {}).get("variantId")
        if p.get("active") and vid and p["endsAt"] >= ahora[:19]:
            out[vid] = p["name"]
    return out


def liquidacion(a):
    if a.hasta < a.desde:
        sys.exit("--hasta debe ser igual o posterior a --desde.")
    filas = leer_excel(a.archivo)
    stock = {x["sku"]: x for x in call("GET", "/inventory/stock") if x.get("active")}
    activas = activas_por_variante()
    buenas, malas = [], []
    for sku, oferta in filas:
        v = stock.get(sku)
        ok, motivo = revisar((sku, oferta), v, activas)
        nombre = v["product"]["name"][:45] if v else "?"
        precio = float(v["price"]) if v else 0
        (buenas if ok else malas).append((sku, nombre, precio, oferta, motivo, v))
    print("Promoción «%s», del %s al %s (hora RD). %d filas: %d listas, %d rechazadas.\n"
          % (a.nombre, a.desde, a.hasta, len(filas), len(buenas), len(malas)))
    for sku, n, p, o, m, _ in buenas:
        print("  OK   %-6s %-45s %8.0f → %8.0f  %s" % (sku, n, p, o, m))
    for sku, n, p, o, m, _ in malas:
        print("  NO   %-6s %-45s %8.0f → %8.0f  %s" % (sku, n, p, o, m))
    if not a.aplicar:
        print("\nSolo mostré. Para crear las %d promociones listas: agrega --aplicar." % len(buenas))
        return
    hechas = 0
    for sku, _, _, oferta, _, v in buenas:
        call("POST", "/promotions", {"name": a.nombre, "type": "special_price", "value": oferta,
                                     "startsAt": fecha(a.desde, False), "endsAt": fecha(a.hasta, True),
                                     "scope": {"variantId": v["id"]}, "isClearance": True})
        hechas += 1
    print("\nCreadas %d promociones. Verifica con: python3 promos.py ver \"%s\"" % (hechas, a.nombre))


def ver(a):
    ps = [p for p in call("GET", "/promotions") if p["name"] == a.nombre]
    vivas = [p for p in ps if p.get("active")]
    print("«%s»: %d promociones (%d activas)." % (a.nombre, len(ps), len(vivas)))
    for p in vivas[:200]:
        print("  %s  %s  %s → %s" % (p["value"], (p.get("scope") or {}).get("variantId"), p["startsAt"][:10], p["endsAt"][:10]))


def apagar(a):
    vivas = [p for p in call("GET", "/promotions") if p["name"] == a.nombre and p.get("active")]
    print("Apagaría %d promociones «%s»." % (len(vivas), a.nombre))
    if not a.aplicar:
        print("Solo mostré. Agrega --aplicar para apagarlas.")
        return
    for p in vivas:
        call("PATCH", "/promotions/" + p["id"], {"active": False})
    print("Apagadas %d." % len(vivas))


def prueba(_):
    v = {"id": "v1", "price": "2100", "costAvg": "1000", "product": {"name": "x"}}
    assert revisar(("1", 1180), v, {})[0]                      # 15.25 % → sí
    assert not revisar(("1", 1175), v, {})[0]                  # 14.9 % → no (redondeo hacia abajo)
    assert not revisar(("1", 2100), v, {})[0]                  # no baja el precio
    assert not revisar(("1", 1180), v, {"v1": "otra"})[0]      # ya tiene promoción
    assert not revisar(("1", 1180), None, {})[0]               # no existe
    assert not revisar(("1", 1180), dict(v, costAvg="0"), {})[0]  # sin costo
    assert abs(margen(3530, 3000) - 15.01) < 0.01
    assert fecha("2026-11-21", False) == "2026-11-21T04:00:00.000Z"
    assert fecha("2026-11-30", True) == "2026-12-01T03:59:59.000Z"
    print("prueba OK")


p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
s = p.add_subparsers(dest="cmd", required=True)
x = s.add_parser("liquidacion"); x.add_argument("archivo"); x.add_argument("--desde", required=True)
x.add_argument("--hasta", required=True); x.add_argument("--nombre", default="Liquidación total")
x.add_argument("--aplicar", action="store_true"); x.set_defaults(f=liquidacion)
x = s.add_parser("ver"); x.add_argument("nombre", nargs="?", default="Liquidación total"); x.set_defaults(f=ver)
x = s.add_parser("apagar"); x.add_argument("nombre"); x.add_argument("--aplicar", action="store_true"); x.set_defaults(f=apagar)
x = s.add_parser("prueba"); x.set_defaults(f=prueba)
a = p.parse_args()
a.f(a)
