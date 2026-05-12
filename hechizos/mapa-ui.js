// ============================================================
// mapa-ui.js — Toolbar, drawer, grimorio, paneles
// /hechizos/mapa-ui.js
// ============================================================

import { st } from './mapa-state.js';
import {
    cargarInventarioPJ, calcSetsGlobales,
    guardarPosiciones, toggleConocido,
    aplicarPropiedades, asignarHechizosAPJ,
    recargarDatos,
} from './mapa-data.js';
import { centrarCamara, centrarEnNodo, renderInfoBar, renderInfoStats, renderOpPanel } from './mapa-render.js';

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
    // Refrescar panel OP izquierdo si está abierto
    if (st.esAdmin) _renderOpLeft();
}

// ══════════════════════════════════════════════════════════════
//  PANEL OP IZQUIERDO — deslizable manualmente (solo admins)
//  Contenido: Herramientas + Acciones OP + Multi-sel + Batch
// ══════════════════════════════════════════════════════════════

export function abrirOpPanel() {
    if (!st.esAdmin) return;
    const panel = document.getElementById('hm-op-left');
    if (!panel) return;
    panel.classList.add('abierto');
    document.body.classList.add('op-panel-open');
    _renderOpLeft();
}

export function cerrarOpPanel() {
    const panel = document.getElementById('hm-op-left');
    if (!panel) return;
    panel.classList.remove('abierto');
    document.body.classList.remove('op-panel-open');
}

export function toggleOpPanel() {
    const panel = document.getElementById('hm-op-left');
    if (!panel) return;
    if (panel.classList.contains('abierto')) cerrarOpPanel();
    else abrirOpPanel();
}

function _renderOpLeft() {
    const body = document.getElementById('hm-op-left-body');
    if (!body || !st.esAdmin) return;

    const nSel = st.seleccionados.size;
    const nodo = st.nodoSel;
    const safe = nodo ? nodo.id.replace(/'/g,"\\'") : '';
    const esPosesion = nodo ? st.posesiones.has(nodo) : false;

    // ── Portapapeles ──
    let clipHtml = '';
    if (st.clipboard) {
        const cb = st.clipboard;
        const pctLabel = cb.pct === 0 ? 'Gratis' : cb.pct === 100 ? '100%' : `${cb.pct}%`;

        // Líneas por hechizo
        let lineasHtml = '';
        if (cb.detalles && cb.detalles.length > 0) {
            lineasHtml = cb.detalles.map(d => {
                const costoTxt = d.hexCobrado > 0
                    ? `<span class="op-clip-hex">−${d.hexCobrado} HEX</span>${d.pct !== 100 ? ` <span class="op-clip-pct">(${d.pct}%)</span>` : ''}`
                    : `<span class="op-clip-gratis">Gratis</span>`;
                const pubTxt = cb.descubiertos?.includes(d.nombre) ? ' <span class="op-clip-pub">↑ publicado</span>' : '';
                return `<div class="op-clip-linea">${d.nombre} ${costoTxt}${pubTxt}</div>`;
            }).join('');
        } else if (cb.hechizos?.length > 0) {
            lineasHtml = cb.hechizos.map(h => {
                const pubTxt = cb.descubiertos?.includes(h) ? ' <span class="op-clip-pub">↑ publicado</span>' : '';
                return `<div class="op-clip-linea">${h} <span class="op-clip-gratis">Gratis</span>${pubTxt}</div>`;
            }).join('');
        }

        clipHtml = `
        <div class="op-l-sep"></div>
        <div class="op-l-section-title">📋 ÚLTIMO BATCH</div>
        <div class="op-l-clipboard">
            <div class="op-clip-header">
                <span class="op-clip-pj">${cb.pj}</span>
                ${cb.hexGastado > 0 ? `<span class="op-clip-total">−${cb.hexGastado} HEX total</span>` : ''}
                ${cb.hexRestante !== null ? `<span class="op-clip-restante">(restante: ${cb.hexRestante})</span>` : ''}
            </div>
            <div class="op-clip-lista">${lineasHtml}</div>
            <button class="op-l-btn" style="margin-top:6px;font-size:0.65em;width:100%;" onclick="window._hmCopiarClipboard()">📋 Copiar al portapapeles</button>
            <button class="op-l-btn op-l-warn" style="margin-top:3px;font-size:0.65em;width:100%;" onclick="st_clearClip()">✕ Limpiar</button>
        </div>`;
    }

    body.innerHTML = `
        <!-- ═══ HERRAMIENTAS ═══ -->
        <div class="op-l-section-title">HERRAMIENTAS</div>
        <div class="op-l-row">
            <button class="op-l-btn op-l-gold" onclick="window._hmNuevoNodo()">➕ Nuevo nodo</button>
            <button class="op-l-btn ${st.modoConexion ? 'op-l-active' : ''}" onclick="window._hmToggleConexion()" id="op-btn-flecha">
                ↗ ${st.modoConexion ? 'Cancelar flecha' : 'Modo flecha'}
            </button>
        </div>
        <div class="op-l-row">
            <button class="op-l-btn ${st.modoEliminarFlecha ? 'op-l-danger op-l-active' : ''}"
                onclick="window._hmToggleEliminarFlecha()" id="op-btn-antif">
                ✂ ${st.modoEliminarFlecha ? 'Cancelar anti-flecha' : 'Anti-flecha'}
            </button>
        </div>
        <div class="op-l-row">
            <button class="op-l-btn op-l-gold" onclick="window._hmGuardarPos()">💾 Guardar posiciones</button>
            <button class="op-l-btn" onclick="window._hmAutoOrdenar()">🌀 Auto-ordenar</button>
        </div>
        <button class="op-l-btn-tablas" onclick="window._hmAbrirTablas()">
            🗄 Tablas DB &nbsp;<span style="opacity:0.5;font-size:0.9em;">nodos · strings</span>
        </button>

        <div class="op-l-sep"></div>

        <!-- ═══ ACCIONES OP (sobre nodo actual) ═══ -->
        <div class="op-l-section-title">ACCIONES OP${nodo ? ` — ${nodo.esConocido || st.esAdmin ? nodo.nombre : nodo.id}` : ''}</div>
        ${nodo ? `
        <div class="op-l-row">
            <button class="op-l-btn ${nodo.esConocido ? 'op-l-warn' : 'op-l-gold'}"
                onclick="window._hmToggleConocido('${safe}',${!nodo.esConocido})">
                ${nodo.esConocido ? '🔒 Ocultar' : '👁 Publicar'}
            </button>
            <button class="op-l-btn op-l-green" onclick="window._hmModalAsignarPJLeft()">👤 Asignar a PJ</button>
        </div>
        <div class="op-l-row">
            ${esPosesion && st.jugadorPanel !== 'Todos'
              ? `<button class="op-l-btn op-l-danger" onclick="window._hmQuitarDePJ('${safe}')">✕ Quitar de ${st.jugadorPanel}</button>` : ''}
            ${nodo.esNuevo
              ? `<button class="op-l-btn op-l-danger" onclick="window._hmEliminarNuevo('${safe}')">🗑 Descartar nodo</button>`
              : `<button class="op-l-btn op-l-danger" onclick="window._hmEliminarHechizo('${safe}')">🗑 Eliminar hechizo</button>`}
        </div>
        ` : `<div style="font-size:0.68em;color:#333;padding:4px 0;">Selecciona un hechizo en el mapa</div>`}

        <div id="op-l-asignar-sec"></div>

        ${clipHtml}

        <div class="op-l-sep"></div>

        <!-- ═══ MULTI-SELECCIÓN Y BATCH ═══ -->
        <div class="op-l-section-title">MULTI-SELECCIÓN ${nSel > 0 ? `(${nSel} sel.)` : ''}</div>
        <div class="op-l-row">
            <button class="op-l-btn ${st.modoSelMulti ? 'op-l-active' : ''}" onclick="window._hmToggleMulti()" id="op-btn-multi">
                ${st.modoSelMulti ? '☑ Multi-sel activo' : '☐ Multi-sel'}
            </button>
            ${nSel > 0 ? `<button class="op-l-btn op-l-warn" onclick="window._hmLimpiarSel()">✕ Limpiar (${nSel})</button>` : ''}
        </div>
        ${nSel > 0 ? `
        <div class="op-l-row">
            <button class="op-l-btn op-l-green" onclick="window._hmBatchAsignarLeft()">👤 Asignar batch (${nSel})</button>
            <button class="op-l-btn" onclick="window._hmBatchPropsLeft()">⚙ Props batch</button>
        </div>
        <div class="op-l-row">
            <button class="op-l-btn op-l-vex-disp" onclick="window._hmBatchDispersarVex()">✦ Dispersar VEX</button>
            <button class="op-l-btn op-l-danger" onclick="window._hmBatchEliminarVex()">✕ Eliminar VEX</button>
        </div>
        <div id="op-l-batch-form"></div>
        ` : `<div style="font-size:0.68em;color:#333;padding:4px 0;">Activa multi-sel y selecciona nodos</div>`}
    `;

    // Exponer limpiar clipboard
    window.st_clearClip = () => { st.clipboard = null; _renderOpLeft(); };

    // Copiar resumen al portapapeles del sistema
    window._hmCopiarClipboard = () => {
        const cb = st.clipboard;
        if (!cb) return;
        let txt = `${cb.pj}\n`;
        if (cb.detalles?.length > 0) {
            cb.detalles.forEach(d => {
                const costo = d.hexCobrado > 0 ? `−${d.hexCobrado} HEX${d.pct !== 100 ? ` (${d.pct}%)` : ''}` : 'Gratis';
                const pub = cb.descubiertos?.includes(d.nombre) ? ' · publicado' : '';
                txt += `${d.nombre} ${costo}${pub}\n`;
            });
        } else {
            (cb.hechizos||[]).forEach(h => {
                const pub = cb.descubiertos?.includes(h) ? ' · publicado' : '';
                txt += `${h} Gratis${pub}\n`;
            });
        }
        if (cb.hexGastado > 0) txt += `Total: −${cb.hexGastado} HEX`;
        if (cb.hexRestante !== null) txt += ` (restante: ${cb.hexRestante})`;
        navigator.clipboard?.writeText(txt.trim()).then(() => toast('📋 Copiado'));
    };
}

// ── Asignar PJ desde panel izquierdo ─────────────────────────
window._hmModalAsignarPJLeft = () => {
    const nodo = st.nodoSel;
    if (!nodo) return;
    const pjOpts = st.personajes.map(p=>`<option value="${p}">${p}</option>`).join('');
    const hexTotal = nodo.hex || 0;
    const sec = document.getElementById('op-l-asignar-sec');
    if (!sec) return;
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
                <option value="25">25% — ${Math.round(hexTotal*0.25)} HEX</option>
                <option value="50">50% — ${Math.round(hexTotal*0.5)} HEX</option>
                <option value="75">75% — ${Math.round(hexTotal*0.75)} HEX</option>
                <option value="100" selected>100% — ${hexTotal} HEX</option>
                <option value="200">200% — ${hexTotal*2} HEX</option>
            </select>
        </div>
        <label style="display:flex;align-items:center;gap:6px;font-size:0.7em;color:#888;margin:6px 0;">
            <input type="checkbox" id="op-asig-pub"> Publicar al asignar
        </label>
        <div class="op-l-row">
            <button class="op-l-btn op-l-green" onclick="window._hmConfirmarAsignar('${nodo.id.replace(/'/g,"\\'")}')">✓ Confirmar</button>
            <button class="op-l-btn" onclick="document.getElementById('op-l-asignar-sec').innerHTML=''">✕ Cancelar</button>
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

    let hexGastado = 0;
    if (pct > 0 && ok > 0 && nodo.hex > 0) {
        hexGastado = Math.round(nodo.hex * pct / 100);
        const { supabase } = await import('../hex-auth.js');
        const { data: pjData } = await supabase.from('personajes').select('hex').eq('nombre', pj).single();
        if (pjData) await supabase.from('personajes').update({ hex: Math.max(0,(pjData.hex||0)-hexGastado) }).eq('nombre', pj);
    }
    if (publicar) await toggleConocido(nodo.id, true);

    // Guardar en portapapeles
    st.clipboard = { pj, hechizos: [nodo.nombre], hexGastado, descubiertos: publicar ? [nodo.nombre] : [] };

    const sec = document.getElementById('op-l-asignar-sec');
    if (sec) sec.innerHTML = '';
    toast(`✓ ${nodo.nombre} asignado a ${pj}`);
    _renderOpLeft();
    if (st.nodoSel) renderSidePanel(st.nodoSel);
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
    const pct = parseInt(document.getElementById('op-batch-hex')?.value || '100');
    const publicar = document.getElementById('op-batch-pub')?.checked;
    if (!pj || nodos.length === 0) return;

    // ── Calcular costo total antes de asignar ────────────────
    const { supabase } = await import('../hex-auth.js');
    const { data: pjData } = await supabase.from('personajes').select('hex').eq('nombre', pj).single();
    const hexActual = pjData?.hex ?? 0;

    let hexGastado = 0;
    const detalles = [];
    for (const n of nodos) {
        const cobrado = pct > 0 ? Math.round((n.hex || 0) * pct / 100) : 0;
        hexGastado += cobrado;
        detalles.push({ nombre: n.nombre, hexBase: n.hex || 0, hexCobrado: cobrado, pct });
    }

    // ── Validar que tenga HEX suficiente ────────────────────
    if (hexGastado > 0 && hexActual < hexGastado) {
        toast(`✘ ${pj} no tiene HEX suficiente (tiene ${hexActual}, necesita ${hexGastado})`);
        return;
    }

    // ── Asignar hechizos ─────────────────────────────────────
    const { ok, total, err } = await asignarHechizosAPJ(nodos.map(n => n.nombre), pj);
    if (err) { toast('Error: ' + err); return; }

    // ── Descontar HEX ────────────────────────────────────────
    let hexRestante = hexActual;
    if (hexGastado > 0) {
        hexRestante = hexActual - hexGastado;
        await supabase.from('personajes').update({ hex: hexRestante }).eq('nombre', pj);
    }

    // ── Publicar si corresponde ──────────────────────────────
    const descubiertos = [];
    if (publicar) for (const n of nodos) if (!n.esConocido) { await toggleConocido(n.id, true); descubiertos.push(n.nombre); }

    st.clipboard = { pj, hechizos: nodos.map(n => n.nombre), hexGastado, descubiertos, detalles, hexRestante, pct };

    const bf = document.getElementById('op-l-batch-form');
    if (bf) bf.innerHTML = '';
    toast(`✓ ${ok}/${total} hechizos asignados a ${pj} · −${hexGastado} HEX · restante: ${hexRestante}`);
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
    const bf = document.getElementById('op-l-batch-form');
    if (bf) bf.innerHTML = '';
    toast(`✓ ${ok} actualizado${ok!==1?'s':''}${err?` · ${err} error${err!==1?'es':''}`:''}`);
    calcSetsGlobales();
    _renderOpLeft();
    if (st.nodoSel) renderSidePanel(st.nodoSel);
};

