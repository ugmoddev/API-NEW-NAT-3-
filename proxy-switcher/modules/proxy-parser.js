export const PROXY_TYPES = ['http', 'https', 'socks4', 'socks5'];

function isValidHost(host) {
  if (!host || host.length > 253 || /\s/.test(host)) return false;
  return /^(localhost|(?:[a-zA-Z0-9-]+\.)*[a-zA-Z0-9-]+|(?:\d{1,3}\.){3}\d{1,3}|\[[0-9a-fA-F:]+\])$/.test(host);
}

function isValidPort(port) {
  const number = Number(port);
  return Number.isInteger(number) && number > 0 && number <= 65535;
}

export function parseProxyLine(line, type = 'http') {
  const value = String(line ?? '').trim();
  if (!value) return null;
  if (!PROXY_TYPES.includes(type)) throw new Error(`Unsupported proxy type: ${type}`);

  const parts = value.split(':');
  if (parts.length !== 2 && parts.length !== 4) {
    throw new Error('Expected ip:port or ip:port:user:pass');
  }

  const [host, port, username, password] = parts;
  if (!isValidHost(host) || !isValidPort(port)) {
    throw new Error('Invalid host or port');
  }
  if (parts.length === 4 && (!username || !password)) {
    throw new Error('Username and password cannot be empty');
  }

  return {
    id: crypto.randomUUID(),
    host,
    port: Number(port),
    type,
    username: username || '',
    password: password || '',
    source: `${host}:${port}${username ? `:${username}:${password}` : ''}`
  };
}

export function parseProxyText(text, type = 'http') {
  const proxies = [];
  const invalid = [];
  const seen = new Set();

  String(text ?? '').split(/\r?\n/).forEach((line, index) => {
    if (!line.trim()) return;
    try {
      const proxy = parseProxyLine(line, type);
      const key = `${proxy.type}|${proxy.host}|${proxy.port}|${proxy.username}|${proxy.password}`;
      if (!seen.has(key)) {
        seen.add(key);
        proxies.push(proxy);
      }
    } catch (error) {
      invalid.push({ line: index + 1, value: line.trim(), reason: error.message });
    }
  });

  return { proxies, invalid };
}

export function sanitizeProxy(proxy) {
  return {
    id: proxy.id || crypto.randomUUID(),
    host: proxy.host,
    port: Number(proxy.port),
    type: PROXY_TYPES.includes(proxy.type) ? proxy.type : 'http',
    username: proxy.username || '',
    password: proxy.password || '',
    source: proxy.source || `${proxy.host}:${proxy.port}`
  };
}
