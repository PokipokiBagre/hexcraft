// ============================================================
// panel-objetos-op.js — Operaciones OP de objetos
// Raíz del proyecto. No modifica panel-objetos.js ni obj-ui.js.
//
// API pública (window.*):
//   _pobjopAbrirEditor(nombre)        → editar objeto existente
//   _pobjopAbrirCrear()               → crear objeto nuevo
//   _pobjopAbrirCrearMulti()          → forja múltiple
//   _pobjopAbrirTransfer()            → mover entre inventarios
//   _pobjopAbrirImagenes()            → gestionar imágenes
// ============================================================

import { supabase } from './hex-auth.js';

// ── Helpers ──────────────────────────────────────────────────
const _norm = (s) => s ? s.toString().trim().toLowerCase()
    .replace(/[áàäâ]/g,'a').replace(/[éèëê]/g,'e').replace(/[íìïî]/g,'i')
    .replace(/[óòöô]/g,'o').replace(/[úùüû]/g,'u').replace(/[ñ]/g,'n')
    .replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,'') : '';
const _sb = () => { try { return window._hexConfig?.storageUrl || ''; } catch { return ''; } };
const _imgObj  = (n) => `${_sb()}/imgobjetos/${_norm(n)}.png`;
const _imgFall = () => `${_sb()}/imginterfaz/no_encontrado.png`;

const TIPOS   = ['Consumible','Herramienta','Accesorio','Equipo','Equipamiento','Contenedor','-'];
const MATS    = ['Cristal','Metal','Orgánico','Sagrado','-'];
const RAREZAS = ['Común','Raro','Legendario','-'];

// ── Estado interno del módulo OP ─────────────────────────────
let _op = {
    modal: null,
    personajes: [],   // [{nombre, is_player}]
    catalogo:   [],   // [{nombre, tipo, material, efecto, rareza, contenedor_padre}]
};

// ── Cargar datos necesarios ──────────────────────────────────
async function _cargarRefs() {
    const [pjRes, catRes] = await Promise.all([
        supabase.from('personajes').select('nombre,is_player,is_active,icono_override').order('nombre'),
        supabase.from('objetos').select('nombre,tipo,material,efecto,rareza,contenedor_padre,es_propuesta').eq('es_propuesta',false).order('nombre'),
    ]);
    _op.personajes = (pjRes.data || []);
    _op.catalogo   = (catRes.data || []);
}

// ── Modal base ───────────────────────────────────────────────
function _crearModal(titulo, contenidoHTML, opciones = {}) {
    _cerrarModal();
    _inyectarEstilosOP();

    const modal = document.createElement('div');
    modal.id = 'pobj-op-modal';
    modal.innerHTML = `
        <div id="pobj-op-backdrop" onclick="${opciones.sinCerrarFuera ? '' : '_cerrarModal()'}"></div>
        <div id="pobj-op-box" style="${opciones.ancho ? `max-width:${opciones.ancho}` : 'max-width:700px'}">
            <div id="pobj-op-header">
                <h3 id="pobj-op-titulo">${titulo}</h3>
                <button id="pobj-op-close" onclick="_cerrarModal()">✕</button>
            </div>
            <div id="pobj-op-body">${contenidoHTML}</div>
        </div>
    `;
    document.body.appendChild(modal);
    _op.modal = modal;
    return modal;
}

function _cerrarModal() {
    document.getElementById('pobj-op-modal')?.remove();
    _op.modal = null;
}
window._pobjopCerrar = _cerrarModal;

// ── ESTILOS OP — cargados desde objetos.css (raíz del proyecto) ─
function _inyectarEstilosOP() {
    if (document.getElementById('pobj-styles-link')) return;
    const link = document.createElement('link');
    link.id   = 'pobj-styles-link';
    link.rel  = 'stylesheet';
    link.href = '/objetos.css';   // ← ajustar ruta si cambia la estructura
    document.head.appendChild(link);
}

// ── Toast ────────────────────────────────────────────────────
function _toast(msg, ok = true) {
    const t = document.createElement('div');
    t.className = 'pobj-toast';
    t.style.borderColor = ok ? 'rgba(212,175,55,0.4)' : 'rgba(220,60,60,0.5)';
    t.style.color = ok ? '#d4af37' : '#ff6060';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2400);
}

