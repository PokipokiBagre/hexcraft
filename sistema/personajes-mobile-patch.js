// ============================================================
// personajes-mobile-patch.js  v5
// <script type="module" src="personajes-mobile-patch.js"></script>
// ============================================================

const _isMob = () => window.innerWidth <= 700;
const _mob = { tab: 'stats', subtab: 0, pj: null };
let _touchInstalled = false;

const _SUBTABS = {
    stats:    ['Vitalidad', 'HEX & VEX'],
    hechizos: ['Grimorio', 'Mapa'],
    objetos:  ['Inventario', 'Catálogo'],
    misiones: ['Mis misiones', 'Catálogo'],
};

// ── Interceptores ────────────────────────────────────────────
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

// ── Setup ─────────────────────────────────────────────────────
function _mobSetup(nombre, tab) {
    if (!_isMob()) return;
    _ensureFullscreen();
    _renderSubtabs(nombre, tab);
    // Pequeño delay para que el engine termine de pintar el ppj-body
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

// ── Contenido ─────────────────────────────────────────────────
function _renderContent(nombre, tab, subtabIdx) {
    if (!_isMob()) return;
    const ppjBody   = document.getElementById('ppj-body');
    const statsBody = document.getElementById('ppj-stats-body');
    if (statsBody) statsBody.style.display = 'none';
    if (ppjBody) Object.assign(ppjBody.style, {
        display:'flex', flexDirection:'column', flex:'1',
        overflowY:'auto', WebkitOverflowScrolling:'touch', paddingBottom:'24px'
    });

    if (tab === 'stats') {
        if (subtabIdx === 0) {
            // Vitalidad: copiar statsBody → ppjBody
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
            // HEX & VEX: copiar hexBody → ppjBody
            const hexBody = document.getElementById('ppj-hex-body');
            if (ppjBody && hexBody) {
                ppjBody.innerHTML = hexBody.innerHTML;
                ppjBody.querySelectorAll('.htab-particle-canvas').forEach(c => c.style.display='none');
            }
        }

    } else if (tab === 'hechizos') {
        if (subtabIdx === 1) {
            _mobAbrirMapa(nombre);
        } else {
            _mobCerrarMapaEnPanel();
            // ppj-body ya tiene el grimorio cargado por el engine
        }

    } else if (tab === 'objetos') {
        if (subtabIdx === 1) {
            // Catálogo: mover el panel izquierdo de objetos al ppj-body
            _mobMoverPanelIzqABodyReal('ppj-obj-panel-izq', ppjBody);
        } else {
            // Inventario: ppj-body ya tiene el contenido del engine
            // Solo asegurarnos de que el panel izq no está copiado
            _mobRestaurarPanelIzq('ppj-obj-panel-izq');
        }

    } else if (tab === 'misiones') {
        if (subtabIdx === 1) {
            // Catálogo: mover el panel izquierdo de misiones al ppj-body
            _mobMoverPanelIzqABodyReal('ppj-mis-panel-izq', ppjBody);
        } else {
            // Mis misiones: ppj-body ya tiene el contenido
            _mobRestaurarPanelIzq('ppj-mis-panel-izq');
        }
    }
}

// ── Mover panel izq al ppj-body ───────────────────────────────
// En lugar de position:absolute (que requiere el padre correcto),
// clonamos el contenido del panel izq dentro del ppj-body
function _mobMoverPanelIzqABodyReal(panelId, ppjBody) {
    if (!ppjBody) return;

    const tryMount = (intentos) => {
        const panel = document.getElementById(panelId);
        if (!panel) {
            if (intentos > 0) setTimeout(() => tryMount(intentos - 1), 200);
            else ppjBody.innerHTML = `<div class="ppj-empty" style="padding:40px 20px;text-align:center;color:#4a4a68;">Sin contenido disponible</div>`;
            return;
        }

        // Clonar el contenido del panel izq dentro del body
        // (no lo movemos para no romper el DOM del engine)
        ppjBody.innerHTML = '';
        const clone = panel.cloneNode(true);
        // Ajustar el clone: quitar position fixed, hacerlo fluido
        Object.assign(clone.style, {
            position:'relative', width:'100%', height:'auto',
            display:'flex', flexDirection:'column', flex:'1',
            border:'none', boxShadow:'none', background:'transparent',
            maxWidth:'none', minWidth:'0', inset:'auto'
        });
        ppjBody.appendChild(clone);
        // Re-bindear eventos del clone (los onclick en HTML son strings, se re-ejecutan)
        // Para los listeners addEventListener necesitaríamos el panel real — usar el real directamente
    };

    tryMount(8);
}

// Panel izq real como fill del body (sin clonar — mover de verdad temporalmente)
function _mobMoverPanelIzqABodyReal(panelId, ppjBody) {
    if (!ppjBody) return;
    const tryMount = (intentos) => {
        const panel = document.getElementById(panelId);
        if (!panel) {
            if (intentos > 0) setTimeout(() => tryMount(intentos - 1), 200);
            return;
        }
        // Mover el panel dentro del ppj-body
        ppjBody.innerHTML = '';
        Object.assign(panel.style, {
            position:'relative', inset:'auto', width:'100%', height:'auto',
            minWidth:'0', border:'none', zIndex:'auto', flex:'1'
        });
        ppjBody.appendChild(panel);
    };
    tryMount(8);
}

function _mobRestaurarPanelIzq(panelId) {
    // Si el panel está dentro del ppj-body, sacarlo y devolverlo al body del documento
    const ppjBody = document.getElementById('ppj-body');
    const panel   = document.getElementById(panelId);
    if (panel && ppjBody && ppjBody.contains(panel)) {
        // Restaurar al DOM raíz
        document.body.appendChild(panel);
        panel.style.display = 'none';
    }
}

// ── MAPA ─────────────────────────────────────────────────────
function _mobAbrirMapa(nombre) {
    const tryMount = (intentos) => {
        const mapa = document.getElementById('pmh-panel');
        if (!mapa) {
            if (intentos > 0) setTimeout(() => tryMount(intentos - 1), 200);
            return;
        }
        const cs = document.getElementById('ppj-col-stats');
        if (cs) cs.style.position = 'relative';

        Object.assign(mapa.style, {
            position:'absolute', inset:'0', width:'100%', minWidth:'0',
            height:'100%', zIndex:'10', boxShadow:'none',
            borderRight:'none', animation:'none'
        });

        if (!_touchInstalled) {
            _touchInstalled = true;
            setTimeout(_addTouchEvents, 150);
        }
        setTimeout(() => { window._pmhRedimensionar?.(); }, 120);
    };
    tryMount(8);
}

function _mobCerrarMapaEnPanel() {
    const mapa = document.getElementById('pmh-panel');
    if (mapa) mapa.style.zIndex = '-1';
}

// ── Touch para el mapa ────────────────────────────────────────
function _addTouchEvents() {
    const wrap = document.getElementById('pmh-canvas-wrap');
    if (!wrap) { setTimeout(_addTouchEvents, 300); return; }

    let _ltDist = null, _ltX = 0, _ltY = 0;
    let _stX = 0, _stY = 0, _moved = false, _candNodo = null;

    const _wp = (cx, cy) => {
        const canvas = document.getElementById('pmh-canvas');
        if (!canvas || !window._pmhGetCamara) return { x:0, y:0 };
        const cam = window._pmhGetCamara();
        const r   = canvas.getBoundingClientRect();
        return { x:(cx-r.left-cam.x)/cam.zoom, y:(cy-r.top-cam.y)/cam.zoom };
    };

    wrap.addEventListener('touchstart', e => {
        e.preventDefault();
        if (e.touches.length === 1) {
            const t = e.touches[0];
            _ltX=t.clientX; _ltY=t.clientY; _stX=t.clientX; _stY=t.clientY;
            _moved=false; _ltDist=null;
            const wp=_wp(t.clientX,t.clientY);
            _candNodo=window._pmhNodoEn?.(wp.x,wp.y)||null;
        } else if (e.touches.length===2) {
            const dx=e.touches[0].clientX-e.touches[1].clientX;
            const dy=e.touches[0].clientY-e.touches[1].clientY;
            _ltDist=Math.hypot(dx,dy); _candNodo=null;
        }
    }, {passive:false});

    wrap.addEventListener('touchmove', e => {
        e.preventDefault();
        if (e.touches.length===1) {
            const t=e.touches[0];
            const dx=t.clientX-_ltX, dy=t.clientY-_ltY;
            if (Math.hypot(t.clientX-_stX,t.clientY-_stY)>6){_moved=true;_candNodo=null;}
            if (_moved) window._pmhPanCamara?.(dx,dy);
            _ltX=t.clientX; _ltY=t.clientY;
        } else if (e.touches.length===2 && _ltDist!==null) {
            const dx=e.touches[0].clientX-e.touches[1].clientX;
            const dy=e.touches[0].clientY-e.touches[1].clientY;
            const dist=Math.hypot(dx,dy);
            const cx=(e.touches[0].clientX+e.touches[1].clientX)/2;
            const cy=(e.touches[0].clientY+e.touches[1].clientY)/2;
            window._pmhZoom?.(dist/_ltDist,cx,cy);
            _ltDist=dist; _moved=true;
        }
    }, {passive:false});

    wrap.addEventListener('touchend', e => {
        e.preventDefault();
        if (!_moved && _candNodo) window._pmhSeleccionar?.(_candNodo);
        _ltDist=null; _candNodo=null;
    }, {passive:false});
}

// ── Sync vitalidad tras refresh ───────────────────────────────
const _origRefresh = window.refreshPanelPJ;
window.refreshPanelPJ = function() {
    _origRefresh?.();
    if (_isMob() && _mob.tab==='stats' && _mob.subtab===0) {
        setTimeout(() => {
            const ppjBody   = document.getElementById('ppj-body');
            const statsBody = document.getElementById('ppj-stats-body');
            if (ppjBody && statsBody?.innerHTML.trim())
                ppjBody.innerHTML = statsBody.innerHTML;
        }, 150);
    }
};

// ── Resize ────────────────────────────────────────────────────
window.addEventListener('resize', () => {
    if (!_isMob()) {
        document.getElementById('mob-subtabs')?.remove();
        _touchInstalled = false;
        const mapa = document.getElementById('pmh-panel');
        if (mapa) Object.assign(mapa.style, {
            position:'fixed', left:'0', top:'0', bottom:'0',
            width:'50vw', height:'', inset:'', zIndex:'10000'
        });
        ['ppj-col-stats','ppj-col-main'].forEach(id => {
            const el=document.getElementById(id);
            if (el) el.style.cssText='';
        });
    } else if (_mob.pj) {
        _mobSetup(_mob.pj, _mob.tab);
    }
}, {passive:true});
