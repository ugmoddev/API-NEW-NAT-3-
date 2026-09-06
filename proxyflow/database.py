import sqlite3, json, time
from pathlib import Path
from .security import encrypt_secret
class Database:
    def __init__(self, path="proxyflow.db"):
        self.path=path; self.conn=sqlite3.connect(path, check_same_thread=False); self.conn.row_factory=sqlite3.Row; self.init()
    def init(self):
        self.conn.executescript("""CREATE TABLE IF NOT EXISTS proxies(id INTEGER PRIMARY KEY, host TEXT, port INTEGER, protocol TEXT, username TEXT, password_encrypted TEXT, status TEXT DEFAULT 'NEW', latency REAL, last_tested REAL, success_count INTEGER DEFAULT 0, failure_count INTEGER DEFAULT 0, run_id TEXT, UNIQUE(host,port,protocol,username)); CREATE TABLE IF NOT EXISTS api_keys(id INTEGER PRIMARY KEY, name TEXT, provider TEXT, enabled INTEGER DEFAULT 1, priority INTEGER DEFAULT 1, request_count INTEGER DEFAULT 0, success_count INTEGER DEFAULT 0, failure_count INTEGER DEFAULT 0, cooldown_until REAL DEFAULT 0, secret_name TEXT UNIQUE); CREATE TABLE IF NOT EXISTS sessions(id TEXT PRIMARY KEY, proxy_id INTEGER, status TEXT, started_at REAL, ended_at REAL, latency REAL, result TEXT); CREATE TABLE IF NOT EXISTS logs(id INTEGER PRIMARY KEY, level TEXT, message TEXT, created_at REAL); CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT);"""); self.conn.commit()
    def add_proxy(self,p):
        self.conn.execute("INSERT OR IGNORE INTO proxies(host,port,protocol,username,password_encrypted) VALUES(?,?,?,?,?)",(p.host,p.port,p.protocol,p.username,encrypt_secret(p.password))); self.conn.commit()
    def proxies(self): return self.conn.execute("SELECT * FROM proxies ORDER BY id DESC").fetchall()
    def stats(self):
        return {"total": self.conn.execute("SELECT count(*) FROM proxies").fetchone()[0], "working": self.conn.execute("SELECT count(*) FROM proxies WHERE status='WORKING'").fetchone()[0], "failed": self.conn.execute("SELECT count(*) FROM proxies WHERE status='FAILED'").fetchone()[0], "sessions": self.conn.execute("SELECT count(*) FROM sessions").fetchone()[0]}
    def log(self, level, message): self.conn.execute("INSERT INTO logs(level,message,created_at) VALUES(?,?,?)",(level,message,time.time())); self.conn.commit()
    def close(self): self.conn.close()
