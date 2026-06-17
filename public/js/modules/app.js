/**
 * 应用入口模块
 * 负责认证检查、配置加载、模块初始化协调
 */
(function() {
    'use strict';

    // 全局配置
    window.APPID = '';
    window.API_KEY = '';

    /**
     * 检查认证状态
     * 未认证则重定向到认证页面
     */
    function checkAuth() {
        var authed = localStorage.getItem('authed');
        if (!authed) {
            window.location.replace('auth.html');
            return false;
        }
        return true;
    }

    /**
     * 从服务器加载配置
     * 加载讯飞API配置等
     */
    function loadConfig() {
        return fetch('/api/config')
            .then(function(response) {
                if (!response.ok) {
                    throw new Error('配置请求失败 (HTTP ' + response.status + ')');
                }
                return response.json();
            })
            .then(function(config) {
                window.APPID = config.xfyunAppId || '';
                window.API_KEY = config.xfyunApiKey || '';
                console.log('[App] 配置已加载');
            })
            .catch(function(error) {
                console.error('[App] 获取配置失败:', error.message);
            });
    }

    /**
     * 初始化所有功能模块
     */
    function initModules() {
        // 历史记录恢复
        if (window.HistoryModule && window.HistoryModule.restore) {
            window.HistoryModule.restore();
        }

        // 语音识别初始化
        if (window.SpeechRecognitionModule && window.SpeechRecognitionModule.init) {
            window.SpeechRecognitionModule.init();
        }

        // 工作区管理初始化
        if (window.WorkspaceManager && window.WorkspaceManager.init) {
            window.WorkspaceManager.init();
        }

        // 侧边栏管理初始化
        if (window.SidebarManager && window.SidebarManager.init) {
            window.SidebarManager.init();
        }

        // 案件管理初始化
        if (window.CaseManager && window.CaseManager.init) {
            window.CaseManager.init();
        }

        // 分析视图 Tab 切换
        initAnalysisTabs();

        console.log('[App] 模块初始化完成');
    }

    /**
     * 初始化分析视图 Tab 切换
     */
    function initAnalysisTabs() {
        var tabBtns = document.querySelectorAll('.analysis-tab-btn');
        var iframe = document.getElementById('analysisIframe');

        if (!tabBtns.length || !iframe) return;

        tabBtns.forEach(function(btn) {
            btn.addEventListener('click', function() {
                var page = btn.dataset.page;
                if (!page) return;

                // 更新 Tab 激活状态
                tabBtns.forEach(function(b) { b.classList.remove('active'); });
                btn.classList.add('active');

                // 切换 iframe 页面
                iframe.src = page;
            });
        });
    }

    /**
     * 主应用初始化
     * 加载配置 -> 初始化模块
     */
    function init() {
        if (!checkAuth()) {
            return;
        }

        loadConfig().finally(function() {
            initModules();
            console.log('[App] 应用启动完成');
        });
    }

    // DOM加载完成后初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // 暴露公共接口
    window.App = {
        init: init,
        loadConfig: loadConfig,
        checkAuth: checkAuth
    };
})();
