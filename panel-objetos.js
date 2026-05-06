// ============================================================
// panel-objetos.js — Panel lateral de objetos (split izq/der)
// Montar en raíz. Igual concepto que panel-pj.js para hechizos.
//
// API pública:
//   abrirPanelObjetos(nombrePJ, esAdmin, supabase)
//   cerrarPanelObjetos()
// ============================================================

import { supabase } from './hex-auth.js';

// ── Constantes ───────────────────────────────────────────────
const _sb = () => {
    try { return window._hexConfig?.storageUrl || ''; } catch { return ''; }
};
const _norm = (s) => s ? s.toString().trim().toLowerCase()
    .replace(/[áàäâ]/g,'a').replace(/[éèëê]/g,'e').replace(/[íìïî]/g,'i')
    .replace(/[óòöô]/g,'o').replace(/[úùüû]/g,'u').replace(/[ñ]/g,'n')
    .replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,'') : '';

const _imgObj = (nombre) => `${_sb()}/imgobjetos/${_norm(nombre)}.png`;
const _imgFallback = () => `${_sb()}/imginterfaz/no_encontrado.png`;

const RAR_COLOR = { 'Legendario': '#d4af37', 'Raro': '#9a50dc', 'Común': '#9090b0', '-': '#7070a0' };
const RAR_BG    = { 'Legendario': 'rgba(212,175,55,0.08)', 'Raro': 'rgba(154,80,220,0.08)', 'Común': 'rgba(100,100,130,0.06)', '-': 'rgba(60,60,80,0.05)' };

// ── Estado ───────────────────────────────────────────────────
let _st = {
    abierto: false,
    nombrePJ: null,
    esAdmin: false,
    // Datos
    catalogo: [],        // todos los objetos [{id,nombre,tipo,material,efecto,rareza,descripcion,vida_roja,vida_azul,contenedor_padre,es_propuesta}]
    inventario: [],      // objetos del PJ [{objeto_nombre,cantidad,equipado}]
    contenidores: {},    // nombre_contenedor → [hijos]
    // UI
    busqCat: '',
    busqInv: '',
    filtroCatRar: 'Todos',
    filtroCatTipo: 'Todos',
    expandedContainers: new Set(),
};

// ── API PÚBLICA ──────────────────────────────────────────────

export async function abrirPanelObjetos(nombrePJ, esAdmin) {
    _st.nombrePJ  = nombrePJ;
    _st.esAdmin   = esAdmin;
    _st.busqCat   = '';
    _st.busqInv   = '';
    _st.filtroCatRar  = 'Todos';
    _st.filtroCatTipo = 'Todos';
    _st.expandedContainers = new Set();

    _inyectarPanel();
    _inyectarEstilos();

    await _cargarDatos();
    _renderTodo();
}

export function cerrarPanelObjetos() {
    _st.abierto = false;
    document.getElementById('pobj-panel')?.remove();
    document.getElementById('pobj-overlay')?.remove();
    document.getElementById('pobj-styles')?.remove();
}

