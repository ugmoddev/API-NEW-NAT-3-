import sys, asyncio
from PySide6.QtWidgets import QApplication,QMainWindow,QWidget,QVBoxLayout,QHBoxLayout,QLabel,QPushButton,QListWidget,QStackedWidget,QTableWidget,QTableWidgetItem,QFileDialog,QMessageBox
from PySide6.QtCore import Qt
from .database import Database
from .config import Settings
from .proxy import parse_many
class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__(); self.setWindowTitle("ProxyFlow"); self.resize(1100,720); self.db=Database(Settings.database_path); self.setStyleSheet("QMainWindow,QWidget{background:#111827;color:#e5e7eb;font-family:Segoe UI} QPushButton{background:#2563eb;border:0;border-radius:8px;padding:10px 16px} QPushButton:hover{background:#3b82f6} QTableWidget{background:#1f2937;border:1px solid #374151}")
        root=QWidget(); layout=QHBoxLayout(root); nav=QVBoxLayout(); title=QLabel("ProxyFlow"); title.setStyleSheet("font-size:24px;font-weight:700;padding:12px"); nav.addWidget(title); self.stack=QStackedWidget();
        for name, page in [("Dashboard",self.dashboard()), ("Proxies",self.proxies()), ("API Keys",self.simple("API key management uses OS credential storage.")), ("Sessions",self.simple("Firefox-only isolated sessions.")), ("Logs",self.logs()), ("Settings",self.simple("Configure TEST_URL, timeouts, headless mode, and concurrency in .env."))]:
            b=QPushButton(name); b.clicked.connect(lambda _,i=self.stack.count(): self.stack.setCurrentIndex(i)); nav.addWidget(b); self.stack.addWidget(page)
        nav.addStretch(); nav.addWidget(QLabel("● System Online")); layout.addLayout(nav,1); layout.addWidget(self.stack,4); self.setCentralWidget(root)
    def simple(self,text): w=QWidget(); l=QVBoxLayout(w); l.addWidget(QLabel(text)); return w
    def dashboard(self):
        w=QWidget(); l=QVBoxLayout(w); l.addWidget(QLabel("Dashboard",styleSheet="font-size:28px;font-weight:700")); s=self.db.stats(); l.addWidget(QLabel(f"Proxies  {s['total']}    Working  {s['working']}    Failed  {s['failed']}    Sessions  {s['sessions']}")); l.addWidget(QLabel("Connectivity and QA metrics update from SQLite.")); return w
    def proxies(self):
        w=QWidget(); l=QVBoxLayout(w); bar=QHBoxLayout(); imp=QPushButton("Import"); imp.clicked.connect(self.import_proxies); bar.addWidget(imp); refresh=QPushButton("Refresh"); refresh.clicked.connect(self.refresh); bar.addWidget(refresh); l.addLayout(bar); self.table=QTableWidget(0,5); self.table.setHorizontalHeaderLabels(["Host","Port","Protocol","Status","Latency"]); l.addWidget(self.table); self.refresh(); return w
    def refresh(self):
        rows=self.db.proxies(); self.table.setRowCount(len(rows))
        for i,r in enumerate(rows):
            for j,v in enumerate((r['host'],r['port'],r['protocol'].upper(),r['status'],r['latency'] or '—')): self.table.setItem(i,j,QTableWidgetItem(str(v)))
    def import_proxies(self):
        path,_=QFileDialog.getOpenFileName(self,"Import proxies",filter="Text files (*.txt);;All files (*)")
        if path:
            try:
                for p in parse_many(open(path,encoding='utf8').read()): self.db.add_proxy(p)
                self.refresh()
            except Exception as e: QMessageBox.critical(self,"Import failed",str(e))
    def logs(self):
        w=QWidget(); l=QVBoxLayout(w); l.addWidget(QLabel("Logs",styleSheet="font-size:28px;font-weight:700")); l.addWidget(QLabel("Structured logs are stored in SQLite and redact sensitive credentials.")); return w
def run_gui(): app=QApplication(sys.argv); win=MainWindow(); win.show(); return app.exec()
