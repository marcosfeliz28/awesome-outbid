#!/usr/bin/env python3
"""Cambios de mercancía con verificación triple (orden de la dueña, 18-oct-2026).

Todo ajuste o traspaso pasa por aquí: lee la existencia por 3-4 caminos independientes
ANTES, aplica, vuelve a leer DESPUÉS, y deja la orden exacta de la dueña en el sistema
(razón del movimiento) y en la bitácora docs/operacion/bitacora-mercancia.jsonl.
Si algo no cuadra, se detiene sin tocar nada.

  python3 mercancia.py ajuste --sku 1183 --cant -1 --almacen tienda --tipo conteo \
      --orden "frase exacta de la dueña" --detalle "reversa del +1 del 16-oct"      # muestra el plan
  ... --aplicar                                                                       # lo hace
  python3 mercancia.py traspaso --sku 1577 --cant 5 --de casa --a tienda --orden "..." [--aplicar]
  python3 mercancia.py nota --orden "..." --detalle "factura FS-0000120 hecha por Claude"
  python3 mercancia.py buscar carnivor          # ¿qué ordenó la dueña sobre X?
  python3 mercancia.py dia [2026-10-18]          # cambios de un día (por defecto: ayer, hora RD)
  python3 mercancia.py prueba                    # autoprueba sin red
Necesita el token de entrar.py (lo renueva solo si venció).
"""
import argparse, datetime, json, os, re, subprocess, sys, unicodedata, urllib.request, uuid

B = os.environ.get("NEXORA_API", "https://nexora-pos-web.onrender.com/api")
AQUI = os.path.dirname(os.path.abspath(__file__))
BITACORA = os.path.normpath(os.path.join(AQUI, "..", "..", "operacion", "bitacora-mercancia.jsonl"))
ALM = {"tienda": "53900cab-31a6-eca2-bb72-0917353e02de", "casa": "5cf94802-9429-521f-2a12-38b16ed514e8"}
# Igual que COUNT_CORRECTION_SQL (apps/api/src/inventory.ts): esas palabras vuelven «corrección» una salida.
CORRECCION = re.compile(r"(conteo|teddy|auditor|reversa|casa a 0|no existe|no hay)", re.I)
TIPOS = ("conteo", "entrada", "salida", "regalo", "ajuste")
RD = datetime.timezone(datetime.timedelta(hours=-4))


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


def variante(sku):
    v = [x for x in call("GET", "/inventory/stock") if x["sku"] == str(sku)]
    if len(v) != 1:
        sys.exit("No encontré un producto activo con SKU %s." % sku)
    return v[0]


def lecturas(vid, alm):
    """Existencia del almacén leída por caminos independientes; deben dar lo mismo."""
    v = [x for x in call("GET", "/inventory/stock") if x["id"] == vid][0]
    stock = float(v["stock"] if alm == "tienda" else v["homeStock"])
    lr = call("GET", "/inventory/location-report")
    lr = lr if isinstance(lr, list) else (lr.get("items") or lr.get("rows"))
    fila = [r for r in lr if r["variantId"] == vid]
    reporte = float(fila[0]["store" if alm == "tienda" else "home"]) if fila else 0.0
    todos = call("GET", "/inventory/movements?variantId=" + vid)
    ms = sorted((m for m in todos if m.get("warehouseId") == ALM[alm]), key=lambda m: m["createdAt"])
    saldo = float(ms[-1]["balanceAfter"]) if ms else 0.0
    out = {"existencia": stock, "reporte_almacenes": reporte, "ultimo_saldo": saldo}
    if len(todos) < 200:  # el historial trae 200 como máximo; con más, la suma no es completa
        out["suma_movimientos"] = round(sum(float(m["qty"]) for m in ms), 3)
    return out


def verificar(vid, alm, esperado=None, cuando="ANTES"):
    r = lecturas(vid, alm)
    vals = set(r.values())
    if len(vals) != 1 or (esperado is not None and abs(list(vals)[0] - esperado) > 1e-9):
        sys.exit("ALTO (%s, %s): las lecturas no cuadran %s%s. No sigo." % (
            cuando, alm, r, "" if esperado is None else " (esperaba %g)" % esperado))
    print("  %s %s: %s ✔" % (cuando, alm, r))
    return list(vals)[0], r


