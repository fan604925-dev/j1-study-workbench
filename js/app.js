/**
 * 初一学习工作台 - 全局应用逻辑（J1App）
 * ============================================================
 * 初始化、导航、SW 注册与更新、toast、复制、进度环、日期显示。
 * 注意：日期计算逻辑在 js/engine.js 的 J1Engine.date（纯逻辑可测），
 *       这里只做 UI 呈现层的薄封装。
 * ============================================================
 */
(function (global) {
  'use strict';

  const App = {
    init() {
      if (global.J1Store) {
        global.J1Store.init();
        // 逾期顺延（幂等：同一天只跑一次）
        try {
          const today = this.todayStr();
          const res = global.J1Engine.rollOver(global.J1Store, today);
          if (res.changed) global.J1Store.save();
        } catch (e) { console.warn('[App] 顺延处理失败', e); }
        // AI feed 拉取（异步、静默失败：离线仍可用本地数据）
        this.applyRemoteFeed();
      }
      this.registerSW();
      this.highlightNav();
      this.checkFirstUse();
    },

    /**
     * 拉取 AI 推送的 data/feed.json 并合并（幂等：feedVersion 递增才生效）。
     * 合并后结算徽章；如果本页已渲染，刷新页面拿到最新数据。
     */
    applyRemoteFeed() {
      if (typeof fetch !== 'function') return;
      fetch('data/feed.json', { cache: 'no-cache' })
        .then(r => (r.ok ? r.json() : null))
        .then(feed => {
          if (!feed) return;
          const res = global.J1Store.applyFeed(feed);
          if (!res.ok || res.skipped) return;
          try { global.J1Store.evaluateBadges(this.todayStr()); } catch (e) {}
          // 页面已渲染过 → 刷新一次以呈现新数据（每会话最多刷一次）
          try {
            if (!sessionStorage.getItem('j1_feed_reloaded')) {
              sessionStorage.setItem('j1_feed_reloaded', '1');
              location.reload();
              return;
            }
          } catch (e) {}
          if (typeof this.onFeedApplied === 'function') this.onFeedApplied(res);
        })
        .catch(() => { /* 离线或无 feed：静默 */ });
    },

    todayStr() {
      return global.J1Engine ? global.J1Engine.date.today() : '';
    },

    registerSW() {
      if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
      if (location.protocol === 'file:') return; // file:// 下不注册
      try {
        navigator.serviceWorker.register('service-worker.js', { scope: './' })
          .then(reg => {
            reg.update();
            reg.addEventListener('updatefound', () => {
              const nw = reg.installing;
              if (!nw) return;
              nw.addEventListener('statechange', () => {
                if (nw.state === 'activated') {
                  if (sessionStorage.getItem('j1_sw_reloaded')) return;
                  sessionStorage.setItem('j1_sw_reloaded', '1');
                  location.reload();
                }
              });
            });
          })
          .catch(err => { console.warn('[SW] 注册失败:', err); });
      } catch (e) { /* 静默降级 */ }
    },

    /**
     * 一键修复（不删数据）：只清理本应用 j1- 前缀缓存 + 重跑 _repairData + 刷新
     */
    async repairAndReload() {
      if (typeof caches !== 'undefined') {
        try {
          const keys = await caches.keys();
          await Promise.all(keys.filter(k => k.indexOf('j1-') === 0).map(k => caches.delete(k)));
        } catch (e) { /* 忽略 */ }
      }
      if (global.J1Store) {
        global.J1Store._repairData();
        global.J1Store.save();
      }
      this.toast('已修复，正在刷新…');
      setTimeout(() => location.reload(true), 600);
    },

    highlightNav() {
      const path = (location.pathname.split('/').pop() || 'index.html');
      document.querySelectorAll('.bottom-nav a').forEach(a => {
        if (a.getAttribute('href') === path) a.classList.add('active');
      });
    },

    checkFirstUse() {
      try {
        if (!localStorage.getItem('j1_visited')) localStorage.setItem('j1_visited', '1');
      } catch (e) {}
    },

    /* ========== 导航 ========== */
    navHTML() {
      const I = global.J1Icons;
      const ic = (n) => (I ? I.render(n, 20) : '');
      return `
        <nav class="bottom-nav">
          <a href="index.html"><span class="nav-icon">${ic('home')}</span><span>看板</span></a>
          <a href="tasks.html"><span class="nav-icon">${ic('list')}</span><span>待办</span></a>
          <a href="mistakes.html"><span class="nav-icon">${ic('book')}</span><span>错题</span></a>
          <a href="plan.html"><span class="nav-icon">${ic('target')}</span><span>计划</span></a>
          <a href="growth.html"><span class="nav-icon">${ic('leaf')}</span><span>成长</span></a>
        </nav>
      `;
    },

    injectNav() {
      const nav = document.getElementById('bottom-nav');
      if (nav) nav.innerHTML = this.navHTML();
      this.highlightNav();
    },

    /* ========== UI 工具 ========== */
    subjectTag(subject) {
      const map = {
        math: { label: '数学', cls: 'tag-math' },
        chinese: { label: '语文', cls: 'tag-chinese' },
        english: { label: '英语', cls: 'tag-english' },
        other: { label: '其他', cls: 'tag-other' }
      };
      const s = map[subject] || map.other;
      return '<span class="tag ' + s.cls + '">' + s.label + '</span>';
    },

    subjectName(subject) {
      return { math: '数学', chinese: '语文', english: '英语', other: '其他' }[subject] || '其他';
    },

    toast(msg, duration) {
      let el = document.getElementById('toast');
      if (!el) {
        el = document.createElement('div');
        el.id = 'toast';
        el.style.cssText = 'position: fixed; bottom: 84px; left: 50%; transform: translateX(-50%);' +
          'background: rgba(0,0,0,0.8); color: #fff; padding: 10px 20px; border-radius: 20px;' +
          'font-size: 14px; z-index: 9999; transition: opacity 0.3s; opacity: 0; max-width: 80vw;';
        document.body.appendChild(el);
      }
      el.textContent = msg;
      el.style.opacity = '1';
      setTimeout(() => { el.style.opacity = '0'; }, duration || 2000);
    },

    escapeHtml(s) {
      return String(s === null || s === undefined ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    },

    copyText(text) {
      const fallback = () => {
        try {
          const ta = document.createElement('textarea');
          ta.value = text;
          ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0;';
          document.body.appendChild(ta);
          ta.select();
          const ok = document.execCommand('copy');
          document.body.removeChild(ta);
          return ok;
        } catch (e) { return false; }
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        return navigator.clipboard.writeText(text).then(() => true).catch(() => fallback());
      }
      return Promise.resolve(fallback());
    },

    formatDate(dateStr) {
      return global.J1Engine ? global.J1Engine.date.fmtCN(dateStr) : dateStr;
    },

    progressRingSVG(percentage, size) {
      size = size || 60;
      const pct = Math.max(0, Math.min(1, percentage || 0));
      const stroke = 5;
      const radius = (size - stroke * 2) / 2;
      const circumference = 2 * Math.PI * radius;
      const offset = circumference * (1 - pct);
      const baseline = (global.J1Store && global.J1Store.settings.completionBaseline) || 0.6;
      const color = pct >= baseline ? '#22c55e' : pct >= 0.3 ? '#f59e0b' : '#ef4444';
      return '<div class="progress-ring" style="width:' + size + 'px;height:' + size + 'px;">' +
        '<svg width="' + size + '" height="' + size + '">' +
        '<circle class="progress-bg" cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + radius + '" fill="none" stroke-width="' + stroke + '"/>' +
        '<circle class="progress-fill" cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + radius + '" fill="none" stroke="' + color + '" stroke-width="' + stroke + '" stroke-dasharray="' + circumference + '" stroke-dashoffset="' + offset + '" stroke-linecap="round"/>' +
        '</svg><div class="progress-text" style="color:' + color + ';">' + Math.round(pct * 100) + '%</div></div>';
    },

    progressBar(pct, cls) {
      const p = Math.max(0, Math.min(100, Math.round((pct || 0) * 100)));
      let color = cls || '';
      if (!cls) {
        if (p >= 60) color = 'green';
        else if (p >= 30) color = 'yellow';
        else color = 'red';
      }
      return '<div class="progress-track"><div class="progress-fill ' + color + '" style="width:' + p + '%"></div></div>';
    },

    rateClass(rate) {
      const baseline = (global.J1Store && global.J1Store.settings.completionBaseline) || 0.6;
      if (rate === null || rate === undefined) return '';
      if (rate >= baseline) return 'good';
      if (rate >= 0.3) return 'warn';
      return 'bad';
    },

    rateText(rate) {
      if (rate === null || rate === undefined) return '—';
      return Math.round(rate * 100) + '%';
    },

    confirm(msg) { return window.confirm(msg); }
  };

  global.J1App = App;
  global.app = App; // 兼容内联 onclick

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => App.init());
  } else {
    App.init();
  }
})(typeof window !== 'undefined' ? window : globalThis);
