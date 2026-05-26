// ==UserScript==
// @name         YouTube 视频下载助手｜多种清晰度HD/2K/4K🔥｜Video&Audio 📥
// @name:en      YouTube Video Downloader | HD Quality Options | Video&Audio 📥
// @name:ja      YouTube動画ダウンローダー｜HD高画質｜ビデオ＆オーディオ 📥
// @name:es      Descargador de YouTube | Alta Calidad HD | Video y Audio 📥
// @name:pt      Baixador de YouTube | Qualidade HD | Vídeo e Áudio 📥
// @namespace    http://tampermonkey.net/
// @version      1.5.1
// @description  YouTube视频下载神器，支持1080P/2K高清视频下载，支持字幕下载，支持视频/音频分离下载，支持短视频下载，完全免费无广告
// @description:en  Download YouTube videos in HD(1080P/2K), subtitles support, video/audio separate download, shorts download, completely free & no ads
// @description:ja  YouTubeビデオをHD(1080P/2K)でダウンロード、字幕対応、ビデオ/オーディオ分離ダウンロード、ショート動画対応、完全無料＆広告なし
// @description:es  Descarga videos de YouTube en HD(1080P/2K), soporte de subtítulos, descarga separada de video/audio, descarga de shorts, completamente gratis y sin anuncios
// @description:pt  Baixe vídeos do YouTube em HD(1080P/2K), suporte a legendas, download separado de vídeo/áudio, download de shorts, totalmente gratuito e sem anúncios
// @author       YouhouLab
// @license      MIT
// @match        *://*.youtube.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=youtube.com
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @connect      www.ssyoutube.com
// @run-at       document-start
// @supportURL   https://saveany.cn
// @supportURL   https://addyoutube.com
// @require      https://cdn.jsdelivr.net/npm/sweetalert2@11
// @compatible   chrome
// @compatible   firefox
// @compatible   opera
// @compatible   edge
// @compatible   safari
// @keywords     youtube, download, video, audio, subtitle, shorts, hd, 1080p, 2k, free, no ads, addyoutube, 油管, 视频下载, 字幕下载, 高清视频, 免费下载, 无广告, YouTube下载器, 短视频下载, ユーチューブ, ダウンロード, 動画保存, 字幕, 高画質, 無料, 유튜브, 다운로드, 동영상, 자막, 고화질, 무료
// @downloadURL https://update.greasyfork.org/scripts/521434/YouTube%20%E8%A7%86%E9%A2%91%E4%B8%8B%E8%BD%BD%E5%8A%A9%E6%89%8B%EF%BD%9C%E5%A4%9A%E7%A7%8D%E6%B8%85%E6%99%B0%E5%BA%A6HD2K4K%F0%9F%94%A5%EF%BD%9CVideoAudio%20%F0%9F%93%A5.user.js
// @updateURL https://update.greasyfork.org/scripts/521434/YouTube%20%E8%A7%86%E9%A2%91%E4%B8%8B%E8%BD%BD%E5%8A%A9%E6%89%8B%EF%BD%9C%E5%A4%9A%E7%A7%8D%E6%B8%85%E6%99%B0%E5%BA%A6HD2K4K%F0%9F%94%A5%EF%BD%9CVideoAudio%20%F0%9F%93%A5.meta.js
// ==/UserScript==

