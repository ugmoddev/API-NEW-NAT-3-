(() => {
  'use strict';

  const ALLOWED_HOSTS = new Set(['link4sub.com', 'onthitracnghiem.com']);
  const form = document.querySelector('#urlForm');
  const input = document.querySelector('#urlInput');
  const frame = document.querySelector('#safeFrame');
  const message = document.querySelector('#message');
  const origin = document.querySelector('#frameOrigin');
  const fallback = document.querySelector('#frameFallback');

  function validateUrl(value) {
    try {
      const url = new URL(value.trim());
      if (url.protocol !== 'https:' || !ALLOWED_HOSTS.has(url.hostname)) return null;
      return url;
    } catch {
      return null;
    }
  }

  function setMessage(text, type = '') {
    message.textContent = text;
    message.className = `message ${type}`.trim();
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const url = validateUrl(input.value);
    if (!url) {
      setMessage('URL bị từ chối: chỉ dùng HTTPS trên link4sub.com hoặc onthitracnghiem.com.', 'error');
      return;
    }
    fallback.hidden = true;
    frame.src = url.href;
    origin.textContent = url.hostname;
    setMessage(`Đã nạp ${url.hostname}.`, 'success');
  });

  frame.addEventListener('load', () => {
    fallback.hidden = true;
  });

  frame.addEventListener('error', () => {
    fallback.hidden = false;
    setMessage('Không thể nạp URL trong iframe.', 'error');
  });
})();
