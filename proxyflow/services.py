import asyncio, time, uuid, httpx
from .proxy import Proxy
from .database import Database
from .security import set_secret, get_secret, delete_secret
class APIKeyManager:
    def __init__(self, db): self.db=db; self._lock=asyncio.Lock()
    async def add(self,name,key,provider="ProxyScrape",priority=1):
        if not key: raise ValueError("API key is empty")
        async with self._lock:
            secret_name=f"api-key-{uuid.uuid4().hex}"; set_secret(secret_name,key)
            self.db.conn.execute("INSERT INTO api_keys(name,provider,priority,secret_name) VALUES(?,?,?,?)",(name,provider,priority,secret_name)); self.db.conn.commit()
    async def healthy(self):
        rows=self.db.conn.execute("SELECT * FROM api_keys WHERE enabled=1 AND cooldown_until<? ORDER BY priority,request_count",(time.time(),)).fetchall()
        return rows[0] if rows else None
    def value(self,row): return get_secret(row['secret_name'])
class ProxyScrapeClient:
    def __init__(self, base_url, keys, db): self.base_url=base_url; self.keys=keys; self.db=db
    async def fetch(self):
        if not self.base_url: raise RuntimeError("PROXYSCRAPE_BASE_URL is not configured")
        row=await self.keys.healthy()
        if not row: raise RuntimeError("No healthy API key available")
        headers={"Authorization":f"Bearer {self.keys.value(row)}"}
        async with httpx.AsyncClient(timeout=20) as c:
            r=await c.get(self.base_url,headers=headers); r.raise_for_status(); data=r.json()
        lines=data if isinstance(data,list) else data.get("proxies", data.get("data", []))
        return [x if isinstance(x,Proxy) else __import__('proxyflow.proxy',fromlist=['parse_proxy']).parse_proxy(x if isinstance(x,str) else x.get('proxy','')) for x in lines]
class ProxyValidator:
    async def validate(self,p: Proxy, timeout=10):
        started=time.perf_counter()
        try:
            async with httpx.AsyncClient(proxy=p.as_playwright()["server"],timeout=timeout) as c:
                r=await c.get("https://example.com"); r.raise_for_status()
            return True, (time.perf_counter()-started)*1000
        except Exception: return False, None
class FirefoxSession: 
    async def run(self, proxy, url, headless=True, timeout=30000):
        try:
            from playwright.async_api import async_playwright
        except ImportError: raise RuntimeError("Install Playwright and run: playwright install firefox")
        async with async_playwright() as pw:
            browser=await pw.firefox.launch(headless=headless); context=await browser.new_context(proxy=proxy.as_playwright()); page=await context.new_page(); started=time.perf_counter()
            try: await page.goto(url,wait_until="domcontentloaded",timeout=timeout); return True,(time.perf_counter()-started)*1000
            finally: await context.close(); await browser.close()
class ProxyQueue:
    def __init__(self, validator, db, concurrency=3): self.validator=validator; self.db=db; self.sem=asyncio.Semaphore(concurrency)
    async def validate_all(self, proxies):
        async def one(p):
            async with self.sem: ok,lat=await self.validator.validate(p); return p,ok,lat
        return await asyncio.gather(*(one(p) for p in proxies))
