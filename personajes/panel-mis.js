// ============================================================
// panel-mis.js — Tab de Misiones (catálogo izq / detalle der)
// /personajes/panel-mis.js
// ============================================================

import { supabase }   from '../hex-auth.js';
import { estadoUI, personajes } from './personajes-state.js';

// ── Helpers ────────────────────────────────────────────────────
function _norm(s) {
    return s ? s.toString().trim().toLowerCase()
        .replace(/[áàäâ]/g,'a').replace(/[éèëê]/g,'e').replace(/[íìïî]/g,'i')
        .replace(/[óòöô]/g,'o').replace(/[úùüû]/g,'u').replace(/[ñ]/g,'n')
        .replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,'') : '';
}
function _sb() { return window._hexConfig?.storageUrl || ''; }
function _imgIcon(nombre) {
    return `${_sb()}/imgpersonajes/${_norm(nombre)}icon.png`;
}
function _fallback() {
    return `${_sb()}/imginterfaz/no_encontrado.png`;
}

const _ESTADO_LABEL = ['Inactiva', 'Pendiente', 'En Proceso', 'Finalizada'];
const _ESTADO_CLS   = ['pmis-badge-0','pmis-badge-1','pmis-badge-2','pmis-badge-3'];

function _badge(estado) {
    return `<span class="pmis-badge ${_ESTADO_CLS[estado]||'pmis-badge-0'}">${_ESTADO_LABEL[estado]||'?'}</span>`;
}
function _tipoBadge(tipo) {
    const map = {
        'Grande':        ['pmis-tipo-grande','Grande'],
        'Normal':        ['pmis-tipo-normal','Normal'],
        'Personalizada': ['pmis-tipo-perso','Perso.'],
    };
    const [cls, label] = map[tipo] || ['pmis-tipo-perso', tipo];
    return `<span class="pmis-tipo-badge ${cls}">${label}</span>`;
}
function _avatares(jugadores, resaltarPJ, size = 26) {
    if (!jugadores || jugadores.length === 0) return '';
    return jugadores.map(j => `
        <img class="pmis-av ${j === resaltarPJ ? 'yo' : ''}"
             width="${size}" height="${size}"
             src="${_imgIcon(j)}"
             onerror="this.src='${_fallback()}'"
             title="${j}">`
    ).join('');
}

