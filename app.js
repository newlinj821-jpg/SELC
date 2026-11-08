/* SELC initial public shell: no credentials or private data handled on this page. */
(() => {
  'use strict';
  const $ = (selector) => document.querySelector(selector);
  const nav = $('#siteNav');
  const toggle = $('#menuToggle');
  const dialog = $('#accessDialog');
  const year = $('#year');
  if (year) year.textContent = String(new Date().getFullYear());

  function closeMenu() {
    if (!nav || !toggle) return;
    nav.classList.remove('open');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Open navigation');
  }

  if (toggle && nav) {
    toggle.addEventListener('click', () => {
      const open = !nav.classList.contains('open');
      nav.classList.toggle('open', open);
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
    });
    nav.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
  }
  if (dialog && typeof dialog.showModal === 'function') {
    document.querySelectorAll('[data-open-login]').forEach(button => {
      button.addEventListener('click', () => {
        closeMenu();
        if (!dialog.open) dialog.showModal();
      });
    });
    $('#closeDialog')?.addEventListener('click', () => dialog.close());
    $('#dismissDialog')?.addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', event => {
      if (event.target === dialog) dialog.close();
    });
  }
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeMenu();
  });
})();
