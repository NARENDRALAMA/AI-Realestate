"""Live smoke test for the deployed API. Usage: python3 audit/deploy/smoke_test.py <API_URL> <ORIGIN> [runs]"""
import json, sys, time, urllib.request, uuid

API, ORIGIN = sys.argv[1].rstrip("/"), sys.argv[2]
RUNS = int(sys.argv[3]) if len(sys.argv) > 3 else 3
H = {"Content-Type": "application/json", "Origin": ORIGIN}
PROPERTY = {
    "title": "Sunny Family Home", "property_type": "house", "price": "$895,000",
    "location": "Sandy Bay, Hobart", "bedrooms": "3", "bathrooms": "2", "parking": "2",
    "land_size": "620 m2", "features": "North-facing garden, renovated kitchen, wood heater",
    "amenities": "Walk to Sandy Bay Beach and the University of Tasmania",
    "tone": "friendly", "length": "medium", "platform": "instagram",
}

def call(path, body=None, token=None, method="POST"):
    h = dict(H, **({"Authorization": f"Bearer {token}"} if token else {}))
    req = urllib.request.Request(API + path, data=json.dumps(body).encode() if body else None, headers=h, method=method)
    t = time.monotonic()
    with urllib.request.urlopen(req, timeout=300) as r:
        raw = r.read().decode()
    return raw, time.monotonic() - t

raw, _ = call("/api/auth/register", {"name": "Smoke Test", "email": f"smoke-{uuid.uuid4().hex[:8]}@example.com", "password": "smoke-test-pass-1"})
token = json.loads(raw)["token"]

for i in range(RUNS):
    raw, wall = call("/api/generate", PROPERTY, token)
    d = json.loads(raw)
    print(f"generate #{i+1}: model_used={d['model_used']} generation_time_ms={d['generation_time_ms']} "
          f"wall={wall:.1f}s sources={d['channel_sources']}")
    print("  words:", {c: len(d["bundle"][c].split()) for c in ("listing", "social", "email", "video")})
    if i == 0:
        for c in ("listing", "social", "email", "video"):
            print(f"  --- {c} ---\n  " + d["bundle"][c][:220].replace("\n", " ") + " ...")

raw, wall = call("/api/generate/stream", PROPERTY, token)
done = [json.loads(l) for l in raw.splitlines() if l.strip() and json.loads(l).get("type") == "done"][0]
print(f"stream: model_used={done['model_used']} generation_time_ms={done['generation_time_ms']} wall={wall:.1f}s")
