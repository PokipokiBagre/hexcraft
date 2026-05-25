// ============================================================
// personajes-mobile-patch.js  v11
//
// Cambios vs v10:
//  1) Interceptamos window.cerrarDetalle (no solo window.cerrarPanelPJ).
//     El botón × del header llama window.cerrarDetalle(), que es
//     una referencia directa a cerrarPanelPJ asignada por
//     personajes-main.js antes de que cargue este patch.  Si solo
//     interceptamos cerrarPanelPJ, el botón × NO pasa por nuestro
//     wrapper y el _unlockBody no se llama → body bloqueado +
//     panel del PJ queda visible.
//  2) MutationObserver sobre el <body>: cuando panel-mis._reRender
//     destruye y recrea #ppj-mis-panel-izq (al buscar, filtrar, o
//     toggle Finalizadas), el nuevo elemento NO tiene .mob-shown,
//     así que mi CSS lo oculta con display:none → pantalla negra.
//     El observer detecta la recreación y, si estábamos en subtab
//     Catálogo, re-aplica .mob-shown automáticamente.  Igual para
//     #ppj-obj-panel-izq (defensa preventiva).
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
  /* Cuando hay un panel .mob-shown abierto, bloquear el scroll del
     body para que no se vea la grid de personajes del index detrás
     ni cause re-renders por scroll chaining. */
  body.hxmob-locked {
    overflow: hidden !important;
    position: fixed !important;
    left: 0; right: 0;
    width: 100%;
  }

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
    z-index: 1210 !important;
    border: none !important;
    border-right: none !important;
    border-left: none !important;
    box-shadow: none !important;
    flex-direction: column !important;
    background: #050510 !important;
    padding-top: 0 !important;
    box-sizing: border-box !important;
    /* Detener scroll chaining: el scroll interno del panel no
       propaga al <body> cuando llega al límite. */
    overscroll-behavior: contain !important;
  }
  /* Aplicar overscroll-behavior también al scroll interno real */
  #ppj-obj-panel-izq.mob-shown .pobj-izq-scroll,
  #ppj-mis-panel-izq.mob-shown .pmis-izq-list,
  #ppj-mis-panel-izq.mob-shown .pmis-izq-scroll {
    overscroll-behavior: contain !important;
    -webkit-overflow-scrolling: touch !important;
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
    overscroll-behavior: contain !important;
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
    // Desbloquear scroll del body (no hay panel encima)
    _unlockBody();
}