// ── INYECTAR HTML ────────────────────────────────────────────
function _inyectarPanel() {
    cerrarPanelObjetos();
    _st.abierto = true;

    // Overlay
    const ov = document.createElement('div');
    ov.id = 'pobj-overlay';
    ov.onclick = cerrarPanelObjetos;
    document.body.appendChild(ov);

    // Panel
    const panel = document.createElement('div');
    panel.id = 'pobj-panel';
    panel.innerHTML = `
        <div id="pobj-header">
            <div id="pobj-header-left">
                <span id="pobj-title">🎒 Objetos</span>
                <span id="pobj-pj-name"></span>
            </div>
            <button id="pobj-close" onclick="cerrarPanelObjetos()">✕</button>
        </div>
        <div id="pobj-body">
            <div id="pobj-left">
                <div id="pobj-cat-header">
                    <span class="pobj-section-label">Catálogo</span>
                    <input id="pobj-busq-cat" class="pobj-search" placeholder="Buscar…" oninput="window._pobjBuscarCat(this.value)">
                    <div id="pobj-cat-filtros"></div>
                </div>
                <div id="pobj-cat-lista"></div>
            </div>
            <div id="pobj-right">
                <div id="pobj-inv-header">
                    <span class="pobj-section-label">Inventario</span>
                    <input id="pobj-busq-inv" class="pobj-search" placeholder="Buscar…" oninput="window._pobjBuscarInv(this.value)">
                </div>
                <div id="pobj-inv-lista"></div>
            </div>
        </div>
    `;
    document.body.appendChild(panel);

    // Exponer funciones globales
    window._pobjBuscarCat = (v) => { _st.busqCat = v; _renderCatalogo(); };
    window._pobjBuscarInv = (v) => { _st.busqInv = v; _renderInventario(); };
    window._pobjFiltroRar = (v) => { _st.filtroCatRar = v; _renderCatalogo(); };
    window._pobjFiltroTipo = (v) => { _st.filtroCatTipo = v; _renderCatalogo(); };
    window._pobjToggleContenedor = (nombre) => {
        if (_st.expandedContainers.has(nombre)) _st.expandedContainers.delete(nombre);
        else _st.expandedContainers.add(nombre);
        _renderInventario();
    };
    window._pobjAsignar = async (objNombre, cantidad = 1) => {
        if (!_st.esAdmin) return;
        const { error } = await supabase.from('inventario_objetos').upsert({
            personaje_nombre: _st.nombrePJ,
            objeto_nombre: objNombre,
            cantidad,
            equipado: false
        }, { onConflict: 'personaje_nombre,objeto_nombre' });
        if (error) { alert('Error: ' + error.message); return; }
        await _cargarInventario();
        _renderInventario();
        _renderCatalogo(); // actualiza badge "en inventario"
    };
    window._pobjModCantidad = async (objNombre, delta) => {
        const item = _st.inventario.find(i => i.objeto_nombre === objNombre);
        const nuevaCant = Math.max(0, (item?.cantidad || 0) + delta);
        if (nuevaCant === 0) {
            const { error } = await supabase.from('inventario_objetos')
                .delete().eq('personaje_nombre', _st.nombrePJ).eq('objeto_nombre', objNombre);
            if (error) { alert(error.message); return; }
        } else {
            const { error } = await supabase.from('inventario_objetos').upsert({
                personaje_nombre: _st.nombrePJ, objeto_nombre: objNombre, cantidad: nuevaCant
            }, { onConflict: 'personaje_nombre,objeto_nombre' });
            if (error) { alert(error.message); return; }
        }
        await _cargarInventario();
        _renderInventario();
        _renderCatalogo();
    };
    window._pobjToggleEquip = async (objNombre) => {
        const item = _st.inventario.find(i => i.objeto_nombre === objNombre);
        if (!item) return;
        const { error } = await supabase.from('inventario_objetos')
            .update({ equipado: !item.equipado })
            .eq('personaje_nombre', _st.nombrePJ).eq('objeto_nombre', objNombre);
        if (error) { alert(error.message); return; }
        await _cargarInventario();
        _renderInventario();
    };

    // Cerrar con Escape
    document.addEventListener('keydown', _onEsc);
}

function _onEsc(e) { if (e.key === 'Escape') cerrarPanelObjetos(); }

