import os
import sqlite3
from flask import g, current_app

DEFAULT_DB_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'clinic.db'))

def get_db_url():
    if current_app:
        return current_app.config.get('DATABASE_URL') or os.environ.get('DATABASE_URL', 'clinic.db')
    return os.environ.get('DATABASE_URL', 'clinic.db')

def is_postgres():
    url = get_db_url()
    return url.startswith('postgresql://') or url.startswith('postgres://')

def get_db_path():
    if current_app:
        db_url = current_app.config.get('DATABASE_URL') or os.environ.get('DATABASE_URL', 'clinic.db')
        if db_url.startswith('sqlite:///'):
            return os.path.abspath(db_url.replace('sqlite:///', ''))
        if not is_postgres() and not os.path.isabs(db_url):
            return os.path.abspath(os.path.join(os.path.dirname(__file__), '..', db_url))
        return os.path.abspath(db_url)
    return DEFAULT_DB_PATH

def get_connection(db_path=None):
    if is_postgres():
        import psycopg2
        from psycopg2.extras import RealDictCursor
        url = get_db_url()
        if url.startswith('postgres://'):
            url = url.replace('postgres://', 'postgresql://', 1)
        conn = psycopg2.connect(url, cursor_factory=RealDictCursor)
        return conn

    path = db_path or get_db_path()
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn

def get_db():
    if 'db' not in g:
        g.db = get_connection()
    return g.db

def close_db(e=None):
    db = g.pop('db', None)
    if db is not None:
        db.close()

def query_db(query, args=(), one=False):
    db = get_db()
    if is_postgres():
        pg_query = query.replace('?', '%s')
        cur = db.cursor()
        cur.execute(pg_query, args)
        rv = cur.fetchall()
        cur.close()

        import datetime
        results = []
        for r in rv:
            row_dict = {}
            for k, v in dict(r).items():
                if isinstance(v, (datetime.date, datetime.datetime)):
                    row_dict[k] = v.isoformat()
                else:
                    row_dict[k] = v
            results.append(row_dict)
        return (results[0] if results else None) if one else results 
    else :
        cur = db.execute(query, args)
        rv = cur.fetchall()
        cur.close()
        return (dict(rv[0]) if rv else None) if one else [dict(r) for r in rv]

def execute_db(query, args=(), commit=True):
    db = get_db()
    if is_postgres():
        pg_query = query.replace('?', '%s')
        is_insert = pg_query.strip().upper().startswith('INSERT')
        
        # Bổ sung RETURNING id để lấy được last_id trả về cho PostgreSQL
        if is_insert and 'RETURNING' not in pg_query.upper():
            pg_query += ' RETURNING id'

        cur = db.cursor()
        cur.execute(pg_query, args)
        
        last_id = None
        if is_insert:
            try:
                row = cur.fetchone()
                if row and 'id' in row:
                    last_id = row['id']
            except Exception:
                pass

        row_count = cur.rowcount
        if commit:
            db.commit()
        cur.close()
        return last_id, row_count

    cur = db.execute(query, args)
    if commit:
        db.commit()
    last_id = cur.lastrowid
    row_count = cur.rowcount
    cur.close()
    return last_id, row_count

def init_db(db_path=None):
    conn = get_connection(db_path)
    if is_postgres():
        schema_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'database', 'schema_pg.sql'))
        with open(schema_path, 'r', encoding='utf-8') as f:
            sql_content = f.read()
        cur = conn.cursor()
        cur.execute(sql_content)
        conn.commit()
        cur.close()
    else:
        schema_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'database', 'schema.sql'))
        with open(schema_path, 'r', encoding='utf-8') as f:
            conn.executescript(f.read())
        conn.commit()
    conn.close()

def seed_db(db_path=None):
    conn = get_connection(db_path)
    if is_postgres():
        seed_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'database', 'seed_pg.sql'))
        with open(seed_path, 'r', encoding='utf-8') as f:
            sql_content = f.read()
        cur = conn.cursor()
        cur.execute(sql_content)
        conn.commit()
        cur.close()
    else:
        seed_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'database', 'seed.sql'))
        with open(seed_path, 'r', encoding='utf-8') as f:
            conn.executescript(f.read())
        conn.commit()
    conn.close()