def razon(tipo, detalle, orden, ref):
    hoy = datetime.datetime.now(RD).strftime("%d-%m-%Y %H:%M")
    if tipo != "conteo" and CORRECCION.search(detalle or ""):
        sys.exit("El detalle tiene una palabra de corrección de conteo (%s) y el tipo es %s: reescríbelo." % (
            CORRECCION.search(detalle).group(0), tipo))
    cita = "«%s»" % orden.strip()
    if tipo != "conteo" and CORRECCION.search(orden):
        cita = "(frase exacta en bitácora %s)" % ref  # no convertir una salida en «corrección»
    return ("%s: %s | orden de la dueña %s: %s" % (tipo, detalle or "-", hoy, cita))[:1000]


def anotar(entrada):
    os.makedirs(os.path.dirname(BITACORA), exist_ok=True)
    with open(BITACORA, "a", encoding="utf-8") as f:
        f.write(json.dumps(entrada, ensure_ascii=False) + "\n")
    print("  Bitácora: %s (id %s). Recuerda commit + push." % (BITACORA, entrada["id"]))


def base(args, **kw):
    ahora = datetime.datetime.now(datetime.timezone.utc)
    return dict(id=uuid.uuid4().hex[:8], cuando=ahora.isoformat(timespec="seconds"),
                cuando_rd=ahora.astimezone(RD).strftime("%Y-%m-%d %H:%M"), quien=os.environ.get("NEXORA_QUIEN", "claude"),
                orden=args.orden, **kw)


def ajuste(a):
    if a.tipo not in TIPOS: sys.exit("Tipo: " + ", ".join(TIPOS))
    if a.cant == 0: sys.exit("Cantidad 0: nada que hacer.")
    if a.tipo in ("salida", "regalo") and a.cant > 0: sys.exit("Una %s va en negativo." % a.tipo)
    if a.tipo == "entrada" and a.cant < 0: sys.exit("Una entrada va en positivo.")
    v = variante(a.sku)
    print("%s · %s · %s %+g en %s" % (a.sku, v["product"]["name"], a.tipo, a.cant, a.almacen))
    antes, l1 = verificar(v["id"], a.almacen)
    if antes + a.cant < 0: sys.exit("Quedaría en negativo (%g %+g)." % (antes, a.cant))
    e = base(a, tipo=a.tipo, sku=a.sku, producto=v["product"]["name"], almacen=a.almacen, cant=a.cant,
             antes=antes, despues=antes + a.cant, detalle=a.detalle)
    e["razon"] = razon(a.tipo, a.detalle, a.orden, e["id"])
    print("  Plan: %g → %g | razón: %s" % (antes, antes + a.cant, e["razon"]))
    if not a.aplicar: return print("  (solo plan; agrega --aplicar)")
    verificar(v["id"], a.almacen, antes, "ANTES-2")  # nadie la movió mientras tanto
    r = call("POST", "/inventory/adjustments", {"variantId": v["id"], "warehouseId": ALM[a.almacen], "qty": a.cant, "reason": e["razon"]})
    _, l2 = verificar(v["id"], a.almacen, antes + a.cant, "DESPUÉS")
    ultimo = sorted((m for m in call("GET", "/inventory/movements?variantId=" + v["id"]) if m.get("warehouseId") == ALM[a.almacen]),
                    key=lambda m: m["createdAt"])[-1]
    if ultimo["reason"] != e["razon"] or abs(float(ultimo["qty"]) - a.cant) > 1e-9:
        sys.exit("ALTO: el último movimiento no es el mío: %s" % ultimo)
    print("  Movimiento confirmado ✔")
    e.update(verificacion={"antes": l1, "despues": l2}, movimiento=ultimo["id"])
    anotar(e)


