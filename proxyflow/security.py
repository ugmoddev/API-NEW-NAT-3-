import base64, hashlib, os, re
from pathlib import Path
from cryptography.fernet import Fernet
try:
    import keyring
except ImportError:
    keyring = None
SERVICE = "proxyflow"

def _fernet() -> Fernet:
    key = get_secret("local-encryption-key")
    if not key:
        key = Fernet.generate_key().decode()
        set_secret("local-encryption-key", key)
    return Fernet(key.encode())

def encrypt_secret(value: str | None) -> str | None:
    return _fernet().encrypt(value.encode()).decode() if value else None

def decrypt_secret(value: str | None) -> str | None:
    return _fernet().decrypt(value.encode()).decode() if value else None

def redact(value: object) -> str:
    text = str(value)
    text = re.sub(r"(?i)(authorization\s*:\s*|token|password|api[_-]?key|secret)([=:]\s*)[^\s,;]+", r"\1\2[REDACTED]", text)
    return re.sub(r"(?i)([A-Za-z0-9_]+://)([^:@/]+):([^@/]+)@", r"\1[REDACTED]:[REDACTED]@", text)

def set_secret(name: str, value: str) -> None:
    if keyring:
        keyring.set_password(SERVICE, name, value)
    else:
        p = Path.home()/".proxyflow-secrets"; p.mkdir(mode=0o700, exist_ok=True)
        (p/name).write_text(base64.urlsafe_b64encode(value.encode()).decode()); os.chmod(p/name, 0o600)

def get_secret(name: str) -> str | None:
    if keyring: return keyring.get_password(SERVICE, name)
    p = Path.home()/".proxyflow-secrets"/name
    return base64.urlsafe_b64decode(p.read_text()).decode() if p.exists() else None

def delete_secret(name: str) -> None:
    if keyring:
        try: keyring.delete_password(SERVICE, name)
        except Exception: pass
    else:
        (Path.home()/".proxyflow-secrets"/name).unlink(missing_ok=True)
