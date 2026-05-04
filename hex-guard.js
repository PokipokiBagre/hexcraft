// ============================================================
// hex-guard.js — Guardián de Campaña
// Agregar como PRIMER <script> en cada subpágina.
// <script src="../hex-guard.js"></script>   ← NO type="module"
//
// Comportamiento:
//   1. Si hay campaña seleccionada → no hace nada, la página carga normal.
//   2. Si NO hay campaña seleccionada → guarda la URL completa actual
//      (con query params y hash) en sessionStorage, y redirige al index
//      principal para que el usuario elija campaña.
//   3. Al elegir campaña, el index lee sessionStorage y devuelve al usuario
//      exactamente a la URL que intentaba visitar.
//
// Ejemplo del caso descrito:
//   Usuario visita: /personajes/index.html?pj=postrimeria
//   → No hay campaña → guard guarda esa URL → redirige a /index.html
//   → Usuario elige "HEX 1" → index redirige a /personajes/index.html?pj=postrimeria
//   → Ahora la página carga con la campaña correcta y el parámetro intacto.
// ============================================================
(function () {
    if (localStorage.getItem('hex_selected')) return; // Campaña ya seleccionada, continuar.

    // Guardar la URL completa que el usuario intentó visitar
    sessionStorage.setItem('hex_redirect_after_select', window.location.href);

    // Calcular la ruta al index raíz de forma robusta
    // Tomamos el pathname, lo dividimos, y subimos tantos niveles como carpetas haya.
    const segments = window.location.pathname
        .split('/')
        .filter(Boolean);          // ['personajes', 'index.html'] por ejemplo

    // Si estamos en la raíz (0 o 1 segmentos), el index está aquí mismo
    const niveles = Math.max(0, segments.length - 1);
    const root    = niveles > 0 ? '../'.repeat(niveles) : './';

    window.location.replace(root + 'index.html');
})();
