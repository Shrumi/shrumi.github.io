/* Демо-виджет AI-помощника по установке Windows.
   Работает полностью в браузере: BM25-поиск по kb.json, без бэкенда. */
(function () {
  'use strict';

  var KB_URL = 'kb.json';
  var K1 = 1.5, B = 0.75;
  var TOKEN_RE = /[a-zA-Zа-яА-ЯёЁ0-9_\-\.]+/g;

  var docs = [], idf = {}, avgdl = 0, N = 0, ready = false;

  function tokenize(text) {
    return (String(text).toLowerCase().match(TOKEN_RE) || []);
  }

  function buildIndex(data) {
    docs = data.map(function (d) {
      var tokens = tokenize(d.title + ' ' + d.section + ' ' + d.text);
      var tf = {};
      tokens.forEach(function (t) { tf[t] = (tf[t] || 0) + 1; });
      return { d: d, tf: tf, len: tokens.length };
    });
    N = docs.length;
    avgdl = docs.reduce(function (s, x) { return s + x.len; }, 0) / N;
    var df = {};
    docs.forEach(function (x) {
      Object.keys(x.tf).forEach(function (t) { df[t] = (df[t] || 0) + 1; });
    });
    Object.keys(df).forEach(function (t) {
      idf[t] = Math.log(1 + (N - df[t] + 0.5) / (df[t] + 0.5));
    });
    ready = true;
  }

  function search(query, top) {
    var q = tokenize(query);
    if (!q.length) return [];
    var scored = docs.map(function (x) {
      var s = 0;
      q.forEach(function (t) {
        if (!x.tf[t]) return;
        var f = x.tf[t];
        s += idf[t] * (f * (K1 + 1)) / (f + K1 * (1 - B + B * x.len / avgdl));
      });
      return { doc: x.d, score: s };
    });
    return scored.filter(function (r) { return r.score > 0; })
      .sort(function (a, b) { return b.score - a.score; })
      .slice(0, top || 3);
  }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function buildUI() {
    var root = el('div', 'wa-root');
    root.innerHTML =
      '<button class="wa-launcher" type="button" aria-label="Открыть AI-помощника">' +
        '<span class="wa-launcher__icon">?</span>' +
        '<span class="wa-launcher__text">Спросить AI</span>' +
      '</button>' +
      '<section class="wa-panel" aria-label="AI-помощник по Windows" hidden>' +
        '<header class="wa-head">' +
          '<div><strong>AI-помощник</strong><span class="wa-head__sub">установка Windows · MVP-демо</span></div>' +
          '<button class="wa-close" type="button" aria-label="Закрыть">×</button>' +
        '</header>' +
        '<div class="wa-log" role="log" aria-live="polite"></div>' +
        '<form class="wa-form">' +
          '<input class="wa-input" type="text" placeholder="Например: ошибка 0x80070002" autocomplete="off">' +
          '<button class="wa-send" type="submit" aria-label="Отправить">→</button>' +
        '</form>' +
        '<p class="wa-foot">Демо: поиск по 24 заметкам базы. Не заменяет диагностику.</p>' +
      '</section>';
    document.body.appendChild(root);
    return root;
  }

  function addMsg(log, role, html) {
    var m = el('div', 'wa-msg wa-msg--' + role);
    m.innerHTML = html;
    log.appendChild(m);
    log.scrollTop = log.scrollHeight;
    return m;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function answer(query) {
    var hits = search(query, 3);
    if (!hits.length) {
      return '<p>В базе нет подходящего материала. Попробуйте уточнить: код ошибки, ' +
        'название раздела или симптом.</p>';
    }
    var best = hits[0].doc;
    var body = best.text.replace(/\n{2,}/g, '\n').trim();
    if (body.length > 700) body = body.slice(0, 700) + '…';
    var html = '<p class="wa-answer__title">' + escapeHtml(best.title) + '</p>';
    if (best.section) html += '<p class="wa-answer__section">' + escapeHtml(best.section) + '</p>';
    html += '<div class="wa-answer__body">' + escapeHtml(body).replace(/\n/g, '<br>') + '</div>';
    html += '<p class="wa-answer__src">Источник: ' + escapeHtml(best.category) +
      ' / ' + escapeHtml(best.path) + '</p>';
    if (hits.length > 1) {
      var seen = {};
      seen[best.title] = true;
      var more = [];
      hits.slice(1).forEach(function (h) {
        if (!seen[h.doc.title]) { seen[h.doc.title] = true; more.push(h.doc.title); }
      });
      if (more.length) {
        html += '<p class="wa-answer__more">Ещё по теме: ' +
          more.map(escapeHtml).join('; ') + '</p>';
      }
    }
    return html;
  }

  function init() {
    var root = buildUI();
    var panel = root.querySelector('.wa-panel');
    var log = root.querySelector('.wa-log');
    var form = root.querySelector('.wa-form');
    var input = root.querySelector('.wa-input');

    root.querySelector('.wa-launcher').addEventListener('click', function () {
      panel.hidden = !panel.hidden;
      if (!panel.hidden) input.focus();
    });
    root.querySelector('.wa-close').addEventListener('click', function () {
      panel.hidden = true;
    });

    addMsg(log, 'bot',
      '<p>Привет! Я демо-помощник по установке Windows. Спросите про ошибку, ' +
      'BIOS, драйверы, BSOD или диск.</p>' +
      '<p class="wa-hint">Попробуйте: «ошибка 0x80070002», «не видит диск при установке», ' +
      '«синий экран».</p>');

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var q = input.value.trim();
      if (!q) return;
      addMsg(log, 'user', '<p>' + escapeHtml(q) + '</p>');
      input.value = '';
      if (!ready) {
        addMsg(log, 'bot', '<p>База ещё загружается, секунду…</p>');
        return;
      }
      setTimeout(function () {
        addMsg(log, 'bot', answer(q));
      }, 120);
    });

    fetch(KB_URL)
      .then(function (r) { return r.json(); })
      .then(buildIndex)
      .catch(function () {
        addMsg(log, 'bot', '<p>Не удалось загрузить базу знаний.</p>');
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
