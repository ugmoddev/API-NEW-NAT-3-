import sys, asyncio, argparse
from proxyflow.config import Settings
from proxyflow.database import Database
from proxyflow.ui import run_gui
async def command(name):
    db=Database(Settings.database_path)
    if name=="stats": print(db.stats())
    elif name=="clean": db.conn.execute("DELETE FROM logs"); db.conn.commit(); print("logs cleaned")
    elif name in {"fetch","test","run"}: print(f"{name}: configure PROXYSCRAPE_BASE_URL and API keys in the GUI first")
    db.close()
def main():
    p=argparse.ArgumentParser(); p.add_argument("command",nargs="?",choices=["fetch","test","run","stats","clean"]); a=p.parse_args(); return asyncio.run(command(a.command)) if a.command else run_gui()
if __name__=="__main__": main()
