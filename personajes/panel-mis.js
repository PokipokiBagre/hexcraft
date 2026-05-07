// ============================================================
// panel-mis.js — Tab de Misiones para el panel lateral del PJ
// /personajes/panel-mis.js
//
// Reemplaza la función _tabMisiones de panel-pj.js.
// Importar desde panel-pj.js:
//   import { renderTabMisiones } from './panel-mis.js';
// Y llamar en el switch del _renderTab:
//   case 'misiones': renderTabMisiones(nombre, body); break;
// ============================================================

import { supabase }    from '../hex-auth.js';
import { estadoUI }    from './personajes-state.js';

// ── Estilos ────────────────────────────────────────────────────
function _inyectarEstilosMis() {
    if (document.getElementById('panel-mis-styles')) return;
    const st = document.createElement('style');
    st.id = 'panel-mis-styles';
    st.textContent = `
/* ── Contenedores generales ── */
.pmis-section { padding: 12px 16px; border-bottom: 1px solid rgba(255,255,255,0.04); }
.pmis-section-title {
    font-size: 0.6em; letter-spacing: 1.5px; text-transform: uppercase;
    color: #3a3a58; font-weight: 700; margin-bottom: 10px;
    display: flex; align-items: center; gap: 6px;
}
.pmis-section-title span { color: #5a5a88; background: rgba(255,255,255,0.05);
    padding: 1px 7px; border-radius: 10px; font-size: 0.9em; }
.pmis-empty { text-align: center; color: #2e2e48; font-size: 0.75em; padding: 18px 0; }
.pmis-empty-icon { font-size: 1.5em; margin-bottom: 6px; opacity: 0.4; }
.pmis-loader { display: flex; align-items: center; justify-content: center;
    padding: 20px; color: #3a3a58; font-size: 0.75em; gap: 8px; }
.pmis-loader::before { content: ''; width: 14px; height: 14px;
    border: 2px solid rgba(212,175,55,0.2); border-top-color: #d4af37;
    border-radius: 50%; animation: pmis-spin 0.8s linear infinite; }
@keyframes pmis-spin { to { transform: rotate(360deg); } }

/* ── Buscador y filtros ── */
.pmis-search {
    width: 100%; background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.08); border-radius: 6px;
    color: #ccc; font-size: 0.78em; padding: 6px 10px; margin-bottom: 8px;
    box-sizing: border-box; outline: none; font-family: inherit;
}
.pmis-search::placeholder { color: #3a3a58; }
.pmis-search:focus { border-color: rgba(212,175,55,0.3); }
.pmis-filtros { display: flex; gap: 4px; flex-wrap: wrap; margin-bottom: 10px; }
.pmis-fbtn {
    background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
    color: #6a6a88; border-radius: 4px; padding: 3px 8px; font-size: 0.62em;
    cursor: pointer; font-family: inherit; transition: all 0.12s;
}
.pmis-fbtn:hover { color: #aaa; }
.pmis-fbtn.on { color: #d4af37; border-color: rgba(212,175,55,0.35); background: rgba(212,175,55,0.08); }

/* ── Tarjeta de misión ── */
.pmis-card {
    background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05);
    border-radius: 8px; padding: 11px 13px; margin-bottom: 6px;
    transition: border-color 0.15s, background 0.15s;
}
.pmis-card:hover { border-color: rgba(255,255,255,0.09); background: rgba(255,255,255,0.03); }
.pmis-card.participando { border-color: rgba(212,175,55,0.2); background: rgba(212,175,55,0.03); }
.pmis-card-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 6px; margin-bottom: 5px; }
.pmis-titulo { font-size: 0.82em; font-weight: 600; color: #d0d0e0; flex: 1; line-height: 1.3; }
.pmis-clase { font-size: 0.62em; color: #4a4a68; flex-shrink: 0; align-self: center; }
.pmis-meta { display: flex; align-items: center; gap: 6px; margin-bottom: 5px; flex-wrap: wrap; }
.pmis-badge {
    font-size: 0.62em; padding: 2px 8px; border-radius: 10px;
    display: inline-flex; align-items: center; gap: 3px;
}
.pmis-badge-0 { background: rgba(100,100,100,0.1); color: #666; border: 1px solid rgba(100,100,100,0.2); }
.pmis-badge-1 { background: rgba(212,175,55,0.1); color: #d4af37; border: 1px solid rgba(212,175,55,0.2); }
.pmis-badge-2 { background: rgba(74,179,232,0.1); color: #4ab3e8; border: 1px solid rgba(74,179,232,0.2); }
.pmis-badge-3 { background: rgba(62,207,110,0.1); color: #3ecf6e; border: 1px solid rgba(62,207,110,0.2); }
.pmis-tipo-badge {
    font-size: 0.58em; padding: 1px 6px; border-radius: 8px; border: 1px solid;
}
.pmis-tipo-grande { color: #e0a030; border-color: rgba(224,160,48,0.3); background: rgba(224,160,48,0.08); }
.pmis-tipo-normal { color: #4ab3e8; border-color: rgba(74,179,232,0.3); background: rgba(74,179,232,0.08); }
.pmis-tipo-perso  { color: #3ecf6e; border-color: rgba(62,207,110,0.3); background: rgba(62,207,110,0.08); }
.pmis-cupos { font-size: 0.65em; color: #5a5a78; }
.pmis-cupos.ok { color: #3ecf6e; }
.pmis-desc { font-size: 0.7em; color: #5a5a78; line-height: 1.5; margin-top: 4px;
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }

/* ── Avatares de jugadores en misión ── */
.pmis-jugadores { display: flex; gap: 4px; flex-wrap: wrap; margin-top: 7px; align-items: center; }
.pmis-avatar-wrap { position: relative; }
.pmis-avatar {
    width: 26px; height: 26px; border-radius: 50%; object-fit: cover;
    object-position: top; border: 2px solid rgba(255,255,255,0.1); background: #111;
}
.pmis-avatar.yo { border-color: #d4af37; }

/* ── Botón apuntar/desapuntar ── */
.pmis-btn-apuntar {
    display: flex; align-items: center; gap: 5px; padding: 5px 10px;
    border-radius: 6px; font-size: 0.7em; font-family: 'Cinzel', serif;
    cursor: pointer; border: 1px solid; transition: all 0.15s;
    letter-spacing: 0.3px; margin-top: 8px; width: 100%; justify-content: center;
}
.pmis-btn-apuntar.unirse {
    background: rgba(212,175,55,0.08); color: #d4af37;
    border-color: rgba(212,175,55,0.3);
}
.pmis-btn-apuntar.unirse:hover { background: rgba(212,175,55,0.18); }
.pmis-btn-apuntar.salir {
    background: rgba(220,60,60,0.07); color: #e06060;
    border-color: rgba(220,60,60,0.25);
}
.pmis-btn-apuntar.salir:hover { background: rgba(220,60,60,0.15); }
.pmis-btn-apuntar:disabled { opacity: 0.35; cursor: default; }

/* ── Formulario crear misión personalizada ── */
.pmis-form {
    background: rgba(5,0,12,0.95); border: 1px solid rgba(212,175,55,0.2);
    border-radius: 10px; padding: 14px 14px 16px; margin-bottom: 10px;
}
.pmis-form-title {
    font-family: 'Cinzel', serif; font-size: 0.78em; color: #d4af37;
    letter-spacing: 0.8px; margin-bottom: 12px;
}
.pmis-form label { font-size: 0.62em; color: #5a5a78; text-transform: uppercase;
    letter-spacing: 1px; display: block; margin-bottom: 3px; margin-top: 9px; }
.pmis-form input, .pmis-form textarea, .pmis-form select {
    width: 100%; background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.1); border-radius: 5px;
    color: #ccc; padding: 6px 8px; font-size: 0.78em;
    box-sizing: border-box; outline: none; font-family: inherit;
}
.pmis-form textarea { resize: vertical; min-height: 55px; }
.pmis-form input:focus, .pmis-form textarea:focus, .pmis-form select:focus {
    border-color: rgba(212,175,55,0.4);
}
.pmis-form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.pmis-form-footer { display: flex; gap: 6px; margin-top: 12px; }
.pmis-btn-save {
    flex: 1; background: rgba(212,175,55,0.1); border: 1px solid rgba(212,175,55,0.3);
    color: #d4af37; border-radius: 5px; padding: 7px; font-size: 0.72em;
    font-family: 'Cinzel', serif; cursor: pointer; transition: all 0.12s;
}
.pmis-btn-save:hover { background: rgba(212,175,55,0.2); }
.pmis-btn-cancel {
    background: transparent; border: 1px solid rgba(255,255,255,0.1);
    color: #5a5a78; border-radius: 5px; padding: 7px 12px; font-size: 0.72em;
    font-family: inherit; cursor: pointer;
}
.pmis-btn-cancel:hover { color: #888; border-color: rgba(255,255,255,0.2); }
.pmis-btn-nueva {
    width: 100%; background: rgba(62,207,110,0.07); border: 1px solid rgba(62,207,110,0.25);
    color: #3ecf6e; border-radius: 6px; padding: 8px; font-size: 0.72em;
    font-family: 'Cinzel', serif; cursor: pointer; transition: all 0.12s;
    letter-spacing: 0.5px; display: flex; align-items: center; justify-content: center; gap: 6px;
}
.pmis-btn-nueva:hover { background: rgba(62,207,110,0.14); }

/* ── Guía de recompensas ── */
.pmis-guia {
    background: rgba(212,175,55,0.04); border: 1px solid rgba(212,175,55,0.12);
    border-radius: 7px; padding: 10px 12px; margin-bottom: 10px; font-size: 0.66em;
}
.pmis-guia-title { color: #d4af37; font-weight: 700; margin-bottom: 5px; }
.pmis-guia-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 3px; color: #6a6a88; }
.pmis-guia-nota { color: #4a4a60; margin-top: 6px; }

/* ── OP actions ── */
.pmis-op-actions {
    display: flex; gap: 5px; margin-top: 8px; flex-wrap: wrap;
}
.pmis-op-btn {
    font-size: 0.62em; padding: 3px 8px; border-radius: 4px; cursor: pointer;
    font-family: inherit; border: 1px solid; transition: all 0.12s;
}
.pmis-op-edit { color: #d4af37; border-color: rgba(212,175,55,0.3); background: rgba(212,175,55,0.06); }
.pmis-op-edit:hover { background: rgba(212,175,55,0.16); }
.pmis-op-del  { color: #ff6060; border-color: rgba(220,60,60,0.3); background: rgba(220,60,60,0.06); }
.pmis-op-del:hover { background: rgba(220,60,60,0.16); }
.pmis-op-apuntar { color: #3ecf6e; border-color: rgba(62,207,110,0.3); background: rgba(62,207,110,0.06); }
.pmis-op-apuntar:hover { background: rgba(62,207,110,0.16); }
.pmis-op-quitar { color: #e0a030; border-color: rgba(224,160,48,0.3); background: rgba(224,160,48,0.06); }
.pmis-op-quitar:hover { background: rgba(224,160,48,0.16); }

/* ── Cupos badge ── */
.pmis-cupos-row { display: flex; align-items: center; gap: 5px; margin-top: 5px; }
.pmis-dot { width: 7px; height: 7px; border-radius: 50%; background: rgba(212,175,55,0.2); }
.pmis-dot.filled { background: #d4af37; }
`;
    document.head.appendChild(st);
}

