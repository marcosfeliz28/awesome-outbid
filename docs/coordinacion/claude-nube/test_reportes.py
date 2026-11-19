"""Prueba sin red de reportes.resumen: devoluciones (opción A) y transferencia rechazada.
Uso: python3 docs/coordinacion/claude-nube/test_reportes.py"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import reportes as R

venta = {"status": "completed", "sellerId": "u1", "total": "1000", "costTotal": "400", "creditBalance": "0",
         "returns": [{"total": "250", "costTotal": "100"}],
         "payments": [{"entryType": "sale", "status": "ok", "method": "cash", "amount": "600"},
                      {"entryType": "sale", "status": "rejected", "method": "transfer", "amount": "400"}],
         "items": [{"variantId": "v1", "lineTotal": "1000", "qty": "4", "returnedQty": "1"}]}
r = R.resumen([venta], {"u1": "Ana"}, {"v1": ("Suplementos", "X")})
assert r["vendido"] == 750 and r["costo"] == 300 and r["ganancia"] == 450, r
assert r["devuelto"] == 250
assert r["met"]["Crédito"] == 400 and r["cobrado"] == 600, r["met"]
assert r["por_c"]["Suplementos"] == 750
print("OK reportes.resumen")
assert R.DIAS[__import__("datetime").date(2026, 10, 31).weekday()] == "sábado" and R.MESES[10] == "octubre"
print("OK fechas en español")