// ── Helper: generar campos de personajes ─────────────────────
function _htmlPersonajesAsignacion(mostrarNPC = false) {
    const pjs = _op.personajes.filter(p => mostrarNPC ? true : p.is_player);
    if (pjs.length === 0) return '<div style="color:#7070a0;font-size:0.75em;">No hay personajes cargados</div>';
    return `<div class="pobj-op-pj-grid">` +
        pjs.map(p => `
            <div class="pobj-op-pj-row">
                <span class="pobj-op-pj-name" style="color:${p.is_player?'#ccc':'#777'}">${p.nombre}</span>
                <input type="number" class="pobj-op-pj-cant" data-pj="${p.nombre.replace(/"/g,'&quot;')}" value="" min="0" placeholder="0">
            </div>`).join('') +
    `</div>`;
}

function _leerAsignaciones() {
    const res = {};
    document.querySelectorAll('.pobj-op-pj-cant').forEach(input => {
        const pj = input.getAttribute('data-pj');
        const v  = parseInt(input.value) || 0;
        if (pj && v > 0) res[pj] = v;
    });
    return res;
}

// ── SELECT de objetos ────────────────────────────────────────
function _htmlSelectObjetos(id, labelVacio = '-- Ninguno (solo catálogo) --') {
    return `<select id="${id}" class="pobj-op-input">
        <option value="">${labelVacio}</option>
        ${_op.catalogo.filter(o => o.tipo === 'Contenedor').map(o =>
            `<option value="${o.nombre.replace(/"/g,'&quot;')}">📦 ${o.nombre}</option>`
        ).join('')}
        ${_op.catalogo.filter(o => o.tipo !== 'Contenedor').map(o =>
            `<option value="${o.nombre.replace(/"/g,'&quot;')}">${o.nombre}</option>`
        ).join('')}
    </select>`;
}

// ════════════════════════════════════════════════════════════
// 1. EDITOR DE OBJETO (crear o editar)
// ════════════════════════════════════════════════════════════
window._pobjopAbrirEditor = async (nombreExistente = null) => {
    await _cargarRefs();
    const esNuevo = !nombreExistente;
    const obj = esNuevo ? null : _op.catalogo.find(o => o.nombre === nombreExistente);

    const tituloModal = esNuevo ? '✨ Nuevo Objeto' : `✏️ Editar · ${nombreExistente}`;

    const htmlSelectContenedor = `<select id="pobj-op-cont-padre" class="pobj-op-input">
        <option value="">— Sin contenedor —</option>
        ${_op.catalogo.filter(o => o.tipo === 'Contenedor' && o.nombre !== nombreExistente)
            .map(o => `<option value="${o.nombre.replace(/"/g,'&quot;')}" ${obj?.contenedor_padre===o.nombre?'selected':''}>${o.nombre}</option>`).join('')}
    </select>`;

    const html = `
    <div class="pobj-op-grid2">
        <div class="pobj-op-field">
            <label class="pobj-op-label">Nombre *</label>
            <input id="pobj-op-nombre" class="pobj-op-input" value="${(obj?.nombre||'').replace(/"/g,'&quot;')}" placeholder="Nombre único" ${!esNuevo?'readonly':''}>
        </div>
        <div class="pobj-op-field">
            <label class="pobj-op-label">Tipo</label>
            <select id="pobj-op-tipo" class="pobj-op-input">
                ${TIPOS.map(t=>`<option value="${t}" ${(obj?.tipo||'-')===t?'selected':''}>${t}</option>`).join('')}
            </select>
        </div>
    </div>
    <div class="pobj-op-grid2">
        <div class="pobj-op-field">
            <label class="pobj-op-label">Material</label>
            <select id="pobj-op-mat" class="pobj-op-input">
                ${MATS.map(m=>`<option value="${m}" ${(obj?.material||'-')===m?'selected':''}>${m}</option>`).join('')}
            </select>
        </div>
        <div class="pobj-op-field">
            <label class="pobj-op-label">Rareza</label>
            <select id="pobj-op-rar" class="pobj-op-input">
                ${RAREZAS.map(r=>`<option value="${r}" ${(obj?.rareza||'Común')===r?'selected':''}>${r}</option>`).join('')}
            </select>
        </div>
    </div>
    <div class="pobj-op-field">
        <label class="pobj-op-label">Efecto / Descripción</label>
        <textarea id="pobj-op-eff" class="pobj-op-input">${obj?.efecto||''}</textarea>
    </div>
    <div class="pobj-op-grid3">
        <div class="pobj-op-field">
            <label class="pobj-op-label">Vida Roja bonus</label>
            <input id="pobj-op-vr" class="pobj-op-input" type="number" value="${obj?.vida_roja||0}" min="0">
        </div>
        <div class="pobj-op-field">
            <label class="pobj-op-label">Vida Azul bonus</label>
            <input id="pobj-op-va" class="pobj-op-input" type="number" value="${obj?.vida_azul||0}" min="0">
        </div>
        <div class="pobj-op-field">
            <label class="pobj-op-label">Contenedor padre</label>
            ${htmlSelectContenedor}
        </div>
    </div>

    ${esNuevo ? `
    <div class="pobj-op-sep">Asignar a personajes (opcional)</div>
    <label style="display:flex;align-items:center;gap:6px;font-size:0.72em;color:#888;margin-bottom:8px;cursor:pointer;">
        <input type="checkbox" id="pobj-op-show-npc" onchange="document.getElementById('pobj-op-pj-area').innerHTML=window._pobjopHtmlPjs(this.checked)"> Mostrar NPCs
    </label>
    <div id="pobj-op-pj-area">${_htmlPersonajesAsignacion(false)}</div>
    ` : ''}

    <div class="pobj-op-footer">
        <button class="pobj-op-btn pobj-op-btn-primary" onclick="window._pobjopGuardarObjeto(${!esNuevo?`'${(nombreExistente||'').replace(/'/g,"\\'")}'`:'null'})">
            ${esNuevo ? '✨ Crear objeto' : '💾 Guardar cambios'}
        </button>
        ${!esNuevo ? `<button class="pobj-op-btn pobj-op-btn-danger" onclick="window._pobjopEliminar('${(nombreExistente||'').replace(/'/g,"\\'")}')">🗑 Eliminar</button>` : ''}
        <button class="pobj-op-btn pobj-op-btn-ghost" onclick="_pobjopCerrar()">Cancelar</button>
    </div>`;

    _crearModal(tituloModal, html, { ancho: '680px' });
};

// Helper expuesto para el checkbox de NPCs
window._pobjopHtmlPjs = (mostrarNPC) => _htmlPersonajesAsignacion(mostrarNPC);

window._pobjopGuardarObjeto = async (nombreExistente) => {
    const esNuevo = !nombreExistente;
    const nombre  = (document.getElementById('pobj-op-nombre')?.value || '').trim();
    const tipo    = document.getElementById('pobj-op-tipo')?.value || '-';
    const mat     = document.getElementById('pobj-op-mat')?.value || '-';
    const rar     = document.getElementById('pobj-op-rar')?.value || 'Común';
    const eff     = (document.getElementById('pobj-op-eff')?.value || '').trim();
    const vr      = parseInt(document.getElementById('pobj-op-vr')?.value) || 0;
    const va      = parseInt(document.getElementById('pobj-op-va')?.value) || 0;
    const cont    = document.getElementById('pobj-op-cont-padre')?.value || null;

    if (!nombre) { alert('El nombre es obligatorio.'); return; }

    const payload = { nombre, tipo, material: mat, rareza: rar, efecto: eff, vida_roja: vr, vida_azul: va, contenedor_padre: cont || null, es_propuesta: false };

    let error;
    if (esNuevo) {
        ({ error } = await supabase.from('objetos').insert(payload));
    } else {
        ({ error } = await supabase.from('objetos').update(payload).eq('nombre', nombreExistente));
    }
    if (error) { _toast('Error: ' + error.message, false); return; }

    // Asignaciones
    if (esNuevo) {
        const asig = _leerAsignaciones();
        const rows = Object.entries(asig).map(([pj, cant]) => ({
            personaje_nombre: pj, objeto_nombre: nombre, cantidad: cant, equipado: false
        }));
        if (rows.length > 0) {
            await supabase.from('inventario_objetos').upsert(rows, { onConflict: 'personaje_nombre,objeto_nombre' });
        }
    }

    _toast(esNuevo ? '✨ Objeto creado' : '💾 Guardado');
    _cerrarModal();
    window._pobjRecargarDesdeOP?.();
};

window._pobjopEliminar = async (nombre) => {
    if (!confirm(`¿Eliminar "${nombre}" del catálogo? Esto lo quitará de todos los inventarios.`)) return;
    const { error } = await supabase.from('objetos').delete().eq('nombre', nombre);
    if (error) { _toast('Error: ' + error.message, false); return; }
    _toast('🗑 Objeto eliminado');
    _cerrarModal();
    window._pobjRecargarDesdeOP?.();
};

// Atajos rápidos desde panel-pj.js
window._pobjopAbrirCrear = () => window._pobjopAbrirEditor(null);

// ════════════════════════════════════════════════════════════
// 2. FORJA MÚLTIPLE (hasta 8 objetos a la vez)
// ════════════════════════════════════════════════════════════
window._pobjopAbrirCrearMulti = async () => {
    await _cargarRefs();
    const N = 8;

    const cardsHTML = Array.from({length:N}, (_,i) => `
        <div class="pobj-multi-card">
            <div class="pobj-multi-card-title">Objeto ${i+1}</div>
            <div class="pobj-op-field">
                <input id="pm-nombre-${i}" class="pobj-op-input" placeholder="Nombre (dejar vacío para omitir)">
            </div>
            <div class="pobj-op-grid3" style="gap:6px;">
                <select id="pm-tipo-${i}" class="pobj-op-input">
                    ${TIPOS.map(t=>`<option value="${t}">${t}</option>`).join('')}
                </select>
                <select id="pm-mat-${i}" class="pobj-op-input">
                    ${MATS.map(m=>`<option value="${m}">${m}</option>`).join('')}
                </select>
                <select id="pm-rar-${i}" class="pobj-op-input">
                    ${RAREZAS.map(r=>`<option value="${r}">${r}</option>`).join('')}
                </select>
            </div>
            <textarea id="pm-eff-${i}" class="pobj-op-input" placeholder="Efecto…" style="margin-top:6px;min-height:40px;"></textarea>
        </div>`).join('');

    const html = `
    <div class="pobj-op-field">
        <label class="pobj-op-label">Destinatario (opcional — todos los objetos)</label>
        <select id="pm-dest" class="pobj-op-input">
            <option value="">— Solo catálogo —</option>
            ${_op.personajes.map(p => `<option value="${p.nombre.replace(/"/g,'&quot;')}">${p.nombre}</option>`).join('')}
        </select>
    </div>
    <div class="pobj-op-sep">Objetos a crear</div>
    ${cardsHTML}
    <div class="pobj-op-footer">
        <button class="pobj-op-btn pobj-op-btn-primary" onclick="window._pobjopEjecutarMulti()">⚒️ Forjar todos</button>
        <button class="pobj-op-btn pobj-op-btn-ghost" onclick="_pobjopCerrar()">Cancelar</button>
    </div>`;

    _crearModal('⚒️ Forja Múltiple', html, { ancho: '800px' });
};

window._pobjopEjecutarMulti = async () => {
    const dest = document.getElementById('pm-dest')?.value || '';
    const N = 8;
    const objetos = [];

    for (let i = 0; i < N; i++) {
        const nombre = (document.getElementById(`pm-nombre-${i}`)?.value || '').trim();
        if (!nombre) continue;
        objetos.push({
            nombre,
            tipo:     document.getElementById(`pm-tipo-${i}`)?.value || '-',
            material: document.getElementById(`pm-mat-${i}`)?.value || '-',
            rareza:   document.getElementById(`pm-rar-${i}`)?.value || 'Común',
            efecto:   (document.getElementById(`pm-eff-${i}`)?.value || '').trim(),
            es_propuesta: false,
        });
    }

    if (objetos.length === 0) { alert('No hay objetos válidos.'); return; }

    const { error: errCat } = await supabase.from('objetos').upsert(objetos, { onConflict: 'nombre' });
    if (errCat) { _toast('Error en catálogo: ' + errCat.message, false); return; }

    if (dest) {
        const rows = objetos.map(o => ({ personaje_nombre: dest, objeto_nombre: o.nombre, cantidad: 1, equipado: false }));
        await supabase.from('inventario_objetos').upsert(rows, { onConflict: 'personaje_nombre,objeto_nombre' });
    }

    _toast(`✨ ${objetos.length} objeto(s) forjados`);
    _cerrarModal();
    window._pobjRecargarDesdeOP?.();
};

// ════════════════════════════════════════════════════════════
// 3. TRANSFERENCIA ENTRE INVENTARIOS
// ════════════════════════════════════════════════════════════
let _trState = { origen: null, destino: null, objSeleccionado: null, cant: 1 };

window._pobjopAbrirTransfer = async () => {
    await _cargarRefs();
    _trState = { origen: null, destino: null, objSeleccionado: null, cant: 1 };
    _renderTransfer();
};

async function _renderTransfer() {
    const _imgPj = (p) => `${_sb()}/imgpersonajes/${_norm(p.icono_override||p.nombre)}icon.png`;

    const pjCards = (tipo) => _op.personajes.map(p => {
        const sel = _trState[tipo] === p.nombre;
        return `<div class="pobj-transfer-pj-card ${sel?'selected':''}" onclick="window._pobjopSelPj('${tipo}','${p.nombre.replace(/'/g,"\\'")}')" >
            <img src="${_imgPj(p)}" onerror="this.onerror=null;this.src='${_imgFall()}'">
            <span>${p.nombre}</span>
        </div>`;
    }).join('');

    let invHTML = '';
    if (_trState.origen) {
        const { data: inv } = await supabase.from('inventario_objetos')
            .select('objeto_nombre,cantidad').eq('personaje_nombre', _trState.origen).gt('cantidad', 0);
        invHTML = `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;">` +
            (inv||[]).map(i => {
                const sel = _trState.objSeleccionado === i.objeto_nombre;
                return `<div onclick="window._pobjopSelObj('${i.objeto_nombre.replace(/'/g,"\\'")}' )"
                    style="display:flex;align-items:center;gap:6px;padding:6px 10px;border-radius:5px;cursor:pointer;
                    border:1px solid ${sel?'#d4af37':'rgba(255,255,255,0.27)'};background:${sel?'rgba(212,175,55,0.1)':'rgba(255,255,255,0.22)'};
                    font-size:0.75em;color:${sel?'#d4af37':'#ccc'};">
                    <img src="${_imgObj(i.objeto_nombre)}" onerror="this.onerror=null;this.src='${_imgFall()}'" style="width:28px;height:28px;border-radius:3px;object-fit:cover;">
                    ${i.objeto_nombre} <b style="color:#d4af37;">×${i.cantidad}</b>
                </div>`;
            }).join('') +
        `</div>`;
    }

    const html = `
    <div class="pobj-op-grid2" style="gap:14px;">
        <div>
            <div class="pobj-op-sep">Origen (quita)</div>
            <div style="display:flex;flex-wrap:wrap;gap:6px;">${pjCards('origen')}</div>
            ${_trState.origen ? `<div class="pobj-op-sep" style="margin-top:10px;">Objeto a transferir</div>${invHTML}` : ''}
        </div>
        <div>
            <div class="pobj-op-sep">Destino (recibe)</div>
            <div style="display:flex;flex-wrap:wrap;gap:6px;">${pjCards('destino')}</div>
        </div>
    </div>
    ${_trState.objSeleccionado ? `
    <div style="margin-top:14px;padding:12px;background:rgba(212,175,55,0.06);border:1px solid rgba(212,175,55,0.4);border-radius:7px;">
        <div class="pobj-op-sep" style="margin-top:0;">Cantidad a transferir</div>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            ${[1,3,5,10,'TODO'].map(n=>`<button onclick="window._pobjopSetCant('${n}')" class="pobj-op-btn ${_trState.cant===n||(_trState.cant==='TODO'&&n==='TODO')?'pobj-op-btn-primary':'pobj-op-btn-ghost'}">×${n}</button>`).join('')}
        </div>
    </div>` : ''}
    <div class="pobj-op-footer">
        <button class="pobj-op-btn pobj-op-btn-primary" onclick="window._pobjopEjecutarTransfer()">⇄ Transferir</button>
        <button class="pobj-op-btn pobj-op-btn-ghost" onclick="_pobjopCerrar()">Cancelar</button>
    </div>`;

    if (!_op.modal) _crearModal('⇄ Transferencia entre inventarios', html, { ancho: '800px' });
    else document.getElementById('pobj-op-body').innerHTML = html;
}

