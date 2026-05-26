// ==UserScript==
// @name                SteamDB 汉化
// @namespace           https://github.com/xiexiaosheng/SteamDB-CN
// @version             1.72
// @description         SteamDB 汉化插件
// @author              Chr_ & xiexiaosheng
// @match               https://steamdb.info/*
// @license             AGPL-3.0
// @resource            data https://cdn.jsdelivr.net/gh/xiexiaosheng/SteamDB-CN@main/SteamDB_CN.json
// @updateURL           https://raw.githubusercontent.com/xiexiaosheng/SteamDB-CN/main/SteamDB_CN.user.js
// @downloadURL         https://raw.githubusercontent.com/xiexiaosheng/SteamDB-CN/main/SteamDB_CN.user.js
// @supportURL          https://github.com/xiexiaosheng/SteamDB-CN/issues
// @grant               GM_addStyle
// @grant               GM_getResourceText
// @grant               GM_registerMenuCommand
// @grant               GM_xmlhttpRequest
// @connect             cdn.jsdelivr.net
// ==/UserScript==

/**
 * 二开 by xiexiaosheng
 * 基于原作者 Chr_ 的 SteamDB 汉化插件进行二次开发
 */

(function () {
  "use strict";
  
  // ========== 配置项 ==========
  // 开发者模式（显示工具面板 + 收集未翻译文本）
  const DEV_MODE = window.localStorage["dev_mode"] == "开";
  
  // ========== 内置翻译词典 ==========
  // 脚本内置的常用词汇翻译，使用 CSS 选择器精准定位，避免误翻译游戏名称
  const BUILT_IN_TRANSLATIONS = {
    // 账户菜单 - 只翻译账户菜单中的特定文本
    "#account-menu a span": {
      "Your Profile": "你的资料",
      "Your Games": "你的游戏",
      "Your Wishlist": "你的愿望单",
      "Your Watchlist": "你的关注",
      "Settings": "设置",
      "Sign out": "退出登录",
    },
    
    // 表格表头
    "table thead th": {
      "Date": "日期",
      "Day": "星期",
      "Time": "时间",
      "Patch Title": "补丁标题",
      "BuildID": "构建ID",
      "Name": "名称",
      "Type": "类型",
      "Status": "状态",
      "Price": "价格",
      "Players": "玩家",
      "Rating": "评分",
      "Reviews": "评测",
      "Release": "发布",
      "Updated": "更新",
      "Added": "添加",
    }
  };

  GM_registerMenuCommand(`🔧 开发者模式: 【${DEV_MODE ? "开" : "关"}】`, () => {
    window.localStorage["dev_mode"] = DEV_MODE ? "关" : "开";
    window.location.reload();
  });

  document.querySelector("html").setAttribute("lang", "zh-CN");

  // 用于收集未翻译的文本
  const untranslatedTexts = {
    STATIC: {},
    INPUT: {},
    LABEL: {}
  };

  /**
   * 翻译数据管理器（单例模式 + 智能更新）
   * 提供优雅的 API、自动缓存和在线更新功能
   */
  const TranslationManager = (() => {
    let cachedData = null;
    let dataSource = null;
    
    const ONLINE_URL = "https://cdn.jsdelivr.net/gh/xiexiaosheng/SteamDB-CN@main/SteamDB_CN.json";
    const UPDATE_CHECK_KEY = "sdb_last_update_check";
    const UPDATE_INTERVAL = 24 * 60 * 60 * 1000; // 24小时
    const ONLINE_DATA_KEY = "sdb_online_data"; // 在线数据缓存
    
    return {
      /**
       * 获取翻译数据（带缓存）
       * 优先级：在线缓存 > localStorage > @resource
       */
      getData() {
        if (cachedData) return cachedData;
        
        // 1. 优先使用在线更新的数据
        const onlineData = window.localStorage[ONLINE_DATA_KEY];
        if (onlineData) {
          try {
            cachedData = JSON.parse(onlineData);
            dataSource = "online";
            console.log(`🌐 使用在线翻译 (${cachedData.DOC?.["更新时间"] || "未知"})`);
            return cachedData;
          } catch (e) {
            console.error("❌ 在线翻译数据格式错误", e.message);
          }
        }
        
        // 2. 使用自定义翻译
        const customLang = window.localStorage["sdb_lang"];
        if (customLang) {
          try {
            cachedData = JSON.parse(customLang);
            dataSource = "custom";
            console.log(`💾 使用自定义翻译 (${cachedData.DOC?.["更新时间"] || "未知"})`);
            return cachedData;
          } catch (e) {
            console.error("❌ 自定义翻译数据格式错误", e.message);
          }
        }
        
        // 3. 回退到内置版本（@resource）
        try {
          const resourceText = GM_getResourceText("data");
          
          // 检查 @resource 是否正确加载
          if (!resourceText || resourceText === "undefined") {
            throw new Error("@resource 未加载，可能是脚本安装不完整");
          }
          
          cachedData = JSON.parse(resourceText);
          dataSource = "builtin";
          console.log(`📦 使用内置翻译 (${cachedData.DOC?.["更新时间"] || "未知"})`);
          return cachedData;
        } catch (e) {
          console.error("❌ 内置翻译数据加载失败", e.message);
          console.warn("⚠️ 可能原因：");
          console.warn("  1. 脚本未完全安装（@resource 未下载）");
          console.warn("  2. Tampermonkey 缓存问题");
          console.warn("  3. 网络问题导致资源下载失败");
          console.warn("📝 解决方案：");
          console.warn("  1. 尝试重新安装脚本");
          console.warn("  2. 清除 Tampermonkey 缓存");
          console.warn("  3. 等待在线更新（几秒后自动尝试）");
          
          // 返回空数据结构，但标记为需要在线更新
          cachedData = { DOC: {}, STATIC: {}, INPUT: {}, LABEL: {} };
          dataSource = "fallback";
          
          // 立即尝试在线更新作为紧急备份
          console.log("🔄 尝试从在线获取翻译数据...");
          this.updateFromOnline(true).then(result => {
            if (result.updated) {
              console.log("✅ 在线翻译数据已下载，请刷新页面");
              // 不自动刷新，让用户选择
            }
          }).catch(() => {
            console.error("❌ 在线更新也失败了，请手动重新安装脚本");
          });
          
          return cachedData;
        }
      },
      
      /**
       * 获取数据来源类型
       */
      getSource() {
        if (!cachedData) this.getData();
        return dataSource;
      },
      
      /**
       * 判断是否使用自定义翻译
       */
      isCustom() {
        return this.getSource() === "custom";
      },
      
      /**
       * 判断是否使用在线翻译
       */
      isOnline() {
        return this.getSource() === "online";
      },
      
      /**
       * 清除缓存（用于重新加载）
       */
      clearCache() {
        cachedData = null;
        dataSource = null;
      },
      
      /**
       * 检查是否需要更新
       */
      shouldCheckUpdate() {
        const lastCheck = window.localStorage[UPDATE_CHECK_KEY];
        if (!lastCheck) return true;
        
        const timeSinceLastCheck = Date.now() - parseInt(lastCheck);
        return timeSinceLastCheck > UPDATE_INTERVAL;
      },
      
      /**
       * 比较翻译版本（通过更新时间）
       */
      isNewer(onlineData) {
        const currentData = this.getData();
        const currentTime = currentData.DOC?.["更新时间"] || "";
        const onlineTime = onlineData.DOC?.["更新时间"] || "";
        
        // 简单字符串比较（格式：YYYY-MM-DD）
        return onlineTime > currentTime;
      },
      
      /**
       * 从在线更新翻译数据（后台静默）
       */
      updateFromOnline(silent = true) {
        return new Promise((resolve, reject) => {
          GM_xmlhttpRequest({
            method: "GET",
            url: ONLINE_URL,
            timeout: 10000,
            onload: (response) => {
              try {
                if (response.status === 200) {
                  const onlineData = JSON.parse(response.responseText);
                  
                  // 比较版本
                  if (this.isNewer(onlineData)) {
                    // 保存在线数据
                    window.localStorage[ONLINE_DATA_KEY] = response.responseText;
                    window.localStorage[UPDATE_CHECK_KEY] = Date.now().toString();
                    
                    const updateTime = onlineData.DOC?.["更新时间"] || "未知";
                    console.log(`✅ 翻译数据已更新 (${updateTime})`);
                    
                    if (!silent) {
                      alert(`✅ 发现新的翻译数据！\n更新时间: ${updateTime}\n\n页面将重新加载...`);
                      window.location.reload();
                    }
                    
                    resolve({ updated: true, data: onlineData });
                  } else {
                    console.log(`ℹ️ 翻译数据已是最新`);
                    window.localStorage[UPDATE_CHECK_KEY] = Date.now().toString();
                    resolve({ updated: false });
                  }
                } else {
                  throw new Error(`HTTP ${response.status}`);
                }
              } catch (e) {
                console.error("❌ 在线更新失败", e.message);
                reject(e);
              }
            },
            onerror: (error) => {
              console.error("❌ 网络请求失败", error);
              reject(error);
            },
            ontimeout: () => {
              console.error("❌ 请求超时");
              reject(new Error("Timeout"));
            }
          });
        });
      },
      
      /**
       * 自动检查更新（后台静默）
       */
      autoCheckUpdate() {
        if (this.shouldCheckUpdate()) {
          console.log("🔍 后台检查翻译数据更新...");
          this.updateFromOnline(true).catch(() => {
            // 静默失败，不影响用户体验
          });
        }
      },
      
      /**
       * 手动检查更新（带提示）
       */
      manualCheckUpdate() {
        return this.updateFromOnline(false);
      },
      
      /**
       * 清除在线数据，恢复内置版本
       */
      clearOnlineData() {
        window.localStorage.removeItem(ONLINE_DATA_KEY);
        window.localStorage.removeItem(UPDATE_CHECK_KEY);
        this.clearCache();
      }
    };
  })();

  // 加载翻译数据
  const Locales = TranslationManager.getData();

  // 检查翻译数据是否加载失败
  if (TranslationManager.getSource() === "fallback") {
    console.error("⚠️⚠️⚠️ 翻译数据加载失败！页面将显示为英文 ⚠️⚠️⚠️");
    
    // 在页面顶部显示明显的错误提示
    setTimeout(() => {
      const errorBanner = document.createElement("div");
      errorBanner.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 15px 20px;
        text-align: center;
        font-size: 14px;
        font-weight: bold;
        z-index: 999999;
        box-shadow: 0 2px 10px rgba(0,0,0,0.3);
        cursor: pointer;
      `;
      errorBanner.innerHTML = `
        ⚠️ SteamDB 汉化脚本数据加载失败 - 页面未翻译 
        <span style="font-weight: normal; margin-left: 10px;">
          正在尝试在线修复... 或 <u>点击这里查看解决方案</u>
        </span>
      `;
      errorBanner.onclick = () => {
        alert(
          `❌ 翻译数据加载失败\n\n` +
          `可能原因：\n` +
          `1. 脚本安装不完整（@resource 未下载）\n` +
          `2. Tampermonkey 缓存问题\n` +
          `3. 网络问题导致资源下载失败\n\n` +
          `解决方案：\n` +
          `1. 重新安装脚本（推荐）\n` +
          `2. 点击 Tampermonkey 菜单中的"检查翻译更新"\n` +
          `3. 清除浏览器缓存后重试\n` +
          `4. 刷新页面（脚本正在后台下载翻译数据）\n\n` +
          `如果问题持续，请访问 GitHub 提交 Issue`
        );
      };
      document.body.prepend(errorBanner);
      
      // 5秒后淡出提示
      setTimeout(() => {
        errorBanner.style.transition = "opacity 1s";
        errorBanner.style.opacity = "0";
        setTimeout(() => errorBanner.remove(), 1000);
      }, 5000);
    }, 1000);
  }

  // 添加手动检查更新菜单
  GM_registerMenuCommand(`🔄 检查翻译更新`, async () => {
    try {
      const result = await TranslationManager.manualCheckUpdate();
      if (!result.updated) {
        alert(`ℹ️ 当前已是最新翻译数据\n\n更新时间: ${Locales.DOC?.["更新时间"] || "未知"}`);
      }
    } catch (e) {
      alert(`❌ 检查更新失败\n\n${e.message}\n\n请检查网络连接或稍后重试`);
    }
  });

  // 后台自动检查更新（24小时一次）
  setTimeout(() => {
    TranslationManager.autoCheckUpdate();
  }, 3000); // 延迟3秒，避免阻塞页面加载

  // 创建开发者工具 - 悬浮球
  if (DEV_MODE) {
    // 悬浮球容器
    const floatContainer = document.createElement("div");
    floatContainer.className = "sdc-float-container";
    
    // 悬浮球按钮
    const floatBtn = document.createElement("div");
    floatBtn.className = "sdc-float-btn";
    floatBtn.innerHTML = `
      <div class="sdc-float-icon">🛠️</div>
      <div class="sdc-float-badge">DEV</div>
    `;
    floatContainer.appendChild(floatBtn);
    
    // 工具菜单
    const menu = document.createElement("div");
    menu.className = "sdc-menu";
    
    // 菜单头部
    const menuHeader = document.createElement("div");
    menuHeader.className = "sdc-menu-header";
    const getDataSourceIcon = () => {
      if (TranslationManager.isOnline()) return "🌐 在线";
      if (TranslationManager.isCustom()) return "💾 自定义";
      return "📦 内置";
    };
    const updateTime = Locales.DOC?.["更新时间"] || "未知";
    menuHeader.innerHTML = `
      <div class="sdc-menu-title">开发者工具</div>
      <div class="sdc-menu-info">${getDataSourceIcon()} · ${updateTime}</div>
    `;
    menu.appendChild(menuHeader);
    
    // 菜单项容器
    const menuItems = document.createElement("div");
    menuItems.className = "sdc-menu-items";
    menu.appendChild(menuItems);
    
    floatContainer.appendChild(menu);
    
    // 切换菜单显示
    let isMenuOpen = false;
    floatBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      isMenuOpen = !isMenuOpen;
      menu.classList.toggle("show", isMenuOpen);
      floatBtn.classList.toggle("active", isMenuOpen);
    });
    
    // 点击页面其他地方关闭菜单
    document.addEventListener("click", (e) => {
      if (!floatContainer.contains(e.target) && isMenuOpen) {
        isMenuOpen = false;
        menu.classList.remove("show");
        floatBtn.classList.remove("active");
      }
    });
    
    // 生成菜单项
    const genMenuItem = (icon, text, onClick) => {
      const item = document.createElement("div");
      item.className = "sdc-menu-item";
      item.innerHTML = `<span class="sdc-menu-icon">${icon}</span><span>${text}</span>`;
      item.addEventListener("click", (e) => {
        e.stopPropagation();
        onClick();
        // 执行后关闭菜单
        isMenuOpen = false;
        menu.classList.remove("show");
        floatBtn.classList.remove("active");
      });
      return item;
    };

    // 导出未翻译文本
    const menuExport = genMenuItem("📤", "导出未翻译文本", () => {
      const exportData = {
        DOC: {
          "更新时间": new Date().toISOString().split('T')[0],
          "说明": "此文件包含当前页面未翻译的文本，请翻译后导入",
          "贡献名单": ["待添加"]
        },
        STATIC: untranslatedTexts.STATIC,
        INPUT: untranslatedTexts.INPUT,
        LABEL: untranslatedTexts.LABEL,
        DYNAMIC: {}
      };
      
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `SteamDB_Untranslated_${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      
      alert(`已导出 ${Object.keys(untranslatedTexts.STATIC).length + Object.keys(untranslatedTexts.INPUT).length + Object.keys(untranslatedTexts.LABEL).length} 条未翻译文本`);
    });
    menuItems.appendChild(menuExport);

    // 导入翻译文本
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = ".json";
    fileInput.style.display = "none";
    fileInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const imported = JSON.parse(event.target.result);
          
          // 合并翻译
          if (imported.STATIC) {
            for (const [selector, translations] of Object.entries(imported.STATIC)) {
              if (!Locales.STATIC[selector]) {
                Locales.STATIC[selector] = {};
              }
              Object.assign(Locales.STATIC[selector], translations);
            }
          }
          if (imported.INPUT) Object.assign(Locales.INPUT, imported.INPUT);
          if (imported.LABEL) Object.assign(Locales.LABEL, imported.LABEL);
          
          // 保存到 localStorage
          window.localStorage["sdb_lang"] = JSON.stringify(Locales);
          alert("✅ 翻译导入成功！页面将重新加载...");
          window.location.reload();
        } catch (e) {
          alert("❌ 导入失败：JSON 格式错误！\n" + e.message);
        }
      };
      reader.readAsText(file);
    });
    floatContainer.appendChild(fileInput);

    const menuImport = genMenuItem("📥", "导入翻译文本", () => {
      fileInput.click();
    });
    menuItems.appendChild(menuImport);

    // 重置为内置版本
    const menuReset = genMenuItem("🔄", "重置为内置版本", () => {
      if (confirm("清除自定义翻译，恢复为脚本内置版本吗？\n\n📦 使用的是脚本打包时的翻译数据")) {
        window.localStorage.removeItem("sdb_lang");
        alert("✅ 已重置，页面将重新加载...");
        window.location.reload();
      }
    });
    menuItems.appendChild(menuReset);

    // 添加到页面
    document.body.appendChild(floatContainer);
  }

  //计时
  const Start = new Date().getTime();

  {//静态元素
    // 先应用内置翻译（带 CSS 选择器精准定位）
    for (const [css, builtInDic] of Object.entries(BUILT_IN_TRANSLATIONS)) {
      const elements = document.querySelectorAll(css);
      if (elements.length > 0) {
        for (let i = 0; i < elements.length; i++) {
          const element = elements[i];
          if (element.childElementCount === 0) {
            const raw = element.innerText?.trim();
            if (raw && raw.length > 2 && builtInDic[raw]) {
              element.innerText = builtInDic[raw];
            }
          } else {
            const nodes = element.childNodes;
            for (let j = 0; j < nodes.length; j++) {
              const node = nodes[j];
              if (node.nodeType === Node.TEXT_NODE) {
                const raw = node.textContent?.trim();
                if (raw && raw.length > 2 && builtInDic[raw]) {
                  node.textContent = builtInDic[raw];
                }
              }
            }
          }
        }
      }
    }
    
    // 再应用翻译数据（翻译数据不会覆盖内置翻译）
    for (const [css, dic] of Object.entries(Locales.STATIC)) {
      const elements = document.querySelectorAll(css);
      if (elements.length > 0) {
        for (let i = 0; i < elements.length; i++) {
          const element = elements[i];
          if (element.childElementCount === 0) {//节点内部无其他元素
            const raw = element.innerText?.trim();
            if (!raw || raw.length <= 2) { continue; }
            
            // 使用翻译数据
            if (dic[raw]) {
              element.innerText = dic[raw];
            }
            // 收集未翻译
            else if (DEV_MODE) {
              if (!untranslatedTexts.STATIC[css]) {
                untranslatedTexts.STATIC[css] = {};
              }
              untranslatedTexts.STATIC[css][raw] = "";
              console.log(`"${raw}": "",`);
            }
          } else {//节点内部有其他元素
            const nodes = element.childNodes;
            for (let j = 0; j < nodes.length; j++) {
              const node = nodes[j];
              if (node.nodeType === Node.TEXT_NODE) {
                const raw = node.textContent?.trim();
                if (!raw || raw.length <= 2) { continue; }
                
                // 使用翻译数据
                if (dic[raw]) {
                  node.textContent = dic[raw];
                }
                // 收集未翻译
                else if (DEV_MODE) {
                  if (!untranslatedTexts.STATIC[css]) {
                    untranslatedTexts.STATIC[css] = {};
                  }
                  untranslatedTexts.STATIC[css][raw] = "";
                  console.log(`"${raw}": "",`);
                }
              }
            }
          }
        }
      }
    }
  }

  {//输入框
    const inputs = Locales.INPUT;
    const elements = document.querySelectorAll("input");
    for (let i = 0; i < elements.length; i++) {
      const element = elements[i];
      const raw = element.placeholder;
      if (!raw) { continue; }
      
      // 使用翻译数据
      if (inputs[raw]) {
        element.placeholder = inputs[raw];
      }
      // 收集未翻译
      else if (DEV_MODE) {
        untranslatedTexts.INPUT[raw] = "";
        console.log(`"${raw}": "",`);
      }
    }
  }

  {//悬浮提示
    const labels = Locales.LABEL;
    const elements = document.querySelectorAll("*[aria-label]");
    for (let i = 0; i < elements.length; i++) {
      const element = elements[i];
      const raw = element.getAttribute("aria-label");
      if (!raw) { continue; }
      
      // 使用翻译数据
      if (labels[raw]) {
        element.setAttribute("aria-label", labels[raw]);
      }
      // 收集未翻译
      else if (DEV_MODE) {
        untranslatedTexts.LABEL[raw] = "";
        console.log(`"${raw}": "",`);
      }
    }
  }

  {//日期翻译
    // ========== 预编译正则规则 (性能优化) ==========
    const dateRules = [];
    
    // 1. 星期映射 (如: "Mon" -> "周一")
    const dayOfWeekMap = {
      "Monday": "周一", "Mon": "周一", "Tuesday": "周二", "Tue": "周二",
      "Wednesday": "周三", "Wed": "周三", "Thursday": "周四", "Thu": "周四",
      "Friday": "周五", "Fri": "周五", "Saturday": "周六", "Sat": "周六",
      "Sunday": "周日", "Sun": "周日"
    };
    for (const [en, zh] of Object.entries(dayOfWeekMap)) {
      dateRules.push([new RegExp(`\\b${en}\\b`, 'g'), zh]);
    }

    // 2. 时间单位映射 (相对时间)
    const timeUnitMap = {
      "second": "秒", "minute": "分钟", "hour": "小时", "day": "天", "week": "周", "month": "个月", "year": "年"
    };
    for (const [en, zh] of Object.entries(timeUnitMap)) {
      // "4 hours ago" -> "4 小时前"
      dateRules.push([new RegExp(`(\\d+)\\s+${en}s?\\s+ago`, 'gi'), `$1 ${zh}前`]);
      // "an/a hour ago" -> "1 小时前"
      dateRules.push([new RegExp(`(an?|1)\\s+${en}s?\\s+ago`, 'gi'), `1 ${zh}前`]);
    }

    // 3. 月份映射 (绝对日期)
    const monthMap = {
      "January": "1月", "February": "2月", "March": "3月", "April": "4月",
      "May": "5月", "June": "6月", "July": "7月", "August": "8月",
      "September": "9月", "October": "10月", "November": "11月", "December": "12月"
    };
    for (const [en, zh] of Object.entries(monthMap)) {
      const monthNum = zh.replace('月', '');
      // "17 November 2025" -> "2025年11月17日"
      dateRules.push([new RegExp(`(\\d{1,2})\\s+${en}\\s+(\\d{4})`, 'g'), `$2年${monthNum}月$1日`]);
      // "November 17, 2025" -> "2025年11月17日"
      dateRules.push([new RegExp(`${en}\\s+(\\d{1,2}),?\\s+(\\d{4})`, 'g'), `$2年${monthNum}月$1日`]);
      // 仅月份 "November" -> "11月" (放在最后，防止破坏完整日期匹配)
      dateRules.push([new RegExp(`\\b${en}\\b`, 'g'), zh]);
    }

    // 4. UTC 时间处理
    dateRules.push([/UTC/g, "UTC"]); // 保持 UTC 原样，但确保能通过 fastCheck

    // 快速检测正则 (用于初步筛选，大幅减少无效替换尝试)
    const fastCheckRegex = new RegExp(
      Object.keys(dayOfWeekMap).join("|") + "|" + 
      Object.keys(monthMap).join("|") + "|" +
      "ago|UTC", 
      "i"
    );

    // ========== 核心处理函数 (逻辑复用) ==========
    
    // 翻译日期字符串
    const translateDate = (text) => {
      if (!text || !fastCheckRegex.test(text)) return text;
      
      let translated = text;
      for (const [regex, replacement] of dateRules) {
        translated = translated.replace(regex, replacement);
      }
      return translated;
    };

    // 处理文本节点
    const processTextNode = (node) => {
      // 跳过脚本和样式标签内的文本
      const parent = node.parentElement;
      if (parent && (parent.tagName === 'SCRIPT' || parent.tagName === 'STYLE')) return;

      const text = node.textContent;
      // 快速预检
      if (text && fastCheckRegex.test(text)) {
        const translated = translateDate(text);
        if (text !== translated) {
          node.textContent = translated;
        }
      }
    };

    // 处理元素节点 (仅处理属性，文本内容统一由 processTextNode 处理)
    const processElement = (element) => {
      // 1. 处理 aria-label
      if (element.hasAttribute('aria-label')) {
        const original = element.getAttribute('aria-label');
        if (original && fastCheckRegex.test(original)) {
          const translated = translateDate(original);
          if (original !== translated) {
            element.setAttribute('aria-label', translated);
          }
        }
      }
      
      // 2. 特殊处理 relative-time (防止 shadowRoot 阻挡或组件自我更新覆盖)
      if (element.tagName === 'RELATIVE-TIME') {
          // 尝试处理 ShadowRoot 中的文本 (如果是 open 的)
          if (element.shadowRoot) {
              const shadowWalker = document.createTreeWalker(element.shadowRoot, NodeFilter.SHOW_TEXT, null);
              let shadowNode;
              while(shadowNode = shadowWalker.nextNode()) processTextNode(shadowNode);
          }
          // 强制检查一次文本内容 (针对 Light DOM)
          if (element.firstChild && element.firstChild.nodeType === Node.TEXT_NODE) {
             processTextNode(element.firstChild);
          }
      }
    };

    // ========== 执行翻译 ==========

    // 1. 初始全量扫描 (TreeWalker 效率最高)
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      null
    );
    let node;
    while (node = walker.nextNode()) {
      processTextNode(node);
    }
    
    // 2. 处理初始的 aria-label 和 relative-time
    document.querySelectorAll('[aria-label], relative-time').forEach(processElement);

    // 3. 监听动态变化 (MutationObserver)
    const dateObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        // 处理新增节点
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === Node.TEXT_NODE) {
              processTextNode(node);
            } else if (node.nodeType === Node.ELEMENT_NODE) {
              // 忽略无需处理的标签
              if (['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'IMG', 'SVG'].includes(node.tagName)) return;

              // A. 处理当前节点及子树中的特殊属性和组件
              processElement(node);
              const candidates = node.querySelectorAll('[aria-label], relative-time');
              candidates.forEach(processElement);
              
              // B. 处理子树中的所有文本节点 (使用 TreeWalker 深度扫描)
              const subWalker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, null);
              let textNode;
              while(textNode = subWalker.nextNode()) {
                processTextNode(textNode);
              }
            }
          });
        } 
        // 处理文本内容变化 (包含对 relative-time 文本变化的响应)
        else if (mutation.type === 'characterData') {
          processTextNode(mutation.target);
        }
      }
    });

    dateObserver.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });

    // 4. 延迟兜底 (针对 relative-time 等可能异步渲染内容的组件)
    setTimeout(() => {
        // 重新扫描一次 relative-time 的文本，以防 ShadowDOM 或异步更新漏掉
        document.querySelectorAll('relative-time').forEach(el => {
             if (el.firstChild && el.firstChild.nodeType === Node.TEXT_NODE) {
                 processTextNode(el.firstChild);
             }
        });
    }, 1000);
  }

  const { script: { version } } = GM_info;
  const { DOC: { "更新时间": update, "贡献名单": contribution } } = Locales;

  const End = new Date().getTime();

  // 输出脚本信息
  if (DEV_MODE) {
    console.log("=================================");
    console.log(`SteamDB 汉化插件 v${version}`);
    console.log(`翻译更新: ${update}`);
    console.log(`执行耗时: ${End - Start} ms`);
    console.log(`贡献者: ${contribution.join(", ")}`);
    console.log("=================================");
  }

  // 添加按钮
  setTimeout(() => {
    const headerUl = document.querySelector(".header-menu-container>div>ul:nth-child(1)");
    const footerUl = document.querySelector(".footer-container>div>ul:nth-child(1)");
    const scriptLink = document.createElement("li");
    scriptLink.innerHTML = `<a href="https://blog.chrxw.com" target="_blank">SteamDB 汉化 V${version}</a>`;
    headerUl?.appendChild(scriptLink);
    footerUl?.appendChild(scriptLink.cloneNode(true));
  }, 500);

  // 添加样式
  GM_addStyle(`.sdc-float-container{position:fixed;bottom:80px;right:20px;z-index:999999}.sdc-float-btn{position:relative;width:56px;height:56px;background:#2a475e;border-radius:50%;box-shadow:0 4px 16px rgba(0,0,0,.3);cursor:pointer;transition:all .3s ease;display:flex;align-items:center;justify-content:center}.sdc-float-btn:hover{transform:scale(1.1);box-shadow:0 6px 20px rgba(103,193,245,.4)}.sdc-float-btn.active{background:#355a74;transform:scale(1.05)}.sdc-float-icon{font-size:28px;user-select:none}.sdc-float-badge{position:absolute;top:-4px;right:-4px;background:#67c1f5;color:#0a1219;font-size:10px;font-weight:700;padding:2px 6px;border-radius:10px;box-shadow:0 2px 6px rgba(0,0,0,.3)}.sdc-menu{position:absolute;bottom:70px;right:0;width:240px;background:#1b2838;border:1px solid #2a475e;border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,.4);opacity:0;visibility:hidden;transform:translateY(10px);transition:all .2s ease}.sdc-menu.show{opacity:1;visibility:visible;transform:translateY(0)}.sdc-menu-header{padding:16px;border-bottom:1px solid #2a475e}.sdc-menu-title{color:#fff;font-size:14px;font-weight:600;margin-bottom:4px}.sdc-menu-info{color:rgba(255,255,255,.5);font-size:11px}.sdc-menu-items{padding:8px 0}.sdc-menu-item{display:flex;align-items:center;gap:12px;padding:12px 16px;color:rgba(255,255,255,.8);font-size:13px;cursor:pointer;transition:all .2s;user-select:none}.sdc-menu-item:hover{background:#2a475e;color:#67c1f5}.sdc-menu-icon{font-size:16px;width:20px;text-align:center}.tabnav-tabs>a{min-width:80px}`);
})(); 
