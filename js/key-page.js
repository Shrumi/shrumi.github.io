/**
 * Страница «Запрос ключа активации» (photon-key/).
 * Логика: Machine ID из хеша URL (#mid=XXXX-XXXX-XXXX),
 * копирование ID и готового письма в буфер обмена.
 */
(function () {
  'use strict';

  var EMAIL = 'shrumi@yandex.ru';
  var SUBJECT = 'Запрос ключа ФОТОН';

  var mid = document.getElementById('mid');
  var statusBox = document.getElementById('status');

  /** Временное сообщение под формой. */
  function showStatus(text) {
    statusBox.textContent = text;
    setTimeout(function () { statusBox.textContent = ''; }, 2500);
  }

  /* Копирование в буфер с fallback для старых браузеров */
  function copyText(text, onDone) {
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch (e) { /* noop */ }
      document.body.removeChild(ta);
      onDone();
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(onDone, fallback);
    } else {
      fallback();
    }
  }

  /* Machine ID из хеша: #mid=XXXX-XXXX-XXXX */
  var midValue = '—';
  var match = window.location.hash.match(/mid=([A-Za-z0-9-]+)/);
  if (match) midValue = match[1].toUpperCase();
  mid.textContent = midValue;

  /* Клик по самому ID копирует его */
  mid.addEventListener('click', function () {
    copyText(midValue, function () {
      showStatus('Machine ID скопирован');
    });
  });

  /* Клавиатурный доступ: Enter/Space на ID */
  mid.addEventListener('keydown', function (event) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      mid.click();
    }
  });

  /* Кнопка «Скопировать письмо» — готовый текст заявки */
  document.getElementById('btnCopyLetter').addEventListener('click', function () {
    var letter = 'Тема: ' + SUBJECT + '\n\nMachine ID: ' + midValue +
      '\n\nПрошу выдать ключ активации калькулятора прайса фотосалона.';
    copyText(letter, function () {
      showStatus('Письмо скопировано — вставьте в почту и отправьте');
    });
  });

  /* Кнопка «Открыть почту»: копирует mailto-ссылку (клиент может не открыться) */
  document.getElementById('btnMail').addEventListener('click', function (event) {
    event.preventDefault();
    var mailto = 'mailto:' + EMAIL +
      '?subject=' + encodeURIComponent(SUBJECT) +
      '&body=' + encodeURIComponent('Machine ID: ' + midValue +
        '\n\nПрошу выдать ключ активации калькулятора прайса фотосалона.');
    copyText(mailto, function () {
      showStatus('Адрес и ссылка скопированы в буфер обмена');
    });
  });
})();