window._pobjopSelPj  = (tipo, nombre) => { _trState[tipo] = nombre; _renderTransfer(); };
window._pobjopSelObj = (nombre) => { _trState.objSeleccionado = nombre; _renderTransfer(); };
window._pobjopSetCant = (v) => { _trState.cant = v === 'TODO' ? 'TODO' : parseInt(v); _renderTransfer(); };

window._pobjopEjecutarTransfer = async () => {
    const { origen, destino, objSeleccionado, cant } = _trState;
    if (!origen || !destino || !objSeleccionado) { alert('Selecciona origen, destino y objeto.'); return; }
    if (origen === destino) { alert('El origen y el destino no pueden ser el mismo.'); return; }

    const { data: invData } = await supabase.from('inventario_objetos')
        .select('cantidad').eq('personaje_nombre', origen).eq('objeto_nombre', objSeleccionado).single();
    if (!invData) { alert('El personaje origen no tiene ese objeto.'); return; }

    const cantReal  = cant === 'TODO' ? invData.cantidad : Math.min(cant, invData.cantidad);
    const origenNew = invData.cantidad - cantReal;

    if (origenNew === 0) {
        await supabase.from('inventario_objetos').delete().eq('personaje_nombre', origen).eq('objeto_nombre', objSeleccionado);
    } else {
        await supabase.from('inventario_objetos').update({ cantidad: origenNew }).eq('personaje_nombre', origen).eq('objeto_nombre', objSeleccionado);
    }

    const { data: destData } = await supabase.from('inventario_objetos')
        .select('cantidad').eq('personaje_nombre', destino).eq('objeto_nombre', objSeleccionado).maybeSingle();
    const destNew = (destData?.cantidad || 0) + cantReal;
    await supabase.from('inventario_objetos').upsert({ personaje_nombre: destino, objeto_nombre: objSeleccionado, cantidad: destNew, equipado: false }, { onConflict: 'personaje_nombre,objeto_nombre' });

    _toast(`✅ ${cantReal}× ${objSeleccionado}: ${origen} → ${destino}`);
    _trState.objSeleccionado = null;
    _renderTransfer();
    window._pobjRecargarDesdeOP?.();
};

