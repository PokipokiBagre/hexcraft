// ============================================================
// personajes-mobile-patch.js
// Añadir al final del <body> DESPUÉS de personajes-main.js:
// <script type="module" src="personajes-mobile-patch.js"></script>
// ============================================================

const _isMob = () => window.innerWidth <= 700;

// ── Parche al _renderTab original ────────────────────────────
// Interceptamos window._ppjCambiarTab que ya existe como global
const _origCambiarTab = window._ppjCambiarTab;
window._ppjCambiarTab = function(nombre, tab) {
    _origCambiarTab?.(nombre, tab);
    if (_isMob()) _mobAjustarLayout(tab);
};

// También parcheamos abrirDetalle para ajustar al abrir
const _origAbrirDetalle = window.abrirDetalle;
window.abrirDetalle = function(nombre) {
    _origAbrirDetalle?.(nombre);
    if (_isMob()) {
        // Pequeño delay para que el DOM se pinte primero
        setTimeout(() => _mobInicializar(nombre), 60);
    }
};

// ── Inicializar panel en móvil ────────────────────────────────
function _mobInicializar(nombre) {
    _mobAjustarLayout('stats');
    _mobInsertarToggleStatsHex(nombre);
}

// ── Ajustar layout según la tab activa ───────────────────────
function _mobAjustarLayout(tab) {
    if (!_isMob()) return;
    const colStats = document.getElementById('ppj-col-stats');
    const colMain  = document.getElementById('ppj-col-main');
    if (!colStats) return;

    if (tab === 'stats') {
        // Stats: col-stats arriba (header+tabs+stats), col-main abajo (HEX)
        colStats.classList.remove('solo-stats');
        colStats.style.maxHeight = '45vh';
        colStats.style.bottom    = 'auto';
        colStats.style.overflowY = 'hidden';
        if (colMain) {
            colMain.style.display = 'flex';
            colMain.style.height  = '55vh';
            colMain.style.top     = 'auto';
        }
        // Mostrar toggle Stats↔HEX si existe
        _mobToggleVisibility(true);

    } else {
        // Hechizos / Objetos / Misiones:
        // col-stats ocupa todo (contiene la tab cargada en ppj-body)
        colStats.classList.add('solo-stats');
        colStats.style.maxHeight = '92vh';
        colStats.style.bottom    = '0';
        colStats.style.overflowY = 'auto';
        if (colMain) colMain.style.display = 'none';
        // Ocultar toggle
        _mobToggleVisibility(false);
    }
}

// ── Toggle Stats ↔ HEX dentro del tab Stats ──────────────────
let _mobStatsView = 'stats'; // 'stats' | 'hex'

function _mobToggleVisibility(show) {
    const tog = document.getElementById('mob-stats-hex-toggle');
    if (tog) tog.style.display = show ? 'flex' : 'none';
}

function _mobInsertarToggleStatsHex(nombre) {
    // Quitar toggle anterior si existe
    document.getElementById('mob-stats-hex-toggle')?.remove();

    const tabs = document.getElementById('ppj-tabs');
    if (!tabs) return;

    const tog = document.createElement('div');
    tog.id = 'mob-stats-hex-toggle';
    tog.className = 'mob-tab-toggle';
    tog.innerHTML = `
        <button class="mob-tab-toggle-btn active" id="mob-btn-stats"
            onclick="window._mobMostrar('stats','${nombre.replace(/'/g,"\\'")}')">
            Vitalidad
        </button>
        <button class="mob-tab-toggle-btn" id="mob-btn-hex"
            onclick="window._mobMostrar('hex','${nombre.replace(/'/g,"\\'")}')">
            HEX &amp; VEX
        </button>`;

    // Insertar DESPUÉS de los tabs principales
    tabs.insertAdjacentElement('afterend', tog);
    _mobStatsView = 'stats';
    _mobMostrarStats();
}

window._mobMostrar = function(vista, nombre) {
    if (!_isMob()) return;
    _mobStatsView = vista;
    document.getElementById('mob-btn-stats')?.classList.toggle('active', vista === 'stats');
    document.getElementById('mob-btn-hex')?.classList.toggle('active', vista === 'hex');

    if (vista === 'stats') {
        _mobMostrarStats();
    } else {
        _mobMostrarHex(nombre);
    }
};

function _mobMostrarStats() {
    const statsBody = document.getElementById('ppj-stats-body');
    const colMain   = document.getElementById('ppj-col-main');
    if (statsBody) statsBody.style.display = '';
    if (colMain)   colMain.style.display   = 'none';

    // col-stats crece para mostrar stats completos
    const colStats = document.getElementById('ppj-col-stats');
    if (colStats) {
        colStats.style.maxHeight = '92vh';
        colStats.style.bottom    = '0';
        colStats.style.overflowY = 'auto';
    }
}

function _mobMostrarHex(nombre) {
    const statsBody = document.getElementById('ppj-stats-body');
    const colMain   = document.getElementById('ppj-col-main');
    if (statsBody) statsBody.style.display = 'none';
    if (colMain) {
        colMain.style.display = 'flex';
        colMain.style.height  = '92vh';
        colMain.style.top     = '0';
        colMain.style.bottom  = '0';
    }

    // col-stats se reduce al mínimo (header + tabs + toggle)
    const colStats = document.getElementById('ppj-col-stats');
    if (colStats) {
        colStats.style.maxHeight = 'auto';
        colStats.style.bottom    = 'auto';
        colStats.style.overflowY = 'hidden';
    }
}

// ── Parche: cuando tab=hechizos, evitar que abrirMinimapa
//    rompa el layout en móvil (el mapa queda oculto via CSS,
//    pero el JS puede mover elementos del DOM)
// ── El minimapa ya se oculta via CSS. No hace falta más. ─────

// ── Re-ajustar en resize (si rotan el teléfono) ──────────────
window.addEventListener('resize', () => {
    const nombre = window._estadoUI?.pjSeleccionado
                || window.estadoUI?.pjSeleccionado;
    if (!nombre) return;
    const tab = window._tabActivo?.[nombre] || 'stats';
    if (_isMob()) {
        _mobAjustarLayout(tab);
    } else {
        // Restaurar desktop: quitar overrides inline
        const colStats = document.getElementById('ppj-col-stats');
        const colMain  = document.getElementById('ppj-col-main');
        document.getElementById('mob-stats-hex-toggle')?.remove();
        if (colStats) { colStats.style.cssText = ''; colStats.style.display = 'flex'; }
        if (colMain  && tab === 'stats') { colMain.style.cssText = ''; colMain.style.display = 'flex'; }
    }
}, { passive: true });
