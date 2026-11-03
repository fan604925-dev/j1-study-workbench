/**
 * 初一学习工作台 - 线性 SVG 图标注册表（J1Icons）
 * ============================================================
 * 统一 24×24 viewBox、stroke=currentColor、1.5px 线宽、圆角端点，
 * 取代全站 emoji 图标（v2 去 emoji 决策）。
 * 用法：
 *   JS  内：J1Icons.render('home', 20)          → 返回 inline SVG 字符串
 *   HTML 内：<span data-icon="home" data-icon-size="20"></span>
 *           DOMContentLoaded 后自动 hydrate
 * 未知图标名返回空字符串，不报错。
 * ============================================================
 */
(function (global) {
  'use strict';

  // 每项为 24×24 viewBox 内的内部元素（path/circle/rect/line…）
  const ICONS = {
    /* --- 导航 --- */
    home: '<path d="M3 11 L12 4 L21 11"/><path d="M5.5 9.5 V20 H18.5 V9.5"/>',
    list: '<path d="M9 6 h11"/><path d="M9 12 h11"/><path d="M9 18 h11"/><path d="M4.2 6 h.1"/><path d="M4.2 12 h.1"/><path d="M4.2 18 h.1"/>',
    book: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 3 v18"/><path d="M12.5 8 h4"/><path d="M12.5 12 h4"/>',
    target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><path d="M12 11.2 v1.6"/>',
    leaf: '<path d="M20 4 C10.5 4 4 10 4 20 C14 20 20 14 20 4 Z"/><path d="M4 20 C9 15 13 11 16.5 7.5"/>',

    /* --- 操作 / 功能 --- */
    check: '<path d="M5 13 l5 5 L20 7"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5 v4.5 l3 2.5"/>',
    alert: '<path d="M12 3.5 L22 20 H2 Z"/><path d="M12 9.5 v5"/><path d="M12 17.3 v.1"/>',
    wrench: '<path d="M14.5 6.5 a4.2 4.2 0 0 0 -5.6 5.6 L4 17 l3 3 4.9-4.9 a4.2 4.2 0 0 0 5.6 -5.6 l-3.2 3.2 -2.5 -2.5 Z"/>',
    calendar: '<rect x="4" y="5" width="16" height="16" rx="2"/><path d="M4 10 h16"/><path d="M8 3 v4"/><path d="M16 3 v4"/><path d="M8 14 h3"/><path d="M8 17.5 h6"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5.5 15 H5 a1 1 0 0 1 -1 -1 V5 a1 1 0 0 1 1 -1 h9 a1 1 0 0 1 1 1 v.5"/>',
    download: '<path d="M12 4 v11"/><path d="M7.5 11 L12 15.5 L16.5 11"/><path d="M4.5 19.5 h15"/>',
    print: '<path d="M7 8 V3.5 h10 V8"/><rect x="4" y="8" width="16" height="7.5" rx="2"/><rect x="8" y="14" width="8" height="6.5" rx="1"/>',
    camera: '<path d="M8.5 7 L10 4 h4 L15.5 7"/><rect x="3" y="7" width="18" height="13" rx="2.5"/><circle cx="12" cy="13.2" r="3.6"/>',
    sparkle: '<path d="M11 3.5 L12.7 8.8 L18 10.5 L12.7 12.2 L11 17.5 L9.3 12.2 L4 10.5 L9.3 8.8 Z"/><path d="M18.5 15 l.8 2.2 L21.5 18 l-2.2 .8 L18.5 21 l-.8-2.2 L15.5 18 l2.2-.8 Z"/>',
    dashboard: '<path d="M4 16.5 A8.5 8.5 0 0 1 20 16.5"/><path d="M12 16.5 L16 10.5"/><path d="M12 16.3 v.4"/>',
    settings: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.8 v2.6"/><path d="M12 18.6 v2.6"/><path d="M2.8 12 h2.6"/><path d="M18.6 12 h2.6"/><path d="M5.2 5.2 l1.9 1.9"/><path d="M16.9 16.9 l1.9 1.9"/><path d="M18.8 5.2 l-1.9 1.9"/><path d="M7.1 16.9 l-1.9 1.9"/>',
    trash: '<path d="M4 7 h16"/><path d="M9 7 V4.5 h6 V7"/><path d="M6 7 l1 13.5 h10 L18 7"/><path d="M10 11 v6"/><path d="M14 11 v6"/>',
    archive: '<rect x="3" y="4" width="18" height="4.5" rx="1"/><path d="M5 8.5 V20 h14 V8.5"/><path d="M10 12.5 h4"/>',
    x: '<path d="M6 6 L18 18"/><path d="M18 6 L6 18"/>',
    redo: '<path d="M20 12 a8 8 0 1 1 -2.4 -5.7"/><path d="M20 3.5 v4.5 h-4.5"/>',
    plus: '<path d="M12 5 v14"/><path d="M5 12 h14"/>',
    scissors: '<circle cx="6" cy="7" r="2.2"/><circle cx="6" cy="17" r="2.2"/><path d="M8 8 L20 18.5"/><path d="M8 16 L20 5.5"/>',
    chart: '<path d="M4 20 h16"/><path d="M7 20 V13"/><path d="M12 20 V6.5"/><path d="M17 20 V10"/>',
    clipboard: '<rect x="6" y="4" width="12" height="17" rx="2"/><rect x="9" y="2.5" width="6" height="3.5" rx="1"/><path d="M9 11 h6"/><path d="M9 15 h4"/>',
    eye: '<path d="M2.5 12 C5.5 7.2 9 5.5 12 5.5 s6.5 1.7 9.5 6.5 c-3 4.8 -6.5 6.5 -9.5 6.5 s-6.5 -1.7 -9.5 -6.5 Z"/><circle cx="12" cy="12" r="2.8"/>',
    bulb: '<path d="M8 10 a4 4 0 1 1 8 0 c0 2 -1.4 3 -2 4.5 h-4 C9.4 13 8 12 8 10 Z"/><path d="M9.5 17.5 h5"/><path d="M10.5 20.5 h3"/>',
    chat: '<path d="M4 5 h16 v11 h-9 l-4 4 v-4 H4 Z"/><path d="M8 9 h8"/><path d="M8 12 h5"/>',
    flag: '<path d="M6 21 V4"/><path d="M6 5 c4 -2 8 2 12 0 v9 c-4 2 -8 -2 -12 0"/>',
    gift: '<rect x="4" y="10" width="16" height="10" rx="1.5"/><path d="M4 10 h16"/><path d="M12 10 v10"/><path d="M12 10 c-4 0 -5 -4.8 -2 -4.8 c2 0 2 4.8 2 4.8 Z"/><path d="M12 10 c4 0 5 -4.8 2 -4.8 c-2 0 -2 4.8 -2 4.8 Z"/>',
    medal: '<circle cx="12" cy="9" r="5"/><path d="M9.2 13.2 L7 21 l5 -3 5 3 -2.2 -7.8"/>',
    arrowLeft: '<path d="M14 6 L8 12 l6 6"/>',

    /* --- 徽章（engine.js 徽章体系）--- */
    fire: '<path d="M12 3.5 c1 3 4.8 4.3 4.8 8.7 a4.8 4.8 0 0 1 -9.6 0 c0 -1.8 .9 -3 1.8 -4.6 c.5 1.8 1.8 2.3 1.8 2.3 c0 -2.8 .3 -4.2 1.2 -6.4 Z"/>',
    mountain: '<path d="M3 19 L10 6.5 L13.5 12.5 L16.5 8 L21 19 Z"/><path d="M8.5 19 L10 16.5 L11.5 19"/>',
    hand: '<path d="M8.5 12 V6.2 a1.1 1.1 0 0 1 2.2 0 V11"/><path d="M10.7 11 V4.8 a1.1 1.1 0 0 1 2.2 0 V11"/><path d="M12.9 11 V6 a1.1 1.1 0 0 1 2.2 0 v6"/><path d="M15.1 12 V8.2 a1.1 1.1 0 0 1 2.2 0 V14 a7 7 0 0 1 -7 7 h-.6 a5.5 5.5 0 0 1 -5.5 -5.5 V12 a1.1 1.1 0 0 1 2.2 0"/>',
    climb: '<path d="M3 17.5 l6 -6 4 4 8 -8.5"/><path d="M14.5 7 h6.5 v6.5"/>',
    calc: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7 h8"/><path d="M8.5 11.5 h.1"/><path d="M12 11.5 h.1"/><path d="M15.5 11.5 h.1"/><path d="M8.5 15 h.1"/><path d="M12 15 h.1"/><path d="M15.5 15 h.1"/><path d="M8.5 18 h.1"/><path d="M12 18 h.1"/><path d="M15.5 18 h.1"/>',
    star: '<path d="M12 3 l2.7 5.6 6.1 .9 -4.4 4.3 1 6.1 -5.4 -2.9 -5.4 2.9 1 -6.1 -4.4 -4.3 6.1 -.9 Z"/>',
    read: '<path d="M12 6 C10 4.5 7 4.5 4 5.5 V19 c3 -1 6 -1 8 .5 c2 -1.5 5 -1.5 8 -.5 V5.5 C17 4.5 14 4.5 12 6 Z"/><path d="M12 6 v13.5"/>',
    search: '<circle cx="11" cy="11" r="6"/><path d="M15.6 15.6 L20.5 20.5"/>',
    broom: '<path d="M15 3 L9.8 12.3"/><path d="M9.8 12.3 L5.5 20 c2.8 1.6 7 1 9.2 -1.6 L11 12.5"/>',
    seed: '<path d="M12 21 V12"/><path d="M12 12 C12 7 15 4 20 4 c0 5 -3 8 -8 8 Z"/><path d="M12 12 C12 8.5 9.5 6 5 6 c0 4.5 2.5 6 7 6 Z"/>',

    /* --- 特权（store.js 特权体系）--- */
    noodle: '<path d="M4 12 h16 a8 8.5 0 0 1 -16 0 Z"/><path d="M13 3 l3.5 9"/><path d="M17.5 4.5 l-2 7.5"/>',
    moon: '<path d="M20 14 A8.5 8.5 0 1 1 10 3.5 a7 7 0 0 0 10 10.5 Z"/>',
    film: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7.5 4 v16"/><path d="M16.5 4 v16"/><path d="M3 9 h4.5"/><path d="M3 15 h4.5"/><path d="M16.5 9 H21"/><path d="M16.5 15 H21"/>',
    walk: '<circle cx="13.5" cy="4.8" r="2"/><path d="M13 7.5 l-1.8 5.5 -3.7 2.5"/><path d="M11.2 13 l.8 4.5 -2.5 4"/><path d="M12 9.5 l3.5 2 1 4"/><path d="M12 9.5 l-4 1"/>',
    sock: '<path d="M8 3.5 h6.5 V11 c0 2.5 3 3 3 6 a4 4 0 0 1 -8 .5 c-.4 -1.8 -1.5 -2.5 -1.5 -4.5 Z"/><path d="M8 7 h6.5"/>',
    music: '<path d="M9.5 17.5 V6.5 L19.5 4.5 V16"/><circle cx="7" cy="17.8" r="2.4"/><circle cx="17" cy="16.3" r="2.4"/>',
    handshake: '<path d="M2.5 12.5 L7.5 7.5 l4 3.8 -2 2 3 3 4.2 -4.2 4.8 4.4"/><path d="M7.5 7.5 l3 -2.5 3 2.8 3 -2.8 3 2.5"/>',
    basketball: '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5 V20.5"/><path d="M3.5 12 H20.5"/><path d="M6 6 c3 2.5 3 9.5 0 12"/><path d="M18 6 c-3 2.5 -3 9.5 0 12"/>',
    dice: '<rect x="4" y="4" width="16" height="16" rx="3.5"/><path d="M9 9 h.1"/><path d="M15 9 h.1"/><path d="M12 12 h.1"/><path d="M9 15 h.1"/><path d="M15 15 h.1"/>',
    pancake: '<ellipse cx="12" cy="15.5" rx="8" ry="3"/><ellipse cx="12" cy="11.5" rx="8" ry="3"/><ellipse cx="12" cy="7.5" rx="6.5" ry="2.6"/>',
    photo: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10" r="1.8"/><path d="M3.5 17 l5 -5 4 4 3 -3 6 5.5"/>',

    /* --- 学科（kpoints.js 学科体系）--- */
    math: '<path d="M4.5 6.5 h6"/><path d="M7.5 3.5 v6"/><path d="M14 4.5 l4.5 4.5"/><path d="M18.5 4.5 L14 9"/><path d="M4.5 15 h6"/><path d="M14.5 13 v6"/><path d="M11.5 16 h6"/>',
    chinese: '<path d="M4 7.5 c3 3 5.5 4 8 4 c2.5 0 5 -1 8 -4"/><path d="M12 4 v16"/><path d="M8 20 h8"/><path d="M12 8.5 c-1.5 2 -4 3.5 -6 4"/>',
    english: '<path d="M5 20 L12 4 L19 20"/><path d="M8 14 h8"/>'
  };

  function render(name, size) {
    const body = ICONS[name];
    if (!body) return '';
    const s = size || 20;
    return '<svg viewBox="0 0 24 24" width="' + s + '" height="' + s + '" fill="none" ' +
      'stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" ' +
      'style="vertical-align:-0.18em;flex-shrink:0;" aria-hidden="true">' + body + '</svg>';
  }

  // 替换页面里所有 [data-icon] 占位
  function hydrate(root) {
    const scope = root || document;
    scope.querySelectorAll('[data-icon]').forEach(el => {
      const name = el.getAttribute('data-icon');
      const size = Number(el.getAttribute('data-icon-size')) || 18;
      const html = render(name, size);
      if (html) el.innerHTML = html;
    });
  }

  global.J1Icons = { render: render, hydrate: hydrate, names: Object.keys(ICONS) };

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => hydrate());
    } else {
      hydrate();
    }
  }
})(typeof window !== 'undefined' ? window : globalThis);