// ── ESTILOS ──────────────────────────────────────────────────
function _inyectarEstilos() {
    if (document.getElementById('pobj-styles')) return;
    const s = document.createElement('style');
    s.id = 'pobj-styles';
    s.textContent = `
#pobj-overlay {
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.5);
    z-index: 10100;
    animation: pobj-fade-in 0.2s ease;
}
#pobj-panel {
    position: fixed;
    inset: 0;
    z-index: 10200;
    display: flex;
    flex-direction: column;
    background: #07050f;
    font-family: 'Inter', system-ui, sans-serif;
    animation: pobj-slide-up 0.24s cubic-bezier(0.4,0,0.2,1);
}
@keyframes pobj-fade-in { from { opacity:0; } to { opacity:1; } }
@keyframes pobj-slide-up { from { transform: translateY(30px); opacity:0; } to { transform: translateY(0); opacity:1; } }

#pobj-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 18px;
    background: #0b0816;
    border-bottom: 1px solid rgba(212,175,55,0.2);
    flex-shrink: 0;
}
#pobj-header-left { display: flex; align-items: center; gap: 12px; }
#pobj-title { font-family: 'Cinzel', serif; color: #d4af37; font-size: 0.9em; letter-spacing: 1.5px; font-weight: 700; }
#pobj-pj-name { font-size: 0.75em; color: #888; letter-spacing: 0.5px; }
#pobj-close {
    background: transparent; border: 1px solid rgba(255,255,255,0.1);
    color: #555; border-radius: 4px; width: 28px; height: 28px;
    cursor: pointer; font-size: 1em; transition: color 0.15s, border-color 0.15s;
}
#pobj-close:hover { color: #fff; border-color: rgba(255,255,255,0.3); }

#pobj-body {
    flex: 1;
    display: flex;
    overflow: hidden;
    min-height: 0;
}

/* ── IZQUIERDA: Catálogo ── */
#pobj-left {
    flex: 0 0 55%;
    border-right: 1px solid rgba(255,255,255,0.06);
    display: flex;
    flex-direction: column;
    overflow: hidden;
}
#pobj-cat-header {
    padding: 10px 14px 8px;
    border-bottom: 1px solid rgba(255,255,255,0.05);
    flex-shrink: 0;
    background: rgba(0,0,0,0.2);
}
#pobj-cat-filtros {
    display: flex;
    gap: 5px;
    flex-wrap: wrap;
    margin-top: 8px;
}
#pobj-cat-lista {
    flex: 1;
    overflow-y: auto;
    padding: 8px 12px;
    scrollbar-width: thin;
    scrollbar-color: rgba(212,175,55,0.2) transparent;
}

/* ── DERECHA: Inventario ── */
#pobj-right {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}
#pobj-inv-header {
    padding: 10px 14px 8px;
    border-bottom: 1px solid rgba(255,255,255,0.05);
    flex-shrink: 0;
    background: rgba(0,0,0,0.2);
}
#pobj-inv-lista {
    flex: 1;
    overflow-y: auto;
    padding: 8px 12px;
    scrollbar-width: thin;
    scrollbar-color: rgba(212,175,55,0.2) transparent;
}

/* ── Compartidos ── */
.pobj-section-label {
    font-size: 0.62em;
    letter-spacing: 1.8px;
    text-transform: uppercase;
    color: #3a3a58;
    font-weight: 700;
    display: block;
    margin-bottom: 6px;
}
.pobj-search {
    width: 100%;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.09);
    border-radius: 5px;
    color: #ccc;
    padding: 6px 10px;
    font-size: 0.78em;
    outline: none;
    box-sizing: border-box;
    font-family: inherit;
    transition: border-color 0.15s;
}
.pobj-search:focus { border-color: rgba(212,175,55,0.35); }
.pobj-search::placeholder { color: #3a3a58; }

.pobj-filtro-btn {
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.08);
    color: #555;
    border-radius: 4px;
    padding: 3px 9px;
    font-size: 0.62em;
    cursor: pointer;
    font-family: inherit;
    letter-spacing: 0.5px;
    transition: all 0.12s;
}
.pobj-filtro-btn:hover { color: #888; border-color: rgba(255,255,255,0.15); }
.pobj-filtro-btn.activo { color: #d4af37; border-color: rgba(212,175,55,0.4); background: rgba(212,175,55,0.08); }

/* ── Tarjeta de catálogo ── */
.pobj-cat-card {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 8px 10px;
    border-radius: 7px;
    margin-bottom: 5px;
    border: 1px solid rgba(255,255,255,0.04);
    background: rgba(255,255,255,0.02);
    transition: background 0.12s, border-color 0.12s;
    cursor: default;
}
.pobj-cat-card:hover { background: rgba(255,255,255,0.04); }
.pobj-cat-card.en-inv { border-color: rgba(212,175,55,0.18); }
.pobj-cat-img {
    width: 44px; height: 44px;
    border-radius: 5px;
    object-fit: cover;
    background: #111;
    flex-shrink: 0;
    border: 1px solid rgba(255,255,255,0.06);
}
.pobj-cat-info { flex: 1; min-width: 0; }
.pobj-cat-nombre { font-size: 0.82em; font-weight: 700; color: #d0d0e0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pobj-cat-meta { font-size: 0.65em; color: #9090b0; margin-top: 2px; }
.pobj-cat-eff { font-size: 0.68em; color: #8888a8; margin-top: 3px; line-height: 1.4; }
.pobj-rar-badge {
    font-size: 0.58em; font-weight: 700; letter-spacing: 0.5px;
    padding: 2px 6px; border-radius: 3px; white-space: nowrap; flex-shrink: 0;
}
.pobj-cat-actions { display: flex; flex-direction: column; gap: 4px; flex-shrink: 0; }
.pobj-btn-sm {
    font-size: 0.62em; padding: 3px 7px; border-radius: 4px;
    cursor: pointer; border: 1px solid; font-family: inherit;
    white-space: nowrap; transition: all 0.12s;
}
.pobj-btn-add { background: rgba(62,207,110,0.1); color: #3ecf6e; border-color: rgba(62,207,110,0.3); }
.pobj-btn-add:hover { background: rgba(62,207,110,0.22); }
.pobj-btn-edit { background: rgba(100,150,255,0.08); color: #6496ff; border-color: rgba(100,150,255,0.25); }
.pobj-btn-edit:hover { background: rgba(100,150,255,0.18); }

/* ── Tarjeta de inventario ── */
.pobj-inv-card {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    border-radius: 7px;
    margin-bottom: 5px;
    border: 1px solid rgba(255,255,255,0.04);
    background: rgba(255,255,255,0.02);
    transition: background 0.12s;
}
.pobj-inv-card.equipado { border-color: rgba(212,175,55,0.3); background: rgba(212,175,55,0.04); }
.pobj-inv-card.contenedor { border-color: rgba(100,150,255,0.2); }
.pobj-inv-nombre { font-size: 0.82em; font-weight: 700; color: #d0d0e0; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pobj-inv-nombre.equipado { color: #d4af37; }
.pobj-inv-badge-eqp { font-size: 0.58em; background: rgba(212,175,55,0.15); color: #d4af37; border: 1px solid rgba(212,175,55,0.3); border-radius: 3px; padding: 1px 5px; margin-left: 4px; }
.pobj-inv-ctrl { display: flex; align-items: center; gap: 4px; flex-shrink: 0; }
.pobj-ctrl-btn {
    background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.09);
    color: #888; border-radius: 4px; width: 22px; height: 22px;
    cursor: pointer; font-size: 0.85em; display: flex; align-items: center; justify-content: center;
    transition: all 0.12s;
}
.pobj-ctrl-btn:hover { background: rgba(255,255,255,0.1); color: #ccc; }
.pobj-cant { font-size: 0.88em; font-weight: 700; color: #d4af37; min-width: 20px; text-align: center; }
.pobj-btn-eqp {
    font-size: 0.58em; padding: 2px 6px; border-radius: 4px;
    cursor: pointer; border: 1px solid; font-family: inherit; transition: all 0.12s;
}
.pobj-btn-eqp.on { background: rgba(212,175,55,0.15); color: #d4af37; border-color: rgba(212,175,55,0.4); }
.pobj-btn-eqp.off { background: rgba(255,255,255,0.03); color: #3a3a58; border-color: rgba(255,255,255,0.07); }

/* ── Contenedor toggle ── */
.pobj-contenedor-toggle {
    display: flex; align-items: center; gap: 6px;
    cursor: pointer; font-size: 0.7em; color: #6496ff;
    padding: 3px 0;
    user-select: none;
}
.pobj-contenedor-hijos { padding-left: 14px; margin-top: 3px; border-left: 1px solid rgba(100,150,255,0.2); }

/* ── Empty state ── */
.pobj-empty { text-align: center; color: #2e2e48; font-size: 0.75em; padding: 24px 0; }

/* ── Responsive ── */
@media (max-width: 600px) {
    #pobj-body { flex-direction: column; }
    #pobj-left { flex: 0 0 50%; border-right: none; border-bottom: 1px solid rgba(255,255,255,0.06); }
}
    `;
    document.head.appendChild(s);
}

