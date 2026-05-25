// ============================================================
// personajes-mobile-patch.js  v9
//
// Cambios vs v8:
//  - Panel izq (Obj/Mis) y mapa ya NO usan `top:0; padding-top:132px`.
//    Ahora usan `top: [altura medida]` (medida en runtime con
//    _alturaCabecera()), exactamente debajo del header+tabs+subtabs.
//  - z-index del panel izq y mapa bajó a 1210 (col-stats sigue en
//    1200, así no tapan el header del col-stats que queda encima
//    en su propia área).
//  - ppj-body.visibility = 'hidden' al entrar en subtab "Catálogo"
//    (Obj/Mis) o "Mapa" (Hechizos).  Esto previene que el grimorio
//    o el inventario asomen por gaps de píxeles entre subtabs y
//    el panel/mapa, especialmente cuando scrollIntoView del callback
//    de selección desplaza una card a posición visible.
//
// <script type="module" src="personajes-mobile-patch.js"></script>
// ============================================================

const DBG = true;
const _log = (...args) => { if (DBG) console.log('[hxmob]', ...args); };

const _isMob = () => window.innerWidth <= 700;
const _mob = { tab: 'stats', subtab: 0, pj: null };
let _touchInstalled = false;
let _intercepted = false;

const _SUBTABS = {
    stats:    ['Vitalidad', 'HEX & VEX'],
    hechizos: ['Grimorio',  'Mapa'],
    objetos:  ['Inventario','Catálogo'],
    misiones: ['Mis misiones','Catálogo'],
};

// IDs de elementos que el patch controla con .mob-shown
const _MOB_TARGETS = ['ppj-obj-panel-izq', 'ppj-mis-panel-izq', 'pmh-panel'];

// ────────────────────────────────────────────────────────────
// CSS de override: inyectado al cargar el patch.  Como se añade
// al final del <head>, vence a las reglas inyectadas en runtime
// por panel-pj.js (línea 1818), panel-mis.js (línea 72) y por
// panel-mapa-hechizos.js (que NO usa !important).
// ────────────────────────────────────────────────────────────
function _inyectarCssOverride() {
    if (document.getElementById('hxmob-overrides')) return;
    const st = document.createElement('style');
    st.id = 'hxmob-overrides';
    st.textContent = `
@media (max-width: 700px) {
  /* === Paneles izq de objetos / misiones === */
  /* Ocultos por defecto: las reglas dinámicas inyectadas por
     panel-pj.js (línea 1818) y panel-mis.js (línea 72) ya hacen
     display:none — esta es defensa adicional sin !important para
     que la clase .mob-shown gane por especificidad. */
  #ppj-obj-panel-izq,
  #ppj-mis-panel-izq {
    display: none;
  }
  /* IMPORTANTE: el panel izq debe quedar DEBAJO del header+tabs+subtabs.
     El "top" se setea dinámicamente vía inline style desde JS para
     ajustarse a la altura real de la cabecera (medida en runtime).
     Aquí solo configuramos lo invariante. */
  #ppj-obj-panel-izq.mob-shown,
  #ppj-mis-panel-izq.mob-shown {
    display: flex !important;
    position: fixed !important;
    left: 0 !important; right: 0 !important;
    bottom: 0 !important;
    width: 100vw !important;
    max-width: 100vw !important;
    min-width: 0 !important;
    z-index: 1210 !important;     /* DEBAJO del col-stats (1200) NO,
                                     necesitamos que asome bajo el header.
                                     Pero z-index entre paneles izq:
                                     1210 < col-stats overlay (1200) sería
                                     incorrecto. Mejor: 1210 > 1200 = el
                                     panel está encima en su área. Como
                                     no comparten área (panel empieza
                                     bajo el header), no hay solapamiento
                                     visual. */
    border: none !important;
    border-right: none !important;
    border-left: none !important;
    box-shadow: none !important;
    flex-direction: column !important;
    background: #050510 !important;
    padding-top: 0 !important;
    box-sizing: border-box !important;
  }

  /* === Mapa de hechizos === */
  #pmh-panel {
    display: none;
  }
  #pmh-panel.mob-shown {
    display: flex !important;
    position: fixed !important;
    left: 0 !important; right: 0 !important;
    bottom: 0 !important;
    width: 100vw !important;
    min-width: 0 !important;
    max-width: 100vw !important;
    height: auto !important;
    z-index: 1210 !important;
    border-right: none !important;
    box-shadow: none !important;
    flex-direction: column !important;
    animation: none !important;
    transform: none !important;
    background: #050510 !important;
  }

  /* La cabecera fija (col-stats con header+tabs+subtabs) debe tener
     fondo opaco y z-index alto para tapar cualquier contenido detrás
     en la zona superior. */
  #ppj-col-stats {
    background: #050510 !important;
  }
  #ppj-header, #ppj-tabs, #mob-subtabs {
    background: #050510 !important;
  }
}
`;
    document.head.appendChild(st);
    _log('CSS override inyectado');
}

