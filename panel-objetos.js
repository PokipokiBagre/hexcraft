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

const RAR_COLOR = { 'Legendario': '#f5d020', 'Raro': '#ffffff', 'Común': '#ffffff', '-': '#dddddd' };
const RAR_BG    = { 'Legendario': 'rgba(245,208,32,0.25)', 'Raro': 'rgba(140,60,210,0.75)', 'Común': 'rgba(100,100,140,0.60)', '-': 'rgba(80,80,100,0.45)' };

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

// ── ESTILOS — cargados desde objetos.css (raíz del proyecto) ─
function _inyectarEstilos() {
    if (document.getElementById('pobj-styles-link')) return;
    const link = document.createElement('link');
    link.id   = 'pobj-styles-link';
    link.rel  = 'stylesheet';
    link.href = '/objetos.css';   // ← ajustar ruta si cambia la estructura
    document.head.appendChild(link);

    // Parche de legibilidad: sobreescribe colores oscuros que no se leen
    if (document.getElementById('pobj-styles-patch')) return;
    const s = document.createElement('style');
    s.id = 'pobj-styles-patch';
    s.textContent = `
        .pobj-filtro-btn {
            background: rgba(255,255,255,0.06);
            border: 1px solid rgba(255,255,255,0.18);
            color: #b0b0cc;
            border-radius: 4px;
            padding: 2px 9px;
            font-size: 0.68em;
            cursor: pointer;
            font-family: inherit;
            transition: all 0.12s;
        }
        .pobj-filtro-btn:hover { color: #e0e0f0; background: rgba(255,255,255,0.1); }
        .pobj-filtro-btn.activo {
            color: #d4af37;
            border-color: rgba(212,175,55,0.5);
            background: rgba(212,175,55,0.12);
        }
        .pobj-cat-meta { color: #9898b8 !important; }
        .pobj-cat-eff  { color: #a8a8c8 !important; }
    `;
    document.head.appendChild(s);
}


// ── CARGA DE DATOS ───────────────────────────────────────────
async function _cargarDatos() {
    await Promise.all([_cargarCatalogo(), _cargarInventario()]);
}

async function _cargarCatalogo() {
    const { data } = await supabase.from('objetos')
        .select('id,nombre,tipo,material,efecto,rareza,descripcion,vida_roja,vida_azul,es_propuesta')
        .eq('es_propuesta', false)
        .order('nombre');
    _st.catalogo = data || [];
}

async function _cargarInventario() {
    if (!_st.nombrePJ) return;
    const { data } = await supabase.from('inventario_objetos')
        .select('objeto_nombre,cantidad,equipado,contenedor_padre')
        .eq('personaje_nombre', _st.nombrePJ)
        .gt('cantidad', 0);
    _st.inventario = data || [];

    // Mapa contenedor → hijos basado en inventario del PJ
    _st.contenidores = {};
    _st.inventario.forEach(i => {
        if (i.contenedor_padre) {
            if (!_st.contenidores[i.contenedor_padre]) _st.contenidores[i.contenedor_padre] = [];
            _st.contenidores[i.contenedor_padre].push(i.objeto_nombre);
        }
    });
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
        `<span style="color:#aaaaaa;font-size:0.65em;margin:0 2px;">·</span>` +
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
                <div class="pobj-cat-nombre" style="color:#ffffff;font-weight:700;">${o.nombre}${contBadge}</div>
                <div class="pobj-cat-meta" style="color:#cccccc;">${o.tipo||'-'} · ${o.material||'-'}</div>
                <div class="pobj-cat-eff" style="color:#ffffff;">${o.efecto||''}</div>
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

    // Objetos dentro de un contenedor → no mostrar en raíz
    const hijosDeContenedor = new Set(Object.values(_st.contenidores).flat());

    const lista = _st.inventario.filter(i => {
        if (hijosDeContenedor.has(i.objeto_nombre)) return false;
        return !q || i.objeto_nombre.toLowerCase().includes(q);
    });

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
                <div style="font-size:0.62em;color:#cccccc;margin-top:1px;">${cat.tipo||''} · <span style="color:${rarColor};">${cat.rareza||''}</span></div>
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