// ── CARGA DE DATOS ───────────────────────────────────────────
async function _cargarDatos() {
    await Promise.all([_cargarCatalogo(), _cargarInventario()]);
}

async function _cargarCatalogo() {
    const { data } = await supabase.from('objetos')
        .select('id,nombre,tipo,material,efecto,rareza,descripcion,vida_roja,vida_azul,contenedor_padre,es_propuesta')
        .eq('es_propuesta', false)
        .order('nombre');
    _st.catalogo = data || [];

    // Mapa contenedor → hijos
    _st.contenidores = {};
    _st.catalogo.forEach(o => {
        if (o.contenedor_padre) {
            if (!_st.contenidores[o.contenedor_padre]) _st.contenidores[o.contenedor_padre] = [];
            _st.contenidores[o.contenedor_padre].push(o.nombre);
        }
    });
}

async function _cargarInventario() {
    if (!_st.nombrePJ) return;
    const { data } = await supabase.from('inventario_objetos')
        .select('objeto_nombre,cantidad,equipado')
        .eq('personaje_nombre', _st.nombrePJ)
        .gt('cantidad', 0);
    _st.inventario = data || [];
}

// ── RENDER PRINCIPAL ─────────────────────────────────────────
function _renderTodo() {
    const pjName = document.getElementById('pobj-pj-name');
    if (pjName) pjName.textContent = _st.nombrePJ || '';
    _renderFiltros();
    _renderCatalogo();
    _renderInventario();
}