(function() {
    'use strict';

    const i18n = {
        'zh': {
            downloadText: 'Free Download',
            error: {
                addNormalButton: '添加普通下载按钮时出错:',
                addShortsButton: '添加Shorts下载按钮时出错:'
            }
        },
        'en': {
            downloadText: 'Free Download',
            error: {
                addNormalButton: 'Error adding normal download button:',
                addShortsButton: 'Error adding Shorts download button:'
            }
        },
        'ja': {
            downloadText: '無料ダウンロード',
            error: {
                addNormalButton: '通常ダウンロードボタンの追加エラー:',
                addShortsButton: 'Shortsダウンロードボタンの追加エラー:'
            }
        },
        'es': {
            downloadText: 'Descarga Gratis',
            error: {
                addNormalButton: 'Error al agregar botón de descarga normal:',
                addShortsButton: 'Error al agregar botón de descarga Shorts:'
            }
        },
        'pt': {
            downloadText: 'Download Grátis',
            error: {
                addNormalButton: 'Erro ao adicionar botão de download normal:',
                addShortsButton: 'Erro ao adicionar botão de download Shorts:'
            }
        }
    };

    GM_addStyle(`
        .youhou-download-btn {
            background: rgb(242, 242, 242);
            border: none;
            border-radius: 18px;
            color: #0f0f0f;
            padding: 0 16px;
            height: 36px;
            margin-right: 8px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            white-space: nowrap;
        }
        .youhou-download-btn:hover {
            background: rgb(230, 230, 230);
        }
    `);

    let buttonObserver = null;
    let fallbackTimer = null;
    let navigateDebounceTimer = null;
    let rafActive = false;

    function createDownloadButton() {
        const downloadButton = document.createElement('button');
        downloadButton.className = 'youhou-download-btn';
        downloadButton.textContent = i18n['zh'].downloadText;

        downloadButton.addEventListener('click', function() {
            const videoUrl = window.location.href;
            const downloadDomains = ['saveanyyoutube.com'];
            const randomDomain = downloadDomains[Math.floor(Math.random() * downloadDomains.length)];
            const newUrl = videoUrl.replace('youtube.com', randomDomain);
            window.open(newUrl, '_blank');
        });

        return downloadButton;
    }

    function insertButtonIfNeeded() {
        const isWatch = window.location.pathname.includes('/watch');
        const isShorts = window.location.pathname.includes('/shorts/');
        
        if (!isWatch && !isShorts) return false;

        if (isWatch) {
            // Target the active (visible) metadata container
            const activeMetadata = document.querySelector('ytd-watch-metadata:not([hidden]), ytd-video-primary-info-renderer:not([hidden])');
            if (!activeMetadata) return false;

            const container = activeMetadata.querySelector('#top-level-buttons-computed');
            if (!container) return false;

            // Check if button already exists IN THIS CONTAINER
            if (container.parentElement.querySelector('.youhou-download-btn')) return true;

            const downloadButton = createDownloadButton();
            container.insertAdjacentElement('beforebegin', downloadButton);
            return true;
        }

        if (isShorts) {
            // Target the active Shorts renderer
            const activeShorts = document.querySelector('ytd-reel-video-renderer[is-active]');
            if (!activeShorts) return false;
            
            const container = activeShorts.querySelector('#actions-inner');
            if (!container) return false;

            if (activeShorts.querySelector('.youhou-download-btn')) return true;

            const downloadButton = createDownloadButton();
            downloadButton.style.margin = '8px 0';
            downloadButton.style.width = '48px';
            downloadButton.style.height = '48px';
            downloadButton.style.borderRadius = '50%';
            downloadButton.style.display = 'flex';
            downloadButton.style.alignItems = 'center';
            downloadButton.style.justifyContent = 'center';
            downloadButton.innerHTML = '<svg viewBox="0 0 24 24" style="width:24px;height:24px"><path d="M17 18V19H6V18H17M11.5 3V12.59L7.7 8.79L7 9.5L12 14.5L17 9.5L16.29 8.79L12.5 12.59V3H11.5Z" fill="currentColor"></path></svg>';
            
            container.insertAdjacentElement('afterbegin', downloadButton);
            return true;
        }
        
        return false;
    }

    function cleanup() {
        if (buttonObserver) {
            buttonObserver.disconnect();
            buttonObserver = null;
        }
        if (fallbackTimer) {
            clearInterval(fallbackTimer);
            fallbackTimer = null;
        }
    }

    function rafPoll(startTime) {
        if (!rafActive) return;
        if (Date.now() - startTime > 10000) { rafActive = false; return; }
        if (insertButtonIfNeeded()) { 
            // Continue polling even if inserted, because YouTube might re-render and wipe it
            // but we can slow down or rely on MutationObserver
        }
        requestAnimationFrame(() => rafPoll(startTime));
    }

    function doNavigate() {
        cleanup();

        // Remove only truly stale buttons if needed, but the new logic handles container-specific existence
        
        if (!window.location.pathname.includes('/watch') && !window.location.pathname.includes('/shorts/')) return;

        // Try inserting immediately
        insertButtonIfNeeded();

        // MutationObserver to catch async DOM rebuilds
        if (document.body) {
            buttonObserver = new MutationObserver((mutations) => {
                for (const mutation of mutations) {
                    if (mutation.addedNodes.length > 0) {
                        insertButtonIfNeeded();
                    }
                }
            });

            buttonObserver.observe(document.body, {
                childList: true,
                subtree: true
            });
        }

        // rAF-based fast polling for the first 10 seconds
        rafActive = true;
        rafPoll(Date.now());

        // Fallback: periodic check
        let attempts = 0;
        fallbackTimer = setInterval(() => {
            attempts++;
            insertButtonIfNeeded();
            if (attempts >= 40) { // Check for 20 seconds
                clearInterval(fallbackTimer);
                fallbackTimer = null;
            }
        }, 500);
    }

    function onNavigate() {
        // Immediately try to insert
        insertButtonIfNeeded();

        // Use a shorter debounce for snappier response
        if (navigateDebounceTimer) clearTimeout(navigateDebounceTimer);
        navigateDebounceTimer = setTimeout(() => {
            navigateDebounceTimer = null;
            doNavigate();
        }, 100);
    }

    // YouTube SPA navigation events
    document.addEventListener('yt-navigate-finish', onNavigate);
    document.addEventListener('yt-page-data-updated', onNavigate);

    // Handle direct page load
    if (document.body) {
        onNavigate();
    } else {
        document.addEventListener('DOMContentLoaded', onNavigate);
    }

})();
