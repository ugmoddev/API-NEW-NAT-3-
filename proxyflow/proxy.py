from dataclasses import dataclass
from urllib.parse import urlsplit
import ipaddress, re

@dataclass(frozen=True)
class Proxy:
    host: str; port: int; protocol: str = "http"; username: str|None = None; password: str|None = None
    def key(self): return (self.host.lower(), self.port, self.protocol.lower(), self.username or "")
    def display(self): return f"{self.host}:{self.port}"
    def as_playwright(self):
        d = {"server": f"{self.protocol}://{self.host}:{self.port}"}
        if self.username: d.update(username=self.username, password=self.password or "")
        return d

def parse_proxy(raw: str) -> Proxy:
    raw = raw.strip()
    if not raw: raise ValueError("proxy is empty")
    candidate = raw if "://" in raw else "http://" + raw
    u = urlsplit(candidate)
    if not u.hostname or not u.port: raise ValueError("proxy must include host and port")
    protocol = (u.scheme or "http").lower()
    if protocol not in {"http","https","socks4","socks5"}: raise ValueError("unsupported protocol")
    try: port = int(u.port)
    except ValueError as e: raise ValueError("invalid port") from e
    if not 1 <= port <= 65535: raise ValueError("port out of range")
    return Proxy(u.hostname, port, protocol, u.username, u.password)

def parse_many(text: str) -> list[Proxy]:
    out=[]; seen=set()
    for line in text.splitlines():
        if not line.strip() or line.lstrip().startswith('#'): continue
        p=parse_proxy(line)
        if p.key() not in seen: out.append(p); seen.add(p.key())
    return out
