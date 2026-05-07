// ============================================================
// panel-mis.js — Tab de Misiones (split: catálogo izq / PJ der)
// /personajes/panel-mis.js
// ============================================================

import { supabase }  from '../hex-auth.js';
import { estadoUI }  from './personajes-state.js';

// ── Estilos ────────────────────────────────────────────────────
function _inyectarEstilos() {
    if (document.getElementById('panel-mis-styles')) return;
    const st = document.createElement('style');
    st.id = 'panel-mis-styles';
    st.textContent = `
/* ── Panel izquierdo (catálogo) ── */
#ppj-mis-panel-izq {
    position: fixed; left: 0; top: 0; bottom: 0;
    width: calc(100vw - 50vw); max-width: calc(100vw - 480px);
    display: flex; flex-direction: column;
    background: rgba(5,0,12,0.97);
    border-right: 1px solid rgba(212,175,55,0.15);
    z-index: 1200; font-family: 'Inter', system-ui, sans-serif; overflow: hidden;
}
@media(max-width:900px) { #ppj-mis-panel-izq { display: none; } }

.pmis-izq-header {
    padding: 14px 16px 10px; border-bottom: 1px solid rgba(255,255,255,0.05);
    flex-shrink: 0;
}
.pmis-izq-title {
    font-family: 'Cinzel', serif; font-size: 0.72em; color: #888;
    letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 10px;
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

.pmis-izq-list {
    flex: 1; overflow-y: auto; padding: 10px 12px;
    scrollbar-width: thin; scrollbar-color: rgba(212,175,55,0.15) transparent;
}
.pmis-izq-list::-webkit-scrollbar { width: 3px; }
.pmis-izq-list::-webkit-scrollbar-thumb { background: rgba(212,175,55,0.15); border-radius: 2px; }

/* ── Fila del catálogo ── */
.pmis-cat-row {
    display: flex; align-items: center; gap: 8px; padding: 8px 10px;
    border-radius: 6px; cursor: pointer; border: 1px solid transparent;
    transition: background 0.12s, border-color 0.12s; margin-bottom: 3px;
}
.pmis-cat-row:hover { background: rgba(255,255,255,0.03); border-color: rgba(255,255,255,0.06); }
.pmis-cat-row.participando {
    background: rgba(212,175,55,0.04); border-color: rgba(212,175,55,0.15);
}
.pmis-cat-titulo {
    flex: 1; font-size: 0.8em; color: #c0c0d0; line-height: 1.3;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.pmis-cat-row.participando .pmis-cat-titulo { color: #d8d0b0; }
.pmis-cat-clase {
    font-size: 0.6em; color: #3a3a58; flex-shrink: 0;
}
.pmis-cat-dots { display: flex; gap: 2px; flex-shrink: 0; }
.pmis-cat-dot { width: 5px; height: 5px; border-radius: 50%; }
.pmis-cat-dot.filled { background: #d4af37; }
.pmis-cat-dot.empty  { background: rgba(212,175,55,0.15); }

/* Estado badges pequeños */
.pmis-estado-dot {
    width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0;
}
.pmis-estado-dot-0 { background: #3a3a50; }
.pmis-estado-dot-1 { background: #a08020; }
.pmis-estado-dot-2 { background: #4a90c8; }
.pmis-estado-dot-3 { background: #4a9a60; }

/* ── Panel derecho: secciones ── */
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

/* ── Tarjeta de misión (panel derecho) ── */
.pmis-card {
    background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05);
    border-radius: 7px; padding: 10px 12px; margin-bottom: 6px;
}
.pmis-card.participando { border-color: rgba(212,175,55,0.18); background: rgba(212,175,55,0.02); }
.pmis-card-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 6px; margin-bottom: 5px; }
.pmis-titulo { font-size: 0.82em; font-weight: 600; color: #c8c8d8; flex: 1; line-height: 1.3; }
.pmis-clase  { font-size: 0.62em; color: #3a3a58; flex-shrink: 0; align-self: center; }
.pmis-meta   { display: flex; align-items: center; gap: 5px; margin-bottom: 5px; flex-wrap: wrap; }

/* Estado badge (derecha) */
.pmis-badge {
    font-size: 0.6em; padding: 2px 7px; border-radius: 8px;
    display: inline-flex; align-items: center; gap: 3px;
}
.pmis-badge-0 { background: rgba(255,255,255,0.04); color: #4a4a60; border: 1px solid rgba(255,255,255,0.06); }
.pmis-badge-1 { background: rgba(180,150,30,0.08); color: #a08828; border: 1px solid rgba(180,150,30,0.18); }
.pmis-badge-2 { background: rgba(60,130,200,0.08); color: #5080a0; border: 1px solid rgba(60,130,200,0.18); }
.pmis-badge-3 { background: rgba(50,150,80,0.08);  color: #508060; border: 1px solid rgba(50,150,80,0.18); }

/* Tipo badge */
.pmis-tipo-badge {
    font-size: 0.58em; padding: 1px 6px; border-radius: 6px; border: 1px solid;
}
.pmis-tipo-grande { color: #887040; border-color: rgba(180,140,60,0.25); background: rgba(180,140,60,0.06); }
.pmis-tipo-normal { color: #407080; border-color: rgba(60,120,180,0.25); background: rgba(60,120,180,0.06); }
.pmis-tipo-perso  { color: #507060; border-color: rgba(80,160,100,0.25); background: rgba(80,160,100,0.06); }

.pmis-desc { font-size: 0.7em; color: #4a4a68; line-height: 1.5; margin-top: 4px;
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }

/* Avatares */
.pmis-jugadores { display: flex; gap: 4px; flex-wrap: wrap; margin-top: 6px; align-items: center; }
.pmis-avatar {
    width: 24px; height: 24px; border-radius: 50%; object-fit: cover;
    object-position: top; border: 2px solid rgba(255,255,255,0.08); background: #111;
}
.pmis-avatar.yo { border-color: rgba(212,175,55,0.5); }
.pmis-cupos-txt { font-size: 0.6em; color: #3a3a58; margin-left: 2px; }

/* Botón apuntar/salir */
.pmis-btn-apuntar {
    display: flex; align-items: center; justify-content: center; gap: 5px;
    padding: 5px 10px; border-radius: 5px; font-size: 0.68em;
    font-family: 'Cinzel', serif; cursor: pointer; border: 1px solid;
    transition: all 0.12s; letter-spacing: 0.3px; margin-top: 7px;
    width: 100%; box-sizing: border-box;
}
.pmis-btn-apuntar.unirse {
    background: rgba(212,175,55,0.06); color: #c8a830;
    border-color: rgba(212,175,55,0.22);
}
.pmis-btn-apuntar.unirse:hover { background: rgba(212,175,55,0.14); }
.pmis-btn-apuntar.salir {
    background: rgba(180,50,50,0.05); color: #a85050;
    border-color: rgba(180,50,50,0.2);
}
.pmis-btn-apuntar.salir:hover { background: rgba(180,50,50,0.12); }
.pmis-btn-apuntar:disabled { opacity: 0.3; cursor: default; }

/* OP actions */
.pmis-op-actions { display: flex; gap: 4px; margin-top: 7px; flex-wrap: wrap; }
.pmis-op-btn {
    font-size: 0.6em; padding: 3px 8px; border-radius: 4px; cursor: pointer;
    font-family: inherit; border: 1px solid; transition: all 0.12s;
}
.pmis-op-edit   { color: #9a9a60; border-color: rgba(160,160,60,0.25); background: rgba(160,160,60,0.05); }
.pmis-op-edit:hover   { background: rgba(160,160,60,0.12); }
.pmis-op-del    { color: #904040; border-color: rgba(160,60,60,0.25); background: rgba(160,60,60,0.05); }
.pmis-op-del:hover    { background: rgba(160,60,60,0.12); }
.pmis-op-apuntar{ color: #507060; border-color: rgba(80,140,90,0.25); background: rgba(80,140,90,0.05); }
.pmis-op-apuntar:hover{ background: rgba(80,140,90,0.12); }
.pmis-op-quitar { color: #806040; border-color: rgba(160,110,50,0.25); background: rgba(160,110,50,0.05); }
.pmis-op-quitar:hover { background: rgba(160,110,50,0.12); }

/* Nota OP */
.pmis-nota-op {
    background: rgba(30,10,50,0.5); border-left: 2px solid rgba(140,80,200,0.3);
    padding: 4px 8px; font-size: 0.65em; margin-top: 5px;
    color: #9a8ab0; border-radius: 0 4px 4px 0;
}
.pmis-nota-op strong { color: #a080c0; }

/* Empty */
.pmis-empty { text-align: center; color: #2e2e48; font-size: 0.75em; padding: 16px 0; }
.pmis-empty-icon { font-size: 1.4em; margin-bottom: 5px; opacity: 0.35; }

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
.pmis-form textarea { resize: vertical; min-height: 50px; }
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

// ── Helpers ────────────────────────────────────────────────────
const _ESTADO_LABEL = ['Inactiva', 'Pendiente', 'En Proceso', 'Finalizada'];
const _ESTADO_CLS   = ['pmis-badge-0', 'pmis-badge-1', 'pmis-badge-2', 'pmis-badge-3'];
const _ESTADO_DOT   = ['pmis-estado-dot-0','pmis-estado-dot-1','pmis-estado-dot-2','pmis-estado-dot-3'];

function _badge(estado) {
    return `<span class="pmis-badge ${_ESTADO_CLS[estado]||'pmis-badge-0'}">${_ESTADO_LABEL[estado]||'?'}</span>`;
}
function _tipoBadge(tipo) {
    const map = {
        'Grande':        ['pmis-tipo-grande', 'Grande'],
        'Normal':        ['pmis-tipo-normal',  'Normal'],
        'Personalizada': ['pmis-tipo-perso',   'Perso.'],
    };
    const [cls, label] = map[tipo] || ['pmis-tipo-perso', tipo];
    return `<span class="pmis-tipo-badge ${cls}">${label}</span>`;
}
function _norm(s) {
    return s ? s.toString().trim().toLowerCase()
        .replace(/[áàäâ]/g,'a').replace(/[éèëê]/g,'e').replace(/[íìïî]/g,'i')
        .replace(/[óòöô]/g,'o').replace(/[úùüû]/g,'u').replace(/[ñ]/g,'n')
        .replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,'') : '';
}
function _sb() { return window._hexConfig?.storageUrl || ''; }

// ── Estado local ───────────────────────────────────────────────
const _s = {
    misiones:   [],
    filtro:     'todos',   // 'todos' | 'participando' | 'disponibles'
    busqueda:   '',
    verFin:     false,
    formActivo: false,
    editandoId: null,
    nombrePJ:   null,
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

    // Panel izquierdo
    document.getElementById('ppj-mis-panel-izq')?.remove();
    document.getElementById('panel-pj-root')?.classList.add('obj-mode'); // reutiliza el ancho 50vw

    body.innerHTML = `<div class="pmis-loader">Cargando misiones…</div>`;
    await _cargar();

    _montarPanelIzq(nombre);
    _renderDerecho(body, nombre);
}

// ── Cierre: limpiar panel izquierdo ───────────────────────────
export function cerrarTabMisiones() {
    document.getElementById('ppj-mis-panel-izq')?.remove();
    document.getElementById('panel-pj-root')?.classList.remove('obj-mode');
}

// ── Panel izquierdo: catálogo ──────────────────────────────────
function _montarPanelIzq(nombre) {
    const izq = document.createElement('div');
    izq.id = 'ppj-mis-panel-izq';

    const esAdmin = estadoUI.esAdmin;
    const q = _s.busqueda.toLowerCase().trim();

    let lista = _s.misiones.filter(m => {
        if (m.tipo === 'OP') return false;
        if (!_s.verFin && m.estado === 3) return false;
        if (_s.filtro === 'participando') {
            const jugs = Array.isArray(m.jugadores) ? m.jugadores : [];
            return jugs.includes(nombre);
        }
        if (_s.filtro === 'disponibles') {
            const jugs = Array.isArray(m.jugadores) ? m.jugadores : [];
            return !jugs.includes(nombre);
        }
        return true;
    });
    if (q) lista = lista.filter(m =>
        m.titulo.toLowerCase().includes(q) || (m.descripcion||'').toLowerCase().includes(q)
    );

    const filasHTML = lista.map(m => {
        const jugs = Array.isArray(m.jugadores) ? m.jugadores : [];
        const enPj  = jugs.includes(nombre);
        const llena = m.cupos > 0 && jugs.length >= m.cupos;

        // Dots de cupos
        const dotsMax = Math.min(m.cupos || 0, 6);
        const dots = Array.from({length: dotsMax}, (_, i) =>
            `<div class="pmis-cat-dot ${i < jugs.length ? 'filled' : 'empty'}"></div>`
        ).join('');

        return `<div class="pmis-cat-row ${enPj ? 'participando' : ''}"
                    onclick="window._pmisVerMision('${m.titulo.replace(/'/g,"\\'")}','${nombre.replace(/'/g,"\\'")}')">
            <div class="pmis-estado-dot ${_ESTADO_DOT[m.estado]||_ESTADO_DOT[0]}"></div>
            <span class="pmis-cat-titulo">${m.titulo}</span>
            <div class="pmis-cat-dots">${dots}</div>
            <span class="pmis-cat-clase">C${m.clase}</span>
        </div>`;
    }).join('');

    izq.innerHTML = `
        <div class="pmis-izq-header">
            <div class="pmis-izq-title">Catálogo de misiones</div>
            <input class="pmis-izq-search" placeholder="Buscar…"
                value="${_s.busqueda.replace(/"/g,'&quot;')}"
                oninput="window._pmisIzqBuscar(this.value,'${nombre.replace(/'/g,"\\'")}')">
            <div class="pmis-izq-filtros">
                <button class="pmis-fbtn ${_s.filtro==='todos'?'on':''}"
                    onclick="window._pmisIzqFiltro('todos','${nombre.replace(/'/g,"\\'")}')">Todas</button>
                <button class="pmis-fbtn ${_s.filtro==='participando'?'on':''}"
                    onclick="window._pmisIzqFiltro('participando','${nombre.replace(/'/g,"\\'")}')">Participando</button>
                <button class="pmis-fbtn ${_s.filtro==='disponibles'?'on':''}"
                    onclick="window._pmisIzqFiltro('disponibles','${nombre.replace(/'/g,"\\'")}')">Disponibles</button>
                <button class="pmis-fbtn ${_s.verFin?'on':''}"
                    onclick="window._pmisIzqToggleFin('${nombre.replace(/'/g,"\\'")}')">Finalizadas</button>
            </div>
        </div>
        <div class="pmis-izq-list">
            ${lista.length === 0
                ? `<div class="pmis-empty"><div class="pmis-empty-icon">🗺️</div>Sin misiones</div>`
                : filasHTML
            }
        </div>`;

    document.body.appendChild(izq);
}

// ── Panel derecho: misiones del PJ ────────────────────────────
function _renderDerecho(body, nombre) {
    if (_s.formActivo) {
        body.innerHTML = _renderForm(nombre);
        return;
    }

    const esAdmin = estadoUI.esAdmin;
    const participando = _s.misiones.filter(m => {
        const jugs = Array.isArray(m.jugadores) ? m.jugadores : [];
        return jugs.includes(nombre);
    });

    let html = '';

    // ── Sección: mis misiones ──
    html += `<div class="pmis-section">
        <div class="pmis-section-title">Participando <span>${participando.length}</span></div>`;
    if (participando.length === 0) {
        html += `<div class="pmis-empty"><div class="pmis-empty-icon">📋</div>Sin misiones activas</div>`;
    } else {
        html += participando.map(m => _renderCard(m, nombre, esAdmin, true)).join('');
    }
    html += `</div>`;

    // ── Botón crear ──
    html += `<div class="pmis-section">
        <button class="pmis-btn-nueva"
            onclick="window._pmisAbrirFormulario('${nombre.replace(/'/g,"\\'")}',null)">
            ✦ Crear misión personalizada
        </button>
    </div>`;

    body.innerHTML = html;
}

// ── Tarjeta (panel derecho) ────────────────────────────────────
function _renderCard(m, nombrePJ, esAdmin, enParticipando) {
    const jugs    = Array.isArray(m.jugadores) ? m.jugadores : [];
    const safeId  = m.titulo.replace(/'/g, "\\'");
    const esPerso = m.tipo === 'Personalizada';

    // Avatares
    const avatares = jugs.length > 0 ? `
        <div class="pmis-jugadores">
            ${jugs.map(j => `
                <div title="${j}">
                    <img class="pmis-avatar ${j===nombrePJ?'yo':''}"
                        src="${_sb()}/imgpersonajes/${_norm(j)}icon.png"
                        onerror="this.onerror=null;this.src='${_sb()}/imginterfaz/no_encontrado.png'">
                </div>`).join('')}
            <span class="pmis-cupos-txt">${jugs.length}/${m.cupos}</span>
        </div>` : `<div style="font-size:0.62em;color:#3a3a50;margin-top:5px;">Sin jugadores · cupos: ${m.cupos}</div>`;

    // Botón principal
    let btnPrincipal = '';
    if (enParticipando) {
        const puede = esAdmin || esPerso;
        btnPrincipal = puede
            ? `<button class="pmis-btn-apuntar salir"
                    onclick="window._pmisDesapuntarPJ('${safeId}','${nombrePJ.replace(/'/g,"\\'")}')">
                    ✕ Salir de misión
               </button>`
            : `<div style="font-size:0.6em;color:#2e2e48;text-align:center;margin-top:5px;">El OP gestiona esta misión</div>`;
    } else {
        const puede = esAdmin || esPerso;
        const llena = m.cupos > 0 && jugs.length >= m.cupos && !esAdmin;
        btnPrincipal = puede
            ? `<button class="pmis-btn-apuntar unirse" ${llena ? 'disabled' : ''}
                    onclick="window._pmisApuntarPJ('${safeId}','${nombrePJ.replace(/'/g,"\\'")}')">
                    ${llena ? '🔒 Misión llena' : '✦ Unirse'}
               </button>`
            : '';
    }

    // Nota OP
    const notaHTML = esAdmin && m.nota_op
        ? `<div class="pmis-nota-op"><strong>OP:</strong> ${m.nota_op}</div>`
        : '';

    // Acciones OP
    let opActions = '';
    if (esAdmin || esPerso) {
        const opApuntar = esAdmin && !enParticipando
            ? `<button class="pmis-op-btn pmis-op-apuntar"
                    onclick="window._pmisApuntarPJ('${safeId}','${nombrePJ.replace(/'/g,"\\'")}')">
                    + Apuntar</button>` : '';
        const opQuitar = esAdmin && enParticipando
            ? `<button class="pmis-op-btn pmis-op-quitar"
                    onclick="window._pmisDesapuntarPJ('${safeId}','${nombrePJ.replace(/'/g,"\\'")}')">
                    − Quitar</button>` : '';

        opActions = `<div class="pmis-op-actions">
            <button class="pmis-op-btn pmis-op-edit"
                onclick="window._pmisAbrirFormulario('${nombrePJ.replace(/'/g,"\\'")}','${safeId}')">✏ Editar</button>
            <button class="pmis-op-btn pmis-op-del"
                onclick="window._pmisEliminar('${safeId}','${nombrePJ.replace(/'/g,"\\'")}')">✕ Borrar</button>
            ${opApuntar}${opQuitar}
        </div>`;
    }

    return `<div class="pmis-card ${enParticipando?'participando':''}">
        <div class="pmis-card-header">
            <span class="pmis-titulo">${m.titulo}</span>
            <span class="pmis-clase">C-${m.clase}</span>
        </div>
        <div class="pmis-meta">${_badge(m.estado)} ${_tipoBadge(m.tipo)}</div>
        ${m.descripcion ? `<div class="pmis-desc">${m.descripcion}</div>` : ''}
        ${notaHTML}
        ${avatares}
        ${btnPrincipal}
        ${opActions}
    </div>`;
}

// ── Formulario ────────────────────────────────────────────────
function _renderForm(nombrePJ) {
    const esAdmin = estadoUI.esAdmin;
    const id = _s.editandoId;
    const m  = id ? _s.misiones.find(x => x.titulo === id) : null;
    const esN = !m;

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
                onclick="window._pmisVolverLista('${nombrePJ.replace(/'/g,"\\'")}')">←</button>
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
                    onclick="window._pmisVolverLista('${nombrePJ.replace(/'/g,"\\'")}')">Cancelar</button>
                <button class="pmis-btn-save"
                    onclick="window._pmisGuardar('${nombrePJ.replace(/'/g,"\\'")}','${(id||'').replace(/'/g,"\\'")}')">
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
window._pmisIzqBuscar = (v, nombre) => { _s.busqueda = v; _reRender(); };
window._pmisIzqFiltro = (v, nombre) => { _s.filtro = v;  _reRender(); };
window._pmisIzqToggleFin = (nombre) => { _s.verFin = !_s.verFin; _reRender(); };

// Click en fila del catálogo: muestra la misión en el panel derecho si no está ya
window._pmisVerMision = (titulo, nombre) => {
    // Por ahora solo scrollea a la card en el panel derecho si está participando
    const body = document.getElementById('ppj-body');
    if (!body) return;
    const cards = body.querySelectorAll('.pmis-card');
    cards.forEach(c => {
        if (c.querySelector('.pmis-titulo')?.textContent === titulo) {
            c.scrollIntoView({ behavior: 'smooth', block: 'center' });
            c.style.outline = '1px solid rgba(212,175,55,0.3)';
            setTimeout(() => { c.style.outline = ''; }, 1200);
        }
    });
};

window._pmisVolverLista = (nombre) => {
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
        jugadores:   misExist?.jugadores || [],
        orden:       misExist?.orden ?? _s.misiones.length,
    };

    const { error } = await supabase.from('misiones').upsert(payload, { onConflict: 'titulo' });
    if (error) { alert('Error al guardar: ' + error.message); return; }

    window.mostrarToast?.(!idOriginal ? '✦ Misión creada' : '💾 Misión guardada');
    _s.formActivo = false; _s.editandoId = null;
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