// ══════════════════════════════════════════════════════════════
//  DISPERSAR VEX — asigna VEX aleatorio con probabilidad
// ══════════════════════════════════════════════════════════════

window._hmBatchDispersarVex = () => {
    const nodos = [...st.seleccionados];
    if (nodos.length === 0) return;
    const bf = document.getElementById('op-l-batch-form');
    if (!bf) return;

    bf.innerHTML = `
        <div class="op-l-sep"></div>
        <div class="op-l-section-title" style="color:#b070e8;">✦ DISPERSAR VEX (${nodos.length} hechizos)</div>

        <div class="op-l-field-row">
            <label>Probabilidad de VEX</label>
            <div style="display:flex;align-items:center;gap:8px;">
                <input id="dv-prob" type="range" min="5" max="100" step="5" value="50"
                    style="flex:1;" oninput="document.getElementById('dv-prob-lbl').textContent=this.value+'%'">
                <span id="dv-prob-lbl" style="min-width:36px;text-align:right;color:#c080f0;font-weight:700;font-family:'Cinzel',serif;">50%</span>
            </div>
        </div>

        <div class="op-l-field-row-2" style="margin-top:6px;">
            <div>
                <label>VEX mínimo</label>
                <select id="dv-min">
                    ${[50,100,150,200,250,300,350,400,450,500].map(v=>`<option value="${v}"${v===50?' selected':''}>${v}</option>`).join('')}
                </select>
            </div>
            <div>
                <label>VEX máximo</label>
                <select id="dv-max">
                    ${[50,100,150,200,250,300,350,400,450,500,600,700,800,900,1000].map(v=>`<option value="${v}"${v===500?' selected':''}>${v}</option>`).join('')}
                </select>
            </div>
        </div>

        <div style="margin:8px 0 4px;padding:8px 10px;background:rgba(154,80,220,0.07);border:1px solid rgba(154,80,220,0.2);border-radius:6px;font-size:0.65em;color:#a070d0;line-height:1.5;">
            <strong style="color:#c090f0;">Cómo funciona:</strong> A cada hechizo se le lanza una moneda
            con la probabilidad configurada. Si sale cara, recibe un VEX aleatorio en pasos de 50
            entre mínimo y máximo. Los que no "ganen" quedan con VEX = 0.
        </div>

        <div style="font-size:0.62em;color:#555;margin-bottom:8px;" id="dv-preview-wrap">
            <span id="dv-preview"></span>
        </div>

        <div class="op-l-row" style="margin-top:4px;">
            <button class="op-l-btn" style="background:rgba(154,80,220,0.12);border-color:rgba(154,80,220,0.35);color:#c090f0;"
                onclick="window._hmPreviewDispersarVex()">👁 Previsualizar</button>
            <button class="op-l-btn op-l-vex-disp"
                onclick="window._hmConfirmarDispersarVex()">✦ Aplicar</button>
            <button class="op-l-btn" onclick="document.getElementById('op-l-batch-form').innerHTML=''">✕</button>
        </div>`;
};

// Preview dispersión sin guardar
window._hmPreviewDispersarVex = () => {
    const prob = parseInt(document.getElementById('dv-prob')?.value || '50') / 100;
    const min  = parseInt(document.getElementById('dv-min')?.value  || '50');
    const max  = parseInt(document.getElementById('dv-max')?.value  || '500');
    if (min > max) { toast('El mínimo no puede ser mayor que el máximo'); return; }

    const nodos  = [...st.seleccionados];
    const pasos  = Math.floor((max - min) / 50) + 1;
    const valores = Array.from({length: pasos}, (_, i) => min + i * 50);

    let conVex = 0, sinVex = 0, totalVex = 0;
    const muestra = [];
    nodos.forEach(n => {
        const toca = Math.random() < prob;
        if (toca) {
            const v = valores[Math.floor(Math.random() * valores.length)];
            conVex++; totalVex += v;
            if (muestra.length < 5) muestra.push(`${n.nombre}: +${v} VEX`);
        } else {
            sinVex++;
        }
    });

    const pv = document.getElementById('dv-preview');
    if (pv) pv.innerHTML = `
        <strong style="color:#c090f0;">Vista previa (simulación):</strong><br>
        ~${conVex} con VEX · ~${sinVex} sin VEX · total: ~${totalVex} VEX<br>
        <span style="opacity:0.7;">${muestra.join(' · ')}${conVex > 5 ? ' …' : ''}</span>`;
};

// Aplicar dispersión a la DB
window._hmConfirmarDispersarVex = async () => {
    const prob = parseInt(document.getElementById('dv-prob')?.value || '50') / 100;
    const min  = parseInt(document.getElementById('dv-min')?.value  || '50');
    const max  = parseInt(document.getElementById('dv-max')?.value  || '500');
    if (min > max) { toast('El mínimo no puede ser mayor que el máximo'); return; }

    const nodos  = [...st.seleccionados];
    const pasos  = Math.floor((max - min) / 50) + 1;
    const valores = Array.from({length: pasos}, (_, i) => min + i * 50);

    const { supabase } = await import('../hex-auth.js');
    let ok = 0, err = 0, conVex = 0;

    for (const n of nodos) {
        const toca = Math.random() < prob;
        const nuevoVex = toca ? valores[Math.floor(Math.random() * valores.length)] : 0;
        if (toca) conVex++;
        const { error } = await supabase
            .from('hechizos_nodos')
            .update({ valor_vex: nuevoVex })
            .eq('hechizo_id', n.id);
        if (error) { err++; continue; }
        n.vex = nuevoVex;
        ok++;
    }

    const bf = document.getElementById('op-l-batch-form');
    if (bf) bf.innerHTML = '';
    toast(`✦ VEX dispersado: ${conVex}/${ok} recibieron VEX${err ? ` · ${err} errores` : ''}`);
    _renderOpLeft();
};

// ══════════════════════════════════════════════════════════════
//  ELIMINAR VEX — quita VEX a los seleccionados con filtros
// ══════════════════════════════════════════════════════════════

