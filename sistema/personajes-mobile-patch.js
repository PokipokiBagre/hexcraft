// ============================================================
// personajes-mobile-patch.js  v7
//
// Cambios clave vs v6:
//  - Usa la clase CSS `.mob-shown` (definida en personajes-mobile.css)
//    en vez de inline styles para mostrar los paneles izq de Obj/Mis
//    y el panel del mapa de hechizos.  Las reglas dinámicas
//    `@media(max-width:900px){#ppj-obj-panel-izq{display:none}}` que
//    inyectan panel-pj.js y panel-mis.js NO tienen !important, así
//    que las reglas del CSS móvil (con !important) ganan.
//  - Para Hechizos: el subtab "Mapa" sólo añade .mob-shown al panel
//    ya creado por abrirMinimapa().  El subtab "Grimorio" sólo quita
//    .mob-shown (no destruye el mapa).
//  - Para Objetos/Misiones: el subtab "Catálogo" añade .mob-shown al
//    panel izq que ya existe (insertado en document.body).  El subtab
//    "Inventario"/"Misiones mías" sólo quita .mob-shown.
//  - Stats: subtab 0 → mueve HEX body al ppj-body (mismo flujo v6).
//
// <script type="module" src="personajes-mobile-patch.js"></script>
// ============================================================

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

function _limpiarMobShown() {
    _MOB_TARGETS.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.remove('mob-shown');
    });
}

function _aplicarMobShown(id) {
    // Limpia los demás targets y aplica .mob-shown sólo a `id`
    _MOB_TARGETS.forEach(targetId => {
        const el = document.getElementById(targetId);
        if (!el) return;
        if (targetId === id) el.classList.add('mob-shown');
        else el.classList.remove('mob-shown');
    });
}

// ── Instalar interceptores DESPUÉS de que los módulos carguen ─
function _instalarInterceptores() {
    if (_intercepted) return;
    _intercepted = true;

    // abrirDetalle
    const _origAbrirDetalle = window.abrirDetalle;
    window.abrirDetalle = function(nombre) {
        _origAbrirDetalle?.(nombre);
        if (_isMob()) {
            _mob.pj = nombre; _mob.tab = 'stats'; _mob.subtab = 0;
            _limpiarMobShown();
            setTimeout(() => _mobSetup(nombre, 'stats'), 80);
        }
    };

    // _ppjCambiarTab — crítico: aquí cambiamos de tab principal
    const _origCambiarTab = window._ppjCambiarTab;
    window._ppjCambiarTab = function(nombre, tab) {
        _origCambiarTab?.(nombre, tab);
        if (_isMob()) {
            _mob.pj = nombre; _mob.tab = tab; _mob.subtab = 0;
            // Al cambiar de tab principal, todos los paneles izq / mapa
            // se reinician.  El default es subtab=0 (no mostrar catálogo
            // ni mapa).
            _limpiarMobShown();
            setTimeout(() => _mobSetup(nombre, tab), 120);
        }
    };

    // cerrarPanelPJ
    const _origCerrar = window.cerrarPanelPJ;
    window.cerrarPanelPJ = function() {
        _limpiarMobShown();
        document.getElementById('mob-subtabs')?.remove();
        _origCerrar?.();
    };

    // refreshPanelPJ — sólo afecta stats, no toca subtabs
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

// Esperar a que los módulos ES terminen de exponer funciones globales.
// window.onload ya pasó en módulos — usamos un poll corto.
const _waitForModules = setInterval(() => {
    if (typeof window._ppjCambiarTab === 'function' &&
        typeof window.abrirDetalle === 'function') {
        clearInterval(_waitForModules);
        _instalarInterceptores();
    }
}, 50);
// Timeout de seguridad: instalar de todas formas a los 3s
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
    _mob.subtab = idx;
    document.querySelectorAll('.mob-subtab').forEach((b, i) =>
        b.classList.toggle('active', i === idx));
    _renderContent(_mob.pj, _mob.tab, idx);
};

// ── Contenido por subtab ──────────────────────────────────────
function _renderContent(nombre, tab, subtabIdx) {
    if (!_isMob()) return;
    const ppjBody   = document.getElementById('ppj-body');
    const statsBody = document.getElementById('ppj-stats-body');

    if (tab === 'stats') {
        // En tab Stats nunca queremos paneles izq ni mapa
        _limpiarMobShown();

        if (statsBody) statsBody.style.display = 'none';
        if (ppjBody) Object.assign(ppjBody.style, {
            display:'flex', flexDirection:'column', flex:'1',
            overflowY:'auto', WebkitOverflowScrolling:'touch', paddingBottom:'24px'
        });

        if (subtabIdx === 0) {
            // Vitalidad — copiar contenido de stats-body
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
            // HEX & VEX
            const hexBody = document.getElementById('ppj-hex-body');
            if (ppjBody && hexBody) {
                ppjBody.innerHTML = hexBody.innerHTML;
                ppjBody.querySelectorAll('.htab-particle-canvas').forEach(c => c.style.display='none');
            }
        }

    } else if (tab === 'hechizos') {
        // Por defecto Grimorio: el contenido HTML del grimorio ya está
        // en ppj-body porque _renderTab lo pintó.  El mapa se controla
        // sólo con .mob-shown.
        if (subtabIdx === 1) {
            // Mapa: añadir .mob-shown al panel del mapa.  Espera a que
            // exista (abrirMinimapa es async).
            _mobMostrarMapa();
        } else {
            // Grimorio: quitar .mob-shown del mapa (queda invisible en
            // DOM, no se destruye)
            const mapa = document.getElementById('pmh-panel');
            if (mapa) mapa.classList.remove('mob-shown');
        }

    } else if (tab === 'objetos') {
        if (subtabIdx === 1) {
            // Catálogo: mostrar panel izq
            _mobMostrarPanelIzq('ppj-obj-panel-izq');
        } else {
            // Inventario: ocultar panel izq (queda en DOM)
            const p = document.getElementById('ppj-obj-panel-izq');
            if (p) p.classList.remove('mob-shown');
        }

    } else if (tab === 'misiones') {
        if (subtabIdx === 1) {
            _mobMostrarPanelIzq('ppj-mis-panel-izq');
        } else {
            const p = document.getElementById('ppj-mis-panel-izq');
            if (p) p.classList.remove('mob-shown');
        }
    }
}

// ── Helpers para mostrar paneles con .mob-shown ──────────────
// Esperan a que el elemento exista (los paneles se crean async tras
// renderTabMisiones/_tabObjetos/abrirMinimapa)
function _mobMostrarPanelIzq(panelId) {
    const try_ = (n) => {
        const el = document.getElementById(panelId);
        if (!el) {
            if (n > 0) setTimeout(() => try_(n-1), 200);
            return;
        }
        // Limpiar inline styles que v6 podía haber puesto
        el.style.cssText = '';
        _aplicarMobShown(panelId);
    };
    try_(10);
}

function _mobMostrarMapa() {
    const try_ = (n) => {
        const el = document.getElementById('pmh-panel');
        if (!el) {
            if (n > 0) setTimeout(() => try_(n-1), 200);
            return;
        }
        el.style.cssText = '';
        _aplicarMobShown('pmh-panel');
        if (!_touchInstalled) { _touchInstalled = true; setTimeout(_addTouchEvents, 150); }
        // Forzar redimensión del canvas tras aplicar la nueva geometría
        setTimeout(() => { window._pmhRedimensionar?.(); }, 120);
    };
    try_(10);
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
        // Volver a desktop: limpiar todo lo móvil
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
