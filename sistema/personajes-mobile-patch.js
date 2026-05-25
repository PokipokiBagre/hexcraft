// ============================================================
// personajes-mobile-patch.js  v6
// <script type="module" src="personajes-mobile-patch.js"></script>
// ============================================================

const _isMob = () => window.innerWidth <= 700;
const _mob = { tab: 'stats', subtab: 0, pj: null };
let _touchInstalled = false;
let _intercepted = false;

const _SUBTABS = {
    stats:    ['Vitalidad', 'HEX & VEX'],
    hechizos: ['Grimorio', 'Mapa'],
    objetos:  ['Inventario', 'Catálogo'],
    misiones: ['Mis misiones', 'Catálogo'],
};

// ── Instalar interceptores DESPUÉS de que los módulos carguen ─
// Los módulos ES se ejecutan en orden pero el window.onload
// ya pasó — esperamos al siguiente tick tras DOMContentLoaded
function _instalarInterceptores() {
    if (_intercepted) return;
    _intercepted = true;

    // abrirDetalle
    const _origAbrirDetalle = window.abrirDetalle;
    window.abrirDetalle = function(nombre) {
        _origAbrirDetalle?.(nombre);
        if (_isMob()) {
            _mob.pj = nombre; _mob.tab = 'stats'; _mob.subtab = 0;
            setTimeout(() => _mobSetup(nombre, 'stats'), 80);
        }
    };

    // _ppjCambiarTab — este es el crítico
    const _origCambiarTab = window._ppjCambiarTab;
    window._ppjCambiarTab = function(nombre, tab) {
        _origCambiarTab?.(nombre, tab);
        if (_isMob()) {
            _mob.pj = nombre; _mob.tab = tab; _mob.subtab = 0;
            setTimeout(() => _mobSetup(nombre, tab), 120);
        }
    };

    // refreshPanelPJ
    const _origRefresh = window.refreshPanelPJ;
    window.refreshPanelPJ = function() {
        _origRefresh?.();
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

// Esperar a que todos los módulos terminen de ejecutarse
// window.onload ya pasó en módulos — usamos un poll corto
const _waitForModules = setInterval(() => {
    if (typeof window._ppjCambiarTab === 'function' &&
        typeof window.abrirDetalle === 'function') {
        clearInterval(_waitForModules);
        _instalarInterceptores();
    }
}, 50);
// Timeout de seguridad: instalar de todas formas a los 3s
setTimeout(() => { clearInterval(_waitForModules); _instalarInterceptores(); }, 3000);

// ── Setup ─────────────────────────────────────────────────────
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
            _mobAbrirMapa();
        } else {
            _mobCerrarMapaEnPanel();
        }

    } else if (tab === 'objetos') {
        if (subtabIdx === 1) {
            _mobMoverPanelAlBody('ppj-obj-panel-izq', ppjBody);
        } else {
            _mobDevolverPanel('ppj-obj-panel-izq');
        }

    } else if (tab === 'misiones') {
        if (subtabIdx === 1) {
            _mobMoverPanelAlBody('ppj-mis-panel-izq', ppjBody);
        } else {
            _mobDevolverPanel('ppj-mis-panel-izq');
        }
    }
}

// ── Mover panel izq al ppj-body (el elemento real) ───────────
function _mobMoverPanelAlBody(panelId, ppjBody) {
    if (!ppjBody) return;
    const try_ = (n) => {
        const panel = document.getElementById(panelId);
        if (!panel) {
            if (n > 0) setTimeout(() => try_(n-1), 200); return;
        }
        ppjBody.innerHTML = '';
        Object.assign(panel.style, {
            position:'relative', inset:'auto', width:'100%', height:'auto',
            minWidth:'0', maxWidth:'none', border:'none', borderRight:'none',
            boxShadow:'none', zIndex:'auto', flex:'1', display:'flex'
        });
        ppjBody.appendChild(panel);
    };
    try_(8);
}

// Devolver el panel al document.body cuando cambia de subtab
function _mobDevolverPanel(panelId) {
    const ppjBody = document.getElementById('ppj-body');
    const panel   = document.getElementById(panelId);
    if (panel && ppjBody && ppjBody.contains(panel)) {
        document.body.appendChild(panel);
        panel.style.display = 'none';
    }
}

// ── MAPA ─────────────────────────────────────────────────────
function _mobAbrirMapa() {
    const try_ = (n) => {
        const mapa = document.getElementById('pmh-panel');
        if (!mapa) { if (n>0) setTimeout(()=>try_(n-1), 200); return; }
        const cs = document.getElementById('ppj-col-stats');
        if (cs) cs.style.position = 'relative';
        Object.assign(mapa.style, {
            position:'absolute', inset:'0', width:'100%', minWidth:'0',
            height:'100%', zIndex:'10', boxShadow:'none',
            borderRight:'none', animation:'none'
        });
        if (!_touchInstalled) { _touchInstalled=true; setTimeout(_addTouchEvents,150); }
        setTimeout(()=>{ window._pmhRedimensionar?.(); }, 120);
    };
    try_(8);
}

function _mobCerrarMapaEnPanel() {
    const mapa = document.getElementById('pmh-panel');
    if (mapa) mapa.style.zIndex = '-1';
}

// ── Touch mapa ────────────────────────────────────────────────
function _addTouchEvents() {
    const wrap = document.getElementById('pmh-canvas-wrap');
    if (!wrap) { setTimeout(_addTouchEvents,300); return; }
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
window.addEventListener('resize',()=>{
    if(!_isMob()){
        document.getElementById('mob-subtabs')?.remove();
        _touchInstalled=false;
        const mapa=document.getElementById('pmh-panel');
        if(mapa) Object.assign(mapa.style,{position:'fixed',left:'0',top:'0',bottom:'0',width:'50vw',height:'',inset:'',zIndex:'10000'});
        ['ppj-col-stats','ppj-col-main'].forEach(id=>{const el=document.getElementById(id);if(el)el.style.cssText='';});
    } else if(_mob.pj){
        _mobSetup(_mob.pj,_mob.tab);
    }
},{passive:true});
