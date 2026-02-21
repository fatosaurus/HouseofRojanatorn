#!/usr/bin/env python3
"""Basic auth + health smoke tests for generated scaffold."""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
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

    admin_email = os.getenv('SMOKE_ADMIN_EMAIL', 'admin@houseofrojanatorn.local').strip().lower()
    admin_password = os.getenv('SMOKE_ADMIN_PASSWORD', 'Admin!23456').strip()
    status, login = http_json('POST', f'{base_url}/login', body={'email': admin_email, 'password': admin_password})

    if status == 200 and isinstance(login, dict):
        token = pick(login, 'token', 'Token')
        expect(isinstance(token, str) and len(token) > 20, 'POST /login did not return token')
    else:
        bootstrap_email = f'smoke.bootstrap.{smoke_id}@example.local'
        bootstrap_password = 'Password123!'
        status, created = http_json(
            'POST',
            f'{base_url}/users',
            body={'email': bootstrap_email, 'password': bootstrap_password, 'role': 'admin'})
        expect(
            status == 201 and isinstance(created, dict),
            f'Bootstrap POST /users expected 201, got {status}: {created}')
        token = pick(created, 'token', 'Token')
        expect(isinstance(token, str) and len(token) > 20, 'Bootstrap user did not return token')

        status, login = http_json('POST', f'{base_url}/login', body={'email': bootstrap_email, 'password': bootstrap_password})
        expect(status == 200, f'Bootstrap POST /login expected 200, got {status}: {login}')

    invite_email = f'smoke.invite.{smoke_id}@example.local'
    status, invite = http_json(
        'POST',
        f'{base_url}/users/invite',
        token=token,
        body={'email': invite_email, 'role': 'member', 'expiresInDays': 7})
    expect(status == 201, f'POST /users/invite expected 201, got {status}: {invite}')
    expect(isinstance(invite, dict), '/users/invite response must be object')
    invite_token = pick(invite, 'token', 'Token')
    expect(isinstance(invite_token, str) and len(invite_token) > 10, 'Invite token missing')

    status, invite_details = http_json('GET', f'{base_url}/users/invite/{invite_token}')
    expect(status == 200, f'GET /users/invite/{{token}} expected 200, got {status}: {invite_details}')

    invite_password = 'Password123!'
    status, accepted = http_json(
        'POST',
        f'{base_url}/users/invite/accept',
        body={'token': invite_token, 'password': invite_password})
    expect(status == 200, f'POST /users/invite/accept expected 200, got {status}: {accepted}')

    status, invited_login = http_json('POST', f'{base_url}/login', body={'email': invite_email, 'password': invite_password})
    expect(status == 200, f'Invited account POST /login expected 200, got {status}: {invited_login}')

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

    status, customers_page = http_json('GET', f'{base_url}/customers?limit=5&offset=0', token=token)
    expect(status == 200, f'GET /customers expected 200, got {status}: {customers_page}')
    expect(isinstance(customers_page, dict), '/customers response must be object')
    customers_items = pick(customers_page, 'items', 'Items')
    expect(isinstance(customers_items, list), '/customers.items must be array')

    customer_payload = {
        'name': f'Smoke Customer {smoke_id}',
        'email': f'customer.{smoke_id}@example.local',
        'phone': '+66-800000000',
        'notes': 'Created by API smoke'
    }
    status, customer_created = http_json('POST', f'{base_url}/customers', token=token, body=customer_payload)
    expect(status == 201, f'POST /customers expected 201, got {status}: {customer_created}')
    expect(isinstance(customer_created, dict), '/customers POST response must be object')
    customer_id = pick(customer_created, 'id', 'Id')
    expect(isinstance(customer_id, str) and len(customer_id) >= 32, 'Created customer id must be string guid')

    status, customer_detail = http_json('GET', f'{base_url}/customers/{customer_id}', token=token)
    expect(status == 200, f'GET /customers/{{id}} expected 200, got {status}: {customer_detail}')
    expect(isinstance(customer_detail, dict), '/customers/{id} response must be object')

    status, customer_note = http_json('POST', f'{base_url}/customers/{customer_id}/notes', token=token, body={'note': 'Smoke note'})
    expect(status == 200, f'POST /customers/{{id}}/notes expected 200, got {status}: {customer_note}')

    status, customer_activity = http_json('GET', f'{base_url}/customers/{customer_id}/activity?limit=10', token=token)
    expect(status == 200, f'GET /customers/{{id}}/activity expected 200, got {status}: {customer_activity}')
    expect(isinstance(customer_activity, list), '/customers/{id}/activity response must be array')

    status, manufacturing_page = http_json('GET', f'{base_url}/manufacturing?limit=5&offset=0', token=token)
    expect(status == 200, f'GET /manufacturing expected 200, got {status}: {manufacturing_page}')
    expect(isinstance(manufacturing_page, dict), '/manufacturing response must be object')
    manufacturing_items = pick(manufacturing_page, 'items', 'Items')
    expect(isinstance(manufacturing_items, list), '/manufacturing.items must be array')

    manufacturing_payload = {
        'manufacturingCode': f'SMK{smoke_id[-8:]}',
        'pieceName': 'Smoke Test Pendant',
        'pieceType': 'pendant',
        'status': 'approved',
        'designerName': 'Smoke QA',
        'usageNotes': 'Smoke baseline note',
        'photos': ['https://example.com/smoke-note.jpg'],
        'sellingPrice': 1000,
        'totalCost': 700,
        'gemstones': []
    }
    status, manufacturing_created = http_json('POST', f'{base_url}/manufacturing', token=token, body=manufacturing_payload)
    expect(status == 201, f'POST /manufacturing expected 201, got {status}: {manufacturing_created}')
    expect(isinstance(manufacturing_created, dict), '/manufacturing POST response must be object')
    manufacturing_id = pick(manufacturing_created, 'id', 'Id')
    expect(isinstance(manufacturing_id, int), 'Created manufacturing id must be int')

    status, manufacturing_detail = http_json('GET', f'{base_url}/manufacturing/{manufacturing_id}', token=token)
    expect(status == 200, f'GET /manufacturing/{{id}} expected 200, got {status}: {manufacturing_detail}')
    expect(isinstance(manufacturing_detail, dict), '/manufacturing/{id} response must be object')

    status, manufacturing_updated = http_json(
        'PUT',
        f'{base_url}/manufacturing/{manufacturing_id}',
        token=token,
        body={'status': 'ready_for_sale', 'activityNote': 'Smoke promotion to ready_for_sale'}
    )
    expect(status == 200, f'PUT /manufacturing/{{id}} expected 200, got {status}: {manufacturing_updated}')

    status, analytics = http_json('GET', f'{base_url}/analytics', token=token)
    expect(status == 200, f'GET /analytics expected 200, got {status}: {analytics}')
    expect(isinstance(analytics, dict), '/analytics response must be object')

    status, sql_health = http_json('GET', f'{base_url}/health/sql', token=token)
    expect(status in (200, 503), f'GET /health/sql expected 200 or 503, got {status}: {sql_health}')

    print('[api-smoke] PASS')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
