// ==UserScript==
// @name         Github Raw 单文件快捷下载
// @name:zh-CN   Github Raw 单文件快捷下载 (☁)
// @name:zh-TW   Github Raw 單文件快捷下載 (☁)
// @version      1.0.0
// @author       X.I.U (提取版) 西瓜经过二次修改
// @description  在 Github 项目文件列表中，鼠标悬停时显示云下载图标，快速下载单个 Raw 文件
// @description:zh-CN  在 Github 项目文件列表中，鼠标悬停时显示云下载图标，快速下载单个 Raw 文件
// @match        *://github.com/*
// @icon         data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAMAAABEpIrGAAAABGdBTUEAALGPC/xhBQAAAAFzUkdCAK7OHOkAAACEUExURUxpcRgWFhsYGBgWFhcWFh8WFhoYGBgWFiUlJRcVFRkWFhgVFRgWFhgVFRsWFhgWFigeHhkWFv////////////r6+h4eHv///xcVFfLx8SMhIUNCQpSTk/r6+jY0NCknJ97e3ru7u+fn51BOTsPCwqGgoISDg6empmpoaK2srNDQ0FhXV3eXcCcAAAAXdFJOUwCBIZXMGP70BuRH2Ze/LpIMUunHkpQR34sfygAAAVpJREFUOMt1U+magjAMDAVb5BDU3W25b9T1/d9vaYpQKDs/rF9nSNJkArDA9ezQZ8wPbc8FE6eAiQUsOO1o19JolFibKCdHGHC0IJezOMD5snx/yE+KOYYr42fPSufSZyazqDoseTPw4lGJNOu6LBXVUPBG3lqYAOv/5ZwnNUfUifzBt8gkgfgINmjxOpgqUA147QWNaocLniqq3QsSVbQHNp45N/BAwoYQz9oUJEiE4GMGfoBSMj5gjeWRIMMqleD/CAzUHFqTLyjOA5zjNnwa4UCEZ2YK3khEcBXHjVBtEFeIZ6+NxYbPqWp1DLKV42t6Ujn2ydyiPi9nX0TTNAkVVZ/gozsl6FbrktkwaVvL2TRK0C8Ca7Hck7f5OBT6FFbLATkL2ugV0tm0RLM9fedDvhWstl8Wp9AFDjFX7yOY/lJrv8AkYuz7fuP8dv9izCYH+x3/LBnj9fYPBTpJDNzX+7cAAAAASUVORK5CYII=
// @grant        window.onurlchange
// @license      GPL-3.0 License
// @run-at       document-end
// @namespace    https://greasyfork.org/scripts/412245
// ==/UserScript==

(function() {
    'use strict';

    // 下载图标 SVG
    const svg = '<svg class="octicon octicon-cloud-download" aria-hidden="true" height="16" version="1.1" viewBox="0 0 16 16" width="16"><path d="M9 12h2l-3 3-3-3h2V7h2v5zm3-8c0-.44-.91-3-4.5-3C5.08 1 3 2.92 3 5 1.02 5 0 6.52 0 8c0 1.53 1 3 3 3h3V9.7H3C1.38 9.7 1.3 8.28 1.3 8c0-.17.05-1.7 1.7-1.7h1.3V5c0-1.39 1.56-2.7 3.2-2.7 2.55 0 3.13 1.55 3.2 1.8v1.2H12c.81 0 2.7.22 2.7 2.2 0 2.09-2.25 2.2-2.7 2.2h-2V11h2c2.08 0 4-1.16 4-3.5C16 5.06 14.08 4 12 4z"></path></svg>';

    // 鼠标指向显示下载图标
    var mouseOverHandler = function(evt) {
        let elem = evt.currentTarget;
        let aElm_new = elem.querySelectorAll('.fileDownLink');
        let aElm_now = elem.querySelectorAll('svg.octicon.octicon-file, svg.color-fg-muted');
        aElm_new.forEach(el => { el.style.cssText = 'display: inline;'; });
        aElm_now.forEach(el => { el.style.cssText = 'display: none;'; });
    };

    // 鼠标离开隐藏下载图标
    var mouseOutHandler = function(evt) {
        let elem = evt.currentTarget;
        let aElm_new = elem.querySelectorAll('.fileDownLink');
        let aElm_now = elem.querySelectorAll('svg.octicon.octicon-file, svg.color-fg-muted');
        aElm_new.forEach(el => { el.style.cssText = 'display: none;'; });
        aElm_now.forEach(el => { el.style.cssText = 'display: inline;'; });
    };

    // 添加 Raw 单文件快捷下载（☁）
    function addRawDownLink() {
        let files = document.querySelectorAll('div.Box-row svg.octicon.octicon-file, .react-directory-filename-column>svg.color-fg-muted');
        if (files.length === 0) return;
        if (location.pathname.indexOf('/tags') > -1) return;
        if (document.querySelectorAll('a.fileDownLink').length > 0) return;

        files.forEach(function(fileElm) {
            let trElm = fileElm.parentNode.parentNode;
            let cntElm_a = trElm.querySelector('[role="rowheader"] > .css-truncate.css-truncate-target.d-block.width-fit > a, .react-directory-truncate>a');
            if (!cntElm_a) return;

            let Name = cntElm_a.innerText;
            let href = cntElm_a.getAttribute('href');
            // 构建 Raw 文件链接
            let url = 'https://raw.githubusercontent.com' + href.replace('/blob/', '/');

            // 插入下载链接
            fileElm.insertAdjacentHTML('afterend', `<a href="${url}" download="${Name}" target="_blank" rel="noreferrer noopener nofollow" class="fileDownLink" style="display: none;" title="Github Raw 文件下载&#10;&#10;[Alt + 左键点击] 或 [右键 - 另存为...] 下载文件。&#10;注意：鼠标点击 [☁] 图标，而不是左侧的文件名！">${svg}</a>`);

            // 绑定鼠标事件
            trElm.onmouseover = mouseOverHandler;
            trElm.onmouseout = mouseOutHandler;
        });
    }

    // 重新绑定鼠标事件（用于页面导航）
    function rebindMouseEvents() {
        let files = document.querySelectorAll('div.Box-row svg.octicon.octicon-file, .react-directory-filename-column>svg.color-fg-muted');
        if (files.length === 0) return;
        if (document.querySelectorAll('a.fileDownLink').length === 0) return;

        files.forEach(function(fileElm) {
            let trElm = fileElm.parentNode.parentNode;
            trElm.onmouseover = mouseOverHandler;
            trElm.onmouseout = mouseOutHandler;
        });
    }

    // 初始化执行
    setTimeout(addRawDownLink, 2000);

    // URL 变化监听（支持 PJAX 导航）
    if (window.onurlchange === undefined) {
        history.pushState = (f => function pushState() {
            var ret = f.apply(this, arguments);
            window.dispatchEvent(new Event('pushstate'));
            window.dispatchEvent(new Event('urlchange'));
            return ret;
        })(history.pushState);

        history.replaceState = (f => function replaceState() {
            var ret = f.apply(this, arguments);
            window.dispatchEvent(new Event('replacestate'));
            window.dispatchEvent(new Event('urlchange'));
            return ret;
        })(history.replaceState);

        window.addEventListener('popstate', () => {
            window.dispatchEvent(new Event('urlchange'));
        });
    }

    window.addEventListener('urlchange', function() {
        setTimeout(addRawDownLink, 2000);
        setTimeout(rebindMouseEvents, 1000);
    });
})();