// ════════════════════════════════════════════════════════════
// 4. ASIGNACIÓN MASIVA (dar objeto de catálogo a varios PJs)
// ════════════════════════════════════════════════════════════
window._pobjopAbrirAsignacionMasiva = async (objNombrePrefill = '') => {
    await _cargarRefs();

    const html = `
    <div class="pobj-op-field">
        <label class="pobj-op-label">Objeto del catálogo *</label>
        <select id="pobj-op-masiva-obj" class="pobj-op-input">
            <option value="">-- Seleccionar --</option>
            ${_op.catalogo.map(o=>`<option value="${o.nombre.replace(/"/g,'&quot;')}" ${o.nombre===objNombrePrefill?'selected':''}>${o.nombre}</option>`).join('')}
        </select>
    </div>
    <div class="pobj-op-sep">Personajes destinatarios</div>
    <label style="display:flex;align-items:center;gap:6px;font-size:0.72em;color:#888;margin-bottom:8px;cursor:pointer;">
        <input type="checkbox" id="pobj-op-masiva-npc" onchange="document.getElementById('pobj-masiva-pjs').innerHTML=window._pobjopHtmlPjs(this.checked)"> Mostrar NPCs
    </label>
    <div id="pobj-masiva-pjs">${_htmlPersonajesAsignacion(false)}</div>
    <div class="pobj-op-footer">
        <button class="pobj-op-btn pobj-op-btn-primary" onclick="window._pobjopEjecutarMasiva()">🎁 Asignar</button>
        <button class="pobj-op-btn pobj-op-btn-ghost" onclick="_pobjopCerrar()">Cancelar</button>
    </div>`;

    _crearModal('🎁 Asignación masiva', html, { ancho: '600px' });
};

window._pobjopEjecutarMasiva = async () => {
    const obj = document.getElementById('pobj-op-masiva-obj')?.value;
    if (!obj) { alert('Selecciona un objeto.'); return; }
    const asig = _leerAsignaciones();
    if (Object.keys(asig).length === 0) { alert('Indica al menos una cantidad.'); return; }

    const rows = Object.entries(asig).map(([pj, cant]) => ({ personaje_nombre: pj, objeto_nombre: obj, cantidad: cant, equipado: false }));
    const { error } = await supabase.from('inventario_objetos').upsert(rows, { onConflict: 'personaje_nombre,objeto_nombre' });
    if (error) { _toast('Error: ' + error.message, false); return; }

    _toast(`✅ ${obj} asignado a ${rows.length} personaje(s)`);
    _cerrarModal();
    window._pobjRecargarDesdeOP?.();
};

// ════════════════════════════════════════════════════════════
// 5. GESTIÓN DE IMÁGENES
// ════════════════════════════════════════════════════════════
let _imgSelObj = null;

window._pobjopAbrirImagenes = async () => {
    await _cargarRefs();
    _imgSelObj = null;
    _renderImagenes();
};

function _renderImagenes() {
    const html = `
    <div style="display:flex;gap:16px;height:460px;">
        <!-- Izquierda: selector de objeto -->
        <div style="flex:0 0 45%;display:flex;flex-direction:column;border-right:1px solid rgba(255,255,255,0.06);padding-right:14px;">
            <div class="pobj-op-sep" style="margin-top:0;">Seleccionar objeto</div>
            <input id="pobj-img-busq" class="pobj-op-input" placeholder="Buscar…" oninput="window._pobjImgFiltrar(this.value)" style="margin-bottom:8px;">
            <div id="pobj-img-grid" class="pobj-img-grid" style="max-height:none;flex:1;overflow-y:auto;">
                ${_op.catalogo.map(o => {
                    const sel = _imgSelObj === o.nombre;
                    return `<div class="pobj-img-card ${sel?'selected':''}" onclick="window._pobjImgSeleccionar('${o.nombre.replace(/'/g,"\\'")}')">
                        <img src="${_imgObj(o.nombre)}" onerror="this.onerror=null;this.src='${_imgFall()}'" loading="lazy">
                        <div class="pobj-img-card-label">${o.nombre}</div>
                    </div>`;
                }).join('')}
            </div>
        </div>
        <!-- Derecha: subir imagen -->
        <div style="flex:1;display:flex;flex-direction:column;">
            <div class="pobj-op-sep" style="margin-top:0;">Subir imagen</div>
            ${_imgSelObj ? `
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;padding:8px;background:rgba(212,175,55,0.26);border:1px solid rgba(212,175,55,0.4);border-radius:6px;">
                <img src="${_imgObj(_imgSelObj)}" onerror="this.onerror=null;this.src='${_imgFall()}'" style="width:48px;height:48px;border-radius:5px;object-fit:cover;">
                <div>
                    <div style="font-size:0.8em;font-weight:700;color:#d4af37;">${_imgSelObj}</div>
                    <div style="font-size:0.62em;color:#8888a8;margin-top:2px;">Archivo destino: <code style="color:#888;">${_norm(_imgSelObj)}.png</code></div>
                </div>
            </div>
            <div class="pobj-upload-zone" id="pobj-upload-zone"
                onclick="document.getElementById('pobj-file-input').click()"
                ondragover="event.preventDefault();this.classList.add('drag-over')"
                ondragleave="this.classList.remove('drag-over')"
                ondrop="window._pobjImgDrop(event)">
                <div style="font-size:2em;margin-bottom:8px;">🖼️</div>
                <div>Haz clic o arrastra una imagen aquí</div>
                <div style="font-size:0.75em;margin-top:4px;color:#7070a0;">PNG, JPG, WEBP · Recomendado 256×256px</div>
            </div>
            <input type="file" id="pobj-file-input" accept="image/*" style="display:none" onchange="window._pobjImgSubir(this.files[0])">
            <div id="pobj-upload-status" style="margin-top:10px;font-size:0.75em;color:#8888a8;"></div>
            ` : `<div class="pobj-empty" style="margin-top:40px;">← Selecciona un objeto para subir su imagen</div>`}
        </div>
    </div>
    <div class="pobj-op-footer">
        <button class="pobj-op-btn pobj-op-btn-ghost" onclick="_pobjopCerrar()">Cerrar</button>
    </div>`;

    if (!_op.modal) _crearModal('🖼️ Imágenes de Objetos', html, { ancho: '860px', sinCerrarFuera: true });
    else document.getElementById('pobj-op-body').innerHTML = html;
}

window._pobjImgSeleccionar = (nombre) => { _imgSelObj = nombre; _renderImagenes(); };

window._pobjImgFiltrar = (q) => {
    const qq = q.toLowerCase();
    document.querySelectorAll('#pobj-img-grid .pobj-img-card').forEach(card => {
        const lbl = card.querySelector('.pobj-img-card-label')?.textContent?.toLowerCase() || '';
        card.style.display = lbl.includes(qq) ? '' : 'none';
    });
};

window._pobjImgDrop = (e) => {
    e.preventDefault();
    document.getElementById('pobj-upload-zone')?.classList.remove('drag-over');
    const file = e.dataTransfer?.files?.[0];
    if (file) window._pobjImgSubir(file);
};

window._pobjImgSubir = async (file) => {
    if (!file || !_imgSelObj) return;
    const status = document.getElementById('pobj-upload-status');
    if (status) status.textContent = 'Subiendo…';

    const bucket = 'imgobjetos';
    const path   = `${_norm(_imgSelObj)}.png`;

    // Convertir a PNG usando canvas
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = async () => {
        const canvas = document.createElement('canvas');
        canvas.width  = img.naturalWidth;
        canvas.height = img.naturalHeight;
        canvas.getContext('2d').drawImage(img, 0, 0);
        URL.revokeObjectURL(url);

        canvas.toBlob(async (blob) => {
            const { error } = await supabase.storage.from(bucket).upload(path, blob, { upsert: true, contentType: 'image/png' });
            if (error) {
                if (status) status.innerHTML = `<span style="color:#ff6060;">Error: ${error.message}</span>`;
                return;
            }
            if (status) status.innerHTML = `<span style="color:#3ecf6e;">✅ Imagen actualizada — recarga para ver el cambio</span>`;
            // Forzar recarga de la imagen en el panel
            const imgs = document.querySelectorAll(`img[src*="${_norm(_imgSelObj)}"]`);
            imgs.forEach(i => { const s = i.src; i.src = ''; i.src = s + '?v=' + Date.now(); });
        }, 'image/png');
    };
    img.onerror = () => { if (status) status.innerHTML = `<span style="color:#ff6060;">No se pudo leer la imagen.</span>`; };
    img.src = url;
};

// ════════════════════════════════════════════════════════════
// 6. GESTIÓN DE CONTENEDORES (ver/editar contenido)
// ════════════════════════════════════════════════════════════
window._pobjopAbrirContenedor = async (nombreContenedor) => {
    await _cargarRefs();

    const hijos = _op.catalogo.filter(o => o.contenedor_padre === nombreContenedor);
    const noHijos = _op.catalogo.filter(o => !o.contenedor_padre || o.contenedor_padre === nombreContenedor);

    const html = `
    <div style="display:flex;gap:16px;min-height:300px;">
        <div style="flex:1;">
            <div class="pobj-op-sep" style="margin-top:0;">Contenido actual (${hijos.length} objetos)</div>
            <div id="pobj-cont-hijos">
            ${hijos.length === 0 ? '<div class="pobj-empty">Contenedor vacío</div>' :
                hijos.map(h => `
                <div style="display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:5px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.25);margin-bottom:5px;">
                    <img src="${_imgObj(h.nombre)}" onerror="this.onerror=null;this.src='${_imgFall()}'" style="width:32px;height:32px;border-radius:4px;object-fit:cover;">
                    <span style="flex:1;font-size:0.8em;color:#ccc;">${h.nombre}</span>
                    <button class="pobj-op-btn pobj-op-btn-danger" style="padding:3px 8px;font-size:0.6em;" onclick="window._pobjContQuitarHijo('${h.nombre.replace(/'/g,"\\'")}','${nombreContenedor.replace(/'/g,"\\'")}')">Quitar</button>
                </div>`).join('')}
            </div>
        </div>
        <div style="flex:1;border-left:1px solid rgba(255,255,255,0.26);padding-left:14px;">
            <div class="pobj-op-sep" style="margin-top:0;">Agregar objeto al contenedor</div>
            <select id="pobj-cont-add-sel" class="pobj-op-input">
                <option value="">-- Seleccionar --</option>
                ${_op.catalogo.filter(o => o.contenedor_padre !== nombreContenedor && o.nombre !== nombreContenedor)
                    .map(o=>`<option value="${o.nombre.replace(/"/g,'&quot;')}">${o.nombre}</option>`).join('')}
            </select>
            <button class="pobj-op-btn pobj-op-btn-green" style="margin-top:8px;width:100%;" onclick="window._pobjContAgregarHijo('${nombreContenedor.replace(/'/g,"\\'")}')">+ Agregar</button>
        </div>
    </div>
    <div class="pobj-op-footer">
        <button class="pobj-op-btn pobj-op-btn-ghost" onclick="_pobjopCerrar()">Cerrar</button>
    </div>`;

    _crearModal(`📦 Contenedor: ${nombreContenedor}`, html, { ancho: '700px' });
};

window._pobjContAgregarHijo = async (contenedor) => {
    const hijo = document.getElementById('pobj-cont-add-sel')?.value;
    if (!hijo) { alert('Selecciona un objeto.'); return; }
    const { error } = await supabase.from('objetos').update({ contenedor_padre: contenedor }).eq('nombre', hijo);
    if (error) { _toast('Error: ' + error.message, false); return; }
    await _cargarRefs();
    window._pobjopAbrirContenedor(contenedor);
    window._pobjRecargarDesdeOP?.();
};

window._pobjContQuitarHijo = async (hijo, contenedor) => {
    const { error } = await supabase.from('objetos').update({ contenedor_padre: null }).eq('nombre', hijo);
    if (error) { _toast('Error: ' + error.message, false); return; }
    await _cargarRefs();
    window._pobjopAbrirContenedor(contenedor);
    window._pobjRecargarDesdeOP?.();
};

// ── Integración con panel-pj.js (tab Objetos) ────────────────
// panel-pj.js puede llamar estas funciones cuando el admin
// hace clic en los botones del tab Objetos:
//   window._pobjopAbrirCrear()
//   window._pobjopAbrirCrearMulti()
//   window._pobjopAbrirTransfer()
//   window._pobjopAbrirImagenes()
//   window._pobjopAbrirAsignacionMasiva(objNombre)
//   window._pobjopAbrirContenedor(nombreContenedor)
//   window._pobjopAbrirEditor(nombreExistente)
