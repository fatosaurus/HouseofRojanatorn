#!/usr/bin/env python3
"""Basic auth + health smoke tests for generated scaffold."""

from __future__ import annotations

import argparse
import datetime as dt
import json
import random
import string
import urllib.error
import urllib.request


def expect(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def http_json(method: str, url: str, token: str | None = None, body: dict | None = None):
    payload = None
    if body is not None:
        payload = json.dumps(body).encode('utf-8')

    req = urllib.request.Request(url=url, data=payload, method=method)
    req.add_header('Content-Type', 'application/json')
    if token:
        req.add_header('Authorization', f'Bearer {token}')

    try:
        with urllib.request.urlopen(req, timeout=45) as response:
            status = response.getcode()
            raw = response.read().decode('utf-8')
    except urllib.error.HTTPError as error:
        status = error.code
        raw = error.read().decode('utf-8')

    if not raw.strip():
        return status, None

    try:
        return status, json.loads(raw)
    except json.JSONDecodeError:
        return status, raw


def main() -> int:
    parser = argparse.ArgumentParser(description='Run scaffold API smoke checks')
    parser.add_argument('--base-url', default='http://localhost:7071/api')
    args = parser.parse_args()

    base_url = args.base_url.rstrip('/')
    smoke_id = dt.datetime.now(dt.UTC).strftime('%Y%m%d%H%M%S') + ''.join(random.choices(string.digits, k=3))

    status, payload = http_json('GET', f'{base_url}/health')
    expect(status == 200, f'GET /health expected 200, got {status}: {payload}')

    email = f'smoke.{smoke_id}@example.local'
    status, created = http_json('POST', f'{base_url}/users', body={'email': email, 'password': 'Password123!', 'role': 'admin'})
    expect(status == 201, f'POST /users expected 201, got {status}: {created}')
    expect(isinstance(created, dict), 'Create user response must be object')

    token = created.get('token')
    expect(isinstance(token, str) and len(token) > 20, 'Create user did not return token')

    status, login = http_json('POST', f'{base_url}/login', body={'email': email, 'password': 'Password123!'})
    expect(status == 200, f'POST /login expected 200, got {status}: {login}')

    status, profile = http_json('GET', f'{base_url}/me/profile', token=token)
    expect(status == 200, f'GET /me/profile expected 200, got {status}: {profile}')

    status, sql_health = http_json('GET', f'{base_url}/health/sql', token=token)
    expect(status in (200, 503), f'GET /health/sql expected 200 or 503, got {status}: {sql_health}')

    print('[api-smoke] PASS')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
