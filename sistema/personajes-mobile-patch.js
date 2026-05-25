// ============================================================
// personajes-mobile-patch.js  v3
// Añadir al final del <body>:
// <script type="module" src="personajes-mobile-patch.js"></script>
// ============================================================

const _isMob = () => window.innerWidth <= 700;

// Estado móvil
const _mob = { tab: 'stats', subtab: 0, pj: null };

// Subtabs por tab principal
const _SUBTABS = {
    stats:    ['Vitalidad', 'HEX & VEX'],
    hechizos: ['Grimorio', 'Mapa'],
    objetos:  ['Inventario', 'Catálogo'],
    misiones: ['Misiones'],
};

// ── Interceptar apertura de panel ────────────────────────────
const _origAbrirDetalle = window.abrirDetalle;
window.abrirDetalle = function(nombre) {
    _origAbrirDetalle?.(nombre);
    if (_isMob()) {
        _mob.pj = nombre; _mob.tab = 'stats'; _mob.subtab = 0;
        setTimeout(() => _mobSetup(nombre, 'stats'), 80);
    }
};

const _origCambiarTab = window._ppjCambiarTab;
window._ppjCambiarTab = function(nombre, tab) {
    _origCambiarTab?.(nombre, tab);
    if (_isMob()) {
        _mob.pj = nombre; _mob.tab = tab; _mob.subtab = 0;
        setTimeout(() => _mobSetup(nombre, tab), 80);
    }
};

// ── Setup: insertar subtabs + mostrar contenido correcto ─────
function _mobSetup(nombre, tab) {
    if (!_isMob()) return;
    _ensureColStatsFullscreen();
    _renderSubtabs(nombre, tab);
    _renderContent(nombre, tab, 0);
}

// col-stats ocupa toda la pantalla
function _ensureColStatsFullscreen() {
    const cs = document.getElementById('ppj-col-stats');
    if (!cs) return;
    cs.style.cssText = [
        'position:fixed', 'inset:0', 'width:100vw', 'min-width:0',
        'height:100dvh', 'border-left:none', 'overflow:hidden',
        'display:flex', 'flex-direction:column', 'z-index:1200',
    ].join('!important;') + '!important';
    // col-main siempre oculto
    const cm = document.getElementById('ppj-col-main');
    if (cm) cm.style.cssText = 'display:none!important';
}

// ── Subtabs ───────────────────────────────────────────────────
function _renderSubtabs(nombre, tab) {
    document.getElementById('mob-subtabs')?.remove();
    const labels = _SUBTABS[tab] || [];
    if (labels.length <= 1) return;

    const bar = document.createElement('div');
    bar.id = 'mob-subtabs';
    bar.innerHTML = labels.map((lbl, i) =>
        `<button class="mob-subtab${i===0?' active':''}"
            onclick="window._mobClickSubtab(${i})">${lbl}</button>`
    ).join('');

    const tabsEl = document.getElementById('ppj-tabs');
    if (tabsEl) tabsEl.insertAdjacentElement('afterend', bar);
}

window._mobClickSubtab = function(idx) {
    if (!_isMob()) return;
    _mob.subtab = idx;
    document.querySelectorAll('.mob-subtab')
        .forEach((b, i) => b.classList.toggle('active', i === idx));
    _renderContent(_mob.pj, _mob.tab, idx);
};

// ── Contenido según tab + subtab ─────────────────────────────
function _renderContent(nombre, tab, subtabIdx) {
    if (!_isMob()) return;

    const ppjBody   = document.getElementById('ppj-body');
    const statsBody = document.getElementById('ppj-stats-body');

    // Asegurar que ppj-body es scrollable y visible
    if (ppjBody) {
        ppjBody.style.cssText = 'display:flex!important;flex-direction:column!important;flex:1!important;overflow-y:auto!important;-webkit-overflow-scrolling:touch!important;padding-bottom:24px!important;';
    }
    // statsBody siempre oculto (lo usamos como fuente, no como display)
    if (statsBody) statsBody.style.display = 'none';

    if (tab === 'stats') {
        if (subtabIdx === 0) {
            // Vitalidad: copiar desde statsBody (ya renderizado por el engine)
            if (ppjBody && statsBody) {
                // Si statsBody está vacío, forzar re-render
                if (!statsBody.innerHTML.trim()) {
                    ppjBody.innerHTML = '<div class="ppj-loader">Cargando stats…</div>';
                    // El engine lo llenará en el próximo tick del refresh
                    setTimeout(() => {
                        if (statsBody.innerHTML.trim()) ppjBody.innerHTML = statsBody.innerHTML;
                    }, 300);
                } else {
                    ppjBody.innerHTML = statsBody.innerHTML;
                }
            }
        } else {
            // HEX & VEX: duplicar el hexBody renderizado
            const hexBody = document.getElementById('ppj-hex-body');
            if (ppjBody && hexBody) {
                ppjBody.innerHTML = hexBody.innerHTML;
                // Re-adjuntar eventos del canvas: el canvas de partículas
                // no se puede clonar, así que mostramos un placeholder
                const canvas = ppjBody.querySelector('.htab-particle-canvas');
                if (canvas) canvas.style.display = 'none'; // ocultar canvas roto
            }
        }

    } else if (tab === 'hechizos' && subtabIdx === 1) {
        // Mapa no disponible en móvil
        if (ppjBody) ppjBody.innerHTML = `
            <div style="text-align:center;padding:48px 20px;color:#4a4a68;">
                <div style="font-size:2em;margin-bottom:14px;opacity:0.35;">🗺️</div>
                <div style="font-size:0.8em;line-height:1.7;color:#5a5a78;">
                    El mapa de hechizos no está disponible en móvil.<br>
                    <span style="color:#d4af37;opacity:0.6;">Usa el Grimorio para navegar tus hechizos.</span>
                </div>
            </div>`;
    }
    // Para hechizos subtab 0, objetos y misiones:
    // ppj-body ya tiene el contenido cargado por el engine — no tocar.
}

// ── Sincronizar vitalidad tras refreshPanelPJ ────────────────
const _origRefresh = window.refreshPanelPJ;
window.refreshPanelPJ = function() {
    _origRefresh?.();
    if (_isMob() && _mob.tab === 'stats' && _mob.subtab === 0) {
        setTimeout(() => {
            const ppjBody   = document.getElementById('ppj-body');
            const statsBody = document.getElementById('ppj-stats-body');
            if (ppjBody && statsBody?.innerHTML.trim()) {
                ppjBody.innerHTML = statsBody.innerHTML;
            }
        }, 150);
    }
};

// ── Resize ───────────────────────────────────────────────────
window.addEventListener('resize', () => {
    if (!_isMob()) {
        document.getElementById('mob-subtabs')?.remove();
        ['ppj-col-stats','ppj-col-main'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.cssText = '';
        });
    } else if (_mob.pj) {
        _mobSetup(_mob.pj, _mob.tab);
    }
}, { passive: true });