window._hmBatchEliminarVex = () => {
    const nodos = [...st.seleccionados];
    if (nodos.length === 0) return;
    const bf = document.getElementById('op-l-batch-form');
    if (!bf) return;

    // Afinidades presentes en la selección
    const afinidades = [...new Set(nodos.map(n => n.afinidad).filter(Boolean))].sort();
    const afinOpts = ['(todas)', ...afinidades].map(a =>
        `<option value="${a}">${a}</option>`).join('');

    // Rango de VEX en la selección
    const vexValues = nodos.filter(n => n.vex > 0).map(n => n.vex);
    const vexMax = vexValues.length ? Math.max(...vexValues) : 500;
    const vexMin = vexValues.length ? Math.min(...vexValues) : 0;

    bf.innerHTML = `
        <div class="op-l-sep"></div>
        <div class="op-l-section-title" style="color:#e06060;">✕ ELIMINAR VEX (${nodos.length} hechizos)</div>

        <div style="margin-bottom:8px;font-size:0.65em;color:#888;">
            En la selección: <strong style="color:#ccc;">${vexValues.length}</strong> con VEX
            (rango: ${vexMin}–${vexMax})
        </div>

        <div class="op-l-field-row">
            <label>Modo de eliminación</label>
            <select id="ev-modo" onchange="window._hmEvModoChange()">
                <option value="todo">Todo el VEX → poner en 0</option>
                <option value="encima">VEX por encima de un valor</option>
                <option value="exacto">VEX de valor exacto</option>
                <option value="afinidad">VEX de afinidad específica</option>
            </select>
        </div>

        <div id="ev-extra" style="margin-top:4px;"></div>

        <div class="op-l-row" style="margin-top:8px;">
            <button class="op-l-btn" style="background:rgba(220,80,80,0.1);border-color:rgba(220,80,80,0.3);color:#e08080;"
                onclick="window._hmPreviewEliminarVex()">👁 Previsualizar</button>
            <button class="op-l-btn op-l-danger"
                onclick="window._hmConfirmarEliminarVex()">✕ Aplicar</button>
            <button class="op-l-btn" onclick="document.getElementById('op-l-batch-form').innerHTML=''">Cancel</button>
        </div>
        <div style="font-size:0.62em;color:#555;margin-top:6px;" id="ev-preview"></div>`;

    // Guardar opciones de afinidad para el modo afinidad
    window._hmEvAfinOpts = afinOpts;
    window._hmEvModoChange();
};

window._hmEvModoChange = () => {
    const modo  = document.getElementById('ev-modo')?.value;
    const extra = document.getElementById('ev-extra');
    if (!extra) return;
    if (modo === 'encima') {
        extra.innerHTML = `
            <div class="op-l-field-row">
                <label>Eliminar VEX ≥ (encima de)</label>
                <input id="ev-umbral" type="number" value="500" min="50" step="50"
                    style="width:90px;" placeholder="ej: 500">
            </div>`;
    } else if (modo === 'exacto') {
        extra.innerHTML = `
            <div class="op-l-field-row">
                <label>Eliminar exactamente este VEX</label>
                <input id="ev-exacto" type="number" value="350" min="50" step="50"
                    style="width:90px;" placeholder="ej: 350">
            </div>`;
    } else if (modo === 'afinidad') {
        extra.innerHTML = `
            <div class="op-l-field-row">
                <label>Afinidad a limpiar</label>
                <select id="ev-afin">${window._hmEvAfinOpts || ''}</select>
            </div>`;
    } else {
        extra.innerHTML = '';
    }
};

window._hmPreviewEliminarVex = () => {
    const afectados = _hmEvFiltrarAfectados();
    const pv = document.getElementById('ev-preview');
    if (!pv) return;
    if (!afectados) { pv.innerHTML = ''; return; }
    const muestra = afectados.slice(0, 6).map(n => `${n.nombre} (${n.vex} VEX)`).join(' · ');
    pv.innerHTML = `<strong style="color:#e08080;">Afectados:</strong> ${afectados.length} hechizos<br>
        <span style="opacity:0.7;">${muestra}${afectados.length > 6 ? ' …' : ''}</span>`;
};

// Retorna los nodos que serán afectados por el modo actual
function _hmEvFiltrarAfectados() {
    const modo   = document.getElementById('ev-modo')?.value || 'todo';
    const nodos  = [...st.seleccionados];
    if (modo === 'todo')     return nodos.filter(n => n.vex > 0);
    if (modo === 'encima') {
        const umbral = parseInt(document.getElementById('ev-umbral')?.value || '500');
        return nodos.filter(n => n.vex >= umbral);
    }
    if (modo === 'exacto') {
        const exacto = parseInt(document.getElementById('ev-exacto')?.value || '350');
        return nodos.filter(n => n.vex === exacto);
    }
    if (modo === 'afinidad') {
        const afin = document.getElementById('ev-afin')?.value;
        if (!afin || afin === '(todas)') return nodos.filter(n => n.vex > 0);
        return nodos.filter(n => n.vex > 0 && n.afinidad === afin);
    }
    return [];
}

window._hmConfirmarEliminarVex = async () => {
    const afectados = _hmEvFiltrarAfectados();
    if (!afectados || afectados.length === 0) { toast('Ningún hechizo coincide con el filtro'); return; }

    const { supabase } = await import('../hex-auth.js');
    let ok = 0, err = 0;
    for (const n of afectados) {
        const { error } = await supabase
            .from('hechizos_nodos')
            .update({ valor_vex: 0 })
            .eq('hechizo_id', n.id);
        if (error) { err++; continue; }
        n.vex = 0;
        ok++;
    }
    const bf = document.getElementById('op-l-batch-form');
    if (bf) bf.innerHTML = '';
    toast(`✕ VEX eliminado de ${ok} hechizo${ok!==1?'s':''}${err ? ` · ${err} errores` : ''}`);
    _renderOpLeft();
};

// ══════════════════════════════════════════════════════════════
//  PANEL DERECHO (INFO + EDICIÓN INLINE)
//  Se abre automáticamente al seleccionar un nodo.
//  Para admins: cada campo es editable inline con click.
// ══════════════════════════════════════════════════════════════

