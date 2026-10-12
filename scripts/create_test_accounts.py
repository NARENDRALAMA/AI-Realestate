"""Create dummy accounts for testing through the running API (default http://localhost:8000).

    backend/.venv/bin/python scripts/create_test_accounts.py [API_URL]

Accounts that already exist are skipped. On a fresh database the first account
created becomes the admin and takes ownership of records saved before accounts existed.
For local testing only — don't use these passwords anywhere real.
"""
import json
import sys
import urllib.error
import urllib.request

API = (sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8000").rstrip("/")

ACCOUNTS = [
    ("Demo Admin", "admin@demo.test", "DemoAdmin123"),
    ("Alice Agent", "alice@demo.test", "AliceAgent123"),
    ("Bob Agent", "bob@demo.test", "BobAgent123"),
]


def post(path: str, body: dict) -> tuple[int, dict]:
    req = urllib.request.Request(
        API + path, data=json.dumps(body).encode(), headers={"Content-Type": "application/json"}
    )
    try:
        with urllib.request.urlopen(req) as res:
            return res.status, json.loads(res.read())
    except urllib.error.HTTPError as err:
        return err.code, json.loads(err.read() or b"{}")


for name, email, password in ACCOUNTS:
    status, data = post("/api/auth/register", {"name": name, "email": email, "password": password})
    if status == 201:
        print(f"created  {email:<18} password: {password:<14} role: {data['user']['role']}")
    elif status == 409:
        print(f"exists   {email:<18} password: {password}")
    else:
        print(f"failed   {email}: {status} {data}")
