// ============================================================
// mapa-ui.js — Toolbar, drawer, grimorio, panel OP izquierdo y Side Panel
// /hechizos/mapa-ui.js
// ============================================================

import { st } from './mapa-state.js';
import {
    cargarInventarioPJ, calcSetsGlobales,
    guardarPosiciones, toggleConocido,
    aplicarPropiedades, asignarHechizosAPJ,
    recargarDatos,
} from './mapa-data.js';
import { centrarCamara, centrarEnNodo, renderInfoBar, renderInfoStats } from './mapa-render.js';

// ── Helpers ─────────────────────────────────────────────────
const _norm = (s) => s ? s.toString().trim().toLowerCase()
    .replace(/[áàäâ]/g,'a').replace(/[éèëê]/g,'e').replace(/[íìïî]/g,'i')
    .replace(/[óòöô]/g,'o').replace(/[úùüû]/g,'u').replace(/[ñ]/g,'n')
    .replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,'') : '';
const _sb = () => {
    try { return window.currentConfig?.storageUrl || ''; } catch { return ''; }
};
const _imgPj = (nombre) => `${_sb()}/imgpersonajes/${_norm(nombre)}icon.png`;
const _fall  = () => `${_sb()}/imginterfaz/no_encontrado.png`;

// ── Toast ────────────────────────────────────────────────────
export function toast(msg, dur=2300) {
    const t = document.getElementById('hm-toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._tid);
    t._tid = setTimeout(() => t.classList.remove('show'), dur);
}

// ── Badge multi-sel ──────────────────────────────────────────
export function actualizarBadgeSel() {
    const b = document.getElementById('hm-sel-badge');
    if (!b) return;
    const n = st.seleccionados.size;
    b.style.display = n > 0 ? 'inline' : 'none';
    b.textContent   = `${n} sel.`;
    // Refrescar panel OP si está abierto
    _refrescarOpPanel();
}


// ══════════════════════════════════════════════════════════════
//  ACTUALIZACIÓN INLINE LOCAL Y GUARDADO DB
// ══════════════════════════════════════════════════════════════
window._hmUpdateLocal = (field, el) => {
    if (!st.nodoSel || !st.esAdmin) return;
    let val = el.type === 'checkbox' ? el.checked : el.value;
    if (['hex', 'vex', 'backcast', 'nextcast'].includes(field)) val = parseInt(val) || 0;
    
    st.nodoSel[field] = val;
    st.nodoSel._dirty = true;

    // Reflejo visual inmediato si afecta diseño base
    if (['nombre', 'esConocido', 'afinidad', 'clase', 'hex', 'vex'].includes(field)) {
        renderInfoBar(st.nodoSel);
        calcSetsGlobales();
        renderGrimorio(document.getElementById('hm-search-central')?.value || '');
    }
};

window._hmGuardarHechizo = async () => {
    const nodo = st.nodoSel;
    if (!nodo || !st.esAdmin) { toast('Selecciona un hechizo primero'); return; }

    const payload = {
        nombre:       nodo.nombre,
        clase:        nodo.clase,
        afinidad:     nodo.afinidad,
        hex_cost:     nodo.hex,
        valor_vex:    nodo.vex,
        backcast:     nodo.backcast,
        nextcast:     nodo.nextcast,
        resumen:      nodo.resumen,
        efecto:       nodo.efecto,
        overcast:     nodo.overcast,
        undercast:    nodo.undercast,
        especial:     nodo.especial,
        nota:         nodo.nota,
        es_conocido:  nodo.esConocido,
        es_estado:    nodo.esEstado,
        es_prioridad: nodo.esPrioridad,
        afecta_usuario:  nodo.afectaUsuario,
        afecta_objetivo: nodo.afectaObjetivo,
        afecta_hechizos: nodo.afectaHechizos,
    };

    const { supabase } = await import('../hex-auth.js');
    let error;

    if (nodo.esNuevo) {
        // En inserción, usamos el ID estático editado en el panel derecho o el temporal
        const newIdInput = document.getElementById('sp-input-id');
        const newId = newIdInput ? newIdInput.value.trim() : nodo.id;
        
        ({ error } = await supabase.from('hechizos_nodos').insert({
            ...payload,
            hechizo_id: newId,
            pos_x: Math.round(nodo.x),
            pos_y: Math.round(nodo.y),
        }));
        if (!error) {
            nodo.id = newId;
            nodo.esNuevo = false;
        }
    } else {
        ({ error } = await supabase.from('hechizos_nodos').update(payload).eq('hechizo_id', nodo.id));
    }

    if (error) { toast('Error al guardar: ' + error.message); return; }

    nodo.radio = nodo.esConocido ? 35 : 28;
    nodo._dirty = false;
    
    calcSetsGlobales();
    renderInfoStats();
    renderSidePanel(nodo); // Refresca por si cambió el ID a estático
    renderGrimorio(document.getElementById('hm-search-central')?.value || '');
    toast('✓ Hechizo guardado en DB');
};


// ══════════════════════════════════════════════════════════════
//  PANEL LATERAL DERECHO — Info y Edición Inline Automática
// ══════════════════════════════════════════════════════════════
export function abrirSidePanel(nodo) {
    const panel = document.getElementById('hm-side-panel');
    if (!panel) return;
    panel.classList.add('abierto');
    document.body.classList.add('side-panel-open');
    renderSidePanel(nodo);
    
    // Si el panel OP izquierdo está abierto, sincronizarlo
    _refrescarOpPanel();
}

export function cerrarSidePanel() {
    st.nodoSel = null;
    const panel = document.getElementById('hm-side-panel');
    if (panel) panel.classList.remove('abierto');
    document.body.classList.remove('side-panel-open');
    renderInfoBar(null);
    _refrescarOpPanel();
}
window._hmCerrarSidePanel = cerrarSidePanel;

export function renderSidePanel(nodo) {
    const body = document.getElementById('hm-side-panel-body');
    const titulo = document.getElementById('sp-titulo-txt');
    if (!body) return;
    if (!nodo) { body.innerHTML = ''; return; }

    const esPosesion = st.posesiones.has(nodo);
    const mostrar    = nodo.esConocido || esPosesion || st.esAdmin;
    const color      = (st.colores[nodo.afinidad] || {}).t || '#888';
    const nombreSafe = mostrar ? nodo.nombre : (nodo.id.match(/\d+/) ? `Hechizo ${nodo.id.match(/\d+/)[0]}` : nodo.id);
    
    if (titulo) titulo.textContent = nombreSafe;

    const afinOpts = Object.keys(st.colores).map(a=>`<option value="${a}" ${nodo.afinidad===a?'selected':''}>${a}</option>`).join('');
    const claseOpts = ['1','2','3','4','5'].map(c=>`<option value="${c}" ${nodo.clase==c?'selected':''}>Clase ${c}</option>`).join('');

    if (st.esAdmin) {
        // MODO EDICIÓN INLINE (OP)
        body.innerHTML = `
            <div class="sp-desc-field" style="margin-bottom:12px;">
                <input class="sp-inline-input sp-inline-title" style="color:${color}" value="${(nodo.nombre||'').replace(/"/g,'&quot;')}" onchange="window._hmUpdateLocal('nombre', this)">
            </div>
            
            <div class="sp-desc-field">
                <div class="sp-desc-label">ID Sistema</div>
                ${nodo.esNuevo 
                    ? `<input id="sp-input-id" class="sp-inline-input" value="${nodo.id}" style="color:#d4af37">`
                    : `<div class="sp-desc-val" style="opacity:0.5">${nodo.id}</div>`}
            </div>

            <div class="sp-grid-2">
                <div class="sp-desc-field">
                    <div class="sp-desc-label">Afinidad</div>
                    <select class="sp-inline-input" style="color:${color}" onchange="window._hmUpdateLocal('afinidad', this)">
                        <option value="">—</option>${afinOpts}
                    </select>
                </div>
                <div class="sp-desc-field">
                    <div class="sp-desc-label">Clase</div>
                    <select class="sp-inline-input" onchange="window._hmUpdateLocal('clase', this)">
                        ${claseOpts}
                    </select>
                </div>
                <div class="sp-desc-field">
                    <div class="sp-desc-label">HEX</div>
                    <input type="number" class="sp-inline-input" value="${nodo.hex||0}" min="0" onchange="window._hmUpdateLocal('hex', this)">
                </div>
                <div class="sp-desc-field">
                    <div class="sp-desc-label">VEX</div>
                    <input type="number" class="sp-inline-input" value="${nodo.vex||0}" min="0" onchange="window._hmUpdateLocal('vex', this)">
                </div>
                <div class="sp-desc-field">
                    <div class="sp-desc-label">Backcast</div>
                    <input type="number" class="sp-inline-input" value="${nodo.backcast||0}" min="0" onchange="window._hmUpdateLocal('backcast', this)">
                </div>
                <div class="sp-desc-field">
                    <div class="sp-desc-label">Nextcast</div>
                    <input type="number" class="sp-inline-input" value="${nodo.nextcast||0}" min="0" onchange="window._hmUpdateLocal('nextcast', this)">
                </div>
            </div>

            <div style="height:1px;background:rgba(255,255,255,0.05);margin:10px 0;"></div>

            <div class="sp-desc-field">
                <div class="sp-desc-label">Resumen</div>
                <textarea class="sp-inline-area" rows="2" onchange="window._hmUpdateLocal('resumen', this)">${nodo.resumen||''}</textarea>
            </div>
            <div class="sp-desc-field">
                <div class="sp-desc-label">Efecto</div>
                <textarea class="sp-inline-area" rows="4" onchange="window._hmUpdateLocal('efecto', this)">${nodo.efecto||''}</textarea>
            </div>
            <div class="sp-desc-field">
                <div class="sp-desc-label">Overcast</div>
                <textarea class="sp-inline-area" rows="2" onchange="window._hmUpdateLocal('overcast', this)">${nodo.overcast||''}</textarea>
            </div>
            <div class="sp-desc-field">
                <div class="sp-desc-label">Undercast</div>
                <textarea class="sp-inline-area" rows="2" onchange="window._hmUpdateLocal('undercast', this)">${nodo.undercast||''}</textarea>
            </div>
            <div class="sp-desc-field">
                <div class="sp-desc-label">Especial</div>
                <textarea class="sp-inline-area" rows="2" onchange="window._hmUpdateLocal('especial', this)">${nodo.especial||''}</textarea>
            </div>
            <div class="sp-desc-field">
                <div class="sp-desc-label">Nota Privada OP</div>
                <textarea class="sp-inline-area" rows="2" style="color:#d4a830;" onchange="window._hmUpdateLocal('nota', this)">${nodo.nota||''}</textarea>
            </div>
        `;
    } else {
        // MODO LECTURA NORMAL (JUGADOR)
        const campos = mostrar ? [
            { label:'Efecto',    val: nodo.efecto },
            { label:'Resumen',   val: nodo.resumen },
            { label:'Overcast',  val: nodo.overcast },
            { label:'Undercast', val: nodo.undercast },
            { label:'Especial',  val: nodo.especial },
        ].filter(c => c.val) : [];

        let gridHtml = '';
        if (mostrar) {
            gridHtml = `
            <div class="sp-grid-2" style="margin-bottom:12px;">
                <div class="sp-desc-field"><div class="sp-desc-label">Clase</div><div class="sp-desc-val">${nodo.clase}</div></div>
                <div class="sp-desc-field"><div class="sp-desc-label">HEX</div><div class="sp-desc-val">${nodo.hex||0}</div></div>
                ${nodo.vex > 0 ? `<div class="sp-desc-field"><div class="sp-desc-label">VEX</div><div class="sp-desc-val">${nodo.vex}</div></div>` : ''}
                ${nodo.backcast > 0 ? `<div class="sp-desc-field"><div class="sp-desc-label">Backcast</div><div class="sp-desc-val">${nodo.backcast}</div></div>` : ''}
                ${nodo.nextcast > 0 ? `<div class="sp-desc-field"><div class="sp-desc-label">Nextcast</div><div class="sp-desc-val">${nodo.nextcast}</div></div>` : ''}
            </div>`;
        }

        body.innerHTML = `
            <div class="sp-nodo-nombre" style="color:${color}">${nombreSafe}</div>
            ${gridHtml}
            ${mostrar ? campos.map(c => `
                <div class="sp-desc-field">
                    <div class="sp-desc-label">${c.label}</div>
                    <div class="sp-desc-val">${c.val}</div>
                </div>`).join('') : `<div style="font-size:0.7em;color:#2a2a3a;font-style:italic;">Sellado — sin información</div>`}
        `;
    }
}


// ══════════════════════════════════════════════════════════════
//  PANEL OP IZQUIERDO — Deslizable manual
// ══════════════════════════════════════════════════════════════
window._hmToggleOpLeft = () => {
    const isAbierto = document.body.classList.toggle('op-panel-open');
    const panel = document.getElementById('hm-op-left');
    
    if (isAbierto) {
        panel.classList.add('abierto');
        _renderOpTools();
        _renderOpLeft();
    } else {
        panel.classList.remove('abierto');
    }
};

function _refrescarOpPanel() {
    const panel = document.getElementById('hm-op-left');
    if (!panel || !panel.classList.contains('abierto')) return;
    _renderOpLeft();
}

function _renderOpLeft() {
    const body = document.getElementById('hm-op-left-body');
    if (!body) return;
    const nodo = st.nodoSel;
    const nSel = st.seleccionados.size;

    let html = '';

    // SECCIÓN 1: ACCIONES SOBRE EL NODO ACTUAL (si hay uno seleccionado)
    if (nodo) {
        const safe = nodo.id.replace(/'/g,"\\'");
        const esPosesion = st.posesiones.has(nodo);

        html += `
            <div class="op-l-section-title">Acciones del Hechizo</div>
            <div class="op-l-row">
                <button class="op-l-btn ${nodo.esConocido?'op-l-warn':'op-l-gold'}" onclick="window._hmToggleConocido('${safe}',${!nodo.esConocido})">
                    ${nodo.esConocido ? '🔒 Ocultar' : '👁 Publicar'}
                </button>
                <button class="op-l-btn op-l-green" onclick="window._hmModalAsignarPJLeft()">👤 Asignar a PJ</button>
                ${esPosesion && st.jugadorPanel !== 'Todos' ?
                  `<button class="op-l-btn op-l-danger" onclick="window._hmQuitarDePJ('${safe}')">✕ Quitar</button>` : ''}
                ${nodo.esNuevo ?
                  `<button class="op-l-btn op-l-danger" onclick="window._hmEliminarNuevo('${safe}')">🗑 Descartar</button>` : ''}
            </div>
            
            <div class="op-l-sep"></div>
            <div class="op-l-section-title">Características</div>
            <div class="op-l-checks">
                <label><input type="checkbox" onchange="window._hmUpdateLocal('esConocido', this)" ${nodo.esConocido?'checked':''}> Conocido (publicado)</label>
                <label><input type="checkbox" onchange="window._hmUpdateLocal('esEstado', this)" ${nodo.esEstado?'checked':''}> Hechizo-Estado</label>
                <label><input type="checkbox" onchange="window._hmUpdateLocal('esPrioridad', this)" ${nodo.esPrioridad?'checked':''}> Prioridad</label>
                <label><input type="checkbox" onchange="window._hmUpdateLocal('afectaUsuario', this)" ${nodo.afectaUsuario?'checked':''}> Afecta Usuario</label>
                <label><input type="checkbox" onchange="window._hmUpdateLocal('afectaObjetivo', this)" ${nodo.afectaObjetivo?'checked':''}> Afecta Objetivo</label>
                <label><input type="checkbox" onchange="window._hmUpdateLocal('afectaHechizos', this)" ${nodo.afectaHechizos?'checked':''}> Afecta Hechizos</label>
            </div>
            
            <div class="op-l-row" style="margin-top:12px;">
                <button class="op-l-btn op-l-gold" style="width:100%" onclick="window._hmGuardarHechizo()">💾 Guardar en DB</button>
            </div>
            <div class="op-l-sep"></div>
        `;
    }

    // SECCIÓN 2: MULTI-SELECCIÓN BATCH
    html += `
        <div class="op-l-section-title">Multi-selección ${nSel > 0 ? `(${nSel})` : ''}</div>
        <div class="op-l-row">
            <button class="op-l-btn ${st.modoSelMulti?'op-l-active':''}" onclick="window._hmToggleMultiLeft()">
                ${st.modoSelMulti ? '☑ Multi-sel activo' : '☐ Activar Multi-sel'}
            </button>
            ${nSel > 0 ? `<button class="op-l-btn op-l-warn" onclick="window._hmLimpiarSel()">✕ Limpiar sel.</button>` : ''}
        </div>
        ${nSel > 0 ? `
        <div class="op-l-row" style="margin-top:6px;">
            <button class="op-l-btn op-l-green" onclick="window._hmBatchAsignarLeft()">👤 Asignar batch (${nSel})</button>
            <button class="op-l-btn" onclick="window._hmBatchPropsLeft()">⚙ Props batch</button>
        </div>
        <div id="op-l-batch-form"></div>` : ''}
    `;

    body.innerHTML = html;
}

// ══════════════════════════════════════════════════════════════
//  BARRA DE HERRAMIENTAS TOP (Inyectada al abrir Panel OP)
// ══════════════════════════════════════════════════════════════
function _renderOpTools() {
    const bar = document.getElementById('hm-op-tools');
    if (!bar) return;
    
    bar.innerHTML = `
        <div class="tool-group">
            <button class="hm-btn gold" onclick="window._hmNuevoNodo()">➕ Nuevo nodo</button>
            <button class="hm-btn" id="hm-btn-flecha" onclick="window._hmToggleConexion()">
                ↗ ${st.modoConexion ? 'Cancelar flecha' : 'Modo flecha'}
            </button>
        </div>
        <div class="tool-group">
            <button class="hm-btn gold" onclick="window._hmGuardarPos()">💾 Guardar posiciones</button>
            <button class="hm-btn" onclick="window._hmAutoOrdenar()">🌀 Auto-ordenar</button>
        </div>
    `;
    if (st.modoConexion) document.getElementById('hm-btn-flecha')?.classList.add('activo');
}

// ── Toggle multi-sel ───────────────────────
window._hmToggleMultiLeft = () => {
    st.modoSelMulti = !st.modoSelMulti;
    if (!st.modoSelMulti) { st.seleccionados.clear(); actualizarBadgeSel(); }
    _renderOpLeft();
};
window._hmToggleMulti = window._hmToggleMultiLeft;


// ══════════════════════════════════════════════════════════════
//  FORMS BATCH INLINE (Panel OP Izquierdo)
// ══════════════════════════════════════════════════════════════
window._hmModalAsignarPJLeft = () => {
    const nodo = st.nodoSel;
    if (!nodo) return;
    const form = document.getElementById('op-l-batch-form') || document.querySelector('#hm-op-left-body');
    if (!form) return;

    const pjOpts = st.personajes.map(p=>`<option value="${p}">${p}</option>`).join('');
    const hexTotal = nodo.hex || 0;

    let sec = document.getElementById('op-l-asignar-sec');
    if (!sec) {
        sec = document.createElement('div');
        sec.id = 'op-l-asignar-sec';
        document.getElementById('hm-op-left-body')?.appendChild(sec);
    }
    sec.innerHTML = `
        <div class="op-l-sep"></div>
        <div class="op-l-section-title">ASIGNAR A PERSONAJE</div>
        <div class="op-l-field-row">
            <label>Personaje</label>
            <select id="op-asig-pj">${pjOpts}</select>
        </div>
        <div class="op-l-field-row">
            <label>Costo HEX</label>
            <select id="op-asig-hex">
                <option value="0">Gratis</option>
                <option value="50">50% — ${Math.round(hexTotal*0.5)} HEX</option>
                <option value="100" selected>100% — ${hexTotal} HEX</option>
            </select>
        </div>
        <label style="display:flex;align-items:center;gap:6px;font-size:0.7em;color:#888;margin:6px 0;">
            <input type="checkbox" id="op-asig-pub"> Publicar al asignar
        </label>
        <div class="op-l-row">
            <button class="op-l-btn op-l-green" onclick="window._hmConfirmarAsignar('${nodo.id.replace(/'/g,"\\'")}')">✓ Confirmar</button>
            <button class="op-l-btn" onclick="document.getElementById('op-l-asignar-sec').remove()">✕ Cancelar</button>
        </div>`;
};

window._hmConfirmarAsignar = async (id) => {
    const nodo = st.nodos.find(n => n.id === id);
    if (!nodo) return;
    const pj = document.getElementById('op-asig-pj')?.value;
    const pct = parseInt(document.getElementById('op-asig-hex')?.value||'100');
    const publicar = document.getElementById('op-asig-pub')?.checked;
    if (!pj) { toast('Selecciona un personaje'); return; }

    const { ok, total, err } = await asignarHechizosAPJ([nodo.nombre], pj);
    if (err) { toast('Error: ' + err); return; }

    if (pct > 0 && ok > 0 && nodo.hex > 0) {
        const hexGastado = Math.round(nodo.hex * pct / 100);
        const { supabase } = await import('../hex-auth.js');
        const { data: pjData } = await supabase.from('personajes').select('hex').eq('nombre', pj).single();
        if (pjData) await supabase.from('personajes').update({ hex: Math.max(0,(pjData.hex||0)-hexGastado) }).eq('nombre', pj);
    }
    if (publicar) await toggleConocido(nodo.id, true);

    document.getElementById('op-l-asignar-sec')?.remove();
    toast(`✓ ${nodo.nombre} asignado a ${pj}`);
    _renderOpLeft();
};

window._hmBatchAsignarLeft = () => {
    const nodos = [...st.seleccionados];
    if (nodos.length === 0) return;
    const bf = document.getElementById('op-l-batch-form');
    if (!bf) return;
    const pjOpts = st.personajes.map(p=>`<option value="${p}">${p}</option>`).join('');
    const hexTotal = nodos.reduce((s,n)=>s+(n.hex||0),0);
    bf.innerHTML = `
        <div class="op-l-sep"></div>
        <div class="op-l-section-title">ASIGNAR BATCH A PJ</div>
        <div class="op-l-field-row">
            <label>Personaje</label>
            <select id="op-batch-pj">${pjOpts}</select>
        </div>
        <div class="op-l-field-row">
            <label>Costo HEX</label>
            <select id="op-batch-hex">
                <option value="0">Gratis</option>
                <option value="100" selected>100% — ${hexTotal} HEX</option>
            </select>
        </div>
        <label style="display:flex;align-items:center;gap:6px;font-size:0.7em;color:#888;margin:6px 0;">
            <input type="checkbox" id="op-batch-pub"> Publicar al asignar
        </label>
        <div class="op-l-row">
            <button class="op-l-btn op-l-green" onclick="window._hmConfirmarBatchAsignar()">✓ Confirmar (${nodos.length})</button>
            <button class="op-l-btn" onclick="document.getElementById('op-l-batch-form').innerHTML=''">✕</button>
        </div>`;
};

window._hmConfirmarBatchAsignar = async () => {
    const nodos = [...st.seleccionados];
    const pj = document.getElementById('op-batch-pj')?.value;
    const pct = parseInt(document.getElementById('op-batch-hex')?.value||'100');
    const publicar = document.getElementById('op-batch-pub')?.checked;
    if (!pj || nodos.length === 0) return;

    const { ok, total, err } = await asignarHechizosAPJ(nodos.map(n=>n.nombre), pj);
    if (err) { toast('Error: ' + err); return; }
    if (publicar) for (const n of nodos) if (!n.esConocido) await toggleConocido(n.id, true);
    document.getElementById('op-l-batch-form').innerHTML = '';
    toast(`✓ ${ok}/${total} hechizos asignados a ${pj}`);
    _renderOpLeft();
};

window._hmBatchPropsLeft = () => {
    const nodos = [...st.seleccionados];
    if (nodos.length === 0) return;
    const bf = document.getElementById('op-l-batch-form');
    if (!bf) return;
    const afinOpts = Object.keys(st.colores).map(a=>`<option value="${a}">${a}</option>`).join('');
    bf.innerHTML = `
        <div class="op-l-sep"></div>
        <div class="op-l-section-title">PROPIEDADES BATCH (${nodos.length})</div>
        <div class="op-l-field-row-2">
            <div><label>HEX</label><input id="bp-hex" type="number" placeholder="—" min="0"></div>
            <div><label>VEX</label><input id="bp-vex" type="number" placeholder="—" min="0"></div>
            <div><label>Clase</label>
                <select id="bp-clase">
                    <option value="">—</option>
                    ${['1','2','3','4','5'].map(c=>`<option value="${c}">${c}</option>`).join('')}
                </select>
            </div>
            <div><label>Afinidad</label>
                <select id="bp-afin"><option value="">—</option>${afinOpts}</select>
            </div>
        </div>
        <div class="op-l-checks">
            <label><input type="checkbox" id="bp-pub"> Publicar todos</label>
            <label><input type="checkbox" id="bp-ocultar"> Ocultar todos</label>
            <label><input type="checkbox" id="bp-prio"> Marcar prioridad</label>
            <label><input type="checkbox" id="bp-estado"> Marcar estado</label>
        </div>
        <div class="op-l-row" style="margin-top:8px;">
            <button class="op-l-btn op-l-gold" onclick="window._hmConfirmarBatchProps()">✓ Aplicar</button>
            <button class="op-l-btn" onclick="document.getElementById('op-l-batch-form').innerHTML=''">✕</button>
        </div>`;
};

window._hmConfirmarBatchProps = async () => {
    const ids = [...st.seleccionados].map(n=>n.id);
    const hex = document.getElementById('bp-hex')?.value.trim();
    const vex = document.getElementById('bp-vex')?.value.trim();
    const clase = document.getElementById('bp-clase')?.value;
    const afin = document.getElementById('bp-afin')?.value;
    const pub = document.getElementById('bp-pub')?.checked;
    const oc  = document.getElementById('bp-ocultar')?.checked;
    const prio = document.getElementById('bp-prio')?.checked;
    const est  = document.getElementById('bp-estado')?.checked;

    const payload = {};
    if (hex !== '')   payload.hex_cost     = parseInt(hex)||0;
    if (vex !== '')   payload.valor_vex    = parseInt(vex)||0;
    if (clase)        payload.clase        = clase;
    if (afin)         payload.afinidad     = afin;
    if (pub)          payload.es_conocido  = true;
    if (oc)           payload.es_conocido  = false;
    if (prio)         payload.es_prioridad = true;
    if (est)          payload.es_estado    = true;

    if (!Object.keys(payload).length) { toast('Sin cambios'); return; }
    const { ok, err } = await aplicarPropiedades(ids, payload);
    document.getElementById('op-l-batch-form').innerHTML = '';
    toast(`✓ ${ok} actualizado${ok!==1?'s':''}${err?` · ${err} error${err!==1?'es':''}`:''}`);
    calcSetsGlobales();
    _renderOpLeft();
};


// ══════════════════════════════════════════════════════════════
//  POOLS, DRAWER Y GRIMORIO (Intacto)
// ══════════════════════════════════════════════════════════════

export function renderPools() {
    const npcs = st.personajes.filter(p => !st.jugadores.includes(p));

    const tarjeta = (nombre, poolId) => {
        const activo = st.jugadorPanel === nombre;
        return `<div class="hm-pool-card ${activo?'activo':''}"
            onclick="window._hmCambiarPJ('${nombre.replace(/'/g,"\\'")}');window._hmCerrarPools()"
            title="${nombre}">
            <img class="hm-pool-avatar"
                src="${_imgPj(nombre)}"
                onerror="this.onerror=null;this.src='${_fall()}'">
            <span class="hm-pool-nombre">${nombre}</span>
        </div>`;
    };

    const jugGrid = document.getElementById('pool-jug-grid');
    const npcGrid = document.getElementById('pool-npc-grid');
    if (jugGrid) jugGrid.innerHTML = st.jugadores.map(j => tarjeta(j, 'jugadores')).join('') || '<span style="font-size:0.65em;color:#3a3a55;">Sin jugadores</span>';
    if (npcGrid) npcGrid.innerHTML = npcs.map(n => tarjeta(n, 'npcs')).join('') || '<span style="font-size:0.65em;color:#3a3a55;">Sin NPCs</span>';

    const jugBtn = document.getElementById('pool-jug-btn');
    const npcBtn = document.getElementById('pool-npc-btn');
    const jugActivo = st.jugadores.includes(st.jugadorPanel);
    const npcActivo = npcs.includes(st.jugadorPanel);
    if (jugBtn) jugBtn.classList.toggle('activo', jugActivo);
    if (npcBtn) npcBtn.classList.toggle('activo', npcActivo);
}

window._hmTogglePool = (cual) => {
    const drops = { jugadores: 'pool-jugadores-drop', npcs: 'pool-npcs-drop' };
    const otroId = cual === 'jugadores' ? drops.npcs : drops.jugadores;
    document.getElementById(otroId)?.classList.remove('open');
    document.getElementById(drops[cual])?.classList.toggle('open');
};

window._hmCerrarPools = () => {
    document.querySelectorAll('.hm-pj-pool-dropdown').forEach(d => d.classList.remove('open'));
};

document.addEventListener('click', e => {
    if (!e.target.closest('.hm-pj-pool-wrap')) window._hmCerrarPools();
});

export function renderToolbar() {
    renderPools();
    const dtAdmin = document.getElementById('dt-admin');
    if (dtAdmin) dtAdmin.style.display = st.esAdmin ? '' : 'none';
}

export function renderDrawer() {
    const dtAdmin = document.getElementById('dt-admin');
    if (dtAdmin) dtAdmin.style.display = st.esAdmin ? '' : 'none';
    renderGrimorio('');
    if (st.esAdmin) _renderDrawerAdmin();
}

window._hmToggleDrawer = () => {
    const drawer = document.getElementById('hm-drawer');
    const tab    = document.getElementById('hm-drawer-tab');
    if (!drawer) return;
    const abierto = drawer.classList.toggle('open');
    tab?.classList.toggle('open', abierto);
    document.body.classList.toggle('drawer-open', abierto);
};

window._hmDrawerTab = (cual) => {
    document.getElementById('hm-pane-grimorio')?.classList.toggle('oculto', cual !== 'grimorio');
    document.getElementById('hm-pane-admin')?.classList.toggle('oculto',   cual !== 'admin');
    document.querySelectorAll('.hm-dtab').forEach(b => b.classList.remove('activo'));
    document.getElementById(`dt-${cual}`)?.classList.add('activo');
};

window._hmBuscar = (query) => renderGrimorio(query);

export function renderGrimorio(query = '') {
    const lista = document.getElementById('hm-grimorio-list');
    if (!lista) return;

    const q = query.toLowerCase().trim();
    const grupos = {};
    st.nodos.forEach(nodo => {
        const af = nodo.afinidad || 'Desconocida';
        if (!grupos[af]) grupos[af] = [];
        const visible = nodo.esConocido || st.posesiones.has(nodo) || st.esAdmin;
        const nombre  = nodo.esConocido || st.esAdmin ? nodo.nombre : `Hechizo ${nodo.id.match(/\d+/)?.[0] || '?'}`;
        if (q && !nombre.toLowerCase().includes(q) && !af.toLowerCase().includes(q)) return;
        grupos[af].push({ nodo, visible, nombre });
    });

    const afinidades = Object.keys(grupos).sort();
    if (afinidades.length === 0) {
        lista.innerHTML = '<div style="font-size:0.7em;color:#333;padding:12px 8px;">Sin resultados</div>';
        return;
    }

    const abiertos = new Set(
        q
            ? afinidades
            : [...lista.querySelectorAll('.gr-grupo.open')].map(el => el.dataset.af)
    );

    lista.innerHTML = afinidades.map(af => {
        const hechizos = grupos[af];
        const colorAf  = (st.colores[af] || {}).t || '#888';
        const estaAbierto = abiertos.has(af) || q;

        const filas = hechizos.map(({ nodo, visible, nombre }) => {
            const esPosesion  = st.posesiones.has(nodo);
            const esAprendible = st.aprendibles.has(nodo);

            let badge = '';
            if (esPosesion)         badge = '<span class="gr-hz-badge posesion">✓</span>';
            else if (nodo.esConocido) badge = '<span class="gr-hz-badge conocido">Conocido</span>';
            else if (esAprendible)   badge = '<span class="gr-hz-badge aprendible">Aprendible</span>';

            const meta = [
                nodo.clase ? `Cl.${nodo.clase}` : '',
                nodo.hex > 0 ? `⬡${nodo.hex}` : '',
                nodo.vex > 0 ? `⬡${nodo.vex}v` : '',
            ].filter(Boolean).join(' ');

            const safe = nodo.id.replace(/'/g, "\\'");
            return `<div class="gr-hz-row" data-id="${nodo.id}" onclick="window._hmGrimorioSel('${safe}')">
                <span class="gr-hz-dot" style="background:${colorAf};border-color:${colorAf}55;opacity:${visible?1:0.3}"></span>
                <span class="gr-hz-nombre${visible ? '' : ' desconocido'}">${nombre}</span>
                <span class="gr-hz-meta">${meta}</span>
                ${badge}
            </div>`;
        }).join('');

        return `<div class="gr-grupo${estaAbierto ? ' open' : ''}" data-af="${af}">
            <div class="gr-grupo-header" onclick="this.parentElement.classList.toggle('open')">
                <span class="gr-grupo-arrow">▶</span>
                <span class="gr-grupo-nombre" style="color:${colorAf}">${af}</span>
                <span class="gr-grupo-count">${hechizos.length}</span>
            </div>
            <div class="gr-grupo-hechizos">${filas}</div>
        </div>`;
    }).join('');
}

window._hmGrimorioSel = (id) => {
    const nodo = st.nodos.find(n => n.id === id);
    if (!nodo) return;

    document.querySelectorAll('.gr-hz-row').forEach(r => r.classList.remove('sel'));
    document.querySelector(`.gr-hz-row[data-id="${id}"]`)?.classList.add('sel');

    st.nodoSel = nodo;
    renderInfoBar(nodo);
    centrarEnNodo(nodo);
    abrirSidePanel(nodo);
};


// ══════════════════════════════════════════════════════════════
//  PORTAPAPELES, MODALES ORIGINALES Y UTILIDADES
// ══════════════════════════════════════════════════════════════
function _mostrarClipboard(pj, hechizosAsignados, hexGastado, descubiertos) {
    const el = document.getElementById('hm-clipboard');
    const ct = document.getElementById('hm-clipboard-content');
    if (!el || !ct) return;
    ct.innerHTML = `
        <div class="clip-title">📋 Resumen de operación</div>
        <div><span class="clip-pj">${pj}</span></div>
        ${hechizosAsignados.length > 0 ?
          `<div><span class="clip-hz">Hechizo${hechizosAsignados.length>1?'s':''} asignado${hechizosAsignados.length>1?'s':''}: </span>${hechizosAsignados.join(', ')}</div>` : ''}
        ${hexGastado > 0 ? `<div><span class="clip-hex">Gasto HEX: −${hexGastado}</span></div>` : ''}
        ${descubiertos.length > 0 ?
          `<div><span class="clip-desc">Hechizos descubiertos: ${descubiertos.join(', ')}</span></div>` : ''}
    `;
    el.classList.add('visible');
}

function _renderDrawerAdmin() {
    const pane = document.getElementById('hm-pane-admin');
    if (!pane || !st.esAdmin) return;

    pane.innerHTML = `
        <div class="adm-seccion">
            <div class="adm-titulo">Nodos y conexiones</div>
            <div class="adm-fila">
                <button class="hm-btn gold" onclick="window._hmNuevoNodo()">➕ Nuevo nodo</button>
                <button class="hm-btn" id="hm-btn-flecha" onclick="window._hmToggleConexion()">↗ Modo flecha</button>
                <button class="hm-btn gold" onclick="window._hmGuardarPos()">💾 Guardar posiciones</button>
                <button class="hm-btn" onclick="window._hmAutoOrdenar()">🌀 Auto-ordenar</button>
            </div>
        </div>
        <div class="adm-seccion">
            <div class="adm-titulo">Selección múltiple</div>
            <div class="adm-fila">
                <button class="hm-btn" id="hm-btn-multi" onclick="window._hmToggleMulti()">☐ Multi-sel</button>
                <button class="hm-btn" onclick="window._hmModalPropiedades()">⚙ Propiedades batch</button>
                <button class="hm-btn verde" onclick="window._hmModalAsignarPJ()">👤 Asignar a PJ</button>
            </div>
        </div>
    `;
}

window._hmCambiarPJ = async (nombre) => {
    st.jugadorPanel = nombre;
    await cargarInventarioPJ(nombre);
    calcSetsGlobales();
    renderInfoStats();
    renderGrimorio(document.getElementById('hm-search-central')?.value || '');
    renderPools();
    if (st.nodoSel) renderSidePanel(st.nodoSel);
};

window._hmBuscarCentral = (query) => {
    const q = query.trim().toLowerCase();
    const numMatch = q.match(/^(?:hechizo\s*)?(\d+)$/);
    if (numMatch) {
        const num = numMatch[1];
        const nodo = st.nodos.find(n => n.id.match(/\d+/)?.[0] === num);
        if (nodo) {
            centrarEnNodo(nodo);
            st.nodoSel = nodo;
            renderSidePanel(nodo);
            renderInfoBar(nodo);
        }
        renderGrimorio(q);
    } else {
        renderGrimorio(q);
    }
};

window._hmCentrar = centrarCamara;

window._hmToggleConexion = () => {
    st.modoConexion = !st.modoConexion;
    st.tempFlecha   = null;
    const btn = document.getElementById('hm-btn-flecha');
    if (btn) {
        btn.classList.toggle('activo', st.modoConexion);
        btn.textContent = st.modoConexion ? '↗ Cancelar flecha' : '↗ Modo flecha';
    }
    const wrap = document.getElementById('hm-canvas-wrap');
    if (wrap) wrap.style.cursor = st.modoConexion ? 'crosshair' : 'grab';
};

window._hmNuevoNodo = () => {
    if (!st.esAdmin) return;
    const wrap = document.getElementById('hm-canvas-wrap');
    if (!wrap) return;
    const cx = (wrap.clientWidth /2 - st.camara.x) / st.camara.zoom;
    const cy = (wrap.clientHeight/2 - st.camara.y) / st.camara.zoom;
    const id = `hechizo_nuevo_${Date.now()}`;
    const nodo = {
        id, nombre: 'Nuevo Hechizo', afinidad:'Desconocida', clase:'1',
        hex:0, vex:0, nota:'', esConocido:false, esNuevo:true,
        esEstado:false, esPrioridad:false, backcast:0, nextcast:0,
        afectaHechizos:false, afectaUsuario:false, afectaObjetivo:false,
        x:cx, y:cy, radio:28, color:'#888', incomingSources:[], _dirty:true,
    };
    st.nodos.push(nodo);
    st.nodoSel = nodo;
    renderInfoBar(nodo);
    renderGrimorio(document.getElementById('hm-search-central')?.value || '');
    abrirSidePanel(nodo);
    toast('Nodo creado. Edítalo a la derecha y guárdalo desde el Panel OP izquierdo.');
};

window._hmGuardarPos = async () => {
    if (!st.esAdmin) return;
    const { ok, err, total } = await guardarPosiciones();
    if (total === 0) { toast('Sin posiciones que guardar'); return; }
    toast(`✓ ${ok} posición${ok!==1?'es':''} guardada${ok!==1?'s':''}${err?` · ${err} error${err!==1?'es':''}`:''}`);
};

window._hmToggleConocido = async (id, nuevoValor) => {
    const ok = await toggleConocido(id, nuevoValor);
    if (!ok) { toast('Error al actualizar'); return; }
    const nodo = st.nodos.find(n => n.id===id);
    if (nodo) {
        renderInfoBar(nodo);
        renderGrimorio(document.getElementById('hm-search-central')?.value || '');
    }
    toast(nuevoValor ? '👁 Publicado' : '🔒 Ocultado');
    _refrescarOpPanel();
};

window._hmEliminarNuevo = (id) => {
    st.nodos   = st.nodos.filter(n => n.id !== id);
    st.enlaces = st.enlaces.filter(e => e.source.id!==id && e.target.id!==id);
    st.seleccionados.forEach(n => { if(n.id===id) st.seleccionados.delete(n); });
    if (st.nodoSel?.id === id) cerrarSidePanel();
    actualizarBadgeSel();
    renderGrimorio(document.getElementById('hm-search-central')?.value || '');
    toast('Nodo descartado');
};

window._hmQuitarDePJ = async (id) => {
    if (!st.jugadorPanel || st.jugadorPanel === 'Todos') { toast('Selecciona un PJ primero'); return; }
    const nodo = st.nodos.find(n => n.id === id);
    if (!nodo) return;
    const { error } = await (await import('../hex-auth.js')).supabase
        .from('hechizos_inventario')
        .delete()
        .eq('personaje_nombre', st.jugadorPanel)
        .eq('hechizo_nombre', nodo.nombre);
    if (error) { toast('Error: ' + error.message); return; }
    await cargarInventarioPJ(st.jugadorPanel);
    calcSetsGlobales();
    renderSidePanel(nodo);
    renderGrimorio(document.getElementById('hm-search-central')?.value || '');
    toast(`✓ Quitado de ${st.jugadorPanel}`);
};

// ── Modales Originales ─────────────────────────────────────────
window._hmModalPropiedades = () => {
    const nodos = _nodosOperacion();
    if (!nodos) return;

    const afinOps = Object.keys(st.colores).map(a => `<option value="${a}">${a}</option>`).join('');

    _modal(`⚙ Propiedades — ${nodos.length} hechizo${nodos.length>1?'s':''}`,`
        <p style="font-size:0.68em;color:#666;margin-bottom:10px;">
            ${nodos.map(n=>n.nombre).slice(0,5).join(', ')}${nodos.length>5?` + ${nodos.length-5} más`:''}
        </p>
        <p style="font-size:0.62em;color:#444;margin-bottom:12px;">Deja en blanco los campos que no quieres modificar.</p>

        <label>Valor VEX</label>
        <input type="number" id="hmp-vex" placeholder="sin cambio" min="0">

        <label>Costo HEX</label>
        <input type="number" id="hmp-hex" placeholder="sin cambio" min="0">

        <label>Clase</label>
        <select id="hmp-clase">
            <option value="">sin cambio</option>
            ${['1','2','3','4','5'].map(c=>`<option value="${c}">Clase ${c}</option>`).join('')}
        </select>

        <label>Afinidad</label>
        <select id="hmp-afin">
            <option value="">sin cambio</option>
            ${afinOps}
        </select>

        <div style="margin-top:12px;display:flex;flex-direction:column;gap:7px;">
            <label style="margin:0;display:flex;align-items:center;gap:8px;cursor:pointer;color:#aaa;font-size:0.72em;">
                <input type="checkbox" id="hmp-estado"> Marcar como hechizo-estado
            </label>
            <label style="margin:0;display:flex;align-items:center;gap:8px;cursor:pointer;color:#aaa;font-size:0.72em;">
                <input type="checkbox" id="hmp-prio"> Marcar como prioridad
            </label>
            <label style="margin:0;display:flex;align-items:center;gap:8px;cursor:pointer;color:#aaa;font-size:0.72em;">
                <input type="checkbox" id="hmp-pub"> Publicar (esConocido = true)
            </label>
            <label style="margin:0;display:flex;align-items:center;gap:8px;cursor:pointer;color:#aaa;font-size:0.72em;">
                <input type="checkbox" id="hmp-ocultar"> Ocultar (esConocido = false)
            </label>
        </div>
    `, `window._hmAplicarProps(${JSON.stringify(nodos.map(n=>n.id))})`);
};

window._hmAplicarProps = async (ids) => {
    const vex     = document.getElementById('hmp-vex')?.value.trim();
    const hex     = document.getElementById('hmp-hex')?.value.trim();
    const clase   = document.getElementById('hmp-clase')?.value;
    const afin    = document.getElementById('hmp-afin')?.value;
    const estado  = document.getElementById('hmp-estado')?.checked;
    const prio    = document.getElementById('hmp-prio')?.checked;
    const pub     = document.getElementById('hmp-pub')?.checked;
    const ocultar = document.getElementById('hmp-ocultar')?.checked;

    const payload = {};
    if (vex   !== '') payload.valor_vex    = parseInt(vex)||0;
    if (hex   !== '') payload.hex_cost     = parseInt(hex)||0;
    if (clase)        payload.clase        = clase;
    if (afin)         payload.afinidad     = afin;
    if (estado)       payload.es_estado    = true;
    if (prio)         payload.es_prioridad = true;
    if (pub)          payload.es_conocido  = true;
    if (ocultar)      payload.es_conocido  = false;

    if (!Object.keys(payload).length) { toast('Sin cambios a aplicar'); return; }

    const { ok, err } = await aplicarPropiedades(ids, payload);
    _cerrarModal();
    toast(`✓ ${ok} hechizo${ok!==1?'s':''} actualizado${ok!==1?'s':''}${err?` · ${err} error${err!==1?'es':''}`:''}`);
    if (st.nodoSel) renderInfoBar(st.nodoSel);
    renderGrimorio(document.getElementById('hm-search-central')?.value || '');
};

window._hmModalAsignarPJ = () => {
    const nodos = _nodosOperacion();
    if (!nodos) return;

    const hexTotal = nodos.reduce((s, n) => s + (n.hex || 0), 0);

    _modal(`👤 Asignar a personaje — ${nodos.length} hechizo${nodos.length>1?'s':''}`, `
        <p style="font-size:0.68em;color:#666;margin-bottom:10px;">
            ${nodos.map(n=>n.nombre).slice(0,5).join(', ')}${nodos.length>5?` + ${nodos.length-5} más`:''}
        </p>
        <label>Personaje</label>
        <select id="hmap-pj">
            ${st.personajes.map(p=>`<option value="${p}">${p}</option>`).join('')}
        </select>
        <label>Costo HEX</label>
        <select id="hmap-hex">
            <option value="0">Gratis (sin cobrar)</option>
            <option value="50">50% — ${Math.round(hexTotal*0.5)} HEX</option>
            <option value="100" selected>100% — ${hexTotal} HEX</option>
            <option value="200">200% — ${hexTotal*2} HEX</option>
        </select>
        <label style="display:flex;align-items:center;gap:8px;margin-top:10px;cursor:pointer;">
            <input type="checkbox" id="hmap-publicar"> Publicar hechizos al asignar
        </label>
    `, `window._hmAplicarAsignar(${JSON.stringify(nodos.map(n=>({id:n.id,nombre:n.nombre,hex:n.hex})))})`);
};

window._hmAplicarAsignar = async (nodosData) => {
    const pj = document.getElementById('hmap-pj')?.value;
    const pct = parseInt(document.getElementById('hmap-hex')?.value || '100');
    const publicar = document.getElementById('hmap-publicar')?.checked;
    if (!pj) { toast('Selecciona un personaje'); return; }

    const nombresHz = nodosData.map(n => n.nombre);
    const { ok, total, err } = await asignarHechizosAPJ(nombresHz, pj);
    _cerrarModal();
    if (err) { toast('Error: ' + err); return; }

    let hexGastado = 0;
    if (pct > 0 && ok > 0) {
        const hexBase = nodosData.reduce((s, n) => s + (n.hex || 0), 0);
        hexGastado = Math.round(hexBase * pct / 100);
        if (hexGastado > 0) {
            const { supabase } = await import('../hex-auth.js');
            const { data: pjData } = await supabase.from('personajes').select('hex').eq('nombre', pj).single();
            if (pjData) {
                const nuevoHex = Math.max(0, (pjData.hex || 0) - hexGastado);
                await supabase.from('personajes').update({ hex: nuevoHex }).eq('nombre', pj);
            }
        }
    }

    const descubiertos = [];
    if (publicar) {
        for (const n of nodosData) {
            const nodo = st.nodos.find(nd => nd.id === n.id);
            if (nodo && !nodo.esConocido) {
                await toggleConocido(n.id, true);
                descubiertos.push(nodo.nombre);
            }
        }
    }

    _mostrarClipboard(pj, nombresHz.slice(0, ok), hexGastado, descubiertos);

    toast(`✓ ${ok} de ${total} hechizo${total!==1?'s':''} asignado${ok!==1?'s':''} a ${pj}${hexGastado>0?` · −${hexGastado} HEX`:''}`);
    renderGrimorio(document.getElementById('hm-search-central')?.value || '');
    if (st.nodoSel) renderSidePanel(st.nodoSel);
};

window._hmAutoOrdenar = () => {
    if (!st.esAdmin) return;
    const nodos = st.nodos, enlaces = st.enlaces;
    const K=500; let temp=300, iter=120;
    nodos.forEach(n => { n._dirty=true; });

    const paso = () => {
        if (iter <= 0) { toast('Ordenado. Guarda posiciones cuando quieras.'); return; }
        const disp = new Map(nodos.map(n => [n.id, {x:0, y:0}]));

        for (let i=0; i<nodos.length; i++) {
            for (let j=i+1; j<nodos.length; j++) {
                const u=nodos[i], v=nodos[j];
                let dx=u.x-v.x, dy=u.y-v.y;
                const d=Math.hypot(dx,dy)||1, f=(K*K)/d;
                disp.get(u.id).x+=dx/d*f; disp.get(u.id).y+=dy/d*f;
                disp.get(v.id).x-=dx/d*f; disp.get(v.id).y-=dy/d*f;
            }
        }
        enlaces.forEach(({source:u, target:v}) => {
            let dx=u.x-v.x, dy=u.y-v.y;
            const d=Math.hypot(dx,dy)||1, f=d*d/K;
            disp.get(u.id).x-=dx/d*f; disp.get(u.id).y-=dy/d*f;
            disp.get(v.id).x+=dx/d*f; disp.get(v.id).y+=dy/d*f;
        });
        nodos.forEach(u => {
            const d=Math.hypot(u.x,u.y)||1, f=d*d/(K*2);
            disp.get(u.id).x-=u.x/d*f; disp.get(u.id).y-=u.y/d*f;
        });
        nodos.forEach(u => {
            const d2=disp.get(u.id), len=Math.hypot(d2.x,d2.y)||1, lim=Math.min(len,temp);
            u.x+=d2.x/len*lim; u.y+=d2.y/len*lim;
        });
        temp*=0.95; iter--;
        requestAnimationFrame(paso);
    };
    paso();
};

function _nodosOperacion() {
    const nodos = st.modoSelMulti && st.seleccionados.size > 0
        ? [...st.seleccionados]
        : (st.nodoSel ? [st.nodoSel] : []);
    if (nodos.length === 0) { toast('Selecciona al menos un hechizo'); return null; }
    return nodos;
}

function _modal(titulo, cuerpo, onOk) {
    _cerrarModal();
    const backdrop = document.createElement('div');
    backdrop.id='hm-modal-bd'; backdrop.className='hm-modal-backdrop';
    backdrop.innerHTML = `<div class="hm-modal" onclick="event.stopPropagation()">
        <div class="hm-modal-title">${titulo}</div>
        ${cuerpo}
        <div class="hm-modal-footer">
            <button class="hm-btn-cancel" onclick="window._hmCerrarModal()">Cancelar</button>
            <button class="hm-btn-ok" onclick="${onOk}">Aplicar</button>
        </div>
    </div>`;
    backdrop.onclick = _cerrarModal;
    document.body.appendChild(backdrop);
}

function _cerrarModal() {
    document.getElementById('hm-modal-bd')?.remove();
}
window._hmCerrarModal = _cerrarModal;