export function renderSidePanel(nodo) {
    const panel = document.getElementById('hm-side-panel');
    const body  = document.getElementById('hm-side-panel-body');
    const titulo = document.getElementById('sp-titulo-txt');
    if (!panel || !body) return;

    if (!nodo) {
        panel.classList.remove('abierto');
        document.body.classList.remove('side-panel-open');
        return;
    }

    panel.classList.add('abierto');
    document.body.classList.add('side-panel-open');

    const esPosesion = st.posesiones.has(nodo);
    const mostrar    = nodo.esConocido || esPosesion || st.esAdmin;
    const color      = (st.colores[nodo.afinidad] || {}).t || '#888';
    const nombre     = mostrar ? nodo.nombre : (nodo.id.match(/\d+/) ? `Hechizo ${nodo.id.match(/\d+/)[0]}` : nodo.id);
    const safe       = nodo.id.replace(/'/g, "\\'");

    if (titulo) titulo.textContent = nombre;

    // ── Chips de meta ──
    const chips = [];
    if (mostrar) {
        chips.push(`<span style="color:${color};font-size:0.9em;font-weight:700;">${nodo.afinidad}</span>`);
        chips.push(`<span class="sp-chip">Cl.${nodo.clase}</span>`);
        if (nodo.hex > 0) chips.push(`<span class="sp-chip sp-chip-hex">⬡${nodo.hex} HEX</span>`);
        if (nodo.vex > 0) chips.push(`<span class="sp-chip sp-chip-vex">⬡${nodo.vex} VEX</span>`);
        if (esPosesion)   chips.push(`<span class="sp-chip sp-chip-pos">✓ Aprendido</span>`);
        if (nodo.esEstado)   chips.push(`<span class="sp-chip sp-chip-est">Estado</span>`);
        if (nodo.esPrioridad)chips.push(`<span class="sp-chip sp-chip-pri">↑ Prioridad</span>`);
        if (nodo.afectaUsuario)  chips.push(`<span class="sp-chip" style="color:#7a8a9a;border-color:rgba(120,140,160,0.25)">👤 Usuario</span>`);
        if (nodo.afectaObjetivo) chips.push(`<span class="sp-chip" style="color:#7a8a9a;border-color:rgba(120,140,160,0.25)">🎯 Objetivo</span>`);
        if (nodo.afectaHechizos) chips.push(`<span class="sp-chip" style="color:#7a8a9a;border-color:rgba(120,140,160,0.25)">✦ Hechizos</span>`);
    }

    // ── Campos informativos (siempre visibles si mostrar) ──
    const camposTxt = mostrar ? [
        { label:'Efecto',    val: nodo.efecto,    id: 'sp-ed-efecto',    type: 'area' },
        { label:'Resumen',   val: nodo.resumen,   id: 'sp-ed-resumen',   type: 'area' },
        { label:'Overcast',  val: nodo.overcast,  id: 'sp-ed-overcast',  type: 'area' },
        { label:'Undercast', val: nodo.undercast, id: 'sp-ed-undercast', type: 'area' },
        { label:'Especial',  val: nodo.especial,  id: 'sp-ed-especial',  type: 'area' },
    ] : [];

    const renderCampo = ({ label, val, id, type }) => {
        if (st.esAdmin) {
            // Inline editable — parece texto, editable al hacer click
            if (type === 'area') {
                return `<div class="sp-desc-field">
                    <div class="sp-desc-label">${label}</div>
                    <textarea class="sp-inline-area" id="${id}" rows="2" placeholder="—">${val||''}</textarea>
                </div>`;
            }
            return `<div class="sp-desc-field">
                <div class="sp-desc-label">${label}</div>
                <input class="sp-inline-input" id="${id}" value="${(val||'').replace(/"/g,'&quot;')}" placeholder="—">
            </div>`;
        }
        if (!val) return '';
        return `<div class="sp-desc-field">
            <div class="sp-desc-label">${label}</div>
            <div class="sp-desc-val">${val}</div>
        </div>`;
    };

    // ── Nota (con estilo especial) ──
    const notaHtml = mostrar ? (st.esAdmin
        ? `<div class="sp-desc-field">
            <div class="sp-desc-label">📌 Nota</div>
            <input class="sp-inline-input" id="sp-ed-nota" value="${(nodo.nota||'').replace(/"/g,'&quot;')}" placeholder="—" style="color:#d4a830;">
           </div>`
        : (nodo.nota ? `<div class="sp-desc-field"><div class="sp-desc-label">📌 Nota</div><div class="sp-desc-val" style="color:#d4a830;">${nodo.nota}</div></div>` : '')
    ) : '';

    // ── Sección OP (solo admin) ──
    let adminHtml = '';
    if (st.esAdmin) {
        const afinOpts = Object.keys(st.colores).map(a =>
            `<option value="${a}" ${nodo.afinidad===a?'selected':''}>${a}</option>`
        ).join('');

        adminHtml = `
        <div class="sp-section-title">Editar hechizo</div>
        <div class="sp-desc-field">
            <div class="sp-desc-label">Nombre</div>
            <input class="sp-inline-input sp-inline-title" id="sp-ed-nombre"
                value="${(nodo.nombre||'').replace(/"/g,'&quot;')}" placeholder="Nombre del hechizo">
        </div>
        <div class="sp-desc-field">
            <div class="sp-desc-label">ID</div>
            <input class="sp-inline-input" id="sp-ed-id"
                value="${nodo.id}" readonly style="opacity:0.4">
        </div>

        <div class="sp-section-title">Características</div>
        <div class="sp-grid-2">
            <div class="sp-desc-field">
                <div class="sp-desc-label">Clase</div>
                <select class="sp-inline-input" id="sp-ed-clase">
                    ${['1','2','3','4','5'].map(c=>`<option value="${c}" ${nodo.clase==c?'selected':''}>${c}</option>`).join('')}
                </select>
            </div>
            <div class="sp-desc-field">
                <div class="sp-desc-label">Afinidad</div>
                <select class="sp-inline-input" id="sp-ed-afin">
                    <option value="">—</option>${afinOpts}
                </select>
            </div>
            <div class="sp-desc-field">
                <div class="sp-desc-label">HEX</div>
                <div class="sp-num-row">
                    <button class="sp-num-btn" tabindex="-1" onclick="window._hmAjustarNum('sp-ed-hex',-50)">−50</button>
                    <input class="sp-inline-input sp-num-input" id="sp-ed-hex" type="text" inputmode="numeric" value="${nodo.hex||0}">
                    <button class="sp-num-btn" tabindex="-1" onclick="window._hmAjustarNum('sp-ed-hex',+50)">+50</button>
                </div>
            </div>
            <div class="sp-desc-field">
                <div class="sp-desc-label">VEX</div>
                <div class="sp-num-row">
                    <button class="sp-num-btn" tabindex="-1" onclick="window._hmAjustarNum('sp-ed-vex',-50)">−50</button>
                    <input class="sp-inline-input sp-num-input" id="sp-ed-vex" type="text" inputmode="numeric" value="${nodo.vex||0}">
                    <button class="sp-num-btn" tabindex="-1" onclick="window._hmAjustarNum('sp-ed-vex',+50)">+50</button>
                </div>
            </div>
            <div class="sp-desc-field">
                <div class="sp-desc-label">Backcast</div>
                <div class="sp-num-row">
                    <button class="sp-num-btn" tabindex="-1" onclick="window._hmAjustarNum('sp-ed-backcast',-1)">−1</button>
                    <input class="sp-inline-input sp-num-input" id="sp-ed-backcast" type="text" inputmode="numeric" value="${nodo.backcast||0}">
                    <button class="sp-num-btn" tabindex="-1" onclick="window._hmAjustarNum('sp-ed-backcast',+1)">+1</button>
                </div>
            </div>
            <div class="sp-desc-field">
                <div class="sp-desc-label">Nextcast</div>
                <div class="sp-num-row">
                    <button class="sp-num-btn" tabindex="-1" onclick="window._hmAjustarNum('sp-ed-nextcast',-1)">−1</button>
                    <input class="sp-inline-input sp-num-input" id="sp-ed-nextcast" type="text" inputmode="numeric" value="${nodo.nextcast||0}">
                    <button class="sp-num-btn" tabindex="-1" onclick="window._hmAjustarNum('sp-ed-nextcast',+1)">+1</button>
                </div>
            </div>
        </div>
        <div class="op-l-checks sp-checks-nav" style="margin-top:6px;">
            <label class="sp-check-row" data-check="sp-ed-conocido"><input type="checkbox" id="sp-ed-conocido" ${nodo.esConocido?'checked':''}> Conocido (publicado)</label>
            <label class="sp-check-row" data-check="sp-ed-estado"  ><input type="checkbox" id="sp-ed-estado"   ${nodo.esEstado?'checked':''}> Hechizo-Estado</label>
            <label class="sp-check-row" data-check="sp-ed-prio"    ><input type="checkbox" id="sp-ed-prio"     ${nodo.esPrioridad?'checked':''}> Prioridad</label>
            <label class="sp-check-row" data-check="sp-ed-afxusr"  ><input type="checkbox" id="sp-ed-afxusr"   ${nodo.afectaUsuario?'checked':''}> Afecta Usuario</label>
            <label class="sp-check-row" data-check="sp-ed-afxobj"  ><input type="checkbox" id="sp-ed-afxobj"   ${nodo.afectaObjetivo?'checked':''}> Afecta Objetivo</label>
            <label class="sp-check-row" data-check="sp-ed-afxhz"   ><input type="checkbox" id="sp-ed-afxhz"    ${nodo.afectaHechizos?'checked':''}> Afecta Hechizos</label>
        </div>
        <div style="margin-top:10px;">
            <button class="sp-btn sp-btn-pub" style="width:100%;justify-content:center;"
                onclick="window._hmGuardarHechizoDerecho()">💾 Guardar en DB</button>
        </div>`;
    }

    body.innerHTML = `
        <div class="sp-nodo-nombre" style="color:${color}">${nombre}</div>
        <div class="sp-nodo-meta">${chips.join('')}</div>
        ${mostrar
            ? camposTxt.map(renderCampo).join('') + notaHtml
            : `<div style="font-size:0.7em;color:#2a2a3a;font-style:italic;padding:6px 0;">Sellado — sin información</div>`}
        ${adminHtml}
    `;
}

// ── Guardar hechizo desde panel derecho ──────────────────────
window._hmGuardarHechizoDerecho = async () => {
    const nodo = st.nodoSel;
    if (!nodo || !st.esAdmin) return;

    const payload = {
        nombre:          document.getElementById('sp-ed-nombre')?.value?.trim() || nodo.nombre,
        clase:           document.getElementById('sp-ed-clase')?.value || nodo.clase,
        afinidad:        document.getElementById('sp-ed-afin')?.value || nodo.afinidad,
        hex_cost:        Math.max(0, parseInt(document.getElementById('sp-ed-hex')?.value)||0),
        valor_vex:       Math.max(0, parseInt(document.getElementById('sp-ed-vex')?.value)||0),
        backcast:        Math.max(0, parseInt(document.getElementById('sp-ed-backcast')?.value)||0),
        nextcast:        Math.max(0, parseInt(document.getElementById('sp-ed-nextcast')?.value)||0),
        resumen:         document.getElementById('sp-ed-resumen')?.value || '',
        efecto:          document.getElementById('sp-ed-efecto')?.value || '',
        overcast:        document.getElementById('sp-ed-overcast')?.value || '',
        undercast:       document.getElementById('sp-ed-undercast')?.value || '',
        especial:        document.getElementById('sp-ed-especial')?.value || '',
        nota:            document.getElementById('sp-ed-nota')?.value || '',
        es_conocido:     document.getElementById('sp-ed-conocido')?.checked || false,
        es_estado:       document.getElementById('sp-ed-estado')?.checked || false,
        es_prioridad:    document.getElementById('sp-ed-prio')?.checked || false,
        afecta_usuario:  document.getElementById('sp-ed-afxusr')?.checked || false,
        afecta_objetivo: document.getElementById('sp-ed-afxobj')?.checked || false,
        afecta_hechizos: document.getElementById('sp-ed-afxhz')?.checked || false,
    };

    const { supabase } = await import('../hex-auth.js');
    let error;

    if (nodo.esNuevo) {
        const newId = document.getElementById('sp-ed-id')?.value?.trim() || nodo.id;
        ({ error } = await supabase.from('hechizos_nodos').insert({
            ...payload,
            hechizo_id: newId,
            pos_x: Math.round(nodo.x),
            pos_y: Math.round(nodo.y),
        }));
        if (!error) { nodo.id = newId; nodo.esNuevo = false; }
    } else {
        ({ error } = await supabase.from('hechizos_nodos').update(payload).eq('hechizo_id', nodo.id));
    }

    if (error) { toast('Error: ' + error.message); return; }

    Object.assign(nodo, {
        nombre: payload.nombre, clase: payload.clase, afinidad: payload.afinidad,
        hex: payload.hex_cost, vex: payload.valor_vex,
        backcast: payload.backcast, nextcast: payload.nextcast,
        resumen: payload.resumen, efecto: payload.efecto,
        overcast: payload.overcast, undercast: payload.undercast,
        especial: payload.especial, nota: payload.nota,
        esConocido: payload.es_conocido, esEstado: payload.es_estado, esPrioridad: payload.es_prioridad,
        afectaUsuario: payload.afecta_usuario, afectaObjetivo: payload.afecta_objetivo,
        afectaHechizos: payload.afecta_hechizos,
        radio: payload.es_conocido ? 35 : 28, _dirty: false,
    });

    calcSetsGlobales();
    renderInfoStats();
    renderGrimorio(document.getElementById('hm-search-central')?.value || '');
    renderSidePanel(nodo);
    if (st.esAdmin) _renderOpLeft();
    toast('✓ Hechizo guardado');
};

// ── Ajustar campo numérico con botones ±────────────────────────
window._hmAjustarNum = (id, delta) => {
    const el = document.getElementById(id);
    if (!el) return;
    const val = Math.max(0, (parseInt(el.value) || 0) + delta);
    el.value = val;
    el.focus();
};

// ── Navegación rápida con flechas en el panel derecho ──────────
(function _initSidePanelKeyNav() {
    const FIELD_IDS = [
        'sp-ed-efecto', 'sp-ed-resumen', 'sp-ed-overcast',
        'sp-ed-undercast', 'sp-ed-especial', 'sp-ed-nota',
        'sp-ed-nombre', 'sp-ed-clase', 'sp-ed-afin',
        'sp-ed-hex', 'sp-ed-vex', 'sp-ed-backcast', 'sp-ed-nextcast',
    ];
    const CHECK_IDS = [
        'sp-ed-conocido', 'sp-ed-estado', 'sp-ed-prio',
        'sp-ed-afxusr', 'sp-ed-afxobj', 'sp-ed-afxhz',
    ];
    const ALL_IDS = [...FIELD_IDS, ...CHECK_IDS];

    const _clearFocus = () =>
        document.querySelectorAll('.sp-check-row.sp-check-focused')
            .forEach(l => l.classList.remove('sp-check-focused'));

    const _focusField = (el) => {
        el.focus();
        if (el.tagName === 'INPUT' && el.type !== 'checkbox') el.select?.();
    };

    const _focusCheck = (el) => {
        _clearFocus();
        el.closest('label')?.classList.add('sp-check-focused');
        el.focus();
    };

    const _navigate = (dir) => {
        const focused = document.activeElement;
        const idx = ALL_IDS.indexOf(focused?.id);
        if (idx === -1) return false;
        const nextIdx = idx + dir;
        if (nextIdx < 0 || nextIdx >= ALL_IDS.length) return false;
        const nextEl = document.getElementById(ALL_IDS[nextIdx]);
        if (!nextEl) return false;
        CHECK_IDS.includes(ALL_IDS[nextIdx]) ? _focusCheck(nextEl) : _focusField(nextEl);
        return true;
    };

    document.addEventListener('keydown', (e) => {
        const panel = document.getElementById('hm-side-panel');
        if (!panel?.classList.contains('abierto')) return;
        if (!panel.contains(document.activeElement)) return;

        const focused = document.activeElement;
        const isArrow = e.key === 'ArrowDown' || e.key === 'ArrowUp';
        const dir = e.key === 'ArrowDown' ? 1 : -1;

        // ── Enter en checkbox: toggle ──────────────────────────
        if (e.key === 'Enter' && focused?.type === 'checkbox') {
            e.preventDefault();
            focused.checked = !focused.checked;
            return;
        }

        // ── Flechas en textarea: saltar solo desde borde ───────
        if (focused?.tagName === 'TEXTAREA' && isArrow) {
            const val = focused.value;
            const pos = focused.selectionStart;
            const atStart = pos === 0;
            const atEnd   = pos === val.length;
            if ((dir === -1 && atStart) || (dir === 1 && atEnd)) {
                e.preventDefault();
                _navigate(dir);
            }
            // Si no está en el borde, dejar que el browser mueva el cursor normal
            return;
        }

        // ── Flechas en el resto de campos ─────────────────────
        if (!isArrow) return;
        const idx = ALL_IDS.indexOf(focused?.id);
        if (idx === -1) return;
        e.preventDefault();
        _navigate(dir);
    });

    // ── Limpiar resalte al salir de un check ──────────────────
    document.addEventListener('focusin', (e) => {
        if (!CHECK_IDS.includes(e.target?.id)) _clearFocus();
    });
})();

// ── Renderizar pools de PJ ───────────────────────────────────
export function renderPools() {
    const npcs = st.personajes.filter(p => !st.jugadores.includes(p));

    const tarjeta = (nombre) => {
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
    if (jugGrid) jugGrid.innerHTML = st.jugadores.map(j => tarjeta(j)).join('') || '<span style="font-size:0.65em;color:#3a3a55;">Sin jugadores</span>';
    if (npcGrid) npcGrid.innerHTML = npcs.map(n => tarjeta(n)).join('') || '<span style="font-size:0.65em;color:#3a3a55;">Sin NPCs</span>';

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

// ══════════════════════════════════════════════════════════════
//  TOOLBAR
// ══════════════════════════════════════════════════════════════
export function renderToolbar() {
    renderPools();
    // Mostrar/ocultar botón OP en la navbar
    const btnOp = document.getElementById('btn-toggle-op');
    if (btnOp) btnOp.style.display = st.esAdmin ? '' : 'none';
    // Mostrar tab admin en drawer
    const dtAdmin = document.getElementById('dt-admin');
    if (dtAdmin) dtAdmin.style.display = st.esAdmin ? '' : 'none';
}

// ══════════════════════════════════════════════════════════════
//  DRAWER — grimorio + admin
// ══════════════════════════════════════════════════════════════
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

// ── Renderizar grimorio (acordeones por afinidad) ─────────────
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
};

// ══════════════════════════════════════════════════════════════
//  PORTAPAPELES
// ══════════════════════════════════════════════════════════════
function _mostrarClipboard(pj, hechizosAsignados, hexGastado, descubiertos) {
    const el = document.getElementById('hm-clipboard');
    const ct = document.getElementById('hm-clipboard-content');
    if (!el || !ct) return;
    ct.innerHTML = `
        <div class="clip-title">📋 Resumen de operación</div>
        <div><span class="clip-pj">${pj}</span></div>
        ${hechizosAsignados.length > 0
          ? `<div><span class="clip-hz">Hechizo${hechizosAsignados.length>1?'s':''} asignado${hechizosAsignados.length>1?'s':''}: </span>${hechizosAsignados.join(', ')}</div>` : ''}
        ${hexGastado > 0 ? `<div><span class="clip-hex">Gasto HEX: −${hexGastado}</span></div>` : ''}
        ${descubiertos.length > 0
          ? `<div><span class="clip-desc">Hechizos descubiertos: ${descubiertos.join(', ')}</span></div>` : ''}
    `;
    el.classList.add('visible');
}

// ── Renderizar panel admin del drawer ─────────────────────────
function _renderDrawerAdmin() {
    const pane = document.getElementById('hm-pane-admin');
    if (!pane || !st.esAdmin) return;

    pane.innerHTML = `
        <div class="adm-seccion">
            <div class="adm-titulo">Panel OP izquierdo</div>
            <div class="adm-fila">
                <button class="hm-btn gold" onclick="window._hmToggleOpLeft()">⚙ Abrir/Cerrar panel OP</button>
            </div>
        </div>
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
                <button class="hm-btn verde" onclick="window._hmBatchAsignarLeft()">👤 Asignar batch</button>
                <button class="hm-btn" onclick="window._hmBatchPropsLeft()">⚙ Props batch</button>
            </div>
        </div>
    `;
}

// ══════════════════════════════════════════════════════════════
//  HANDLERS GLOBALES
// ══════════════════════════════════════════════════════════════

window._hmToggleOpLeft = () => toggleOpPanel();

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

window._hmCerrarSidePanel = () => {
    st.nodoSel = null;
    renderSidePanel(null);
    renderInfoBar(null);
};

window._hmCerrarOpLeft = () => cerrarOpPanel();

window._hmToggleConexion = () => {
    st.modoConexion = !st.modoConexion;
    st.tempFlecha   = null;
    if (st.modoConexion) {
        // Desactivar anti-flecha si estaba activo
        st.modoEliminarFlecha = false;
        st.enlaceHover = null;
        const baf = document.getElementById('op-btn-antif');
        if (baf) { baf.classList.remove('op-l-active', 'op-l-danger'); baf.textContent = '✂ Anti-flecha'; }
    }
    const btns = ['hm-btn-flecha', 'op-btn-flecha'];
    btns.forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.classList.toggle('activo', st.modoConexion);
            btn.textContent = st.modoConexion ? '↗ Cancelar flecha' : '↗ Modo flecha';
        }
    });
    const wrap = document.getElementById('hm-canvas-wrap');
    if (wrap) wrap.style.cursor = st.modoConexion ? 'crosshair' : 'grab';
    if (st.esAdmin) _renderOpLeft();
};

