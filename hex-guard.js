// ============================================================
// hex-guard.js — Guardián de Campaña
// Agregar como PRIMER <script> en cada subpágina (estadisticas, misiones, etc.)
// <script src="../hex-guard.js"></script>   ← NO type="module"
// ============================================================
(function () {
    if (!localStorage.getItem('hex_selected')) {
        // Guardamos la URL actual para volver después de elegir campaña
        sessionStorage.setItem('hex_redirect_after_select', window.location.href);
        // Redirigir al selector (raíz del proyecto)
        const depth = window.location.pathname.split('/').filter(Boolean).length;
        const root = '../'.repeat(depth - 1) || './';
        window.location.replace(root + 'index.html');
    }
})();
