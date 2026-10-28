// モーション版（motion-1.0）: 見た目のスタイル（glass/pop/modern）はそのままに「動きの文法」だけを足す。
// - ページ遷移のワイプ・入場スタッガー・ナビのジャンプ・数字のカウントアップ・カレンダーのセル入場・チャット新着ポップ
// - 分析ページの「🎯 学習ステータス」（五角形チャート＋段階表示）
// 色は CSS 変数（--mt-acc / --text / --muted）だけを使う。prefers-reduced-motion では動きを付けない。
// 09-misc.js（showPage）と 07-timer-calendar.js（renderCal）の後に読み込まれ、読込時点でラップする。
// どの処理も失敗してアプリを止めないよう、要素がなければ何もせず、例外は握りつぶす。
(function () {
  'use strict';

  const reduced = () => {
    try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }
    catch (e) { return false; }
  };
  const safe = (fn) => { try { fn(); } catch (e) { /* モーションの失敗でアプリを止めない */ } };

  // ---------- 1. ワイプ ----------
  let wipeTimer = null;
  const ensureWipe = () => {
    if (!document.body) return null;
    let w = document.getElementById('mt-wipe');
    if (!w) {
      w = document.createElement('div');
      w.id = 'mt-wipe';
      w.setAttribute('aria-hidden', 'true');
      w.innerHTML = '<div class="mt-wp"></div><div class="mt-wp sub"></div>';
      document.body.appendChild(w);
    }
    return w;
  };
  const playWipe = () => safe(() => {
    if (reduced()) return;
    const w = ensureWipe(); if (!w) return;
    w.classList.remove('go');
    void w.offsetWidth; // クラスを付け直してアニメを再発火させる
    w.classList.add('go');
    clearTimeout(wipeTimer);
    wipeTimer = setTimeout(() => w.classList.remove('go'), 350);
  });

  // ---------- スタッガー共通 ----------
  const stagger = (els, stepMs, maxMs, rot) => {
    els.forEach((el, i) => {
      el.classList.remove('mt-in');
      void el.offsetWidth;
      el.style.setProperty('--mt-rot', rot ? (i % 2 ? '1.1deg' : '-1.1deg') : '0deg');
      el.style.animationDelay = Math.min(i * stepMs, maxMs) + 'ms';
      el.classList.add('mt-in');
    });
    setTimeout(() => safe(() => els.forEach(el => {
      el.classList.remove('mt-in');
      el.style.animationDelay = '';
      el.style.removeProperty('--mt-rot');
    })), 900);
  };

  const enterPage = (page) => {
    if (!page || reduced()) return;
    const blocks = [...page.children].filter(el =>
      (el.matches('.card, .g4, .page-hdr') || el.id === 'live-band') && el.offsetParent !== null
    ).slice(0, 14);
    stagger(blocks, 45, 420, true);
    const rows = [
      ...page.querySelectorAll('#home-tasks > *'),
      ...page.querySelectorAll('#uni-list-c > .row'),
    ].filter(el => el.offsetParent !== null).slice(0, 12);
    stagger(rows, 35, 420, false);
  };

  const jumpNav = () => {
    if (reduced()) return;
    const b = document.querySelector('.nav-btn.active'); if (!b) return;
    b.classList.remove('mt-jump');
    void b.offsetWidth;
    b.classList.add('mt-jump');
    let done = false;
    const off = () => { if (done) return; done = true; b.classList.remove('mt-jump'); b.removeEventListener('animationend', off); };
    b.addEventListener('animationend', off);
    setTimeout(off, 350);
  };

  // ---------- 3. カウントアップ ----------
  // 前後に数字を含まない「接頭辞 + 数値 + 接尾辞」だけを対象にする。
  // "29時間12分" のような複合表記は接尾辞に数字が残るので対象外、"¥•••"（マスク）や "今日!" は数字がないので対象外。
  const NUM_RE = /^(\D*?)(\d[\d,]*(?:\.\d+)?)(\D*)$/;
  const COUNT_SELECTORS = [
    '#home-countdown > div > div:last-child', // ホーム: 入試カウントダウンの日数（44px の数字）
    '#home-stats .stat-v',                      // ホーム: 統計（総学習・今日・継続・模試回数）。お金ページ内の .stat-v は対象外にする
    // お金: 総資産。17-money.js の MoneyView.html() が out.total に
    // `<div style="font-size:34px;font-weight:900;letter-spacing:-1px">${MoneyView.yen(total)}</div>` を描画する
    '#money-root div[style*="font-size:34px"]',
  ];
  // オドメーター式の刻み: 進捗に応じて下位の桁ほど細かく回し、最後に確定値へ揃える
  const step = (target, p) => {
    if (p >= 1) return target;
    const e = 1 - Math.pow(1 - p, 3);
    const v = target * e;
    const mag = Math.pow(10, Math.max(0, Math.floor(Math.log10(Math.max(1, target))) - 2));
    return Math.min(target, Math.floor(v / mag) * mag);
  };
  const countEl = (el) => {
    const text = (el.textContent || '').trim();
    if (!text || el.dataset.mtcu === text) return;
    const m = text.match(NUM_RE); if (!m) return;
    const raw = m[2], hasComma = raw.includes(','), dec = (raw.split('.')[1] || '').length;
    const target = parseFloat(raw.replace(/,/g, ''));
    el.dataset.mtcu = text;
    if (!isFinite(target) || target <= 0 || reduced()) return;
    const fmt = (v) => {
      let s = dec ? v.toFixed(dec) : String(Math.round(v));
      if (hasComma) { const [i, d] = s.split('.'); s = Number(i).toLocaleString('ja-JP') + (d ? '.' + d : ''); }
      return m[1] + s + m[3];
    };
    const t0 = performance.now(), dur = 600;
    let last = fmt(0);
    el.textContent = last;
    const tick = (now) => {
      // 途中でアプリ側が書き換えたら手を引く
      if (!el.isConnected || el.textContent !== last) return;
      const p = Math.min(1, (now - t0) / dur);
      last = p >= 1 ? text : fmt(step(target, p));
      el.textContent = last;
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  const countUp = (root) => safe(() => {
    if (!root || reduced()) return;
    COUNT_SELECTORS.forEach(sel => root.querySelectorAll(sel).forEach(el => safe(() => countEl(el))));
  });

  // renderMoney は非同期で、キャッシュ描画の後に最新データで #money-root を描き直す。
  // 描き直し後の総資産も、直前に数えた値から変わっていればカウントアップする（同じ値なら確定表示のまま）。
  let moneyObs = null;
  const watchMoney = () => safe(() => {
    const root = document.getElementById('money-root');
    if (!root || typeof MutationObserver === 'undefined') return;
    if (moneyObs) moneyObs.disconnect();
    const prev = {};
    root.querySelectorAll(COUNT_SELECTORS[2]).forEach((el, i) => { prev[i] = el.dataset.mtcu || ''; });
    moneyObs = new MutationObserver(() => safe(() => {
      moneyObs.disconnect(); moneyObs = null;
      root.querySelectorAll(COUNT_SELECTORS[2]).forEach((el, i) => {
        const t = (el.textContent || '').trim();
        if (prev[i] === t) el.dataset.mtcu = t; else countEl(el);
      });
    }));
    moneyObs.observe(root, { childList: true });
    setTimeout(() => { if (moneyObs) { moneyObs.disconnect(); moneyObs = null; } }, 8000);
  });

  // ---------- 4. 学習ステータス ----------
  const clamp01 = (v) => Math.max(0, Math.min(1, Number(v) || 0));
  const dayStr = (d) => {
    try { if (typeof DateManager !== 'undefined' && DateManager.getTodayStr) return DateManager.getTodayStr(d); } catch (e) {}
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  };
  const fmtMin = (min) => {
    try { if (typeof DateManager !== 'undefined' && DateManager.formatHours) return DateManager.formatHours(min); } catch (e) {}
    return Math.floor(min / 60) + '時間' + (min % 60) + '分';
  };
  const compute = () => {
    const st = (typeof S !== 'undefined' && S) ? S : {};
    // 知識: 目標が設定されている科目の current/target 平均
    const tg = Object.values(st.scoreTargets || {}).filter(t => t && Number(t.target) > 0);
    const know = tg.length ? tg.reduce((a, t) => a + clamp01((Number(t.current) || 0) / Number(t.target)), 0) / tg.length : 0;
    // 演習量: 模試＋過去問の回数（12回で満タン）
    const practiceN = (st.mocks || []).length + (st.pastExams || []).length;
    // 継続: 直近28日で学習記録がある日の割合
    const logs = st.dailyLogs || {};
    let active = 0;
    for (let i = 0; i < 28; i++) {
      const d = new Date(); d.setDate(d.getDate() - i);
      if ((logs[dayStr(d)]?.total || 0) > 0) active++;
    }
    // 総学習: 累計分数（12000分＝200時間で満タン）
    let total = 0;
    try { total = calcTotalMinutes(); } catch (e) { total = Number(st.totalMinutes) || 0; }
    // 達成: タスクの完了率
    const tasks = st.tasks || [];
    const done = tasks.filter(t => t && t.done).length;
    return {
      know: { v: know, txt: '達成率 ' + Math.round(know * 100) + '%' },
      practice: { v: clamp01(practiceN / 12), txt: practiceN + '回' },
      cont: { v: active / 28, txt: '実施率 ' + Math.round(active / 28 * 100) + '%' },
      total: { v: clamp01(total / 12000), txt: '累計 ' + fmtMin(total) },
      done: { v: tasks.length ? done / tasks.length : 0, txt: '達成率 ' + done + '/' + tasks.length },
    };
  };
  const RANKS = ['まだまだ', '初級', '中級', '上級', '達人'];
  const rankOf = (v) => (v < 0.2 ? 1 : v < 0.4 ? 2 : v < 0.6 ? 3 : v < 0.8 ? 4 : 5);
  // 頂点順: 上=知識、右上=総学習、右下=継続、左下=達成、左上=演習量（-90°から72°刻み）
  const AXES = [
    { k: 'know', name: '知識' },
    { k: 'total', name: '総学習' },
    { k: 'cont', name: '継続' },
    { k: 'done', name: '達成' },
    { k: 'practice', name: '演習量' },
  ];
  const CX = 100, CY = 95, R = 70;
  const pt = (i, r) => {
    const a = (-90 + i * 72) * Math.PI / 180;
    return [CX + r * Math.cos(a), CY + r * Math.sin(a)];
  };
  const pts = (rs) => rs.map((r, i) => pt(i, r).map(n => n.toFixed(1)).join(',')).join(' ');
  const pentSvg = (vals) => {
    let g = '';
    [0.2, 0.4, 0.6, 0.8, 1.0].forEach(f => {
      g += `<polygon points="${pts(AXES.map(() => R * f))}" fill="none" stroke="var(--muted)" stroke-opacity="${(0.12 + f * 0.25).toFixed(2)}" stroke-width="1"/>`;
    });
    AXES.forEach((_, i) => {
      const [x, y] = pt(i, R);
      g += `<line x1="${CX}" y1="${CY}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="var(--muted)" stroke-opacity=".3" stroke-width="1"/>`;
    });
    const vr = vals.map(v => R * Math.max(0.04, v));
    let val = `<polygon points="${pts(vr)}" fill="var(--mt-acc)" fill-opacity=".22" stroke="var(--mt-acc)" stroke-width="2" stroke-linejoin="round"/>`;
    vr.forEach((r, i) => { const [x, y] = pt(i, r); val += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3" fill="var(--mt-acc)"/>`; });
    let lab = '';
    AXES.forEach((a, i) => {
      const [x, y] = pt(i, R + 14);
      const anchor = Math.abs(x - CX) < 2 ? 'middle' : x > CX ? 'start' : 'end';
      const dy = i === 0 ? -2 : 4;
      lab += `<text x="${x.toFixed(1)}" y="${(y + dy).toFixed(1)}" text-anchor="${anchor}" font-size="11" font-weight="700" fill="var(--text)">${a.name}</text>`;
      lab += `<text x="${x.toFixed(1)}" y="${(y + dy + 12).toFixed(1)}" text-anchor="${anchor}" font-size="9" fill="var(--muted)">Lv${rankOf(vals[i])}</text>`;
    });
    return `<svg viewBox="0 0 200 190" style="width:100%;max-width:280px;display:block;margin:0 auto;overflow:visible" role="img" aria-label="学習ステータスの五角形チャート">${g}<g class="mt-pent-val">${val}</g>${lab}</svg>`;
  };
  const renderMtStatus = () => safe(() => {
    const el = document.getElementById('mt-status'); if (!el) return;
    const d = compute();
    const vals = AXES.map(a => clamp01(d[a.k].v));
    const rows = AXES.map((a, i) => {
      const v = vals[i], lv = rankOf(v);
      const inStage = lv >= 5 ? clamp01((v - 0.8) / 0.2) : clamp01((v - (lv - 1) * 0.2) / 0.2);
      return `<div style="padding:8px 0;border-top:1px solid var(--border)">
        <div class="flex-between" style="font-size:13px">
          <span style="font-weight:700;color:var(--text)">${a.name} <span style="font-weight:600;color:var(--muted);font-size:12px">Lv${lv} ${RANKS[lv - 1]}</span></span>
          <span style="color:var(--muted);font-size:12px">${d[a.k].txt}</span>
        </div>
        <div class="pb"><div class="pf" style="width:0%;background:var(--mt-acc)" data-mt-w="${Math.round(inStage * 100)}"></div></div>
        <div style="font-size:11px;color:var(--muted)">${lv >= 5 ? '最高段階' : '次の段階まで ' + Math.round(inStage * 100) + '%'}</div>
      </div>`;
    }).join('');
    el.innerHTML = pentSvg(vals) + `<div style="margin-top:8px">${rows}</div>`;
    // 幅 0 → 目標幅にして .pf の transition で伸ばす（reduced なら即時）
    const fills = el.querySelectorAll('.pf[data-mt-w]');
    const apply = () => fills.forEach(f => { f.style.width = f.dataset.mtW + '%'; });
    if (reduced()) apply();
    else requestAnimationFrame(() => requestAnimationFrame(() => safe(apply)));
  });

  // ---------- 2. showPage ラップ ----------
  safe(() => {
    const orig = window.showPage;
    if (typeof orig !== 'function' || orig.__mtWrapped) return;
    const wrapped = function (id, btn) {
      const r = orig.apply(this, arguments);
      safe(() => {
        const userDriven = !!btn;
        if (userDriven) playWipe();
        const page = document.getElementById('page-' + id);
        enterPage(page);
        jumpNav();
        if (id === 'home' || id === 'money') countUp(page);
        if (id === 'money') watchMoney();
        if (id === 'analytics') renderMtStatus();
      });
      return r;
    };
    wrapped.__mtWrapped = true;
    window.showPage = wrapped;
  });

  // ---------- 5. renderCal ----------
  const animateCal = () => safe(() => {
    if (reduced()) return;
    const cells = [...document.querySelectorAll('#cal-body .cal-day')];
    cells.forEach((c, i) => {
      c.classList.remove('mt-cell');
      c.style.animationDelay = Math.min((i % 7) * 22 + Math.floor(i / 7) * 14, 500) + 'ms';
      c.classList.add('mt-cell');
    });
    setTimeout(() => safe(() => cells.forEach(c => { c.classList.remove('mt-cell'); c.style.animationDelay = ''; })), 900);
  });
  safe(() => {
    // renderCal は 07-timer-calendar.js でトップレベルの const として定義されており、
    // 別スクリプトから再代入できない（呼び出し側も字句スコープの renderCal を直接参照する）。
    // window に関数として出ていればラップし、そうでなければ #cal-body の描き直しを監視して同じ効果を出す。
    const orig = window.renderCal;
    if (typeof orig === 'function') {
      if (orig.__mtWrapped) return;
      const wrapped = function () { const r = orig.apply(this, arguments); animateCal(); return r; };
      wrapped.__mtWrapped = true;
      window.renderCal = wrapped;
      return;
    }
    if (window.__mtCalObs || typeof MutationObserver === 'undefined') return;
    const start = () => safe(() => {
      const body = document.getElementById('cal-body'); if (!body || window.__mtCalObs) return;
      window.__mtCalObs = new MutationObserver(() => animateCal());
      window.__mtCalObs.observe(body, { childList: true });
    });
    if (document.getElementById('cal-body')) start();
    else document.addEventListener('DOMContentLoaded', start);
  });

  // ---------- 6. チャット新着ポップ ----------
  const watchChat = () => safe(() => {
    const box = document.getElementById('chat-msgs');
    if (!box || box.__mtObs || typeof MutationObserver === 'undefined') return;
    box.__mtObs = new MutationObserver((muts) => safe(() => {
      if (reduced()) return;
      const added = [];
      muts.forEach(m => m.addedNodes.forEach(n => added.push(n)));
      if (added.length < 1 || added.length > 3) return; // 初期の一括描画には付けない
      added.forEach(n => {
        if (n.nodeType !== 1) return;
        n.classList.add('mt-pop');
        n.addEventListener('animationend', () => n.classList.remove('mt-pop'), { once: true });
      });
    }));
    box.__mtObs.observe(box, { childList: true });
  });

  // ---------- 7. 初期化 ----------
  const init = () => { ensureWipe(); watchChat(); };
  if (document.body) safe(init);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => safe(init));

  window.MotionUI = { playWipe, countUp, renderMtStatus };
})();