function _limpiarMobShown() {
    _MOB_TARGETS.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.classList.remove('mob-shown');
            // Limpiar inline styles que v6 podía haber dejado
            if (el.style.cssText) el.style.cssText = '';
        }
    });
}

function _aplicarMobShown(id) {
    _MOB_TARGETS.forEach(targetId => {
        const el = document.getElementById(targetId);
        if (!el) return;
        // Limpiar inline styles antes de aplicar la clase, evitando
        // que estilos viejos de v6 (inline) batan al CSS
        if (el.style.cssText) el.style.cssText = '';
        if (targetId === id) {
            el.classList.add('mob-shown');
            // top dinámico: medir la altura real de header+tabs+subtabs
            const topPx = _alturaCabecera();
            el.style.top = topPx + 'px';
            _log('mob-shown +', targetId, '@ top=', topPx);
        } else {
            el.classList.remove('mob-shown');
        }
    });
}

// Mide la altura efectiva de la cabecera fija (header del PJ + tabs
// principales + subtabs móvil) para alinear el top del panel izq y
// del mapa exactamente debajo, sin huecos ni solapamientos.
function _alturaCabecera() {
    const cs = document.getElementById('ppj-col-stats');
    if (!cs) return 132;
    const header = cs.querySelector('#ppj-header');
    const tabs   = cs.querySelector('#ppj-tabs');
    const subs   = document.getElementById('mob-subtabs');
    let h = 0;
    if (header) h += header.offsetHeight;
    if (tabs)   h += tabs.offsetHeight;
    if (subs)   h += subs.offsetHeight;
    // Fallback razonable si por algún motivo las medidas son 0
    return h > 40 ? h : 132;
}

// ── Instalar interceptores DESPUÉS de que los módulos carguen ─
function _instalarInterceptores() {
    if (_intercepted) return;
    _intercepted = true;
    _log('Interceptores instalados');

    const _origAbrirDetalle = window.abrirDetalle;
    window.abrirDetalle = function(nombre) {
        _origAbrirDetalle?.(nombre);
        if (_isMob()) {
            _mob.pj = nombre; _mob.tab = 'stats'; _mob.subtab = 0;
            _limpiarMobShown();
            setTimeout(() => _mobSetup(nombre, 'stats'), 80);
        }
    };

    const _origCambiarTab = window._ppjCambiarTab;
    window._ppjCambiarTab = function(nombre, tab) {
        _origCambiarTab?.(nombre, tab);
        if (_isMob()) {
            _log('CambiarTab →', tab);
            _mob.pj = nombre; _mob.tab = tab; _mob.subtab = 0;
            _limpiarMobShown();
            setTimeout(() => _mobSetup(nombre, tab), 120);
        }
    };

    const _origCerrar = window.cerrarPanelPJ;
    window.cerrarPanelPJ = function() {
        _limpiarMobShown();
        document.getElementById('mob-subtabs')?.remove();
        _origCerrar?.();
    };

    const _origRefresh = window.refreshPanelPJ;
    if (typeof _origRefresh === 'function') {
        window.refreshPanelPJ = function() {
            _origRefresh();
            if (_isMob() && _mob.tab === 'stats' && _mob.subtab === 0) {
                setTimeout(() => {
                    const ppjBody   = document.getElementById('ppj-body');
                    const statsBody = document.getElementById('ppj-stats-body');
                    if (ppjBody && statsBody?.innerHTML.trim())
                        ppjBody.innerHTML = statsBody.innerHTML;
                }, 150);
            }
        };
    }
}

// Inyectar CSS de inmediato
_inyectarCssOverride();