window._hmToggleMulti = () => {
    st.modoSelMulti = !st.modoSelMulti;
    if (!st.modoSelMulti) { st.seleccionados.clear(); actualizarBadgeSel(); }
    const btns = ['hm-btn-multi', 'op-btn-multi'];
    btns.forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.classList.toggle('activo', st.modoSelMulti);
            btn.textContent = st.modoSelMulti ? '☑ Multi-sel' : '☐ Multi-sel';
        }
    });
    actualizarBadgeSel();
    if (st.esAdmin) _renderOpLeft();
};

window._hmNuevoNodo = () => {
    if (!st.esAdmin) return;
    const wrap = document.getElementById('hm-canvas-wrap');
    if (!wrap) return;
    const cx = (wrap.clientWidth /2 - st.camara.x) / st.camara.zoom;
    const cy = (wrap.clientHeight/2 - st.camara.y) / st.camara.zoom;

    // Auto-ID: buscar el número más bajo disponible en la secuencia
    const nums = new Set(
        st.nodos.map(n => { const m = n.id.match(/^hechizo[_\s]?(\d+)$/i); return m ? parseInt(m[1]) : null; })
               .filter(n => n !== null)
    );
    let seq = 1;
    while (nums.has(seq)) seq++;
    const id = `hechizo_${seq}`;

    const nodo = {
        id, nombre: `Hechizo ${seq}`, afinidad:'Desconocida', clase:'1',
        hex:0, vex:0, nota:'', esConocido:false, esNuevo:true,
        esEstado:false, esPrioridad:false, backcast:0, nextcast:0,
        afectaHechizos:false, afectaUsuario:false, afectaObjetivo:false,
        resumen:'', efecto:'', overcast:'', undercast:'', especial:'',
        x:cx, y:cy, radio:28, color:'#888', incomingSources:[], _dirty:true,
    };
    st.nodos.push(nodo);
    st.nodoSel = nodo;
    renderInfoBar(nodo);
    renderGrimorio(document.getElementById('hm-search-central')?.value || '');
    renderSidePanel(nodo);
    toast(`Nodo temporal creado (ID: ${id}). Edita y guarda en DB.`);
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
        renderSidePanel(nodo);
        renderGrimorio(document.getElementById('hm-search-central')?.value || '');
        if (st.esAdmin) _renderOpLeft();
    }
    toast(nuevoValor ? '👁 Publicado' : '🔒 Ocultado');
};

window._hmEliminarNuevo = (id) => {
    st.nodos   = st.nodos.filter(n => n.id !== id);
    st.enlaces = st.enlaces.filter(e => e.source.id!==id && e.target.id!==id);
    st.seleccionados.forEach(n => { if(n.id===id) st.seleccionados.delete(n); });
    if (st.nodoSel?.id === id) {
        st.nodoSel = null;
        renderInfoBar(null);
        renderSidePanel(null);
    }
    actualizarBadgeSel();
    renderGrimorio(document.getElementById('hm-search-central')?.value || '');
    toast('Nodo descartado');
};

window._hmEliminarHechizo = async (id) => {
    if (!st.esAdmin) return;
    const nodo = st.nodos.find(n => n.id === id);
    if (!nodo) return;
    if (nodo.esNuevo) { window._hmEliminarNuevo(id); return; }

    if (!confirm(`¿Eliminar "${nodo.nombre}" y todas sus conexiones? Esta acción no se puede deshacer.`)) return;

    const { supabase } = await import('../hex-auth.js');

    // Borrar strings de este nodo
    await supabase.from('hechizos_strings').delete().eq('source_id', nodo.id);
    await supabase.from('hechizos_strings').delete().eq('target_id', nodo.id);
    // Borrar inventario
    await supabase.from('hechizos_inventario').delete().eq('hechizo_nombre', nodo.nombre);
    // Borrar nodo
    const { error } = await supabase.from('hechizos_nodos').delete().eq('hechizo_id', nodo.id);
    if (error) { toast('Error al eliminar: ' + error.message); return; }

    // Actualizar estado local
    st.enlaces = st.enlaces.filter(e => e.source !== nodo && e.target !== nodo);
    st.nodos   = st.nodos.filter(n => n !== nodo);
    st.nodos.forEach(n => { n.incomingSources = n.incomingSources.filter(s => s !== nodo); });
    st.seleccionados.delete(nodo);
    st.posesiones.delete(nodo);
    st.rastreo.delete(nodo);
    if (st.nodoSel === nodo) {
        st.nodoSel = null;
        renderInfoBar(null);
        renderSidePanel(null);
    }
    calcSetsGlobales();
    actualizarBadgeSel();
    renderGrimorio(document.getElementById('hm-search-central')?.value || '');
    renderInfoStats();
    if (st.esAdmin) _renderOpLeft();
    toast('🗑 Hechizo eliminado');
};

