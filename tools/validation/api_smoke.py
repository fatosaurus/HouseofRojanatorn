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


def pick(payload: dict, *keys: str):
    for key in keys:
        if key in payload:
            return payload[key]
    return None


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
    smoke_id = dt.datetime.now(dt.timezone.utc).strftime('%Y%m%d%H%M%S') + ''.join(random.choices(string.digits, k=3))

    status, payload = http_json('GET', f'{base_url}/health')
    expect(status == 200, f'GET /health expected 200, got {status}: {payload}')

    email = f'smoke.{smoke_id}@example.local'
    status, created = http_json('POST', f'{base_url}/users', body={'email': email, 'password': 'Password123!', 'role': 'admin'})
    expect(status == 201, f'POST /users expected 201, got {status}: {created}')
    expect(isinstance(created, dict), 'Create user response must be object')

    token = pick(created, 'token', 'Token')
    expect(isinstance(token, str) and len(token) > 20, 'Create user did not return token')

    status, login = http_json('POST', f'{base_url}/login', body={'email': email, 'password': 'Password123!'})
    expect(status == 200, f'POST /login expected 200, got {status}: {login}')

    status, profile = http_json('GET', f'{base_url}/me/profile', token=token)
    expect(status == 200, f'GET /me/profile expected 200, got {status}: {profile}')

    status, inventory_summary = http_json('GET', f'{base_url}/inventory/summary', token=token)
    expect(status == 200, f'GET /inventory/summary expected 200, got {status}: {inventory_summary}')
    expect(isinstance(inventory_summary, dict), '/inventory/summary response must be object')

    status, inventory_page = http_json('GET', f'{base_url}/inventory/gemstones?limit=5&offset=0', token=token)
    expect(status == 200, f'GET /inventory/gemstones expected 200, got {status}: {inventory_page}')
    expect(isinstance(inventory_page, dict), '/inventory/gemstones response must be object')
    inventory_items = pick(inventory_page, 'items', 'Items')
    expect(isinstance(inventory_items, list), '/inventory/gemstones.items must be array')

    if inventory_items:
        first_inventory_id = pick(inventory_items[0], 'id', 'Id')
        expect(isinstance(first_inventory_id, int), 'Inventory item id must be int')
        status, inventory_item = http_json('GET', f'{base_url}/inventory/gemstones/{first_inventory_id}', token=token)
        expect(status == 200, f'GET /inventory/gemstones/{{id}} expected 200, got {status}: {inventory_item}')

    status, usage_page = http_json('GET', f'{base_url}/inventory/usage?limit=5&offset=0', token=token)
    expect(status == 200, f'GET /inventory/usage expected 200, got {status}: {usage_page}')
    expect(isinstance(usage_page, dict), '/inventory/usage response must be object')
    usage_items = pick(usage_page, 'items', 'Items')
    expect(isinstance(usage_items, list), '/inventory/usage.items must be array')

    if usage_items:
        first_batch_id = pick(usage_items[0], 'id', 'Id')
        expect(isinstance(first_batch_id, int), 'Usage batch id must be int')
        status, usage_detail = http_json('GET', f'{base_url}/inventory/usage/{first_batch_id}', token=token)
        expect(status == 200, f'GET /inventory/usage/{{id}} expected 200, got {status}: {usage_detail}')
        expect(isinstance(usage_detail, dict), '/inventory/usage/{id} response must be object')

    status, sql_health = http_json('GET', f'{base_url}/health/sql', token=token)
    expect(status in (200, 503), f'GET /health/sql expected 200 or 503, got {status}: {sql_health}')

    print('[api-smoke] PASS')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
