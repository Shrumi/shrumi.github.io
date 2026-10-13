/* ============================================================
   Дмитрий Скородько — shrumi.github.io
   Клиентские сценарии (Vanilla JS, без зависимостей):
     1. Параллакс фона
     2. mailto-фолбэк (копирование адреса + тост)
     3. Волновое покачивание подписи-водяного знака
   ============================================================ */

/* ============================================================
   1. Параллакс фона: SVG смещается медленнее скролла.
      rAF + pointer-events:none — без дёрганий и без перехвата кликов.
   ============================================================ */
(function () {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var bg = document.querySelector('.bg-art');
  if (!bg) return;
  var ticking = false;
  window.addEventListener('scroll', function () {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      bg.style.transform = 'translateY(' + (window.scrollY * 0.25) + 'px)';
      ticking = false;
    });
  }, { passive: true });
})();

/* ============================================================
   2. mailto-фолбэк: если почтовый клиент не настроен, клик
      «ничего не делает». Копируем адрес в буфер и показываем тост,
      чтобы контакт не терялся.
   ============================================================ */
(function () {
  var EMAIL = 'shrumi@yandex.ru';
  var toast = document.querySelector('.copy-toast');
  function showToast(msg) {
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('copy-toast--visible');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(function () {
      toast.classList.remove('copy-toast--visible');
    }, 2600);
  }
  document.querySelectorAll('a[href^="mailto:"]').forEach(function (link) {
    link.addEventListener('click', function () {
      // Копируем ПОЛНЫЙ mailto (с темой) — из буфера откроется письмо
      // с готовой темой, а сам адрес виден в начале строки.
      var href = link.getAttribute('href') || ('mailto:' + EMAIL);
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(link.href || href).then(function () {
          showToast('Скопировано в буфер: ' + EMAIL);
        }).catch(function () {});
      }
    });
  });
})();

/* ============================================================
   3. Подпись: разбиваем на буквы для волнового покачивания.
      Без JS (и при prefers-reduced-motion) текст остаётся статичным.
   ============================================================ */
(function () {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var note = document.querySelector('.made-with-ai');
  if (!note) return;
  var text = note.textContent;
  note.textContent = '';
  Array.prototype.forEach.call(text, function (ch, i) {
    var s = document.createElement('span');
    s.className = 'made-with-ai__char';
    s.textContent = ch === ' ' ? '\u00A0' : ch;
    s.style.animationDelay = (i * 0.14) + 's';
    note.appendChild(s);
  });
})();