// ── Estilos ────────────────────────────────────────────────────
function _inyectarEstilos() {
    if (document.getElementById('panel-mis-styles')) return;
    const st = document.createElement('style');
    st.id = 'panel-mis-styles';
    st.textContent = `
/* ═══════════════════════════════════════════════
   PANEL IZQUIERDO (catálogo)
═══════════════════════════════════════════════ */
#ppj-mis-panel-izq {
    position: fixed; left: 0; top: 0; bottom: 0;
    width: calc(50vw - 220px); max-width: 560px; min-width: 280px;
    display: flex; flex-direction: column;
    background: rgba(5,0,12,0.97);
    border-right: 1px solid rgba(212,175,55,0.15);
    z-index: 1200; font-family: 'Inter', system-ui, sans-serif; overflow: hidden;
}
@media(max-width:900px) { #ppj-mis-panel-izq { display: none; } }

/* Header izq */
.pmis-izq-header {
    padding: 12px 14px 10px;
    border-bottom: 1px solid rgba(255,255,255,0.05); flex-shrink: 0;
}
.pmis-izq-toprow {
    display: flex; align-items: center; justify-content: space-between;
    margin-bottom: 8px; gap: 8px;
}
.pmis-izq-title {
    font-family: 'Cinzel', serif; font-size: 0.68em; color: #888;
    letter-spacing: 1.5px; text-transform: uppercase;
}
.pmis-izq-search {
    width: 100%; background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.08); border-radius: 6px;
    color: #ccc; font-size: 0.78em; padding: 6px 10px; margin-bottom: 8px;
    box-sizing: border-box; outline: none; font-family: inherit;
}
.pmis-izq-search::placeholder { color: #3a3a58; }
.pmis-izq-search:focus { border-color: rgba(212,175,55,0.3); }
.pmis-izq-filtros { display: flex; gap: 4px; flex-wrap: wrap; }
.pmis-fbtn {
    background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
    color: #5a5a78; border-radius: 4px; padding: 3px 9px; font-size: 0.62em;
    cursor: pointer; font-family: inherit; transition: all 0.12s; white-space: nowrap;
}
.pmis-fbtn:hover { color: #aaa; border-color: rgba(255,255,255,0.15); }
.pmis-fbtn.on { color: #d4af37; border-color: rgba(212,175,55,0.35); background: rgba(212,175,55,0.07); }

/* Modo asignación OP */
.pmis-btn-asig {
    font-size: 0.62em; padding: 3px 9px; border-radius: 4px; cursor: pointer;
    font-family: inherit; border: 1px solid rgba(120,80,200,0.3);
    color: #7a60b0; background: rgba(120,80,200,0.06); transition: all 0.12s;
    white-space: nowrap;
}
.pmis-btn-asig.on {
    background: rgba(120,80,200,0.18); color: #c090ff;
    border-color: rgba(160,100,240,0.45);
}
.pmis-btn-asig:hover { background: rgba(120,80,200,0.14); color: #b080ee; }

/* Lista izq */
.pmis-izq-list {
    flex: 1; overflow-y: auto; padding: 8px 10px 16px;
    scrollbar-width: thin; scrollbar-color: rgba(212,175,55,0.12) transparent;
}
.pmis-izq-list::-webkit-scrollbar { width: 3px; }
.pmis-izq-list::-webkit-scrollbar-thumb { background: rgba(212,175,55,0.12); border-radius: 2px; }

/* Separador de grupo */
.pmis-grupo-label {
    font-size: 0.57em; letter-spacing: 1.8px; text-transform: uppercase;
    color: #3a3a58; font-weight: 700; padding: 10px 4px 5px;
    border-bottom: 1px solid rgba(255,255,255,0.04); margin-bottom: 5px;
}

/* Card del catálogo izquierdo */
.pmis-cat-card {
    background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05);
    border-radius: 7px; padding: 9px 11px; margin-bottom: 5px;
    cursor: pointer; transition: background 0.12s, border-color 0.12s;
    position: relative;
}
.pmis-cat-card:hover { background: rgba(255,255,255,0.04); border-color: rgba(255,255,255,0.09); }
.pmis-cat-card.seleccionada { border-color: rgba(212,175,55,0.35); background: rgba(212,175,55,0.04); }
.pmis-cat-card.participando { border-color: rgba(212,175,55,0.18); }

.pmis-cat-card-header {
    display: flex; align-items: flex-start; justify-content: space-between;
    gap: 6px; margin-bottom: 5px;
}
.pmis-cat-card-titulo {
    font-size: 0.82em; font-weight: 600; color: #c8c8d8; line-height: 1.3; flex: 1;
}
.pmis-cat-card-clase { font-size: 0.6em; color: #4a4a60; flex-shrink: 0; align-self: center; }
.pmis-cat-meta { display: flex; align-items: center; gap: 5px; flex-wrap: wrap; margin-bottom: 5px; }
.pmis-cat-desc {
    font-size: 0.68em; color: #4a4a68; line-height: 1.45; margin-bottom: 5px;
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.pmis-cat-footer {
    display: flex; align-items: center; justify-content: space-between;
    gap: 6px; margin-top: 4px;
}
.pmis-cat-avs { display: flex; gap: 3px; align-items: center; flex-wrap: wrap; }
.pmis-cat-cupos { font-size: 0.6em; color: #3a3a50; }
.pmis-cat-actions { display: flex; gap: 4px; flex-shrink: 0; }
.pmis-cat-btn {
    font-size: 0.58em; padding: 2px 7px; border-radius: 4px; cursor: pointer;
    font-family: inherit; border: 1px solid; transition: all 0.12s;
}
.pmis-cat-btn-edit { color: #9a9a60; border-color: rgba(160,160,60,0.25); background: rgba(160,160,60,0.05); }
.pmis-cat-btn-edit:hover { background: rgba(160,160,60,0.14); }
.pmis-cat-btn-del  { color: #904040; border-color: rgba(160,60,60,0.25); background: rgba(160,60,60,0.05); }
.pmis-cat-btn-del:hover { background: rgba(160,60,60,0.14); }

/* Nota OP en card catálogo */
.pmis-nota-op {
    background: rgba(30,10,50,0.5); border-left: 2px solid rgba(140,80,200,0.3);
    padding: 3px 7px; font-size: 0.63em; margin: 4px 0;
    color: #9a8ab0; border-radius: 0 4px 4px 0;
}
.pmis-nota-op strong { color: #a080c0; }

/* Avatar compartido */
.pmis-av {
    width: 26px; height: 26px; border-radius: 50%; object-fit: cover;
    object-position: top; border: 2px solid rgba(255,255,255,0.08); background: #111;
    flex-shrink: 0;
}
.pmis-av.yo { border-color: rgba(212,175,55,0.55); }

/* ═══════════════════════════════════════════════
   TOOLTIP DE ASIGNACIÓN (modo OP)
═══════════════════════════════════════════════ */
.pmis-asig-tooltip {
    position: absolute; left: calc(100% + 6px); top: 0;
    background: rgba(8,4,20,0.98); border: 1px solid rgba(120,80,200,0.4);
    border-radius: 8px; padding: 8px 10px;
    z-index: 1400; width: 200px; box-shadow: 0 4px 20px rgba(0,0,0,0.6);
    animation: pmis-tooltip-in 0.12s ease;
}
@keyframes pmis-tooltip-in { from { opacity:0; transform:translateX(-4px); } to { opacity:1; transform:none; } }
.pmis-asig-tt-title {
    font-size: 0.6em; color: #7a60b0; letter-spacing: 1.2px;
    text-transform: uppercase; font-weight: 700; margin-bottom: 7px;
}
.pmis-asig-tt-grid {
    display: flex; flex-direction: column; gap: 3px;
    max-height: 220px; overflow-y: auto;
    scrollbar-width: thin; scrollbar-color: rgba(120,80,200,0.2) transparent;
}
.pmis-asig-tt-pj {
    display: flex; align-items: center; gap: 7px;
    padding: 4px 6px; border-radius: 5px; cursor: pointer;
    border: 1px solid transparent; transition: all 0.1s;
}
.pmis-asig-tt-pj:hover { background: rgba(255,255,255,0.04); border-color: rgba(255,255,255,0.07); }
.pmis-asig-tt-pj.en { background: rgba(120,80,200,0.08); border-color: rgba(120,80,200,0.25); }
.pmis-asig-tt-nombre { font-size: 0.72em; color: #b0b0c8; flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pmis-asig-tt-pj.en .pmis-asig-tt-nombre { color: #c090ff; }
.pmis-asig-tt-check { font-size: 0.75em; color: #7a60b0; flex-shrink: 0; }

/* ═══════════════════════════════════════════════
   PANEL DERECHO (detalle de misión)
═══════════════════════════════════════════════ */
.pmis-section { padding: 12px 16px; border-bottom: 1px solid rgba(255,255,255,0.04); }
.pmis-section-title {
    font-size: 0.6em; letter-spacing: 1.5px; text-transform: uppercase;
    color: #3a3a58; font-weight: 700; margin-bottom: 10px;
    display: flex; align-items: center; gap: 6px;
}
.pmis-section-title span {
    color: #5a5a78; background: rgba(255,255,255,0.05);
    padding: 1px 7px; border-radius: 10px; font-size: 0.9em;
}

/* Detalle grande */
.pmis-det-card {
    background: rgba(255,255,255,0.02); border: 1px solid rgba(212,175,55,0.18);
    border-radius: 8px; padding: 14px 16px;
}
.pmis-det-titulo { font-family: 'Cinzel', serif; font-size: 1.05em; color: #ddd; margin-bottom: 7px; line-height: 1.35; }
.pmis-det-meta   { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-bottom: 10px; }
.pmis-det-desc   { font-size: 0.78em; color: #7a7a98; line-height: 1.6; margin-bottom: 10px; }
.pmis-det-avs    { display: flex; gap: 5px; flex-wrap: wrap; align-items: center; margin-bottom: 10px; }
.pmis-det-cupos  { font-size: 0.65em; color: #4a4a60; margin-left: 4px; }

.pmis-det-av {
    width: 36px; height: 36px; border-radius: 50%; object-fit: cover;
    object-position: top; border: 2px solid rgba(255,255,255,0.1); background: #111;
    cursor: default;
}
.pmis-det-av.yo { border-color: rgba(212,175,55,0.55); }

/* Botones de acción (derecha) */
.pmis-btn-accion {
    display: flex; align-items: center; justify-content: center; gap: 6px;
    width: 100%; padding: 7px 10px; border-radius: 6px; font-size: 0.72em;
    font-family: 'Cinzel', serif; cursor: pointer; border: 1px solid;
    transition: all 0.12s; letter-spacing: 0.3px; margin-top: 8px;
    box-sizing: border-box;
}
.pmis-btn-accion.unirse {
    background: rgba(212,175,55,0.06); color: #c8a830; border-color: rgba(212,175,55,0.22);
}
.pmis-btn-accion.unirse:hover { background: rgba(212,175,55,0.14); }
.pmis-btn-accion.salir {
    background: rgba(180,50,50,0.05); color: #a85050; border-color: rgba(180,50,50,0.2);
}
.pmis-btn-accion.salir:hover { background: rgba(180,50,50,0.14); }
.pmis-btn-accion:disabled { opacity: 0.3; cursor: default; }

/* Estado vacio */
.pmis-empty { text-align: center; color: #2e2e48; font-size: 0.75em; padding: 20px 0; }
.pmis-empty-icon { font-size: 1.6em; margin-bottom: 6px; opacity: 0.3; }

/* Loader */
.pmis-loader {
    display: flex; align-items: center; justify-content: center;
    padding: 20px; color: #3a3a58; font-size: 0.75em; gap: 8px;
}
.pmis-loader::before {
    content: ''; width: 14px; height: 14px;
    border: 2px solid rgba(212,175,55,0.15); border-top-color: rgba(212,175,55,0.5);
    border-radius: 50%; animation: pmis-spin 0.8s linear infinite;
}
@keyframes pmis-spin { to { transform: rotate(360deg); } }

/* Botón nueva misión */
.pmis-btn-nueva {
    width: 100%; background: rgba(255,255,255,0.02);
    border: 1px solid rgba(255,255,255,0.07);
    color: #5a5a78; border-radius: 5px; padding: 8px;
    font-size: 0.7em; font-family: 'Cinzel', serif; cursor: pointer;
    transition: all 0.12s; letter-spacing: 0.4px;
    display: flex; align-items: center; justify-content: center; gap: 6px;
}
.pmis-btn-nueva:hover { color: #888; border-color: rgba(255,255,255,0.12); background: rgba(255,255,255,0.04); }

/* Badges */
.pmis-badge {
    font-size: 0.6em; padding: 2px 7px; border-radius: 8px;
    display: inline-flex; align-items: center; gap: 3px;
}
.pmis-badge-0 { background: rgba(255,255,255,0.04); color: #4a4a60; border: 1px solid rgba(255,255,255,0.06); }
.pmis-badge-1 { background: rgba(180,150,30,0.08); color: #a08828; border: 1px solid rgba(180,150,30,0.18); }
.pmis-badge-2 { background: rgba(60,130,200,0.08); color: #5080a0; border: 1px solid rgba(60,130,200,0.18); }
.pmis-badge-3 { background: rgba(50,150,80,0.08);  color: #508060; border: 1px solid rgba(50,150,80,0.18); }

.pmis-tipo-badge { font-size: 0.58em; padding: 1px 6px; border-radius: 6px; border: 1px solid; }
.pmis-tipo-grande { color: #887040; border-color: rgba(180,140,60,0.25); background: rgba(180,140,60,0.06); }
.pmis-tipo-normal { color: #407080; border-color: rgba(60,120,180,0.25); background: rgba(60,120,180,0.06); }
.pmis-tipo-perso  { color: #507060; border-color: rgba(80,160,100,0.25); background: rgba(80,160,100,0.06); }

/* Formulario */
.pmis-form {
    background: rgba(5,0,12,0.8); border: 1px solid rgba(255,255,255,0.08);
    border-radius: 8px; padding: 12px 14px 14px; margin-bottom: 8px;
}
.pmis-form label {
    font-size: 0.6em; color: #4a4a68; text-transform: uppercase;
    letter-spacing: 1px; display: block; margin-bottom: 3px; margin-top: 8px;
}
.pmis-form input, .pmis-form textarea, .pmis-form select {
    width: 100%; background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.08); border-radius: 5px;
    color: #ccc; padding: 5px 8px; font-size: 0.78em;
    box-sizing: border-box; outline: none; font-family: inherit;
}
.pmis-form textarea { resize: vertical; min-height: 55px; }
.pmis-form input:focus, .pmis-form textarea:focus, .pmis-form select:focus {
    border-color: rgba(212,175,55,0.3);
}
.pmis-form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.pmis-form-footer { display: flex; gap: 6px; margin-top: 10px; }
.pmis-btn-save {
    flex: 1; background: rgba(212,175,55,0.07);
    border: 1px solid rgba(212,175,55,0.22);
    color: #b09030; border-radius: 5px; padding: 7px;
    font-size: 0.7em; font-family: 'Cinzel', serif; cursor: pointer; transition: all 0.12s;
}
.pmis-btn-save:hover { background: rgba(212,175,55,0.14); }
.pmis-btn-cancel {
    background: transparent; border: 1px solid rgba(255,255,255,0.08);
    color: #4a4a68; border-radius: 5px; padding: 7px 12px; font-size: 0.7em;
    font-family: inherit; cursor: pointer; transition: all 0.12s;
}
.pmis-btn-cancel:hover { color: #888; }

/* Guía recompensas */
.pmis-guia {
    background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05);
    border-radius: 6px; padding: 9px 11px; margin-bottom: 10px; font-size: 0.65em;
}
.pmis-guia-title { color: #6a6a50; font-weight: 700; margin-bottom: 5px; }
.pmis-guia-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 3px; color: #4a4a60; }
.pmis-guia-nota { color: #3a3a50; margin-top: 5px; }
`;
    document.head.appendChild(st);
}

