// Efectos visuales globales: onda al hacer clic en los botones (como en CitrusCode).
export function iniciarEfectos() {
  const reducir = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (reducir) return;
  document.addEventListener('pointerdown', (e) => {
    const b = e.target.closest?.('.btn, .tabs button, .step button, .icon-btn');
    if (!b || b.disabled) return;
    const r = b.getBoundingClientRect();
    const d = Math.max(r.width, r.height) * 2;
    const s = document.createElement('span');
    s.className = 'ripple';
    s.style.cssText = `width:${d}px;height:${d}px;left:${e.clientX - r.left - d / 2}px;top:${e.clientY - r.top - d / 2}px`;
    if (getComputedStyle(b).position === 'static') b.style.position = 'relative';
    b.style.overflow = 'hidden';
    b.appendChild(s);
    setTimeout(() => s.remove(), 650);
  });
}
