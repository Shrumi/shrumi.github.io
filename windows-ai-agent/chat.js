/* AI-помощник по установке Windows.
   Поиск: BM25 по kb.json в браузере. Ответ: бесплатная LLM (Pollinations, без ключа)
   с fallback на локальный фрагмент, если API недоступен. */
(function () {
  'use strict';

  var KB_URL = 'kb.json';
  var LLM_URL = 'https://text.pollinations.ai/openai';
  var LLM_MODEL = 'openai';
  var LLM_TIMEOUT = 25000;
  var K1 = 1.5, B = 0.75;
  var TOKEN_RE = /[a-zA-Zа-яА-ЯёЁ0-9_\-\.]+/g;

  var docs = [], idf = {}, avgdl = 0, N = 0, ready = false;
  var panel, log, input, modal;

  /* ---------- поиск ---------- */

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

  /* ---------- LLM ---------- */

  function buildPrompt(query, hits) {
    var ctx = hits.map(function (h, i) {
      return '[' + (i + 1) + '] ' + h.doc.title + ' / ' + h.doc.section + '\n' + h.doc.text;
    }).join('\n\n');
    return 'Ты помощник по установке и настройке Windows. Отвечай ТОЛЬКО по контексту ниже. ' +
      'Если ответа в контексте нет — скажи: «В базе нет подходящего материала». ' +
      'Отвечай по-русски, кратко: 3–6 предложений, по делу, с конкретными командами, если они есть.\n\n' +
      'КОНТЕКСТ:\n' + ctx + '\n\nВОПРОС: ' + query;
  }

  function askLLM(query, hits) {
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, LLM_TIMEOUT);
    return fetch(LLM_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model: LLM_MODEL,
        messages: [
          { role: 'system', content: 'Ты технический помощник по Windows. Отвечай кратко и по делу.' },
          { role: 'user', content: buildPrompt(query, hits) }
        ],
        max_tokens: 500,
        temperature: 0.3
      })
    }).then(function (r) {
      clearTimeout(timer);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function (j) {
      var msg = j.choices && j.choices[0] && j.choices[0].message;
      var text = msg && msg.content;
      if (!text) throw new Error('empty');
      return String(text).trim();
    });
  }

  /* ---------- утилиты ---------- */

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function addMsg(role, html) {
    var m = el('div', 'wa-msg wa-msg--' + role);
    m.innerHTML = html;
    log.appendChild(m);
    log.scrollTop = log.scrollHeight;
    return m;
  }

  /* ---------- модалка с полным текстом ---------- */

  function openFull(doc) {
    if (!modal) {
      modal = el('div', 'wa-modal');
      modal.innerHTML =
        '<div class="wa-modal__box" role="dialog" aria-modal="true">' +
          '<header class="wa-modal__head">' +
            '<div><strong class="wa-modal__title"></strong>' +
            '<span class="wa-modal__sub"></span></div>' +
            '<button class="wa-modal__close" type="button" aria-label="Закрыть">×</button>' +
          '</header>' +
          '<div class="wa-modal__body"></div>' +
          '<footer class="wa-modal__foot"></footer>' +
        '</div>';
      document.body.appendChild(modal);
      modal.querySelector('.wa-modal__close').addEventListener('click', closeFull);
      modal.addEventListener('click', function (e) {
        if (e.target === modal) closeFull();
      });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && modal && modal.classList.contains('is-open')) closeFull();
      });
    }
    modal.querySelector('.wa-modal__title').textContent = doc.title;
    modal.querySelector('.wa-modal__sub').textContent =
      (doc.section ? doc.section + ' · ' : '') + doc.category;
    modal.querySelector('.wa-modal__body').textContent = doc.text;
    modal.querySelector('.wa-modal__foot').textContent = 'Источник: ' + doc.path;
    modal.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  }

  function closeFull() {
    if (!modal) return;
    modal.classList.remove('is-open');
    document.body.style.overflow = '';
  }

  /* ---------- ответ ---------- */

  function renderAnswer(query, hits, llmText) {
    var best = hits[0].doc;
    var html = '';
    if (llmText) {
      html += '<div class="wa-answer__body">' +
        escapeHtml(llmText).replace(/\n/g, '<br>') + '</div>';
    } else {
      var body = best.text.replace(/\n{2,}/g, '\n').trim();
      if (body.length > 600) body = body.slice(0, 600) + '…';
      html += '<div class="wa-answer__body">' + escapeHtml(body).replace(/\n/g, '<br>') + '</div>';
    }
    html += '<button class="wa-answer__link" type="button" data-doc="' + best.id + '">' +
      'Читать полностью: ' + escapeHtml(best.title) + ' →</button>';
    html += '<p class="wa-answer__src">Источник: ' + escapeHtml(best.category) +
      ' / ' + escapeHtml(best.path) + '</p>';
    return html;
  }

  function bindAnswerLinks(container) {
    container.querySelectorAll('.wa-answer__link').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = Number(btn.getAttribute('data-doc'));
        var found = null;
        docs.forEach(function (x) { if (x.d.id === id) found = x.d; });
        if (found) openFull(found);
      });
    });
  }

  /* ---------- перетаскивание ---------- */

  var MIN_W = 280, MIN_H = 320;

  function clampSize(w, h) {
    return {
      w: Math.min(Math.max(MIN_W, w), window.innerWidth - 20),
      h: Math.min(Math.max(MIN_H, h), window.innerHeight - 20)
    };
  }

  function saveSize(panelEl) {
    try {
      localStorage.setItem('wa-size', JSON.stringify({
        w: panelEl.offsetWidth,
        h: panelEl.offsetHeight
      }));
    } catch (e) { /* приватный режим — молча игнорируем */ }
  }

  function restoreSize(panelEl) {
    try {
      var s = JSON.parse(localStorage.getItem('wa-size') || 'null');
      if (s && s.w && s.h) {
        var c = clampSize(s.w, s.h);
        panelEl.style.width = c.w + 'px';
        panelEl.style.height = c.h + 'px';
        panelEl.style.maxHeight = 'none';
      }
    } catch (e) { /* повреждённое значение — игнорируем */ }
  }

  function makeResizable(panelEl, handle) {
    var resizing = false, startX = 0, startY = 0, startW = 0, startH = 0;

    function begin(x, y) {
      var rect = panelEl.getBoundingClientRect();
      resizing = true;
      startX = x; startY = y;
      startW = rect.width; startH = rect.height;
      // фиксируем позицию, чтобы панель не прыгала при смене width/height
      panelEl.style.left = rect.left + 'px';
      panelEl.style.top = rect.top + 'px';
      panelEl.style.right = 'auto';
      panelEl.style.bottom = 'auto';
    }

    function apply(x, y) {
      var c = clampSize(startW + (x - startX), startH + (y - startY));
      panelEl.style.width = c.w + 'px';
      panelEl.style.height = c.h + 'px';
      panelEl.style.maxHeight = 'none';
    }

    handle.addEventListener('mousedown', function (e) {
      e.preventDefault();
      e.stopPropagation();
      begin(e.clientX, e.clientY);
    });

    document.addEventListener('mousemove', function (e) {
      if (resizing) apply(e.clientX, e.clientY);
    });

    document.addEventListener('mouseup', function () {
      if (!resizing) return;
      resizing = false;
      saveSize(panelEl);
    });

    handle.addEventListener('touchstart', function (e) {
      var t = e.touches[0];
      begin(t.clientX, t.clientY);
    }, { passive: true });

    document.addEventListener('touchmove', function (e) {
      if (!resizing) return;
      var t = e.touches[0];
      apply(t.clientX, t.clientY);
    }, { passive: true });

    document.addEventListener('touchend', function () {
      if (!resizing) return;
      resizing = false;
      saveSize(panelEl);
    });
  }

  function makeDraggable(panelEl, handle) {
    var dragging = false, startX = 0, startY = 0, startLeft = 0, startTop = 0;

    handle.addEventListener('mousedown', function (e) {
      if (e.target.closest('button')) return;
      var rect = panelEl.getBoundingClientRect();
      panelEl.style.left = rect.left + 'px';
      panelEl.style.top = rect.top + 'px';
      panelEl.style.right = 'auto';
      panelEl.style.bottom = 'auto';
      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
      startLeft = rect.left;
      startTop = rect.top;
      e.preventDefault();
    });

    document.addEventListener('mousemove', function (e) {
      if (!dragging) return;
      var w = panelEl.offsetWidth, h = panelEl.offsetHeight;
      var left = Math.min(Math.max(0, startLeft + e.clientX - startX), window.innerWidth - w);
      var top = Math.min(Math.max(0, startTop + e.clientY - startY), window.innerHeight - h);
      panelEl.style.left = left + 'px';
      panelEl.style.top = top + 'px';
    });

    document.addEventListener('mouseup', function () { dragging = false; });

    handle.addEventListener('touchstart', function (e) {
      if (e.target.closest('button')) return;
      var t = e.touches[0];
      var rect = panelEl.getBoundingClientRect();
      panelEl.style.left = rect.left + 'px';
      panelEl.style.top = rect.top + 'px';
      panelEl.style.right = 'auto';
      panelEl.style.bottom = 'auto';
      dragging = true;
      startX = t.clientX; startY = t.clientY;
      startLeft = rect.left; startTop = rect.top;
    }, { passive: true });

    document.addEventListener('touchmove', function (e) {
      if (!dragging) return;
      var t = e.touches[0];
      var w = panelEl.offsetWidth, h = panelEl.offsetHeight;
      var left = Math.min(Math.max(0, startLeft + t.clientX - startX), window.innerWidth - w);
      var top = Math.min(Math.max(0, startTop + t.clientY - startY), window.innerHeight - h);
      panelEl.style.left = left + 'px';
      panelEl.style.top = top + 'px';
    }, { passive: true });

    document.addEventListener('touchend', function () { dragging = false; });
  }

  /* ---------- UI ---------- */

  function buildUI() {
    var root = el('div', 'wa-root');
    root.innerHTML =
      '<button class="wa-launcher" type="button" aria-label="Открыть AI-помощника">' +
        '<span class="wa-launcher__icon">?</span>' +
        '<span class="wa-launcher__text">Спросить AI</span>' +
      '</button>' +
      '<section class="wa-panel" aria-label="AI-помощник по Windows" hidden>' +
        '<header class="wa-head">' +
          '<div class="wa-head__drag">' +
            '<strong>AI-помощник</strong>' +
            '<span class="wa-head__sub">установка Windows · MVP</span>' +
          '</div>' +
          '<button class="wa-close" type="button" aria-label="Закрыть">×</button>' +
        '</header>' +
        '<div class="wa-log" role="log" aria-live="polite"></div>' +
        '<form class="wa-form">' +
          '<input class="wa-input" type="text" placeholder="Например: ошибка 0x80070002" autocomplete="off">' +
          '<button class="wa-send" type="submit" aria-label="Отправить">→</button>' +
        '</form>' +
        '<p class="wa-foot">Поиск по 24 заметкам + бесплатная LLM. Не заменяет диагностику.</p>' +
        '<div class="wa-resize" title="Изменить размер" aria-hidden="true"></div>' +
      '</section>';
    document.body.appendChild(root);
    return root;
  }

  function openPanel() {
    if (!panel) return;
    // если панель утащили за пределы экрана — вернуть в видимую область
    var r = panel.getBoundingClientRect();
    var offscreen = r.right < 40 || r.bottom < 40 ||
      r.left > window.innerWidth - 40 || r.top > window.innerHeight - 40;
    if (offscreen) {
      panel.style.left = '';
      panel.style.top = '';
      panel.style.right = '1.25rem';
      panel.style.bottom = '5.5rem';
    }
    panel.hidden = false;
    if (input) input.focus();
  }

  function closePanel() {
    if (panel) panel.hidden = true;
  }

  function init() {
    var root = buildUI();
    panel = root.querySelector('.wa-panel');
    log = root.querySelector('.wa-log');
    input = root.querySelector('.wa-input');
    var form = root.querySelector('.wa-form');

    root.querySelector('.wa-launcher').addEventListener('click', function () {
      if (panel.hidden) openPanel(); else closePanel();
    });
    root.querySelector('.wa-close').addEventListener('click', closePanel);

    makeDraggable(panel, root.querySelector('.wa-head__drag'));
    makeResizable(panel, root.querySelector('.wa-resize'));
    restoreSize(panel);

    // внешние кнопки страницы
    ['wa-open-chat', 'wa-open-chat-2'].forEach(function (id) {
      var b = document.getElementById(id);
      if (b) b.addEventListener('click', openPanel);
    });
    window.WAOpenChat = openPanel;

    addMsg('bot',
      '<p>Привет! Спросите про ошибку установки, BIOS, драйверы, BSOD или диск.</p>' +
      '<p class="wa-hint">Например: «ошибка 0x80070002», «не видит диск при установке», «синий экран».</p>');

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var q = input.value.trim();
      if (!q) return;
      addMsg('user', '<p>' + escapeHtml(q) + '</p>');
      input.value = '';

      if (!ready) {
        addMsg('bot', '<p>База ещё загружается, секунду…</p>');
        return;
      }

      var hits = search(q, 3);
      if (!hits.length) {
        addMsg('bot', '<p>В базе нет подходящего материала. Уточните код ошибки или симптом.</p>');
        return;
      }

      var thinking = addMsg('bot', '<p class="wa-thinking">Думаю…</p>');

      askLLM(q, hits)
        .then(function (text) {
          thinking.innerHTML = renderAnswer(q, hits, text);
          bindAnswerLinks(thinking);
          log.scrollTop = log.scrollHeight;
        })
        .catch(function () {
          thinking.innerHTML = renderAnswer(q, hits, null) +
            '<p class="wa-answer__more">LLM недоступна — показан фрагмент из базы.</p>';
          bindAnswerLinks(thinking);
          log.scrollTop = log.scrollHeight;
        });
    });

    fetch(KB_URL)
      .then(function (r) { return r.json(); })
      .then(buildIndex)
      .catch(function () {
        addMsg('bot', '<p>Не удалось загрузить базу знаний.</p>');
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