function _renderFiltros() {
    const cont = document.getElementById('pobj-cat-filtros');
    if (!cont) return;

    const rars   = ['Todos', 'Común', 'Raro', 'Legendario'];
    const tipos  = ['Todos', ...new Set(_st.catalogo.map(o => o.tipo).filter(Boolean).filter(t => t !== '-'))].sort((a,b) => a==='Todos'?-1:a.localeCompare(b));

    cont.innerHTML =
        rars.map(r => `<button class="pobj-filtro-btn ${_st.filtroCatRar===r?'activo':''}" onclick="window._pobjFiltroRar('${r}')">${r}</button>`).join('') +
        `<span style="color:#2e2e48;font-size:0.65em;margin:0 2px;">·</span>` +
        tipos.map(t => `<button class="pobj-filtro-btn ${_st.filtroCatTipo===t?'activo':''}" onclick="window._pobjFiltroTipo('${t.replace(/'/g,"\\'")}')">${t}</button>`).join('');
}

function _renderCatalogo() {
    const cont = document.getElementById('pobj-cat-lista');
    if (!cont) return;

    const q    = _st.busqCat.toLowerCase().trim();
    const invSet = new Set(_st.inventario.map(i => i.objeto_nombre));

    const lista = _st.catalogo.filter(o => {
        if (_st.filtroCatRar !== 'Todos' && o.rareza !== _st.filtroCatRar) return false;
        if (_st.filtroCatTipo !== 'Todos' && o.tipo !== _st.filtroCatTipo) return false;
        if (q && !o.nombre.toLowerCase().includes(q) && !(o.efecto||'').toLowerCase().includes(q)) return false;
        return true;
    });

    if (lista.length === 0) {
        cont.innerHTML = `<div class="pobj-empty">Sin resultados</div>`;
        return;
    }

    const rarColor = (r) => RAR_COLOR[r] || '#888';
    const rarBg    = (r) => RAR_BG[r] || 'transparent';

    cont.innerHTML = lista.map(o => {
        const enInv   = invSet.has(o.nombre);
        const oSafe   = o.nombre.replace(/'/g, "\\'");
        const hijos   = _st.contenidores[o.nombre]?.length || 0;
        const addBtn  = _st.esAdmin
            ? `<button class="pobj-btn-sm pobj-btn-add" onclick="window._pobjAsignar('${oSafe}',1)">${enInv ? '+1' : '+ Dar'}</button>`
            : '';
        const editBtn = _st.esAdmin
            ? `<button class="pobj-btn-sm pobj-btn-edit" onclick="window._pobjAbrirEditorObjeto('${oSafe}')">✏️</button>`
            : '';
        const imgSrc  = _imgObj(o.nombre);
        const contBadge = hijos > 0 ? `<span style="font-size:0.6em;color:#6496ff;margin-left:4px;">📦 ${hijos}</span>` : '';

        return `<div class="pobj-cat-card ${enInv?'en-inv':''}">
            <img class="pobj-cat-img" src="${imgSrc}" onerror="this.onerror=null;this.src='${_imgFallback()}'" loading="lazy">
            <div class="pobj-cat-info">
                <div class="pobj-cat-nombre">${o.nombre}${contBadge}</div>
                <div class="pobj-cat-meta">${o.tipo||'-'} · ${o.material||'-'}</div>
                <div class="pobj-cat-eff">${o.efecto||''}</div>
            </div>
            <span class="pobj-rar-badge" style="color:${rarColor(o.rareza)};background:${rarBg(o.rareza)};border:1px solid ${rarColor(o.rareza)}44;">${o.rareza||'-'}</span>
            ${_st.esAdmin ? `<div class="pobj-cat-actions">${addBtn}${editBtn}</div>` : ''}
        </div>`;
    }).join('');
}

function _renderInventario() {
    const cont = document.getElementById('pobj-inv-lista');
    if (!cont) return;

    const q = _st.busqInv.toLowerCase().trim();
    const lista = _st.inventario.filter(i => !q || i.objeto_nombre.toLowerCase().includes(q));

    if (lista.length === 0) {
        cont.innerHTML = `<div class="pobj-empty"><div style="font-size:1.5em;margin-bottom:6px;opacity:0.3">🎒</div>Sin objetos en el inventario</div>`;
        return;
    }

    // Ordenar: equipados primero, luego por nombre
    lista.sort((a,b) => {
        if (a.equipado && !b.equipado) return -1;
        if (!a.equipado && b.equipado) return 1;
        return a.objeto_nombre.localeCompare(b.objeto_nombre);
    });

    const catMap = {};
    _st.catalogo.forEach(o => { catMap[o.nombre] = o; });

    cont.innerHTML = lista.map(item => {
        const nombre  = item.objeto_nombre;
        const oSafe   = nombre.replace(/'/g, "\\'");
        const cat     = catMap[nombre] || {};
        const isEqp   = item.equipado;
        const esContenedor = (_st.contenidores[nombre]?.length || 0) > 0;
        const expanded = _st.expandedContainers.has(nombre);

        const ctrlHTML = _st.esAdmin ? `
            <div class="pobj-inv-ctrl">
                <button class="pobj-ctrl-btn" onclick="window._pobjModCantidad('${oSafe}',-1)">−</button>
                <span class="pobj-cant">${item.cantidad}</span>
                <button class="pobj-ctrl-btn" onclick="window._pobjModCantidad('${oSafe}',1)">+</button>
                <button class="pobj-btn-eqp ${isEqp?'on':'off'}" onclick="window._pobjToggleEquip('${oSafe}')">${isEqp?'EQP':'Eqp.'}</button>
            </div>` : `<span class="pobj-cant">${item.cantidad}</span>`;

        const rarColor = RAR_COLOR[cat.rareza] || '#888';

        let html = `<div class="pobj-inv-card ${isEqp?'equipado':''} ${esContenedor?'contenedor':''}">
            <img class="pobj-cat-img" src="${_imgObj(nombre)}" onerror="this.onerror=null;this.src='${_imgFallback()}'" loading="lazy">
            <div style="flex:1;min-width:0;">
                <div class="pobj-inv-nombre ${isEqp?'equipado':''}">${nombre}${isEqp?'<span class="pobj-inv-badge-eqp">EQP</span>':''}</div>
                <div style="font-size:0.62em;color:#7070a0;margin-top:1px;">${cat.tipo||''} · <span style="color:${rarColor};">${cat.rareza||''}</span></div>
            </div>
            ${ctrlHTML}
            ${esContenedor ? `<button class="pobj-ctrl-btn" onclick="window._pobjToggleContenedor('${oSafe}')" title="Ver contenido">${expanded?'▲':'▼'}</button>` : ''}
        </div>`;

        // Contenido del contenedor si está expandido
        if (esContenedor && expanded) {
            const hijos = _st.contenidores[nombre] || [];
            html += `<div class="pobj-contenedor-hijos">` +
                hijos.map(hNombre => {
                    const hCat   = catMap[hNombre] || {};
                    const hSafe  = hNombre.replace(/'/g, "\\'");
                    const hInvItem = _st.inventario.find(i => i.objeto_nombre === hNombre);
                    const hCant  = hInvItem?.cantidad || 0;
                    const addBtn = _st.esAdmin ? `<button class="pobj-btn-sm pobj-btn-add" onclick="window._pobjAsignar('${hSafe}',1)">+1</button>` : '';
                    return `<div class="pobj-inv-card" style="opacity:${hCant>0?1:0.45}">
                        <img class="pobj-cat-img" src="${_imgObj(hNombre)}" onerror="this.onerror=null;this.src='${_imgFallback()}'" loading="lazy" style="width:32px;height:32px;">
                        <div class="pobj-inv-nombre" style="font-size:0.75em;">${hNombre}</div>
                        <span class="pobj-cant" style="font-size:0.8em;">${hCant}</span>
                        ${_st.esAdmin && hCant > 0 ? `<button class="pobj-ctrl-btn" onclick="window._pobjModCantidad('${hSafe}',-1)">−</button>` : ''}
                        ${addBtn}
                    </div>`;
                }).join('') +
            `</div>`;
        }
        return html;
    }).join('');
}

// ── EXPONER API PARA OTROS MÓDULOS ───────────────────────────
// El panel-objetos-op.js puede llamar esto para refrescar tras cambios
window._pobjRecargarDesdeOP = async () => {
    await _cargarDatos();
    _renderTodo();
};

window._pobjAbrirEditorObjeto = (nombre) => {
    // Delega al módulo OP si está disponible
    if (typeof window._pobjopAbrirEditor === 'function') {
        window._pobjopAbrirEditor(nombre);
    }
};
