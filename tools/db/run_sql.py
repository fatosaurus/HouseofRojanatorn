#!/usr/bin/env python3
import argparse
import os
import re
import sys
from pathlib import Path

try:
    import pyodbc
except ModuleNotFoundError:
    print('pyodbc is required: pip install pyodbc', file=sys.stderr)
    raise


def build_conn_str() -> str:
    server = os.getenv('AZURE_SQL_SERVER', '').strip()
    database = os.getenv('AZURE_SQL_DB', '').strip()
    user = os.getenv('AZURE_SQL_USER', '').strip()
    password = os.getenv('AZURE_SQL_PASSWORD', '').strip()
    driver = os.getenv('AZURE_SQL_ODBC_DRIVER', 'ODBC Driver 18 for SQL Server').strip()

    if not all([server, database, user, password]):
        raise RuntimeError('Missing required env vars: AZURE_SQL_SERVER, AZURE_SQL_DB, AZURE_SQL_USER, AZURE_SQL_PASSWORD')

    return (
        f'DRIVER={{{driver}}};'
        f'SERVER={server};'
        f'DATABASE={database};'
        f'UID={user};'
        f'PWD={password};'
        'Encrypt=yes;TrustServerCertificate=no;Connection Timeout=30;'
    )


def split_batches(sql_text: str) -> list[str]:
    chunks = re.split(r'^\s*GO\s*$', sql_text, flags=re.IGNORECASE | re.MULTILINE)
    return [chunk.strip() for chunk in chunks if chunk.strip()]


def execute_sql(conn: pyodbc.Connection, sql_text: str) -> None:
    cursor = conn.cursor()
    for batch in split_batches(sql_text):
        cursor.execute(batch)
    conn.commit()


def run_query(conn: pyodbc.Connection, query: str) -> None:
    cursor = conn.cursor()
    cursor.execute(query)
    columns = [col[0] for col in cursor.description] if cursor.description else []
    rows = cursor.fetchall()

    if columns:
        print(' | '.join(columns))
        print('-' * (len(' | '.join(columns))))
    for row in rows:
        print(' | '.join('' if value is None else str(value) for value in row))


def main() -> int:
    parser = argparse.ArgumentParser(description='Run SQL against Azure SQL')
    parser.add_argument('--file', help='Path to SQL file')
    parser.add_argument('--query', help='Inline SQL query')
    args = parser.parse_args()

    if not args.file and not args.query:
        parser.error('Either --file or --query is required')

    conn_str = build_conn_str()
    with pyodbc.connect(conn_str) as conn:
        if args.file:
            sql = Path(args.file).read_text(encoding='utf-8')
            execute_sql(conn, sql)
            print(f'Executed file: {args.file}')
        if args.query:
            run_query(conn, args.query)

    return 0


if __name__ == '__main__':
    raise SystemExit(main())