// ── Estado local ───────────────────────────────────────────────
const _s = {
    misiones:       [],
    filtro:         'todos',
    busqueda:       '',
    verFin:         false,
    formActivo:     false,
    editandoId:     null,
    nombrePJ:       null,
    misionSelec:    null,   // titulo de la misión seleccionada en el catálogo
    modoAsig:       false,  // modo asignación OP activo
    tooltipMision:  null,   // titulo de la misión con tooltip abierto
};

// ── Carga ──────────────────────────────────────────────────────
async function _cargar() {
    const { data } = await supabase
        .from('misiones')
        .select('titulo, tipo, clase, estado, descripcion, nota_op, cupos, jugadores, autor, orden')
        .order('orden');
    _s.misiones = data || [];
}

// ── Entrada pública ────────────────────────────────────────────
export async function renderTabMisiones(nombre, body) {
    _inyectarEstilos();
    _s.nombrePJ   = nombre;
    _s.formActivo = false;
    _s.editandoId = null;
    _s.misionSelec= null;
    _s.tooltipMision = null;

    document.getElementById('ppj-mis-panel-izq')?.remove();
    document.getElementById('panel-pj-root')?.classList.add('obj-mode');

    body.innerHTML = `<div class="pmis-loader">Cargando misiones…</div>`;
    await _cargar();

    // Si el PJ participa en al menos una, seleccionar la primera
    if (!_s.misionSelec) {
        const primera = _s.misiones.find(m => {
            const j = Array.isArray(m.jugadores) ? m.jugadores : [];
            return j.includes(nombre);
        });
        _s.misionSelec = primera?.titulo || null;
    }

    _montarPanelIzq(nombre);
    _renderDerecho(body, nombre);
}