// ── Bloqueo del scroll del body ───────────────────────────────
// Cuando un panel .mob-shown está abierto, el <body> NO debe
// scrollearse.  Eso previene que la grid de personajes del index
// aparezca cuando el panel llega al final de su scroll interno
// (scroll chaining) y previene que el resize por toolbar móvil
// rompa el estado.
function _lockBody() {
    if (document.body.classList.contains('hxmob-locked')) return;
    // Guardar la posición de scroll actual para restaurarla luego
    document.body.dataset.hxmobScrollY = String(window.scrollY);
    document.body.classList.add('hxmob-locked');
    document.body.style.top = `-${window.scrollY}px`;
}
function _unlockBody() {
    if (!document.body.classList.contains('hxmob-locked')) return;
    const y = parseInt(document.body.dataset.hxmobScrollY || '0', 10);
    document.body.classList.remove('hxmob-locked');
    document.body.style.top = '';
    delete document.body.dataset.hxmobScrollY;
    window.scrollTo(0, y);
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
    // Bloquear scroll del body mientras este panel está visible
    _lockBody();
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

    // cerrarPanelPJ Y cerrarDetalle: ambos referencian la función
    // original, pero personajes-main.js asigna cerrarDetalle a la
    // referencia directa del módulo ANTES de que cargue nuestro patch,
    // así que interceptar window.cerrarPanelPJ no afecta el botón × del
    // header (que llama window.cerrarDetalle).  Por eso interceptamos
    // los dos por separado.
    const _origCerrar = window.cerrarPanelPJ;
    window.cerrarPanelPJ = function() {
        _limpiarMobShown();         // remueve .mob-shown + _unlockBody
        document.getElementById('mob-subtabs')?.remove();
        if (_mob.pj) _mob.pj = null;
        _origCerrar?.();
    };
    const _origCerrarDetalle = window.cerrarDetalle;
    window.cerrarDetalle = function() {
        _log('cerrarDetalle invocado');
        _limpiarMobShown();
        document.getElementById('mob-subtabs')?.remove();
        if (_mob.pj) _mob.pj = null;
        _origCerrarDetalle?.();
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

// ── Observer: cuando los paneles izq se DESTRUYEN+RECREAN
// (por ejemplo, panel-mis._reRender hace remove() + crear nuevo
// al cambiar búsqueda/filtros/toggle Finalizadas), el nuevo
// elemento NO tiene la clase .mob-shown.  Sin ella, mi CSS lo
// oculta con display:none → pantalla negra.
//
// Solución: observamos el <body> y, cuando aparece un nuevo
// #ppj-mis-panel-izq o #ppj-obj-panel-izq, si estábamos en subtab
// Catálogo (subtab 1), re-aplicamos .mob-shown automáticamente.
const _panelObserver = new MutationObserver(mutations => {
    if (!_isMob()) return;
    if (_mob.subtab !== 1) return;
    for (const m of mutations) {
        for (const n of m.addedNodes) {
            if (!(n instanceof HTMLElement)) continue;
            const id = n.id;
            const matchObj = id === 'ppj-obj-panel-izq' && _mob.tab === 'objetos';
            const matchMis = id === 'ppj-mis-panel-izq' && _mob.tab === 'misiones';
            if (matchObj || matchMis) {
                _log('Panel recreado, re-aplicando mob-shown a', id);
                // Diferir para que panel-mis termine de poblar el HTML
                setTimeout(() => _aplicarMobShown(id), 30);
            }
        }
    }
});
_panelObserver.observe(document.body, { childList: true });

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
            _unlockBody();
        }

    } else if (tab === 'objetos') {
        if (subtabIdx === 1) {
            if (ppjBody) ppjBody.style.visibility = 'hidden';
            _mobMostrarPanelIzq('ppj-obj-panel-izq');
        } else {
            if (ppjBody) ppjBody.style.visibility = '';
            const p = document.getElementById('ppj-obj-panel-izq');
            if (p) { p.classList.remove('mob-shown'); if (p.style.cssText) p.style.cssText = ''; }
            _unlockBody();
        }

    } else if (tab === 'misiones') {
        if (subtabIdx === 1) {
            if (ppjBody) ppjBody.style.visibility = 'hidden';
            _mobMostrarPanelIzq('ppj-mis-panel-izq');
        } else {
            if (ppjBody) ppjBody.style.visibility = '';
            const p = document.getElementById('ppj-mis-panel-izq');
            if (p) { p.classList.remove('mob-shown'); if (p.style.cssText) p.style.cssText = ''; }
            _unlockBody();
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
// Importante: en móvil, mostrar/ocultar la toolbar del navegador
// dispara un evento "resize" que cambia solo la altura (window.innerHeight).
// Eso NO debe disparar un re-render porque rompe el subtab activo.
// Solo recreamos el setup móvil cuando cambia el ancho (orientación
// o cambio real de dispositivo).
let _lastInnerWidth = window.innerWidth;
window.addEventListener('resize', () => {
    const widthChanged = window.innerWidth !== _lastInnerWidth;
    _lastInnerWidth = window.innerWidth;

    if (!_isMob()) {
        // Salida a desktop: limpiar todo lo móvil
        document.getElementById('mob-subtabs')?.remove();
        _touchInstalled = false;
        _limpiarMobShown();
        document.body.classList.remove('hxmob-locked');
        ['ppj-col-stats','ppj-col-main'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.cssText = '';
        });
    } else if (_mob.pj && widthChanged) {
        // Cambio real de ancho (rotación o redimensión del navegador):
        // recrear setup, preservando el subtab actual
        const prevSubtab = _mob.subtab;
        _mobSetup(_mob.pj, _mob.tab);
        // Tras el setTimeout de _mobSetup, reactivar el subtab original
        setTimeout(() => {
            if (prevSubtab !== 0) window._mobClickSubtab(prevSubtab);
        }, 200);
    }
    // Si solo cambió la altura (toolbar móvil mostrando/ocultando),
    // no hacemos NADA — el subtab activo se preserva intacto.
}, { passive: true });