def traspaso(a):
    if a.de == a.a or a.cant <= 0: sys.exit("Traspaso: dos almacenes distintos y cantidad positiva.")
    v = variante(a.sku)
    print("%s · %s · traspaso %g de %s a %s" % (a.sku, v["product"]["name"], a.cant, a.de, a.a))
    o0, l1 = verificar(v["id"], a.de)
    d0, l2 = verificar(v["id"], a.a)
    if o0 < a.cant: sys.exit("En %s solo hay %g." % (a.de, o0))
    e = base(a, tipo="traspaso", sku=a.sku, producto=v["product"]["name"], de=a.de, a=a.a, cant=a.cant,
             antes={a.de: o0, a.a: d0}, despues={a.de: o0 - a.cant, a.a: d0 + a.cant}, detalle=a.detalle)
    e["razon"] = ("traspaso %s→%s: %s | orden de la dueña: «%s»" % (a.de, a.a, a.detalle or "-", a.orden.strip()))[:300]
    print("  Plan: %s %g→%g, %s %g→%g" % (a.de, o0, o0 - a.cant, a.a, d0, d0 + a.cant))
    if not a.aplicar: return print("  (solo plan; agrega --aplicar)")
    r = call("POST", "/inventory/transfers", {"operationId": str(uuid.uuid4()), "fromId": ALM[a.de], "toId": ALM[a.a],
                                              "reason": e["razon"], "lines": [{"variantId": v["id"], "qty": a.cant}]})
    _, l3 = verificar(v["id"], a.de, o0 - a.cant, "DESPUÉS")
    _, l4 = verificar(v["id"], a.a, d0 + a.cant, "DESPUÉS")
    e.update(verificacion={"antes": {a.de: l1, a.a: l2}, "despues": {a.de: l3, a.a: l4}}, traspaso=r.get("id"))
    anotar(e)


def nota(a):
    anotar(base(a, tipo="nota", detalle=a.detalle))


def _plano(s):
    return unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()


def leer():
    if not os.path.exists(BITACORA): return []
    return [json.loads(l) for l in open(BITACORA, encoding="utf-8") if l.strip()]


def buscar(a):
    q = _plano(" ".join(a.texto))
    for e in leer():
        if q in _plano(json.dumps(e, ensure_ascii=False)): print(resumen(e))


def resumen(e):
    if e["tipo"] == "traspaso":
        q = "%s %g: %s→%s" % (e["sku"], e["cant"], e["de"], e["a"])
    elif e["tipo"] == "nota":
        q = e.get("detalle") or ""
    else:
        q = "%s %s %+g en %s (%g→%g)" % (e["sku"], e["producto"][:40], e["cant"], e["almacen"], e["antes"], e["despues"])
    return "%s [%s] %s · orden: «%s»" % (e.get("cuando_rd", ""), e["tipo"], q, e["orden"])


def dia(a):
    f = a.fecha or (datetime.datetime.now(RD) - datetime.timedelta(days=1)).strftime("%Y-%m-%d")
    hoy = [e for e in leer() if e.get("cuando_rd", "").startswith(f)]
    print("Cambios de mercancía del %s: %d" % (f, len(hoy)))
    for e in hoy: print(" ", resumen(e))


def prueba(_):
    assert CORRECCION.search("Conteo: x") and not CORRECCION.search("regalo a Ana")
    r = razon("salida", "regalo a Ana", "no hay que cobrarle", "abc")
    assert "bitácora abc" in r and "no hay" not in r, r  # una salida nunca queda como corrección
    assert "«quedan 3»" in razon("conteo", "reversa", "quedan 3", "x")
    assert len(razon("ajuste", "d", "x" * 2000, "x")) == 1000
    try: razon("salida", "reversa de algo", "o", "x"); assert False
    except SystemExit: pass
    print("autoprueba OK")


p = argparse.ArgumentParser(description="Mercancía con verificación triple.")
s = p.add_subparsers(dest="cmd", required=True)
x = s.add_parser("ajuste"); x.add_argument("--sku", required=True); x.add_argument("--cant", type=float, required=True)
x.add_argument("--almacen", choices=ALM, default="tienda"); x.add_argument("--tipo", required=True)
x.add_argument("--orden", required=True); x.add_argument("--detalle", default=""); x.add_argument("--aplicar", action="store_true")
x.set_defaults(f=ajuste)
x = s.add_parser("traspaso"); x.add_argument("--sku", required=True); x.add_argument("--cant", type=float, required=True)
x.add_argument("--de", choices=ALM, required=True); x.add_argument("--a", choices=ALM, required=True)
x.add_argument("--orden", required=True); x.add_argument("--detalle", default=""); x.add_argument("--aplicar", action="store_true")
x.set_defaults(f=traspaso)
x = s.add_parser("nota"); x.add_argument("--orden", required=True); x.add_argument("--detalle", required=True); x.set_defaults(f=nota)
x = s.add_parser("buscar"); x.add_argument("texto", nargs="+"); x.set_defaults(f=buscar)
x = s.add_parser("dia"); x.add_argument("fecha", nargs="?"); x.set_defaults(f=dia)
x = s.add_parser("prueba"); x.set_defaults(f=prueba)
a = p.parse_args(); a.f(a)
