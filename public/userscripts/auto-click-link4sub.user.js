// ==UserScript==
// @name         Auto Click Link4Sub / OnThiTracNghiem (Bản tổng quát)
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  Tự động bấm tất cả các nút unlock trên trang được phép
// @author       You
// @match        https://onthitracnghiem.com/*
// @match        https://link4sub.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    function autoClick() {
        const buttons = document.querySelectorAll('a.stu-btn.link.unlock');

        buttons.forEach((btn) => {
            if (btn.dataset.clicked) return;
            btn.dataset.clicked = 'true';
            console.log('[AutoClick] Đã click nút:', btn.innerText.trim() || btn.href);

            setTimeout(() => {
                if (document.contains(btn)) btn.click();
            }, 500);
        });
    }

    autoClick();

    const observer = new MutationObserver(autoClick);
    observer.observe(document.body, { childList: true, subtree: true });
})();