window._hmToggleEliminarFlecha = () => {
    st.modoEliminarFlecha = !st.modoEliminarFlecha;
    if (st.modoEliminarFlecha) {
        st.modoConexion = false;
        st.tempFlecha   = null;
        // Apagar botón modo flecha
        const bf = document.getElementById('op-btn-flecha');
        if (bf) { bf.classList.remove('op-l-active'); bf.textContent = '↗ Modo flecha'; }
    }
    st.enlaceHover = null;
    const wrap = document.getElementById('hm-canvas-wrap');
    if (wrap) wrap.style.cursor = st.modoEliminarFlecha ? 'crosshair' : 'grab';
    if (st.esAdmin) _renderOpLeft();
    toast(st.modoEliminarFlecha
        ? '✂ Anti-flecha activo — clic sobre una flecha para eliminarla'
        : 'Modo anti-flecha cancelado', 3000);
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
    if (st.esAdmin) _renderOpLeft();
    renderGrimorio(document.getElementById('hm-search-central')?.value || '');
    toast(`✓ Quitado de ${st.jugadorPanel}`);
};

window._hmLimpiarSel = () => {
    st.seleccionados.clear();
    actualizarBadgeSel();
    if (st.esAdmin) _renderOpLeft();
};

// ── Auto-ordenar (Fruchterman-Reingold) ──────────────────────
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

// ── Modal: Propiedades batch (legacy, usado desde drawer admin) ─
window._hmModalPropiedades = () => {
    // Re-ruta a batch props inline en el panel izquierdo
    if (st.esAdmin) {
        abrirOpPanel();
        setTimeout(() => window._hmBatchPropsLeft(), 100);
    }
};

window._hmModalAsignarPJ = () => {
    if (st.esAdmin) window._hmModalAsignarPJLeft();
};

// ══════════════════════════════════════════════════════════════
//  PANEL TABLAS DB — hechizos_nodos (75%) + hechizos_strings (25%)
// ══════════════════════════════════════════════════════════════