// Fallback: capturar clics en las tabs principales por delegación
// SÓLO cuando el interceptor de _ppjCambiarTab aún no se haya
// instalado.  Esto evita doble setup cuando todo funciona normal.
document.addEventListener('click', (e) => {
    if (!_isMob() || _intercepted) return;
    const tab = e.target.closest('.ppj-tab');
    if (!tab) return;
    const onclick = tab.getAttribute('onclick') || '';
    const m = onclick.match(/_ppjCambiarTab\(['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]/);
    if (!m) return;
    const [, nombre, tabId] = m;
    _log('Click tab (delegación fallback) →', tabId);
    _mob.pj = nombre; _mob.tab = tabId; _mob.subtab = 0;
    _limpiarMobShown();
    setTimeout(() => _mobSetup(nombre, tabId), 150);
}, true);

// Esperar a que los módulos ES expongan funciones globales
const _waitForModules = setInterval(() => {
    if (typeof window._ppjCambiarTab === 'function' &&
        typeof window.abrirDetalle === 'function') {
        clearInterval(_waitForModules);
        _instalarInterceptores();
    }
}, 50);
setTimeout(() => { clearInterval(_waitForModules); _instalarInterceptores(); }, 3000);

// ── Setup tras cambio de tab principal ────────────────────────
function _mobSetup(nombre, tab) {
    if (!_isMob()) return;
    _ensureFullscreen();
    _renderSubtabs(nombre, tab);
    setTimeout(() => _renderContent(nombre, tab, 0), 120);
}

function _ensureFullscreen() {
    const cs = document.getElementById('ppj-col-stats');
    if (!cs) return;
    Object.assign(cs.style, {
        position:'fixed', inset:'0', width:'100vw', minWidth:'0',
        height:'100dvh', borderLeft:'none', overflow:'hidden',
        display:'flex', flexDirection:'column', zIndex:'1200'
    });
    const cm = document.getElementById('ppj-col-main');
    if (cm) cm.style.display = 'none';
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
    document.getElementById('ppj-tabs')?.insertAdjacentElement('afterend', bar);
}

window._mobClickSubtab = function(idx) {
    if (!_isMob()) return;
    _log('Click subtab', idx, 'tab:', _mob.tab);
    _mob.subtab = idx;
    document.querySelectorAll('.mob-subtab').forEach((b, i) =>
        b.classList.toggle('active', i === idx));
    _renderContent(_mob.pj, _mob.tab, idx);
};

// ── Contenido por subtab ──────────────────────────────────────
function _renderContent(nombre, tab, subtabIdx) {
    if (!_isMob()) return;
    _log('renderContent', tab, 'subtab:', subtabIdx);
    const ppjBody   = document.getElementById('ppj-body');
    const statsBody = document.getElementById('ppj-stats-body');

    // Restaurar visibility por defecto (se ocultará si el subtab usa
    // panel izq o mapa)
    if (ppjBody) ppjBody.style.visibility = '';

    if (tab === 'stats') {
        _limpiarMobShown();

        if (statsBody) statsBody.style.display = 'none';
        if (ppjBody) Object.assign(ppjBody.style, {
            display:'flex', flexDirection:'column', flex:'1',
            overflowY:'auto', WebkitOverflowScrolling:'touch', paddingBottom:'24px'
        });

        if (subtabIdx === 0) {
            if (ppjBody && statsBody) {
                if (statsBody.innerHTML.trim()) {
                    ppjBody.innerHTML = statsBody.innerHTML;
                } else {
                    ppjBody.innerHTML = '<div class="ppj-loader">Cargando…</div>';
                    const wait = setInterval(() => {
                        if (statsBody.innerHTML.trim()) {
                            ppjBody.innerHTML = statsBody.innerHTML;
                            clearInterval(wait);
                        }
                    }, 100);
                    setTimeout(() => clearInterval(wait), 3000);
                }
            }
        } else {
            const hexBody = document.getElementById('ppj-hex-body');
            if (ppjBody && hexBody) {
                ppjBody.innerHTML = hexBody.innerHTML;
                ppjBody.querySelectorAll('.htab-particle-canvas').forEach(c => c.style.display='none');
            }
        }

    } else if (tab === 'hechizos') {
        if (subtabIdx === 1) {
            // Ocultar el ppj-body (grimorio) para que NADA asome por
            // detrás del mapa, especialmente cuando scrollIntoView del
            // callback de selección desplaza la card a una posición que
            // podría asomar por un gap de píxeles entre subtabs y mapa.
            if (ppjBody) ppjBody.style.visibility = 'hidden';
            _mobMostrarMapa();
        } else {
            // Grimorio: restaurar visibilidad del body
            if (ppjBody) ppjBody.style.visibility = '';
            const mapa = document.getElementById('pmh-panel');
            if (mapa) mapa.classList.remove('mob-shown');
        }

    } else if (tab === 'objetos') {
        if (subtabIdx === 1) {
            if (ppjBody) ppjBody.style.visibility = 'hidden';
            _mobMostrarPanelIzq('ppj-obj-panel-izq');
        } else {
            if (ppjBody) ppjBody.style.visibility = '';
            const p = document.getElementById('ppj-obj-panel-izq');
            if (p) { p.classList.remove('mob-shown'); if (p.style.cssText) p.style.cssText = ''; }
        }

    } else if (tab === 'misiones') {
        if (subtabIdx === 1) {
            if (ppjBody) ppjBody.style.visibility = 'hidden';
            _mobMostrarPanelIzq('ppj-mis-panel-izq');
        } else {
            if (ppjBody) ppjBody.style.visibility = '';
            const p = document.getElementById('ppj-mis-panel-izq');
            if (p) { p.classList.remove('mob-shown'); if (p.style.cssText) p.style.cssText = ''; }
        }
    }
}

// ── Helpers para mostrar paneles con .mob-shown ──────────────
function _mobMostrarPanelIzq(panelId) {
    const try_ = (n) => {
        const el = document.getElementById(panelId);
        if (!el) {
            if (n > 0) setTimeout(() => try_(n-1), 200);
            else _log('Panel no encontrado:', panelId);
            return;
        }
        _log('Encontrado', panelId, '— aplicando mob-shown');
        _aplicarMobShown(panelId);
    };
    try_(15);  // 3 segundos de poll
}

function _mobMostrarMapa() {
    const try_ = (n) => {
        const el = document.getElementById('pmh-panel');
        if (!el) {
            if (n > 0) setTimeout(() => try_(n-1), 200);
            else _log('pmh-panel no encontrado tras esperar');
            return;
        }
        _log('Encontrado pmh-panel — aplicando mob-shown');
        _aplicarMobShown('pmh-panel');
        if (!_touchInstalled) { _touchInstalled = true; setTimeout(_addTouchEvents, 150); }
        // Redimensionar canvas: esperar a que el wrap tenga ancho real
        _redimensionarCanvasMapa();
    };
    try_(15);
}

function _redimensionarCanvasMapa() {
    let tries = 0;
    const intervalo = setInterval(() => {
        tries++;
        const wrap = document.getElementById('pmh-canvas-wrap');
        if (wrap && wrap.clientWidth > 0 && wrap.clientHeight > 0) {
            _log('Canvas wrap listo:', wrap.clientWidth, 'x', wrap.clientHeight);
            window._pmhRedimensionar?.();
            // Centrar y forzar redibujado completo
            clearInterval(intervalo);
        } else if (tries > 20) {
            _log('Canvas wrap nunca tuvo ancho — abandono');
            clearInterval(intervalo);
        }
    }, 100);
}

// ── Touch handlers para el mapa ───────────────────────────────
function _addTouchEvents() {
    const wrap = document.getElementById('pmh-canvas-wrap');
    if (!wrap) { setTimeout(_addTouchEvents, 300); return; }
    let _ld=null,_lx=0,_ly=0,_sx=0,_sy=0,_mv=false,_cn=null;
    const _wp=(cx,cy)=>{
        const c=document.getElementById('pmh-canvas');
        if(!c||!window._pmhGetCamara) return {x:0,y:0};
        const cam=window._pmhGetCamara(), r=c.getBoundingClientRect();
        return {x:(cx-r.left-cam.x)/cam.zoom, y:(cy-r.top-cam.y)/cam.zoom};
    };
    wrap.addEventListener('touchstart',e=>{
        e.preventDefault();
        if(e.touches.length===1){
            const t=e.touches[0]; _lx=t.clientX;_ly=t.clientY;_sx=t.clientX;_sy=t.clientY;
            _mv=false;_ld=null; const wp=_wp(t.clientX,t.clientY);
            _cn=window._pmhNodoEn?.(wp.x,wp.y)||null;
        } else if(e.touches.length===2){
            _ld=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);
            _cn=null;
        }
    },{passive:false});
    wrap.addEventListener('touchmove',e=>{
        e.preventDefault();
        if(e.touches.length===1){
            const t=e.touches[0],dx=t.clientX-_lx,dy=t.clientY-_ly;
            if(Math.hypot(t.clientX-_sx,t.clientY-_sy)>6){_mv=true;_cn=null;}
            if(_mv) window._pmhPanCamara?.(dx,dy);
            _lx=t.clientX;_ly=t.clientY;
        } else if(e.touches.length===2&&_ld!==null){
            const dx=e.touches[0].clientX-e.touches[1].clientX,dy=e.touches[0].clientY-e.touches[1].clientY;
            const dist=Math.hypot(dx,dy),cx=(e.touches[0].clientX+e.touches[1].clientX)/2,cy=(e.touches[0].clientY+e.touches[1].clientY)/2;
            window._pmhZoom?.(dist/_ld,cx,cy); _ld=dist; _mv=true;
        }
    },{passive:false});
    wrap.addEventListener('touchend',e=>{
        e.preventDefault();
        if(!_mv&&_cn) window._pmhSeleccionar?.(_cn);
        _ld=null;_cn=null;
    },{passive:false});
}

// ── Resize ────────────────────────────────────────────────────
window.addEventListener('resize', () => {
    if (!_isMob()) {
        document.getElementById('mob-subtabs')?.remove();
        _touchInstalled = false;
        _limpiarMobShown();
        ['ppj-col-stats','ppj-col-main'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.cssText = '';
        });
    } else if (_mob.pj) {
        _mobSetup(_mob.pj, _mob.tab);
    }
}, { passive: true });
         