// ── Helpers ────────────────────────────────────────────────────
const _ESTADO_LABEL = ['Inactiva', 'Pendiente', 'En Proceso', 'Finalizada'];
const _ESTADO_CLS   = ['pmis-badge-0', 'pmis-badge-1', 'pmis-badge-2', 'pmis-badge-3'];

function _badge(estado) {
    const cls = _ESTADO_CLS[estado] || 'pmis-badge-0';
    const lbl = _ESTADO_LABEL[estado] || '?';
    return `<span class="pmis-badge ${cls}">${lbl}</span>`;
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

function _imgIcon(icono, storageUrl) {
    return `${storageUrl}/imgpersonajes/${_norm(icono)}icon.png`;
}

// Busca la URL de storage del config global
function _sb() {
    return window._hexConfig?.storageUrl || '';
}

// ── Estado local del panel ─────────────────────────────────────
const _misState = {
    misiones:     [],      // todas las misiones cargadas
    filtro:       'todos', // 'todos' | 'participando' | 'disponibles'
    busqueda:     '',
    verFin:       false,   // mostrar finalizadas
    formActivo:   false,   // si se muestra el formulario
    editandoId:   null,    // id de misión en edición (null = crear)
    nombrePJ:     null,
};

// ── Carga de misiones ──────────────────────────────────────────
async function _cargarMisiones() {
    const { data } = await supabase
        .from('misiones')
        .select('titulo, tipo, clase, estado, descripcion, nota_op, cupos, jugadores, autor, orden')
        .order('orden');
    _misState.misiones = data || [];
}

// ── Renderizado principal ──────────────────────────────────────
export async function renderTabMisiones(nombre, body) {
    _inyectarEstilosMis();
    _misState.nombrePJ   = nombre;
    _misState.formActivo = false;
    _misState.editandoId = null;

    body.innerHTML = `<div class="pmis-loader">Cargando misiones…</div>`;
    await _cargarMisiones();
    _renderMisiones(body, nombre);
}

function _renderMisiones(body, nombre) {
    const esAdmin = estadoUI.esAdmin;
    const q       = _misState.busqueda.toLowerCase().trim();

    // Separar por participación
    const participando = _misState.misiones.filter(m => {
        const jugs = Array.isArray(m.jugadores) ? m.jugadores : [];
        return jugs.includes(nombre);
    });
    const disponibles = _misState.misiones.filter(m => {
        const jugs = Array.isArray(m.jugadores) ? m.jugadores : [];
        if (jugs.includes(nombre)) return false;
        if (!_misState.verFin && m.estado === 3) return false;
        if (m.tipo === 'OP') return false; // ideas OP nunca visibles para PJ
        return true;
    });

    // Filtro de sección
    let misP = participando;
    let misD = disponibles;

    if (_misState.filtro === 'participando') misD = [];
    if (_misState.filtro === 'disponibles')  misP = [];

    // Búsqueda
    const _filtrarQ = (arr) => q
        ? arr.filter(m => m.titulo.toLowerCase().includes(q) || (m.descripcion||'').toLowerCase().includes(q))
        : arr;
    misP = _filtrarQ(misP);
    misD = _filtrarQ(misD);

    // Si el form está activo, mostrarlo
    if (_misState.formActivo) {
        body.innerHTML = _renderForm(nombre, esAdmin);
        _attachFormListeners(body, nombre);
        return;
    }

    let html = '';

    // ── Buscador + filtros ──
    html += `<div class="pmis-section">
        <input class="pmis-search" id="pmis-search" placeholder="Buscar misión…"
            value="${_misState.busqueda.replace(/"/g,'&quot;')}"
            oninput="window._pmisSetBusqueda(this.value)">
        <div class="pmis-filtros">
            <button class="pmis-fbtn ${_misState.filtro==='todos'?'on':''}"          onclick="window._pmisSetFiltro('todos')">Todas</button>
            <button class="pmis-fbtn ${_misState.filtro==='participando'?'on':''}"   onclick="window._pmisSetFiltro('participando')">Mis misiones</button>
            <button class="pmis-fbtn ${_misState.filtro==='disponibles'?'on':''}"    onclick="window._pmisSetFiltro('disponibles')">Disponibles</button>
            <button class="pmis-fbtn ${_misState.verFin?'on':''}"                   onclick="window._pmisToggleFin()">Finalizadas</button>
        </div>
    </div>`;

    // ── Participando ──
    if (_misState.filtro !== 'disponibles') {
        html += `<div class="pmis-section">
            <div class="pmis-section-title">Participando <span>${misP.length}</span></div>`;
        if (misP.length === 0) {
            html += `<div class="pmis-empty"><div class="pmis-empty-icon">📋</div>Sin misiones activas</div>`;
        } else {
            html += misP.map(m => _renderCard(m, nombre, esAdmin, true)).join('');
        }
        html += `</div>`;
    }

    // ── Disponibles ──
    if (_misState.filtro !== 'participando') {
        html += `<div class="pmis-section">
            <div class="pmis-section-title">Disponibles <span>${misD.length}</span></div>`;
        if (misD.length === 0) {
            html += `<div class="pmis-empty"><div class="pmis-empty-icon">🗺️</div>Sin misiones disponibles</div>`;
        } else {
            html += misD.map(m => _renderCard(m, nombre, esAdmin, false)).join('');
        }
        html += `</div>`;
    }

    // ── Botón crear misión personalizada (todos los jugadores pueden) ──
    html += `<div class="pmis-section">
        <button class="pmis-btn-nueva" onclick="window._pmisAbrirFormulario('${nombre.replace(/'/g,"\\'")}',null)">
            ✦ Crear misión personalizada
        </button>
    </div>`;

    body.innerHTML = html;
}

// ── Tarjeta de misión ──────────────────────────────────────────
function _renderCard(m, nombrePJ, esAdmin, enParticipando) {
    const jugs     = Array.isArray(m.jugadores) ? m.jugadores : [];
    const safeId   = m.titulo.replace(/'/g, "\\'");
    const cuposOk  = m.cupos > 0 && jugs.length >= m.cupos;
    const esPerso  = m.tipo === 'Personalizada';

    // ── Avatares de jugadores ──
    const avatarHTML = jugs.length > 0 ? `
        <div class="pmis-jugadores">
            ${jugs.map(j => {
                const esYo = j === nombrePJ;
                return `<div class="pmis-avatar-wrap" title="${j}">
                    <img class="pmis-avatar ${esYo ? 'yo' : ''}"
                         src="${_sb()}/imgpersonajes/${_norm(j)}icon.png"
                         onerror="this.onerror=null;this.src='${_sb()}/imginterfaz/no_encontrado.png'">
                </div>`;
            }).join('')}
            <span style="font-size:0.62em;color:#5a5a78;margin-left:2px;">${jugs.length}/${m.cupos}</span>
        </div>` : `<div style="font-size:0.64em;color:#3a3a58;margin-top:5px;">Sin jugadores · cupos: ${m.cupos}</div>`;

    // ── Botón apuntar/salir (para el PJ dueño del panel) ──
    let btnApuntar = '';
    if (enParticipando) {
        // Puede salirse si es perso o admin; las grandes/normales solo OP puede moverlas
        const puedeEditar = esAdmin || esPerso;
        btnApuntar = puedeEditar
            ? `<button class="pmis-btn-apuntar salir"
                    onclick="window._pmisDesapuntarPJ('${safeId}','${nombrePJ.replace(/'/g,"\\'")}')">
                    ✕ Salir de misión
               </button>`
            : `<div style="font-size:0.6em;color:#3a3a58;text-align:center;margin-top:6px;">Solo el OP puede removerte de esta misión</div>`;
    } else {
        // Puede apuntarse si es perso o si OP quiere
        const puedeUnirse = esAdmin || esPerso;
        const llena = m.cupos > 0 && jugs.length >= m.cupos && !esAdmin;
        btnApuntar = puedeUnirse
            ? `<button class="pmis-btn-apuntar unirse" ${llena ? 'disabled' : ''}
                    onclick="window._pmisApuntarPJ('${safeId}','${nombrePJ.replace(/'/g,"\\'")}')">
                    ${llena ? '🔒 Misión llena' : '✦ Unirse a misión'}
               </button>`
            : '';
    }

    // ── Nota OP (solo admin) ──
    const notaHTML = esAdmin && m.nota_op
        ? `<div style="background:rgba(46,0,79,0.5);border-left:3px solid #9a50dc;padding:5px 8px;font-size:0.65em;margin-top:6px;color:#c0a0e0;border-radius:0 4px 4px 0;">
               <strong style="color:#c080ff;">OP:</strong> ${m.nota_op}
           </div>`
        : '';

    // ── Acciones OP ──
    let opActions = '';
    if (esAdmin || esPerso) {
        const puedeEditar = esAdmin || esPerso;
        const puedeBorrar = esAdmin || esPerso;

        // Botones de apuntar/desapuntar OP sobre cualquier misión
        const opApuntar = esAdmin && !enParticipando
            ? `<button class="pmis-op-btn pmis-op-apuntar"
                    onclick="window._pmisApuntarPJ('${safeId}','${nombrePJ.replace(/'/g,"\\'")}')">
                    + Apuntar OP
               </button>`
            : '';
        const opQuitar = esAdmin && enParticipando
            ? `<button class="pmis-op-btn pmis-op-quitar"
                    onclick="window._pmisDesapuntarPJ('${safeId}','${nombrePJ.replace(/'/g,"\\'")}')">
                    − Quitar OP
               </button>`
            : '';

        opActions = `<div class="pmis-op-actions">
            ${puedeEditar ? `<button class="pmis-op-btn pmis-op-edit"
                onclick="window._pmisAbrirFormulario('${nombrePJ.replace(/'/g,"\\'")}','${safeId}')">✏️ Editar</button>` : ''}
            ${puedeBorrar ? `<button class="pmis-op-btn pmis-op-del"
                onclick="window._pmisEliminar('${safeId}','${nombrePJ.replace(/'/g,"\\'")}')">🗑 Borrar</button>` : ''}
            ${opApuntar}${opQuitar}
        </div>`;
    }

    return `<div class="pmis-card ${enParticipando ? 'participando' : ''}">
        <div class="pmis-card-header">
            <span class="pmis-titulo">${m.titulo}</span>
            <span class="pmis-clase">C-${m.clase}</span>
        </div>
        <div class="pmis-meta">
            ${_badge(m.estado)}
            ${_tipoBadge(m.tipo)}
        </div>
        ${m.descripcion ? `<div class="pmis-desc">${m.descripcion}</div>` : ''}
        ${notaHTML}
        ${avatarHTML}
        ${btnApuntar}
        ${opActions}
    </div>`;
}

// ── Formulario crear / editar misión personalizada ─────────────
function _renderForm(nombrePJ, esAdmin) {
    const id   = _misState.editandoId;
    const m    = id ? _misState.misiones.find(x => x.titulo === id) : null;
    const esN  = !m;

    const TIPOS_PERSO = ['Personalizada'];
    const TIPOS_ADMIN = ['Personalizada', 'Grande', 'Normal'];
    const TIPOS = esAdmin ? TIPOS_ADMIN : TIPOS_PERSO;

    const guia = `<div class="pmis-guia">
        <div class="pmis-guia-title">💡 Recompensas sugeridas por clase</div>
        <div class="pmis-guia-grid">
            <div><b>Clase 1:</b> 600–1200 HEX · 2–4 PA</div>
            <div><b>Clase 2:</b> 1000–1800 HEX · 3–6 PA</div>
            <div><b>Clase 3:</b> 1500–2200 HEX · 4–8 PA</div>
            <div><b>Clase 4:</b> 2000–3000 HEX · 5–10 PA</div>
            <div><b>Clase 5:</b> 2500–3600 HEX · 6–12 PA</div>
        </div>
        <div class="pmis-guia-nota">Se recomienda que la clase del hechizo coincida con la de la misión.</div>
    </div>`;

    return `<div class="pmis-section">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
            <button class="pmis-btn-cancel" style="padding:4px 8px;"
                onclick="window._pmisVolverLista('${nombrePJ.replace(/'/g,"\\'")}')">←</button>
            <span style="font-family:'Cinzel',serif;color:#d4af37;font-size:0.82em;">
                ${esN ? 'Nueva misión personalizada' : `Editar: ${m.titulo}`}
            </span>
        </div>
        ${guia}
        <div class="pmis-form">
            <label>Título *</label>
            <input id="pmis-f-titulo" value="${(m?.titulo||'').replace(/"/g,'&quot;')}" placeholder="Nombre de la misión" ${!esN?'readonly style="opacity:0.55"':''}>

            <div class="pmis-form-grid" style="margin-top:0;">
                <div>
                    <label>Tipo</label>
                    <select id="pmis-f-tipo" ${!esAdmin?'disabled':''}>
                        ${TIPOS.map(t=>`<option value="${t}" ${(m?.tipo||'Personalizada')===t?'selected':''}>${t}</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label>Clase</label>
                    <select id="pmis-f-clase">
                        ${[1,2,3,4,5].map(c=>`<option value="${c}" ${parseInt(m?.clase||'1')===c?'selected':''}>${c}</option>`).join('')}
                    </select>
                </div>
            </div>

            <div class="pmis-form-grid" style="margin-top:0;">
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
                    <label>Cupos (umbral)</label>
                    <input id="pmis-f-cupos" type="number" min="1" value="${m?.cupos||2}">
                </div>
            </div>

            <label>Autor</label>
            <input id="pmis-f-autor" value="${(m?.autor||nombrePJ).replace(/"/g,'&quot;')}" placeholder="Nombre del autor">

            <label>Descripción / Recompensa</label>
            <textarea id="pmis-f-desc">${m?.descripcion||''}</textarea>

            ${esAdmin ? `<label style="color:#c080ff;">Nota OP (oculta para jugadores)</label>
            <textarea id="pmis-f-notaop" style="border-color:rgba(154,80,220,0.4);">${m?.nota_op||''}</textarea>` : ''}

            <div class="pmis-form-footer">
                <button class="pmis-btn-cancel"
                    onclick="window._pmisVolverLista('${nombrePJ.replace(/'/g,"\\'")}')">Cancelar</button>
                <button class="pmis-btn-save"
                    onclick="window._pmisGuardar('${nombrePJ.replace(/'/g,"\\'")}','${(id||'').replace(/'/g,"\\'")}')">
                    ${esN ? '✦ Crear misión' : '💾 Guardar cambios'}
                </button>
            </div>
        </div>
    </div>`;
}

function _attachFormListeners(body, nombre) {
    // nada extra por ahora, los handlers son globales
}

// ── Funciones globales ─────────────────────────────────────────
window._pmisSetBusqueda = (v) => {
    _misState.busqueda = v;
    _reRender();
};

window._pmisSetFiltro = (v) => {
    _misState.filtro = v;
    _reRender();
};

window._pmisToggleFin = () => {
    _misState.verFin = !_misState.verFin;
    _reRender();
};

window._pmisVolverLista = (nombre) => {
    _misState.formActivo = false;
    _misState.editandoId = null;
    _reRender();
};

window._pmisAbrirFormulario = (nombre, idMision) => {
    // Las misiones grandes/normales solo las puede crear/editar OP
    if (idMision) {
        const m = _misState.misiones.find(x => x.titulo === idMision);
        if (m && (m.tipo === 'Grande' || m.tipo === 'Normal') && !estadoUI.esAdmin) {
            window.mostrarToast?.('Solo el OP puede editar misiones Grandes o Normales.', true);
            return;
        }
    }
    _misState.formActivo = true;
    _misState.editandoId = idMision || null;
    _misState.nombrePJ   = nombre;
    _reRender();
};

window._pmisGuardar = async (nombre, idOriginal) => {
    const titulo  = document.getElementById('pmis-f-titulo')?.value.trim();
    const tipo    = document.getElementById('pmis-f-tipo')?.value    || 'Personalizada';
    const clase   = document.getElementById('pmis-f-clase')?.value   || '1';
    const estado  = parseInt(document.getElementById('pmis-f-estado')?.value) || 0;
    const cupos   = parseInt(document.getElementById('pmis-f-cupos')?.value)  || 2;
    const autor   = document.getElementById('pmis-f-autor')?.value.trim()   || nombre;
    const desc    = document.getElementById('pmis-f-desc')?.value.trim()    || '';
    const notaOp  = document.getElementById('pmis-f-notaop')?.value.trim()  || '';

    if (!titulo) { alert('El título no puede estar vacío.'); return; }

    // Seguridad: solo OP puede crear/editar Grande o Normal
    if ((tipo === 'Grande' || tipo === 'Normal') && !estadoUI.esAdmin) {
        window.mostrarToast?.('Solo el OP puede crear misiones Grandes o Normales.', true);
        return;
    }

    const esNuevo = !idOriginal;
    // Buscar misión existente para mantener jugadores y orden
    const misExist = _misState.misiones.find(m => m.titulo === (idOriginal || titulo));

    const payload = {
        titulo,
        tipo,
        clase,
        estado,
        cupos,
        autor,
        descripcion: desc,
        nota_op:     notaOp,
        jugadores:   misExist?.jugadores || [],
        orden:       misExist?.orden     ?? _misState.misiones.length,
    };

    const { error } = await supabase
        .from('misiones')
        .upsert(payload, { onConflict: 'titulo' });

    if (error) {
        alert('Error al guardar: ' + error.message);
        return;
    }

    window.mostrarToast?.(esNuevo ? '✦ Misión creada' : '💾 Misión guardada');
    _misState.formActivo = false;
    _misState.editandoId = null;

    // Recargar y re-render
    await _cargarMisiones();
    _reRender();
};

window._pmisEliminar = async (idMision, nombre) => {
    const m = _misState.misiones.find(x => x.titulo === idMision);
    if (!m) return;

    // Solo OP puede eliminar Grande/Normal
    if ((m.tipo === 'Grande' || m.tipo === 'Normal') && !estadoUI.esAdmin) {
        window.mostrarToast?.('Solo el OP puede eliminar misiones Grandes o Normales.', true);
        return;
    }

    if (!confirm(`¿Eliminar "${idMision}"?`)) return;

    const { error } = await supabase.from('misiones').delete().eq('titulo', idMision);
    if (error) { alert('Error al eliminar: ' + error.message); return; }

    window.mostrarToast?.('🗑 Misión eliminada');
    await _cargarMisiones();
    _reRender();
};

window._pmisApuntarPJ = async (idMision, nombrePJ) => {
    const m = _misState.misiones.find(x => x.titulo === idMision);
    if (!m) return;

    // Solo OP puede apuntar a Grande/Normal
    if ((m.tipo === 'Grande' || m.tipo === 'Normal') && !estadoUI.esAdmin) {
        window.mostrarToast?.('Solo el OP puede gestionar misiones Grandes o Normales.', true);
        return;
    }

    const jugs = Array.isArray(m.jugadores) ? [...m.jugadores] : [];
    if (jugs.includes(nombrePJ)) return;
    jugs.push(nombrePJ);

    // Auto-activar si llega al cupo
    let nuevoEstado = m.estado;
    if (nuevoEstado === 0 && m.cupos > 0 && jugs.length >= m.cupos) {
        nuevoEstado = 1;
    }

    const { error } = await supabase
        .from('misiones')
        .update({ jugadores: jugs, estado: nuevoEstado })
        .eq('titulo', idMision);

    if (error) { alert('Error: ' + error.message); return; }

    window.mostrarToast?.(`✦ ${nombrePJ} apuntado a "${idMision}"`);
    await _cargarMisiones();
    _reRender();
};

window._pmisDesapuntarPJ = async (idMision, nombrePJ) => {
    const m = _misState.misiones.find(x => x.titulo === idMision);
    if (!m) return;

    // Solo OP puede mover de Grande/Normal
    if ((m.tipo === 'Grande' || m.tipo === 'Normal') && !estadoUI.esAdmin) {
        window.mostrarToast?.('Solo el OP puede gestionar misiones Grandes o Normales.', true);
        return;
    }

    const jugs = (Array.isArray(m.jugadores) ? m.jugadores : []).filter(j => j !== nombrePJ);

    // Auto-desactivar si baja del cupo y estaba Pendiente
    let nuevoEstado = m.estado;
    if (nuevoEstado === 1 && m.cupos > 0 && jugs.length < m.cupos) {
        nuevoEstado = 0;
    }

    const { error } = await supabase
        .from('misiones')
        .update({ jugadores: jugs, estado: nuevoEstado })
        .eq('titulo', idMision);

    if (error) { alert('Error: ' + error.message); return; }

    window.mostrarToast?.(`✕ ${nombrePJ} removido de "${idMision}"`);
    await _cargarMisiones();
    _reRender();
};

// ── Re-render sin recargar BD ──────────────────────────────────
function _reRender() {
    const body = document.getElementById('ppj-body');
    if (!body || !_misState.nombrePJ) return;
    _renderMisiones(body, _misState.nombrePJ);
}