export function cerrarTabMisiones() {
    document.getElementById('ppj-mis-panel-izq')?.remove();
    document.getElementById('panel-pj-root')?.classList.remove('obj-mode');
    _s.modoAsig = false;
    _s.tooltipMision = null;
}

// ── Panel izquierdo (catálogo completo) ───────────────────────
function _montarPanelIzq(nombre) {
    const izq = document.createElement('div');
    izq.id = 'ppj-mis-panel-izq';

    const esAdmin = estadoUI.esAdmin;
    const q = _s.busqueda.toLowerCase().trim();

    let lista = _s.misiones.filter(m => {
        if (m.tipo === 'OP') return false;
        if (!_s.verFin && m.estado === 3) return false;
        if (_s.filtro === 'participando') {
            const j = Array.isArray(m.jugadores) ? m.jugadores : [];
            return j.includes(nombre);
        }
        if (_s.filtro === 'disponibles') {
            const j = Array.isArray(m.jugadores) ? m.jugadores : [];
            return !j.includes(nombre);
        }
        return true;
    });
    if (q) lista = lista.filter(m =>
        m.titulo.toLowerCase().includes(q) || (m.descripcion || '').toLowerCase().includes(q)
    );

    // Agrupar por tipo
    const grupos = [
        { key: 'Grande',        label: 'Misiones Grandes' },
        { key: 'Normal',        label: 'Misiones Normales' },
        { key: 'Personalizada', label: 'Misiones Personalizadas' },
    ];

    let gruposHTML = '';
    for (const g of grupos) {
        const items = lista.filter(m => m.tipo === g.key);
        if (items.length === 0) continue;
        gruposHTML += `<div class="pmis-grupo-label">${g.label}</div>`;
        gruposHTML += items.map(m => _renderCatCard(m, nombre, esAdmin)).join('');
    }

    if (!gruposHTML) {
        gruposHTML = `<div class="pmis-empty"><div class="pmis-empty-icon">🗺️</div>Sin misiones</div>`;
    }

    const safeNombre = nombre.replace(/'/g, "\\'");

    izq.innerHTML = `
        <div class="pmis-izq-header">
            <div class="pmis-izq-toprow">
                <span class="pmis-izq-title">Catálogo de Misiones</span>
                ${esAdmin ? `<button class="pmis-btn-asig ${_s.modoAsig ? 'on' : ''}"
                    onclick="window._pmisToggleModoAsig('${safeNombre}')">
                    ${_s.modoAsig ? '✦ Asignando' : '⊕ Asignar'}
                </button>` : ''}
            </div>
            <input class="pmis-izq-search" placeholder="Buscar misión…"
                value="${_s.busqueda.replace(/"/g,'&quot;')}"
                oninput="window._pmisIzqBuscar(this.value,'${safeNombre}')">
            <div class="pmis-izq-filtros">
                <button class="pmis-fbtn ${_s.filtro==='todos'?'on':''}"
                    onclick="window._pmisIzqFiltro('todos','${safeNombre}')">Todas</button>
                <button class="pmis-fbtn ${_s.filtro==='participando'?'on':''}"
                    onclick="window._pmisIzqFiltro('participando','${safeNombre}')">Participando</button>
                <button class="pmis-fbtn ${_s.filtro==='disponibles'?'on':''}"
                    onclick="window._pmisIzqFiltro('disponibles','${safeNombre}')">Disponibles</button>
                <button class="pmis-fbtn ${_s.verFin?'on':''}"
                    onclick="window._pmisIzqToggleFin('${safeNombre}')">Finalizadas</button>
            </div>
        </div>
        <div class="pmis-izq-list">${gruposHTML}</div>`;

    document.body.appendChild(izq);

    // Si hay tooltip abierto, reabrirlo
    if (_s.modoAsig && _s.tooltipMision) {
        _abrirTooltipAsig(_s.tooltipMision, nombre);
    }
}

// ── Card del catálogo izquierdo ────────────────────────────────
function _renderCatCard(m, nombrePJ, esAdmin) {
    const jugs     = Array.isArray(m.jugadores) ? m.jugadores : [];
    const enMision = jugs.includes(nombrePJ);
    const safeId   = m.titulo.replace(/'/g, "\\'");
    const safeNom  = nombrePJ.replace(/'/g, "\\'");
    const esPerso  = m.tipo === 'Personalizada';
    const selec    = _s.misionSelec === m.titulo;

    // Avatares pequeños
    const avsHTML = jugs.length > 0
        ? `<div class="pmis-cat-avs">
            ${_avatares(jugs, nombrePJ, 22)}
            <span class="pmis-cat-cupos">${jugs.length}/${m.cupos}</span>
           </div>`
        : `<span class="pmis-cat-cupos">Sin jugadores · cupos: ${m.cupos}</span>`;

    // Nota OP
    const notaHTML = esAdmin && m.nota_op
        ? `<div class="pmis-nota-op"><strong>OP:</strong> ${m.nota_op}</div>` : '';

    // Acciones editar/borrar (SOLO en izquierda, solo para admin o perso propia)
    let actionsHTML = '';
    if (esAdmin || esPerso) {
        actionsHTML = `<div class="pmis-cat-actions">
            <button class="pmis-cat-btn pmis-cat-btn-edit"
                onclick="event.stopPropagation();window._pmisAbrirFormulario('${safeNom}','${safeId}')">✏ Editar</button>
            <button class="pmis-cat-btn pmis-cat-btn-del"
                onclick="event.stopPropagation();window._pmisEliminar('${safeId}','${safeNom}')">✕ Borrar</button>
        </div>`;
    }

    // Clic en la card: si modo asig OP → tooltip; si no → mostrar detalle derecho
    const clickFn = _s.modoAsig && esAdmin
        ? `window._pmisClickCatAsig('${safeId}','${safeNom}')`
        : `window._pmisSeleccionar('${safeId}','${safeNom}')`;

    return `<div class="pmis-cat-card${enMision ? ' participando' : ''}${selec ? ' seleccionada' : ''}"
                 id="pmis-cat-${_norm(m.titulo)}"
                 onclick="${clickFn}">
        <div class="pmis-cat-card-header">
            <span class="pmis-cat-card-titulo">${m.titulo}</span>
            <span class="pmis-cat-card-clase">C-${m.clase}</span>
        </div>
        <div class="pmis-cat-meta">${_badge(m.estado)} ${_tipoBadge(m.tipo)}</div>
        ${m.descripcion ? `<div class="pmis-cat-desc">${m.descripcion}</div>` : ''}
        ${notaHTML}
        <div class="pmis-cat-footer">
            ${avsHTML}
            ${actionsHTML}
        </div>
    </div>`;
}

// ── Panel derecho (detalle) ────────────────────────────────────
function _renderDerecho(body, nombre) {
    if (_s.formActivo) {
        body.innerHTML = _renderForm(nombre);
        return;
    }

    const esAdmin = estadoUI.esAdmin;
    let html = '';

    // Si hay misión seleccionada → mostrar su detalle
    if (_s.misionSelec) {
        const m = _s.misiones.find(x => x.titulo === _s.misionSelec);
        if (m) {
            html += `<div class="pmis-section">
                <div class="pmis-section-title">Detalle de misión</div>
                ${_renderDetalle(m, nombre, esAdmin)}
            </div>`;
        }
    } else {
        html += `<div class="pmis-section">
            <div class="pmis-empty"><div class="pmis-empty-icon">📋</div>Selecciona una misión del catálogo</div>
        </div>`;
    }

    // Botón crear
    html += `<div class="pmis-section">
        <button class="pmis-btn-nueva"
            onclick="window._pmisAbrirFormulario('${nombre.replace(/'/g,"\\'")}',null)">
            ✦ Crear misión personalizada
        </button>
    </div>`;

    body.innerHTML = html;
}

// ── Detalle de misión (panel derecho, solo Unirse/Salir) ───────
function _renderDetalle(m, nombrePJ, esAdmin) {
    const jugs   = Array.isArray(m.jugadores) ? m.jugadores : [];
    const enMis  = jugs.includes(nombrePJ);
    const safeId = m.titulo.replace(/'/g, "\\'");
    const safeNom= nombrePJ.replace(/'/g, "\\'");
    const esPerso= m.tipo === 'Personalizada';
    const llena  = m.cupos > 0 && jugs.length >= m.cupos && !esAdmin;

    // Avatares grandes
    const avsHTML = jugs.length > 0
        ? `<div class="pmis-det-avs">
            ${jugs.map(j => `
                <img class="pmis-det-av ${j === nombrePJ ? 'yo' : ''}"
                     src="${_imgIcon(j)}"
                     onerror="this.src='${_fallback()}'"
                     title="${j}">`).join('')}
            <span class="pmis-det-cupos">${jugs.length}/${m.cupos} participantes</span>
           </div>`
        : `<div style="font-size:0.65em;color:#3a3a50;margin-bottom:8px;">Sin jugadores aún · cupos: ${m.cupos}</div>`;

    // Nota OP
    const notaHTML = esAdmin && m.nota_op
        ? `<div class="pmis-nota-op" style="margin-bottom:8px;"><strong>OP:</strong> ${m.nota_op}</div>` : '';

    // Solo botón Unirse / Salir (no hay editar/borrar aquí)
    let btnHTML = '';
    if (enMis) {
        const puede = esAdmin || esPerso;
        btnHTML = puede
            ? `<button class="pmis-btn-accion salir"
                    onclick="window._pmisDesapuntarPJ('${safeId}','${safeNom}')">
                    ✕ Salir de misión
               </button>`
            : `<div style="font-size:0.62em;color:#2e2e48;text-align:center;margin-top:8px;">El OP gestiona esta misión</div>`;
    } else {
        const puede = esAdmin || esPerso;
        btnHTML = puede
            ? `<button class="pmis-btn-accion unirse" ${llena ? 'disabled' : ''}
                    onclick="window._pmisApuntarPJ('${safeId}','${safeNom}')">
                    ${llena ? '🔒 Misión llena' : '✦ Unirse a esta misión'}
               </button>`
            : '';
    }

    return `<div class="pmis-det-card">
        <div class="pmis-det-titulo">${m.titulo}</div>
        <div class="pmis-det-meta">${_badge(m.estado)} ${_tipoBadge(m.tipo)} <span style="font-size:0.6em;color:#3a3a58;">Clase ${m.clase}</span></div>
        ${m.descripcion ? `<div class="pmis-det-desc">${m.descripcion}</div>` : ''}
        ${notaHTML}
        ${avsHTML}
        ${btnHTML}
    </div>`;
}

// ── Tooltip de asignación (modo OP) ───────────────────────────
function _abrirTooltipAsig(titulo, nombrePJ) {
    // Cerrar tooltip previo
    document.querySelector('.pmis-asig-tooltip')?.remove();

    const card = document.getElementById(`pmis-cat-${_norm(titulo)}`);
    if (!card) return;

    const m    = _s.misiones.find(x => x.titulo === titulo);
    if (!m) return;

    const jugs = Array.isArray(m.jugadores) ? m.jugadores : [];

    // Obtener todos los personajes activos
    const todosLosPjs = Object.entries(personajes)
        .filter(([, p]) => p.isActive !== false)
        .sort(([a], [b]) => a.localeCompare(b));

    const safeId  = titulo.replace(/'/g, "\\'");
    const safeNom = nombrePJ.replace(/'/g, "\\'");

    const tooltip = document.createElement('div');
    tooltip.className = 'pmis-asig-tooltip';
    tooltip.innerHTML = `
        <div class="pmis-asig-tt-title">Asignar a misión</div>
        <div class="pmis-asig-tt-grid">
            ${todosLosPjs.map(([nom, p]) => {
                const enMis = jugs.includes(nom);
                const icono = p.iconoOverride || nom;
                return `<div class="pmis-asig-tt-pj ${enMis ? 'en' : ''}"
                             onclick="event.stopPropagation();window._pmisToggleAsigPj('${safeId}','${nom.replace(/'/g,"\\'")}','${safeNom}')">
                    <img class="pmis-av" width="20" height="20"
                         src="${_imgIcon(icono)}"
                         onerror="this.src='${_fallback()}'"
                         style="width:20px;height:20px;">
                    <span class="pmis-asig-tt-nombre">${nom}</span>
                    <span class="pmis-asig-tt-check">${enMis ? '✓' : ''}</span>
                </div>`;
            }).join('')}
        </div>`;

    // Posicionar relativo a la card
    card.style.position = 'relative';
    card.appendChild(tooltip);
    _s.tooltipMision = titulo;

    // Cerrar al hacer click fuera
    setTimeout(() => {
        document.addEventListener('click', _cerrarTooltip, { once: true });
    }, 50);
}

function _cerrarTooltip() {
    document.querySelector('.pmis-asig-tooltip')?.remove();
    _s.tooltipMision = null;
}

// ── Formulario ────────────────────────────────────────────────
function _renderForm(nombrePJ) {
    const esAdmin = estadoUI.esAdmin;
    const id = _s.editandoId;
    const m  = id ? _s.misiones.find(x => x.titulo === id) : null;
    const esN = !m;
    const safeNom = nombrePJ.replace(/'/g, "\\'");
    const safeId  = (id || '').replace(/'/g, "\\'");

    const TIPOS = esAdmin
        ? ['Personalizada', 'Grande', 'Normal']
        : ['Personalizada'];

    const guia = `<div class="pmis-guia">
        <div class="pmis-guia-title">Recompensas sugeridas por clase</div>
        <div class="pmis-guia-grid">
            <div>C1: 600–1200 HEX · 2–4 PA</div><div>C2: 1000–1800 HEX · 3–6 PA</div>
            <div>C3: 1500–2200 HEX · 4–8 PA</div><div>C4: 2000–3000 HEX · 5–10 PA</div>
            <div>C5: 2500–3600 HEX · 6–12 PA</div>
        </div>
        <div class="pmis-guia-nota">La clase del hechizo debería coincidir con la de la misión.</div>
    </div>`;

    return `<div class="pmis-section">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
            <button class="pmis-btn-cancel" style="padding:4px 8px;"
                onclick="window._pmisVolverLista('${safeNom}')">←</button>
            <span style="font-size:0.82em;color:#888;">
                ${esN ? 'Nueva misión personalizada' : `Editar: ${m.titulo}`}
            </span>
        </div>
        ${guia}
        <div class="pmis-form">
            <label>Título *</label>
            <input id="pmis-f-titulo" value="${(m?.titulo||'').replace(/"/g,'&quot;')}"
                placeholder="Nombre de la misión"
                ${!esN ? 'readonly style="opacity:0.5"' : ''}>

            <div class="pmis-form-grid">
                <div>
                    <label>Tipo</label>
                    <select id="pmis-f-tipo" ${!esAdmin?'disabled':''}>
                        ${TIPOS.map(t=>`<option value="${t}" ${(m?.tipo||'Personalizada')===t?'selected':''}>${t}</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label>Clase</label>
                    <select id="pmis-f-clase">
                        ${[1,2,3,4,5].map(c=>`<option value="${c}" ${parseInt(m?.clase||1)===c?'selected':''}>${c}</option>`).join('')}
                    </select>
                </div>
            </div>

            <div class="pmis-form-grid">
                <div>
                    <label>Estado</label>
                    <select id="pmis-f-estado" ${!esAdmin&&!esN?'disabled':''}>
                        <option value="0" ${(m?.estado||0)===0?'selected':''}>Inactiva</option>
                        <option value="1" ${(m?.estado||0)===1?'selected':''}>Pendiente</option>
                        <option value="2" ${(m?.estado||0)===2?'selected':''}>En Proceso</option>
                        <option value="3" ${(m?.estado||0)===3?'selected':''}>Finalizada</option>
                    </select>
                </div>
                <div>
                    <label>Cupos</label>
                    <input id="pmis-f-cupos" type="number" min="1" value="${m?.cupos||2}">
                </div>
            </div>

            <label>Autor</label>
            <input id="pmis-f-autor" value="${(m?.autor||nombrePJ).replace(/"/g,'&quot;')}">

            <label>Descripción / Recompensa</label>
            <textarea id="pmis-f-desc">${m?.descripcion||''}</textarea>

            ${esAdmin ? `
            <label style="color:#806090;">Nota OP (oculta para jugadores)</label>
            <textarea id="pmis-f-notaop" style="border-color:rgba(120,70,180,0.3);">${m?.nota_op||''}</textarea>` : ''}

            <div class="pmis-form-footer">
                <button class="pmis-btn-cancel"
                    onclick="window._pmisVolverLista('${safeNom}')">Cancelar</button>
                <button class="pmis-btn-save"
                    onclick="window._pmisGuardar('${safeNom}','${safeId}')">
                    ${esN ? '✦ Crear' : '💾 Guardar'}
                </button>
            </div>
        </div>
    </div>`;
}

// ── Re-render ─────────────────────────────────────────────────
function _reRender() {
    const body = document.getElementById('ppj-body');
    if (!body || !_s.nombrePJ) return;
    document.getElementById('ppj-mis-panel-izq')?.remove();
    _montarPanelIzq(_s.nombrePJ);
    _renderDerecho(body, _s.nombrePJ);
}

// ── Globals ───────────────────────────────────────────────────
window._pmisIzqBuscar     = (v) => { _s.busqueda = v; _reRender(); };
window._pmisIzqFiltro     = (v) => { _s.filtro   = v; _reRender(); };
window._pmisIzqToggleFin  = ()  => { _s.verFin   = !_s.verFin; _reRender(); };
window._pmisToggleModoAsig= ()  => {
    _s.modoAsig = !_s.modoAsig;
    if (!_s.modoAsig) _s.tooltipMision = null;
    _reRender();
};

// Click en card catálogo: modo normal → seleccionar; modo asig → tooltip
window._pmisSeleccionar = (titulo, nombrePJ) => {
    _s.misionSelec = titulo;
    _reRender();
};

window._pmisClickCatAsig = (titulo, nombrePJ) => {
    if (_s.tooltipMision === titulo) {
        _cerrarTooltip();
    } else {
        _cerrarTooltip();
        _abrirTooltipAsig(titulo, nombrePJ);
    }
};

// Asignar/quitar un PJ desde el tooltip
window._pmisToggleAsigPj = async (idMision, pjNombre, nombrePjActivo) => {
    const m = _s.misiones.find(x => x.titulo === idMision);
    if (!m) return;
    const jugs = Array.isArray(m.jugadores) ? [...m.jugadores] : [];
    let nuevoEstado = m.estado;

    if (jugs.includes(pjNombre)) {
        // Quitar
        const idx = jugs.indexOf(pjNombre);
        jugs.splice(idx, 1);
        if (nuevoEstado === 1 && m.cupos > 0 && jugs.length < m.cupos) nuevoEstado = 0;
    } else {
        // Añadir
        jugs.push(pjNombre);
        if (nuevoEstado === 0 && m.cupos > 0 && jugs.length >= m.cupos) nuevoEstado = 1;
    }

    const { error } = await supabase.from('misiones')
        .update({ jugadores: jugs, estado: nuevoEstado }).eq('titulo', idMision);
    if (error) { alert('Error: ' + error.message); return; }

    window.mostrarToast?.(jugs.includes(pjNombre) ? `✦ ${pjNombre} apuntado` : `✕ ${pjNombre} removido`);
    _s.tooltipMision = null; // se reabre tras re-render si _modoAsig activo
    await _cargar();
    _reRender();
};

window._pmisVolverLista = () => {
    _s.formActivo = false; _s.editandoId = null; _reRender();
};

window._pmisAbrirFormulario = (nombre, idMision) => {
    if (idMision) {
        const m = _s.misiones.find(x => x.titulo === idMision);
        if (m && (m.tipo === 'Grande' || m.tipo === 'Normal') && !estadoUI.esAdmin) {
            window.mostrarToast?.('Solo el OP puede editar misiones Grandes o Normales.', true);
            return;
        }
    }
    _s.formActivo = true;
    _s.editandoId = idMision || null;
    _s.nombrePJ   = nombre;
    _reRender();
};

window._pmisGuardar = async (nombre, idOriginal) => {
    const titulo = document.getElementById('pmis-f-titulo')?.value.trim();
    const tipo   = document.getElementById('pmis-f-tipo')?.value    || 'Personalizada';
    const clase  = document.getElementById('pmis-f-clase')?.value   || '1';
    const estado = parseInt(document.getElementById('pmis-f-estado')?.value) || 0;
    const cupos  = parseInt(document.getElementById('pmis-f-cupos')?.value)  || 2;
    const autor  = document.getElementById('pmis-f-autor')?.value.trim()    || nombre;
    const desc   = document.getElementById('pmis-f-desc')?.value.trim()     || '';
    const notaOp = document.getElementById('pmis-f-notaop')?.value?.trim()  || '';

    if (!titulo) { alert('El título no puede estar vacío.'); return; }
    if ((tipo === 'Grande' || tipo === 'Normal') && !estadoUI.esAdmin) {
        window.mostrarToast?.('Solo el OP puede crear misiones Grandes o Normales.', true); return;
    }

    const misExist = _s.misiones.find(m => m.titulo === (idOriginal || titulo));
    const payload  = {
        titulo, tipo, clase, estado, cupos, autor,
        descripcion: desc, nota_op: notaOp,
        jugadores: misExist?.jugadores || [],
        orden:     misExist?.orden ?? _s.misiones.length,
    };

    const { error } = await supabase.from('misiones').upsert(payload, { onConflict: 'titulo' });
    if (error) { alert('Error al guardar: ' + error.message); return; }

    window.mostrarToast?.(!idOriginal ? '✦ Misión creada' : '💾 Misión guardada');
    _s.formActivo = false; _s.editandoId = null;
    _s.misionSelec = titulo;
    await _cargar(); _reRender();
};

window._pmisEliminar = async (idMision, nombre) => {
    const m = _s.misiones.find(x => x.titulo === idMision);
    if (!m) return;
    if ((m.tipo === 'Grande' || m.tipo === 'Normal') && !estadoUI.esAdmin) {
        window.mostrarToast?.('Solo el OP puede eliminar misiones Grandes o Normales.', true); return;
    }
    if (!confirm(`¿Eliminar "${idMision}"?`)) return;
    const { error } = await supabase.from('misiones').delete().eq('titulo', idMision);
    if (error) { alert('Error: ' + error.message); return; }
    window.mostrarToast?.('Misión eliminada');
    if (_s.misionSelec === idMision) _s.misionSelec = null;
    await _cargar(); _reRender();
};

window._pmisApuntarPJ = async (idMision, nombrePJ) => {
    const m = _s.misiones.find(x => x.titulo === idMision);
    if (!m) return;
    if ((m.tipo === 'Grande' || m.tipo === 'Normal') && !estadoUI.esAdmin) {
        window.mostrarToast?.('Solo el OP puede gestionar esta misión.', true); return;
    }
    const jugs = Array.isArray(m.jugadores) ? [...m.jugadores] : [];
    if (jugs.includes(nombrePJ)) return;
    jugs.push(nombrePJ);
    let nuevoEstado = m.estado;
    if (nuevoEstado === 0 && m.cupos > 0 && jugs.length >= m.cupos) nuevoEstado = 1;
    const { error } = await supabase.from('misiones')
        .update({ jugadores: jugs, estado: nuevoEstado }).eq('titulo', idMision);
    if (error) { alert('Error: ' + error.message); return; }
    window.mostrarToast?.(`✦ ${nombrePJ} apuntado`);
    await _cargar(); _reRender();
};

window._pmisDesapuntarPJ = async (idMision, nombrePJ) => {
    const m = _s.misiones.find(x => x.titulo === idMision);
    if (!m) return;
    if ((m.tipo === 'Grande' || m.tipo === 'Normal') && !estadoUI.esAdmin) {
        window.mostrarToast?.('Solo el OP puede gestionar esta misión.', true); return;
    }
    const jugs = (Array.isArray(m.jugadores) ? m.jugadores : []).filter(j => j !== nombrePJ);
    let nuevoEstado = m.estado;
    if (nuevoEstado === 1 && m.cupos > 0 && jugs.length < m.cupos) nuevoEstado = 0;
    const { error } = await supabase.from('misiones')
        .update({ jugadores: jugs, estado: nuevoEstado }).eq('titulo', idMision);
    if (error) { alert('Error: ' + error.message); return; }
    window.mostrarToast?.(`✕ ${nombrePJ} removido`);
    await _cargar(); _reRender();
};
