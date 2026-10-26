const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
const header = document.querySelector('[data-header]');

const updateHeader = () => header?.classList.toggle('is-scrolled', window.scrollY > 16);
updateHeader();
window.addEventListener('scroll', updateHeader, { passive: true });

for (const button of document.querySelectorAll('[data-magnetic]')) {
  const reset = () => {
    button.style.removeProperty('--magnet-x');
    button.style.removeProperty('--magnet-y');
  };
  button.addEventListener('pointermove', (event) => {
    if (reduceMotion.matches || !finePointer.matches || event.pointerType === 'touch') return;
    const rect = button.getBoundingClientRect();
    const x = Math.max(-4, Math.min(4, (event.clientX - rect.left - rect.width / 2) * .07));
    const y = Math.max(-3, Math.min(3, (event.clientY - rect.top - rect.height / 2) * .1));
    button.style.setProperty('--magnet-x', `${x}px`);
    button.style.setProperty('--magnet-y', `${y}px`);
  });
  button.addEventListener('pointerleave', reset);
  button.addEventListener('blur', reset);
  reduceMotion.addEventListener('change', reset);
}

const terminal = document.querySelector('[data-terminal]');
const expand = document.querySelector('[data-terminal-expand]');
const extraCode = document.getElementById('extra-code');
const terminalStatus = document.querySelector('[data-terminal-status]');

expand?.addEventListener('click', () => {
  const expanded = expand.getAttribute('aria-expanded') !== 'true';
  expand.setAttribute('aria-expanded', String(expanded));
  expand.setAttribute('aria-label', expanded ? 'Свернуть фрагмент кода' : 'Развернуть фрагмент кода');
  expand.title = expanded ? 'Свернуть код' : 'Развернуть код';
  if (extraCode) extraCode.hidden = !expanded;
  if (terminalStatus) terminalStatus.textContent = expanded ? 'Показан полный фрагмент кода.' : 'Фрагмент кода свёрнут.';
});

const run = document.querySelector('[data-terminal-run]');
const output = document.getElementById('terminal-output');
run?.addEventListener('click', () => {
  const expanded = run.getAttribute('aria-expanded') !== 'true';
  run.setAttribute('aria-expanded', String(expanded));
  if (output) output.hidden = !expanded;
  if (terminalStatus) terminalStatus.textContent = expanded ? 'Доступны две игры: LifeSim и Deadweed.' : 'Ссылки на игры скрыты.';
});

const handle = document.querySelector('[data-drag-handle]');
let drag = null;
const resetDrag = () => {
  if (drag && handle?.hasPointerCapture(drag.id)) handle.releasePointerCapture(drag.id);
  drag = null;
  terminal?.classList.remove('is-dragging');
  terminal?.style.removeProperty('--drag-x');
  terminal?.style.removeProperty('--drag-y');
};
handle?.addEventListener('pointerdown', (event) => {
  if (!terminal || reduceMotion.matches || !finePointer.matches || event.button !== 0 || event.target.closest('button')) return;
  drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
  handle.setPointerCapture(event.pointerId);
  terminal.classList.add('is-dragging');
});
handle?.addEventListener('pointermove', (event) => {
  if (!drag || event.pointerId !== drag.id) return;
  const x = Math.max(-18, Math.min(18, (event.clientX - drag.x) * .3));
  const y = Math.max(-12, Math.min(12, (event.clientY - drag.y) * .3));
  terminal.style.setProperty('--drag-x', `${x}px`);
  terminal.style.setProperty('--drag-y', `${y}px`);
});
handle?.addEventListener('pointerup', resetDrag);
handle?.addEventListener('pointercancel', resetDrag);
handle?.addEventListener('lostpointercapture', () => {
  drag = null;
  terminal?.classList.remove('is-dragging');
  terminal?.style.removeProperty('--drag-x');
  terminal?.style.removeProperty('--drag-y');
});
window.addEventListener('blur', resetDrag);
reduceMotion.addEventListener('change', resetDrag);

if ('IntersectionObserver' in window && !reduceMotion.matches) {
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('is-revealed');
      observer.unobserve(entry.target);
    }
  }, { threshold: .06 });
  for (const element of document.querySelectorAll('[data-reveal]')) observer.observe(element);
  document.documentElement.classList.add('motion-ready');
}
