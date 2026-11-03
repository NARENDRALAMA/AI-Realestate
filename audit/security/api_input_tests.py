"""API input-validation, auth and CORS tests against the live API (our own deployment only).
Usage: python3 audit/security/api_input_tests.py <API_URL> <ALLOWED_ORIGIN>"""
import json, sys, time, urllib.error, urllib.request, uuid

API, ORIGIN = sys.argv[1].rstrip("/"), sys.argv[2]

def req(method, path, body=None, headers=None, raw=None):
    h = {"Content-Type": "application/json", "Origin": ORIGIN, **(headers or {})}
    data = raw if raw is not None else (json.dumps(body).encode() if body is not None else None)
    r = urllib.request.Request(API + path, data=data, headers=h, method=method)
    t = time.monotonic()
    try:
        with urllib.request.urlopen(r, timeout=120) as resp:
            return resp.status, resp.read().decode(errors="replace"), dict(resp.headers), time.monotonic() - t
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode(errors="replace"), dict(e.headers), time.monotonic() - t

def show(name, expect, got, note=""):
    ok = got in expect if isinstance(expect, (list, tuple, set)) else got == expect
    print(f"{'PASS' if ok else 'FAIL'} | {name} | expected {expect} got {got} {note}")
    return ok

_, body, _, _ = req("POST", "/api/auth/register", {"name": "Sec Test", "email": f"sec-{uuid.uuid4().hex[:8]}@example.com", "password": "sec-test-pass-1"})
AUTH = {"Authorization": "Bearer " + json.loads(body)["token"]}
BASE = {"title": "Test Home", "location": "Hobart"}

print("## Authentication")
show("generate without token", 401, req("POST", "/api/generate", BASE)[0])
show("generate with forged token", 401, req("POST", "/api/generate", BASE, {"Authorization": "Bearer forged.token.value"})[0])
show("library without token", 401, req("GET", "/api/library")[0])
show("library item of another user / missing id", 404, req("GET", "/api/library/999999", headers=AUTH)[0])

print("## Missing fields / wrong types")
show("missing title+location", 422, req("POST", "/api/generate", {}, AUTH)[0])
show("blank title", 422, req("POST", "/api/generate", {"title": "   ", "location": "Hobart"}, AUTH)[0])
show("title is a number (wrong type)", 422, req("POST", "/api/generate", {"title": 123, "location": "Hobart"}, AUTH)[0])
show("bedrooms is text", 422, req("POST", "/api/generate", {**BASE, "bedrooms": "three; DROP TABLE users"}, AUTH)[0])
show("negative price", 422, req("POST", "/api/generate", {**BASE, "price": "-500000"}, AUTH)[0])
show("unknown tone enum", 422, req("POST", "/api/generate", {**BASE, "tone": "<script>"}, AUTH)[0])
show("variations out of range", 422, req("POST", "/api/generate", {**BASE, "variations": 50}, AUTH)[0])
show("malformed JSON", 422, req("POST", "/api/generate", raw=b"{not json", headers=AUTH)[0])
show("SQL-like id in path", 422, req("GET", "/api/library/1%20OR%201=1", headers=AUTH)[0])

print("## Very long strings")
time.sleep(61)  # the generate rate limit (10/min) is shared with the tests above
for n in (10_000, 200_000):
    code, body, _, secs = req("POST", "/api/generate", {**BASE, "features": "A" * n}, AUTH)
    show(f"features = {n:,} chars", 422, code, f"({secs:.1f}s)")
code, _, _, secs = req("POST", "/api/auth/register", {"name": "N" * 100_000, "email": f"x{uuid.uuid4().hex[:6]}@example.com", "password": "p" * 100_000})
show("register with 100k-char name/password", 422, code, f"({secs:.1f}s)")
code, _, _, secs = req("POST", "/api/export", {"format": "txt", "title": "T" * 500_000, "tone": "formal", "bundle": {"listing": "x", "social": "x", "email": "x", "video": "x"}}, AUTH)
show("export with 500k-char title", 422, code, f"({secs:.1f}s)")

print("## CORS")
code, _, h, _ = req("OPTIONS", "/api/generate", headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "POST"})
show("preflight from disallowed origin rejected", 400, code, f"ACAO={h.get('access-control-allow-origin')}")
code, _, h, _ = req("GET", "/api/health", headers={"Origin": "https://evil.example"})
show("simple GET from disallowed origin has no ACAO header", None, h.get("access-control-allow-origin"))
code, _, h, _ = req("OPTIONS", "/api/generate", headers={"Origin": ORIGIN, "Access-Control-Request-Method": "POST"})
show("preflight from Pages origin allowed", ORIGIN, h.get("access-control-allow-origin"))
code, _, h, _ = req("OPTIONS", "/api/generate", headers={"Origin": "null", "Access-Control-Request-Method": "POST"})
show("preflight from 'null' origin rejected", 400, code)

print("## Rate limiting (login, limit 10/min)")
codes = [req("POST", "/api/auth/login", {"email": "nobody@example.com", "password": "wrong-password"})[0] for _ in range(12)]
show("12 bad logins -> last ones 429", 429, codes[-1], f"codes={codes}")