(function() {
    // ── Estado interno del panel ─────────────────────────────
    const TS = {
        // Nodos
        nRows:      [],   // filas cargadas desde DB
        nFilt:      [],   // filas filtradas
        nPage:      0,
        nPageSize:  50,
        nSearch:    '',
        nSortCol:   'id',
        nSortDir:   1,    // 1=asc -1=desc
        nEditing:   null, // id de fila en edición
        nBuf:       {},   // buffer de edición

        // Strings
        sRows:      [],
        sFilt:      [],
        sPage:      0,
        sPageSize:  100,
        sSearch:    '',
        sSortCol:   'source_id',
        sSortDir:   1,
        sEditing:   null,
        sBuf:       {},

        open:       false,
        afinidades: [],
    };

    // Columnas de nodos visibles en la tabla
    const NCOLS = [
        { key:'id',             label:'ID',         w:'5%',  type:'ro' },
        { key:'hechizo_id',     label:'HECHIZO ID', w:'8%',  type:'text' },
        { key:'nombre',         label:'Nombre',     w:'10%', type:'text' },
        { key:'afinidad',       label:'Afinidad',   w:'7%',  type:'afin' },
        { key:'clase',          label:'Clase',      w:'4%',  type:'clase' },
        { key:'hex_cost',       label:'HEX',        w:'4%',  type:'num' },
        { key:'valor_vex',      label:'VEX',        w:'4%',  type:'num' },
        { key:'es_conocido',    label:'Conocido',   w:'4%',  type:'bool' },
        { key:'es_estado',      label:'Estado',     w:'4%',  type:'bool' },
        { key:'es_prioridad',   label:'Prioridad',  w:'4%',  type:'bool' },
        { key:'backcast',       label:'Bk',         w:'3%',  type:'num' },
        { key:'nextcast',       label:'Nx',         w:'3%',  type:'num' },
        { key:'resumen',        label:'Resumen',    w:'10%', type:'text' },
        { key:'efecto',         label:'Efecto',     w:'10%', type:'text' },
        { key:'overcast',       label:'Overcast',   w:'7%',  type:'text' },
        { key:'undercast',      label:'Undercast',  w:'7%',  type:'text' },
        { key:'especial',       label:'Especial',   w:'5%',  type:'text' },
        { key:'nota',           label:'Nota',       w:'5%',  type:'text' },
        { key:'_acc',           label:'',           w:'5%',  type:'actions' },
    ];

    // ── Montar DOM ───────────────────────────────────────────
    function _mount() {
        if (document.getElementById('hz-tablas-overlay')) return;

        const overlay = document.createElement('div');
        overlay.id = 'hz-tablas-overlay';
        overlay.onclick = (e) => { if (e.target === overlay) _close(); };
        document.body.appendChild(overlay);

        const wrap = document.createElement('div');
        wrap.id = 'hz-tablas-wrap';
        wrap.innerHTML = `
            <!-- Panel nodos (75%) -->
            <div id="hz-panel-nodos">
                <div class="hz-tab-header">
                    <div style="display:flex;align-items:center;gap:0;">
                        <span class="hz-tab-header-title">🗄 hechizos_nodos</span>
                        <span class="hz-tab-header-sub" id="hz-nodos-count"></span>
                    </div>
                    <div class="hz-tab-header-actions">
                        <button class="hz-btn blue" onclick="window._hmTablasExportNodos()">⬇ CSV</button>
                        <label class="hz-btn blue" style="cursor:pointer;" title="Importar CSV">⬆ CSV <input type="file" accept=".csv" style="display:none;" onchange="window._hmTablasImportNodos(this)"></label>
                        <button class="hz-btn green" onclick="window._hmTablasNuevoNodo()">➕ Fila</button>
                        <button class="hz-btn gold" onclick="window._hmTablasRecargar()">↺ Recargar</button>
                        <button class="hz-tab-close" onclick="window._hmCerrarTablas()">×</button>
                    </div>
                </div>
                <div class="hz-tab-toolbar">
                    <input type="text" id="hz-n-search" placeholder="Buscar en nodos…" oninput="window._hmTablasNSearch(this.value)">
                    <span id="hz-n-sel-info" style="font-size:0.6em;color:#555;"></span>
                </div>
                <div class="hz-tab-body" id="hz-n-body">
                    <div class="hz-loading"><div class="hz-spinner"></div>Cargando nodos…</div>
                </div>
                <div class="hz-tab-pager" id="hz-n-pager"></div>
            </div>

            <!-- Panel strings (25%) -->
            <div id="hz-panel-strings">
                <div class="hz-tab-header">
                    <div style="display:flex;align-items:center;">
                        <span class="hz-tab-header-title">🔗 hechizos_strings</span>
                        <span class="hz-tab-header-sub" id="hz-strings-count"></span>
                    </div>
                    <div class="hz-tab-header-actions">
                        <button class="hz-btn blue" onclick="window._hmTablasExportStrings()">⬇ CSV</button>
                        <label class="hz-btn blue" style="cursor:pointer;">⬆ CSV <input type="file" accept=".csv" style="display:none;" onchange="window._hmTablasImportStrings(this)"></label>
                        <button class="hz-btn green" onclick="window._hmTablasNuevoString()">➕</button>
                    </div>
                </div>
                <div class="hz-tab-toolbar">
                    <input type="text" id="hz-s-search" placeholder="Buscar…" oninput="window._hmTablasSSearch(this.value)">
                </div>
                <div class="hz-tab-body" id="hz-s-body">
                    <div class="hz-loading"><div class="hz-spinner"></div>Cargando…</div>
                </div>
                <div class="hz-tab-pager" id="hz-s-pager"></div>
            </div>
        `;
        document.body.appendChild(wrap);
    }

    // ── Abrir / cerrar ───────────────────────────────────────
    async function _open() {
        _mount();
        TS.open = true;
        document.getElementById('hz-tablas-overlay').classList.add('visible');
        document.getElementById('hz-tablas-wrap').classList.add('visible');
        // Cargar afinidades desde state
        TS.afinidades = Object.keys(st.colores);
        await Promise.all([_loadNodos(), _loadStrings()]);
    }

    function _close() {
        TS.open = false;
        const ov = document.getElementById('hz-tablas-overlay');
        const wr = document.getElementById('hz-tablas-wrap');
        if (ov) ov.classList.remove('visible');
        if (wr) wr.classList.remove('visible');
    }

    // ── Cargar datos ─────────────────────────────────────────
    async function _loadNodos() {
        const body = document.getElementById('hz-n-body');
        if (!body) return;
        body.innerHTML = '<div class="hz-loading"><div class="hz-spinner"></div>Cargando nodos…</div>';
        try {
            const { supabase } = await import('../hex-auth.js');
            const { data, error } = await supabase
                .from('hechizos_nodos')
                .select('*')
                .order('id', { ascending: true });
            if (error) throw error;
            TS.nRows = data || [];
            _nFilter();
        } catch(e) {
            body.innerHTML = `<div class="hz-tab-empty">Error: ${e.message}</div>`;
        }
    }

    async function _loadStrings() {
        const body = document.getElementById('hz-s-body');
        if (!body) return;
        body.innerHTML = '<div class="hz-loading"><div class="hz-spinner"></div>Cargando strings…</div>';
        try {
            const { supabase } = await import('../hex-auth.js');
            const { data, error } = await supabase
                .from('hechizos_strings')
                .select('*')
                .order('id', { ascending: true });
            if (error) throw error;
            TS.sRows = data || [];
            _sFilter();
        } catch(e) {
            body.innerHTML = `<div class="hz-tab-empty">Error: ${e.message}</div>`;
        }
    }

    // ── Filtro / sort / render NODOS ─────────────────────────
    function _nFilter() {
        const q = TS.nSearch.toLowerCase();
        TS.nFilt = q
            ? TS.nRows.filter(r =>
                (r.nombre||'').toLowerCase().includes(q) ||
                (r.hechizo_id||'').toLowerCase().includes(q) ||
                (r.afinidad||'').toLowerCase().includes(q) ||
                String(r.id).includes(q)
              )
            : [...TS.nRows];
        _nSort();
    }

    function _nSort() {
        const k = TS.nSortCol, d = TS.nSortDir;
        TS.nFilt.sort((a,b) => {
            let av = a[k], bv = b[k];
            if (typeof av === 'boolean') av = av ? 1 : 0;
            if (typeof bv === 'boolean') bv = bv ? 1 : 0;
            if (av == null) av = '';
            if (bv == null) bv = '';
            return av < bv ? -d : av > bv ? d : 0;
        });
        TS.nPage = 0;
        _nRender();
    }

    function _nRender() {
        const body = document.getElementById('hz-n-body');
        const pager = document.getElementById('hz-n-pager');
        const count = document.getElementById('hz-nodos-count');
        if (!body) return;

        const total = TS.nFilt.length;
        const pages = Math.max(1, Math.ceil(total / TS.nPageSize));
        TS.nPage = Math.min(TS.nPage, pages - 1);
        const slice = TS.nFilt.slice(TS.nPage * TS.nPageSize, (TS.nPage+1) * TS.nPageSize);

        if (count) count.textContent = ` (${total}/${TS.nRows.length})`;

        // Tabla
        const thHtml = NCOLS.map(c => {
            const cls = TS.nSortCol === c.key
                ? (TS.nSortDir === 1 ? 'sort-asc' : 'sort-desc')
                : '';
            const onclick = c.type !== 'actions'
                ? `onclick="window._hmTablasNSort('${c.key}')"` : '';
            return `<th style="width:${c.w}" class="${cls}" ${onclick}>${c.label}</th>`;
        }).join('');

        const rowsHtml = slice.map(r => _nRowHtml(r)).join('');

        body.innerHTML = `
            <table class="hz-tabla">
                <thead><tr>${thHtml}</tr></thead>
                <tbody id="hz-n-tbody">${rowsHtml || '<tr><td colspan="${NCOLS.length}" class="hz-tab-empty">Sin resultados</td></tr>'}</tbody>
            </table>`;

        // Paginador
        if (pager) pager.innerHTML = `
            <span>${TS.nPage+1} / ${pages} &nbsp;·&nbsp; ${total} filas</span>
            <button class="hz-pager-btn" ${TS.nPage<=0?'disabled':''} onclick="window._hmTablasNPage(${TS.nPage-1})">◀</button>
            <button class="hz-pager-btn" ${TS.nPage>=pages-1?'disabled':''} onclick="window._hmTablasNPage(${TS.nPage+1})">▶</button>
            <select style="font-size:1em;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:4px;color:#888;padding:1px 4px;" onchange="window._hmTablasNPageSize(this.value)">
                ${[25,50,100,200].map(n=>`<option value="${n}" ${n===TS.nPageSize?'selected':''}>${n}/pág</option>`).join('')}
            </select>`;
    }

    function _nRowHtml(r) {
        const editing = TS.nEditing === r.id;
        const buf = editing ? TS.nBuf : r;
        const afinOpts = TS.afinidades.map(a =>
            `<option value="${a}" ${(buf.afinidad||r.afinidad)===a?'selected':''}>${a}</option>`
        ).join('');
        const claseOpts = ['1','2','3','4','5'].map(c =>
            `<option value="${c}" ${String(buf.clase||r.clase)===c?'selected':''}>${c}</option>`
        ).join('');

        return `<tr data-nid="${r.id}" class="${editing?'hz-row-sel':''}">
            ${NCOLS.map(c => {
                if (c.type === 'ro') return `<td class="hz-cell-id">${r[c.key]}</td>`;
                if (c.type === 'actions') return `<td class="hz-cell-actions">
                    ${editing
                        ? `<button class="hz-row-btn save" onclick="window._hmTablasNSave(${r.id})">✓</button>
                           <button class="hz-row-btn cancel" onclick="window._hmTablasNCancelEdit()">✕</button>`
                        : `<button class="hz-row-btn" onclick="window._hmTablasNEdit(${r.id})">✏</button>
                           <button class="hz-row-btn del" onclick="window._hmTablasNDel(${r.id},'${(r.nombre||'').replace(/'/g,"\\'")}')">🗑</button>`
                    }</td>`;
                if (c.type === 'bool') return `<td class="hz-cell-bool">
                    <input type="checkbox" ${(editing?buf[c.key]:r[c.key])?'checked':''} ${editing?`onchange="window._hmTablasNBufBool('${c.key}',this.checked)"`:'disabled'}>
                    </td>`;
                if (c.type === 'num') return `<td class="hz-cell-num">
                    ${editing
                        ? `<input type="number" value="${buf[c.key]??r[c.key]??0}" min="0" style="width:52px;text-align:right;" oninput="window._hmTablasNBuf('${c.key}',this.value)">`
                        : (r[c.key]??0)}</td>`;
                if (c.type === 'afin') return `<td class="hz-cell-afin">
                    ${editing
                        ? `<select onchange="window._hmTablasNBuf('${c.key}',this.value)">${afinOpts}</select>`
                        : (r[c.key]||'')}</td>`;
                if (c.type === 'clase') return `<td>
                    ${editing
                        ? `<select onchange="window._hmTablasNBuf('${c.key}',this.value)">${claseOpts}</select>`
                        : (r[c.key]||'')}</td>`;
                // text
                const val = editing ? (buf[c.key]??r[c.key]??'') : (r[c.key]||'');
                const disp = String(val).length > 40 ? String(val).substring(0,40)+'…' : String(val);
                return `<td title="${String(r[c.key]||'').replace(/"/g,'&quot;')}">
                    ${editing
                        ? `<input type="text" value="${String(buf[c.key]??r[c.key]??'').replace(/"/g,'&quot;')}" oninput="window._hmTablasNBuf('${c.key}',this.value)">`
                        : `<span>${disp}</span>`}</td>`;
            }).join('')}
        </tr>`;
    }

    // ── Filtro / sort / render STRINGS ───────────────────────
    function _sFilter() {
        const q = TS.sSearch.toLowerCase();
        TS.sFilt = q
            ? TS.sRows.filter(r =>
                (r.source_id||'').toLowerCase().includes(q) ||
                (r.target_id||'').toLowerCase().includes(q) ||
                String(r.id).includes(q)
              )
            : [...TS.sRows];
        _sSort();
    }

    function _sSort() {
        const k = TS.sSortCol, d = TS.sSortDir;
        TS.sFilt.sort((a,b) => {
            let av = a[k]??'', bv = b[k]??'';
            return av < bv ? -d : av > bv ? d : 0;
        });
        TS.sPage = 0;
        _sRender();
    }

    function _sRender() {
        const body = document.getElementById('hz-s-body');
        const pager = document.getElementById('hz-s-pager');
        const count = document.getElementById('hz-strings-count');
        if (!body) return;

        const total = TS.sFilt.length;
        const pages = Math.max(1, Math.ceil(total / TS.sPageSize));
        TS.sPage = Math.min(TS.sPage, pages - 1);
        const slice = TS.sFilt.slice(TS.sPage * TS.sPageSize, (TS.sPage+1) * TS.sPageSize);

        if (count) count.textContent = ` (${total}/${TS.sRows.length})`;

        const rowsHtml = slice.map(r => {
            const editing = TS.sEditing === r.id;
            const buf = editing ? TS.sBuf : r;
            return `<tr data-sid="${r.id}" class="${editing?'hz-row-sel':''}">
                <td class="hz-cell-id" style="width:8%">${r.id}</td>
                <td class="hz-str-src" style="width:37%">${editing
                    ? `<input type="text" value="${buf.source_id||''}" oninput="window._hmTablasSBuf('source_id',this.value)">`
                    : (r.source_id||'')}</td>
                <td style="width:4%;text-align:center;color:#555;">→</td>
                <td class="hz-str-tgt" style="width:37%">${editing
                    ? `<input type="text" value="${buf.target_id||''}" oninput="window._hmTablasSBuf('target_id',this.value)">`
                    : (r.target_id||'')}</td>
                <td style="width:14%;text-align:right;white-space:nowrap;">
                    ${editing
                        ? `<button class="hz-row-btn save" onclick="window._hmTablasSave(${r.id})">✓</button>
                           <button class="hz-row-btn cancel" onclick="window._hmTablasSCancelEdit()">✕</button>`
                        : `<button class="hz-row-btn" onclick="window._hmTablasSEdit(${r.id})">✏</button>
                           <button class="hz-row-btn del" onclick="window._hmTablasSDelStr(${r.id})">🗑</button>`
                    }
                </td>
            </tr>`;
        }).join('');

        body.innerHTML = `
            <table class="hz-tabla">
                <thead><tr>
                    <th style="width:8%;" onclick="window._hmTablasSSort('id')">ID</th>
                    <th style="width:37%;" onclick="window._hmTablasSSort('source_id')" class="${TS.sSortCol==='source_id'?(TS.sSortDir===1?'sort-asc':'sort-desc'):''}">SOURCE</th>
                    <th style="width:4%;"></th>
                    <th style="width:37%;" onclick="window._hmTablasSSort('target_id')" class="${TS.sSortCol==='target_id'?(TS.sSortDir===1?'sort-asc':'sort-desc'):''}">TARGET</th>
                    <th style="width:14%;"></th>
                </tr></thead>
                <tbody>${rowsHtml || '<tr><td colspan="5" class="hz-tab-empty">Sin resultados</td></tr>'}</tbody>
            </table>`;

        if (pager) pager.innerHTML = `
            <span>${TS.sPage+1} / ${pages} &nbsp;·&nbsp; ${total} filas</span>
            <button class="hz-pager-btn" ${TS.sPage<=0?'disabled':''} onclick="window._hmTablasSPage(${TS.sPage-1})">◀</button>
            <button class="hz-pager-btn" ${TS.sPage>=pages-1?'disabled':''} onclick="window._hmTablasSPage(${TS.sPage+1})">▶</button>`;
    }

    // ── CSV export ───────────────────────────────────────────
    function _toCSV(rows) {
        if (!rows.length) return '';
        const keys = Object.keys(rows[0]);
        const esc = v => `"${String(v??'').replace(/"/g,'""')}"`;
        return [keys.join(','), ...rows.map(r => keys.map(k => esc(r[k])).join(','))].join('\n');
    }
    function _download(csv, fname) {
        const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a'); a.href = url; a.download = fname;
        document.body.appendChild(a); a.click();
        setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1000);
    }

    // ── CSV import ───────────────────────────────────────────
    function _parseCSV(text) {
        const lines = text.trim().split('\n');
        const headers = lines[0].split(',').map(h => h.replace(/^"|"$/g,'').trim());
        return lines.slice(1).map(line => {
            const vals = []; let cur='', inQ=false;
            for (const ch of line) {
                if (ch==='"') inQ=!inQ;
                else if (ch===',' && !inQ) { vals.push(cur.trim()); cur=''; }
                else cur += ch;
            }
            vals.push(cur.trim());
            const obj = {};
            headers.forEach((h,i) => { obj[h] = vals[i]??''; });
            return obj;
        });
    }

    // ── Globals expuestos ────────────────────────────────────
    window._hmAbrirTablas   = () => _open();
    window._hmCerrarTablas  = () => _close();
    window._hmTablasRecargar = async () => {
        await Promise.all([_loadNodos(), _loadStrings()]);
        toast('↺ Tablas recargadas');
    };

    // Nodos — búsqueda
    window._hmTablasNSearch = (v) => { TS.nSearch=v; TS.nPage=0; _nFilter(); };
    window._hmTablasNSort   = (k) => {
        if (TS.nSortCol===k) TS.nSortDir *= -1; else { TS.nSortCol=k; TS.nSortDir=1; }
        _nSort();
    };
    window._hmTablasNPage     = (p) => { TS.nPage=p; _nRender(); };
    window._hmTablasNPageSize = (n) => { TS.nPageSize=parseInt(n); TS.nPage=0; _nRender(); };

    // Nodos — edición
    window._hmTablasNEdit = (id) => {
        const r = TS.nRows.find(r=>r.id===id); if (!r) return;
        TS.nEditing = id;
        TS.nBuf = {...r};
        _nRender();
    };
    window._hmTablasNCancelEdit = () => { TS.nEditing=null; TS.nBuf={}; _nRender(); };
    window._hmTablasNBuf  = (k,v) => { TS.nBuf[k]=v; };
    window._hmTablasNBufBool = (k,v) => { TS.nBuf[k]=v; };

    window._hmTablasNSave = async (id) => {
        const orig = TS.nRows.find(r=>r.id===id); if (!orig) return;
        const buf = TS.nBuf;
        const payload = {};
        NCOLS.forEach(c => {
            if (c.type==='ro' || c.type==='actions') return;
            const k = c.key;
            let v = buf[k]??orig[k];
            if (c.type==='num') v = parseInt(v)||0;
            if (c.type==='bool') v = !!v;
            payload[k] = v;
        });
        try {
            const { supabase } = await import('../hex-auth.js');
            const { error } = await supabase.from('hechizos_nodos').update(payload).eq('id', id);
            if (error) throw error;
            Object.assign(orig, payload);
            TS.nEditing = null; TS.nBuf = {};
            _nFilter();
            toast('✓ Nodo guardado');
        } catch(e) { toast('Error: ' + e.message); }
    };

    window._hmTablasNDel = async (id, nombre) => {
        if (!confirm(`¿Eliminar nodo "${nombre}" (id:${id})? Esta acción no se puede deshacer.`)) return;
        try {
            const { supabase } = await import('../hex-auth.js');
            const { error } = await supabase.from('hechizos_nodos').delete().eq('id', id);
            if (error) throw error;
            TS.nRows = TS.nRows.filter(r=>r.id!==id);
            _nFilter();
            toast('🗑 Nodo eliminado');
        } catch(e) { toast('Error: ' + e.message); }
    };

    window._hmTablasNuevoNodo = () => {
        const nuevo = {
            id: '__new__', hechizo_id:'', nombre:'', afinidad:'Desconocida',
            clase:'1', hex_cost:0, valor_vex:0, es_conocido:false, es_estado:false,
            es_prioridad:false, backcast:0, nextcast:0,
            resumen:'', efecto:'', overcast:'', undercast:'', especial:'', nota:'',
            _isNew: true,
        };
        TS.nRows.unshift(nuevo);
        TS.nEditing = '__new__';
        TS.nBuf = {...nuevo};
        TS.nPage = 0;
        _nFilter();
    };

    // Para filas nuevas guardamos con insert
    window._hmTablasNSave = async (id) => {
        const orig = TS.nRows.find(r=>r.id===id); if (!orig) return;
        const buf = TS.nBuf;
        const payload = {};
        NCOLS.forEach(c => {
            if (c.type==='ro' || c.type==='actions') return;
            const k = c.key;
            let v = buf[k]??orig[k];
            if (c.type==='num') v = parseInt(v)||0;
            if (c.type==='bool') v = !!v;
            payload[k] = v;
        });
        try {
            const { supabase } = await import('../hex-auth.js');
            if (orig._isNew) {
                const { data, error } = await supabase.from('hechizos_nodos').insert(payload).select().single();
                if (error) throw error;
                // Reemplazar row temporal
                const idx = TS.nRows.findIndex(r=>r.id==='__new__');
                if (idx>=0) TS.nRows[idx] = data;
            } else {
                const { error } = await supabase.from('hechizos_nodos').update(payload).eq('id', id);
                if (error) throw error;
                Object.assign(orig, payload);
            }
            TS.nEditing = null; TS.nBuf = {};
            _nFilter();
            toast('✓ Guardado');
        } catch(e) { toast('Error: ' + e.message); }
    };

    // Export/Import nodos
    window._hmTablasExportNodos = () => _download(_toCSV(TS.nRows), 'hechizos_nodos.csv');
    window._hmTablasImportNodos = async (input) => {
        const file = input.files[0]; if (!file) return;
        const text = await file.text();
        const rows = _parseCSV(text);
        if (!rows.length || !rows[0].hechizo_id) { toast('CSV inválido — necesita columna hechizo_id'); return; }
        if (!confirm(`¿Importar ${rows.length} filas a hechizos_nodos? (upsert por hechizo_id)`)) { input.value=''; return; }
        try {
            const { supabase } = await import('../hex-auth.js');
            const payload = rows.map(r => ({
                hechizo_id: r.hechizo_id, nombre: r.nombre||r.hechizo_id,
                afinidad: r.afinidad||'Desconocida', clase: r.clase||'1',
                hex_cost: parseInt(r.hex_cost)||0, valor_vex: parseInt(r.valor_vex)||0,
                es_conocido: r.es_conocido==='true'||r.es_conocido===true,
                es_estado: r.es_estado==='true'||r.es_estado===true,
                es_prioridad: r.es_prioridad==='true'||r.es_prioridad===true,
                backcast: parseInt(r.backcast)||0, nextcast: parseInt(r.nextcast)||0,
                resumen: r.resumen||'', efecto: r.efecto||'',
                overcast: r.overcast||'', undercast: r.undercast||'',
                especial: r.especial||'', nota: r.nota||'',
            }));
            const { error } = await supabase.from('hechizos_nodos')
                .upsert(payload, { onConflict: 'hechizo_id' });
            if (error) throw error;
            toast(`✓ ${rows.length} filas importadas`);
            await _loadNodos();
        } catch(e) { toast('Error importando: ' + e.message); }
        input.value = '';
    };

    // Strings — búsqueda
    window._hmTablasSSearch = (v) => { TS.sSearch=v; TS.sPage=0; _sFilter(); };
    window._hmTablasSSort   = (k) => {
        if (TS.sSortCol===k) TS.sSortDir*=-1; else { TS.sSortCol=k; TS.sSortDir=1; }
        _sSort();
    };
    window._hmTablasSPage   = (p) => { TS.sPage=p; _sRender(); };

    // Strings — edición
    window._hmTablasSEdit = (id) => {
        const r = TS.sRows.find(r=>r.id===id); if (!r) return;
        TS.sEditing=id; TS.sBuf={...r}; _sRender();
    };
    window._hmTablasSCancelEdit = () => { TS.sEditing=null; TS.sBuf={}; _sRender(); };
    window._hmTablasSBuf = (k,v) => { TS.sBuf[k]=v; };

    window._hmTablasSave = async (id) => {
        const orig = TS.sRows.find(r=>r.id===id); if (!orig) return;
        const payload = { source_id: TS.sBuf.source_id||orig.source_id, target_id: TS.sBuf.target_id||orig.target_id };
        try {
            const { supabase } = await import('../hex-auth.js');
            const { error } = await supabase.from('hechizos_strings').update(payload).eq('id', id);
            if (error) throw error;
            Object.assign(orig, payload);
            TS.sEditing=null; TS.sBuf={}; _sFilter();
            toast('✓ String guardado');
        } catch(e) { toast('Error: ' + e.message); }
    };

    window._hmTablasSDelStr = async (id) => {
        if (!confirm(`¿Eliminar string id:${id}?`)) return;
        try {
            const { supabase } = await import('../hex-auth.js');
            const { error } = await supabase.from('hechizos_strings').delete().eq('id', id);
            if (error) throw error;
            TS.sRows = TS.sRows.filter(r=>r.id!==id);
            _sFilter();
            toast('🗑 String eliminado');
        } catch(e) { toast('Error: ' + e.message); }
    };

    window._hmTablasNuevoString = () => {
        const nuevo = { id: '__snew__', source_id:'', target_id:'', _isNew:true };
        TS.sRows.unshift(nuevo);
        TS.sEditing='__snew__'; TS.sBuf={...nuevo};
        TS.sPage=0; _sFilter();
    };

    window._hmTablasSave = async (id) => {
        const orig = TS.sRows.find(r=>r.id===id); if (!orig) return;
        const payload = { source_id: TS.sBuf.source_id||orig.source_id, target_id: TS.sBuf.target_id||orig.target_id };
        if (!payload.source_id || !payload.target_id) { toast('source_id y target_id requeridos'); return; }
        try {
            const { supabase } = await import('../hex-auth.js');
            if (orig._isNew) {
                const { data, error } = await supabase.from('hechizos_strings').insert(payload).select().single();
                if (error) throw error;
                const idx = TS.sRows.findIndex(r=>r.id==='__snew__');
                if (idx>=0) TS.sRows[idx] = data;
            } else {
                const { error } = await supabase.from('hechizos_strings').update(payload).eq('id', id);
                if (error) throw error;
                Object.assign(orig, payload);
            }
            TS.sEditing=null; TS.sBuf={}; _sFilter();
            toast('✓ String guardado');
        } catch(e) { toast('Error: ' + e.message); }
    };

    // Export/Import strings
    window._hmTablasExportStrings = () => _download(_toCSV(TS.sRows), 'hechizos_strings.csv');
    window._hmTablasImportStrings = async (input) => {
        const file = input.files[0]; if (!file) return;
        const text = await file.text();
        const rows = _parseCSV(text);
        if (!rows.length || !rows[0].source_id) { toast('CSV inválido — necesita source_id, target_id'); return; }
        if (!confirm(`¿Importar ${rows.length} strings? (upsert)`)) { input.value=''; return; }
        try {
            const { supabase } = await import('../hex-auth.js');
            const payload = rows.map(r => ({ source_id: r.source_id, target_id: r.target_id }));
            const { error } = await supabase.from('hechizos_strings')
                .upsert(payload, { onConflict: 'source_id,target_id' });
            if (error) throw error;
            toast(`✓ ${rows.length} strings importados`);
            await _loadStrings();
        } catch(e) { toast('Error importando: ' + e.message); }
        input.value = '';
    };
})();
