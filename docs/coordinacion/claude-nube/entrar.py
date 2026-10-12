#!/usr/bin/env python3
"""Entrada de Claude (nube) al sistema Nexora POS de la dueña. Sin secretos en el código.

Lee NEXORA_CLAUDE_USER y NEXORA_CLAUDE_PASSWORD del entorno, inicia sesión por la API,
registra (o reutiliza) el equipo «Claude nube» —el administrador lo aprueba solo— y
guarda el token en /tmp/nexora_tok y el equipo en /tmp/nexora_term (modo 600).
Uso:  python3 entrar.py        → imprime «OK» y el nombre/rol; nunca imprime la clave.
"""
import json, os, secrets, sys, urllib.request, uuid

B = os.environ.get("NEXORA_API", "https://nexora-pos-web.onrender.com/api")
user, pw = os.environ.get("NEXORA_CLAUDE_USER"), os.environ.get("NEXORA_CLAUDE_PASSWORD")
if not user or not pw:
    sys.exit("Faltan NEXORA_CLAUDE_USER / NEXORA_CLAUDE_PASSWORD en el entorno (Edit environment).")

def call(path, body=None, tok=None):
    h = {"Content-Type": "application/json"}
    if tok: h["Authorization"] = "Bearer " + tok
    r = urllib.request.Request(B + path, data=json.dumps(body).encode() if body is not None else None,
                               headers=h, method="POST" if body is not None else "GET")
    try: return json.load(urllib.request.urlopen(r, timeout=60))
    except urllib.error.HTTPError as e: return {"_err": e.code, "_b": e.read().decode()[:300]}

lg = call("/auth/login", {"login": user, "password": pw})
if lg.get("requiresPasswordChange"):
    sys.exit("La cuenta pide cambio de contraseña: la dueña la restableció. Pídele la nueva y cámbiala en el entorno.")
tok = lg.get("accessToken")
if not tok: sys.exit("Login falló: %s %s" % (lg.get("_err"), lg.get("_b")))
term_file = "/tmp/nexora_term"
term = json.load(open(term_file)) if os.path.exists(term_file) else {"id": str(uuid.uuid4()), "secret": secrets.token_urlsafe(32)}
reg = call("/terminals/register", {"id": term["id"], "name": "Claude nube", "secret": term["secret"]}, tok)
if reg.get("_err") or not reg.get("approvedAt"):
    sys.exit("No se pudo registrar/aprobar el equipo: %s" % reg)
lg = call("/auth/login", {"login": user, "password": pw, "terminal": term}); tok = lg["accessToken"]
call("/terminals/register", {"id": term["id"], "name": "Claude nube", "secret": term["secret"]}, tok)  # liga la sesión al equipo
os.umask(0o077)
open("/tmp/nexora_tok", "w").write(tok); json.dump(term, open(term_file, "w"))
me = call("/auth/me", tok=tok)
print("OK", me.get("name"), me.get("role"), "| token en /tmp/nexora_tok (válido unas horas)")
