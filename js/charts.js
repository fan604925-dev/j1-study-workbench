/**
 * 初一学习工作台 - Chart.js 薄封装
 * 统一配色与实例管理（destroy 后重建），Chart.js 未加载时返回 null 由页面优雅降级。
 */
(function (global) {
  'use strict';

  const registry = {};

  const COLORS = {
    brand: '#2f80ed',
    cyan: '#38bdf8',
    amber: '#f59e0b',
    green: '#22c55e',
    red: '#ef4444',
    grey: '#cbd5e1'
  };

  function ensure(name, ctx, cfgFactory) {
    if (typeof global.Chart === 'undefined') return null;
    if (registry[name]) { try { registry[name].destroy(); } catch (e) {} }
    try {
      registry[name] = new global.Chart(ctx, cfgFactory());
      return registry[name];
    } catch (e) { return null; }
  }

  global.J1Charts = {
    available() { return typeof global.Chart !== 'undefined'; },

    // 近 N 日完成率折线（labels: 日期, values: 0-1 或 null）
    completionTrend(name, ctx, labels, values) {
      return ensure(name, ctx, () => ({
        type: 'line',
        data: {
          labels: labels,
          datasets: [{
            data: values,
            borderColor: COLORS.brand,
            backgroundColor: 'rgba(47,128,237,0.12)',
            fill: true, tension: 0.35, spanGaps: true,
            pointRadius: 3, pointBackgroundColor: COLORS.brand
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          scales: {
            y: { min: 0, max: 1, ticks: { callback: v => Math.round(v * 100) + '%' } }
          },
          plugins: { legend: { display: false } }
        }
      }));
    },

    // 三科分布环形（labels + values + colors）
    doughnut(name, ctx, labels, values, colors) {
      return ensure(name, ctx, () => ({
        type: 'doughnut',
        data: {
          labels: labels,
          datasets: [{ data: values, backgroundColor: colors || [COLORS.brand, COLORS.amber, COLORS.green, COLORS.grey], borderWidth: 2, borderColor: '#fff' }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          cutout: '62%',
          plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } } }
        }
      }));
    },

    // 考试分数趋势折线（0-100 归一化，可带参考线）
    examTrend(name, ctx, labels, values, refLine) {
      return ensure(name, ctx, () => ({
        type: 'line',
        data: {
          labels: labels,
          datasets: [{
            data: values,
            borderColor: COLORS.brand,
            backgroundColor: 'rgba(47,128,237,0.12)',
            fill: true, tension: 0.3,
            pointRadius: 4, pointBackgroundColor: COLORS.brand
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          scales: { y: { min: 0, max: 100 } },
          plugins: {
            legend: { display: false },
            ...(refLine ? {
              annotationLike: {}
            } : {})
          }
        }
      }));
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
