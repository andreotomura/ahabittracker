/*
 * ui.js — DOM helpers, modal system, toasts, dialogs.
 * Attaches to the global `UI` namespace.
 */
'use strict';

const UI = (() => {
  const q = (sel, root = document) => root.querySelector(sel);
  const qa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const el = (tag, attrs = {}, ...children) => {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') node.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
      else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
      else if (k === 'html') node.innerHTML = v;
      else if (v !== false && v != null) node.setAttribute(k, v === true ? '' : v);
    }
    for (const c of children.flat()) {
      if (c == null || c === false) continue;
      node.append(c.nodeType ? c : document.createTextNode(c));
    }
    return node;
  };

  /* ---------------- Toasts ---------------- */

  const toast = (msg, type = 'ok', ms = 2600) => {
    const root = q('#toast-root');
    const t = el('div', { class: `toast ${type}`, role: 'status' }, msg);
    root.appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => {
      t.classList.remove('show');
      setTimeout(() => t.remove(), 300);
    }, ms);
  };

  /* ---------------- Modal system ---------------- */

  const overlay = el('div', { class: 'modal-overlay', id: 'modal' });
  const modalRoot = () => q('#modal-root');

  function openModal(bodyNode) {
    const root = modalRoot();
    root.innerHTML = '';
    overlay.innerHTML = '';
    overlay.appendChild(bodyNode);
    bodyNode.classList.add('modal');
    bodyNode.classList.add('modal-enter');
    root.appendChild(overlay);
    requestAnimationFrame(() => {
      overlay.classList.add('open');
      document.body.classList.add('modal-open');
    });
  }

  /** Replace the content of the currently open modal (for live-updating forms). */
  function updateModal(bodyNode) {
    const current = q('#modal .modal');
    if (!current) return openModal(bodyNode);
    const fresh = bodyNode;
    fresh.classList.add('modal');
    current.replaceWith(fresh);
  }

  function closeModal() {
    const overlayEl = q('#modal');
    if (!overlayEl) return;
    overlayEl.classList.remove('open');
    document.body.classList.remove('modal-open');
    setTimeout(() => { overlayEl.remove(); }, 220);
  }

  function modalShell({ title, body, footer }) {
    return el('div', { class: 'modal-inner', role: 'dialog', 'aria-modal': 'true' },
      el('div', { class: 'modal-head' },
        el('h3', {}, title),
        el('button', { class: 'icon-btn', 'aria-label': 'Close', title: 'Close', onclick: closeModal }, '✕'),
      ),
      el('div', { class: 'modal-body' }, body),
      footer ? el('div', { class: 'modal-foot' }, footer) : null,
    );
  }

  /* ---------------- Dialogs ---------------- */

  /** Resolves `true`/`false` — used for destructive confirmations. */
  function confirmDialog({ title, message, confirmText = 'Confirm', danger = false }) {
    return new Promise((resolve) => {
      const body = el('p', { class: 'dialog-msg' }, message);
      const foot = el('div', { class: 'btn-row' },
        el('button', { class: 'btn ghost', onclick: () => { closeModal(); resolve(false); } }, 'Cancel'),
        el('button', {
          class: `btn ${danger ? 'danger' : 'primary'}`,
          onclick: () => { closeModal(); resolve(true); },
        }, confirmText),
      );
      openModal(modalShell({ title, body, footer: foot }));
    });
  }

  /** Resolves one of `options` (array of {label, value, danger}) or null on cancel. */
  function choiceDialog({ title, message, options }) {
    return new Promise((resolve) => {
      const body = el('p', { class: 'dialog-msg' }, message);
      const foot = el('div', { class: 'btn-row' },
        el('button', { class: 'btn ghost', onclick: () => { closeModal(); resolve(null); } }, 'Cancel'),
        ...options.map((o) => el('button', {
          class: `btn ${o.danger ? 'danger' : 'primary'}`,
          onclick: () => { closeModal(); resolve(o.value); },
        }, o.label)),
      );
      openModal(modalShell({ title, body, footer: foot }));
    });
  }

  return { q, qa, el, toast, openModal, updateModal, closeModal, confirmDialog, choiceDialog, modalShell };
})();