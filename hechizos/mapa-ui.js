// ============================================================
// mapa-ui.js — Toolbar, drawer, grimorio, modales y handlers
// /hechizos/mapa-ui.js
// ============================================================

import { st } from './mapa-state.js';
import {
    cargarInventarioPJ, calcSetsGlobales,
    guardarPosiciones, toggleConocido,
    aplicarPropiedades, asignarHechizosAPJ,
} from './mapa-data.js';
import { centrarCamara, centrarEnNodo, renderInfoBar, renderInfoStats, renderOpPanel } from './mapa-render.js';

// ── Badge multi-sel ──────────────────────────────────────────
export function actualizarBadgeSel() {
    const b = document.getElementById('hm-sel-badge');
    if (!b) return;
    const n = st.seleccionados.size;
    b.style.display = n > 0 ? 'inline' : 'none';
    b.textContent   = `${n} sel.`;
}

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
    // Actualizar título del side panel si está abierto
    const spTit = document.getElementById('sp-titulo-txt');
    if (spTit && n > 0) spTit.textContent = `${n} hechizos seleccionados`;
}

// ── Renderizar pools de PJ ───────────────────────────────────
export function renderPools() {
    // La diferenciación jugador/NPC viene de is_player en la DB,
    // pero aquí solo tenemos st.jugadores (jugadores) y st.personajes (todos).
    // NPCs = personajes que NO están en jugadores
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

    // Actualizar botones activos
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

// Cerrar pools al clickar fuera
document.addEventListener('click', e => {
    if (!e.target.closest('.hm-pj-pool-wrap')) window._hmCerrarPools();
});

// ══════════════════════════════════════════════════════════════
//  TOOLBAR — ahora solo contiene lógica de ponds; el HTML ya está en index.html
// ══════════════════════════════════════════════════════════════
export function renderToolbar() {
    renderPools();
    // Admin: mostrar tab admin en drawer
    const dtAdmin = document.getElementById('dt-admin');
    if (dtAdmin) dtAdmin.style.display = st.esAdmin ? '' : 'none';
}

// ══════════════════════════════════════════════════════════════
//  DRAWER — grimorio + admin
// ══════════════════════════════════════════════════════════════
export function renderDrawer() {
    // Mostrar/ocultar tab admin según rol
    const dtAdmin = document.getElementById('dt-admin');
    if (dtAdmin) dtAdmin.style.display = st.esAdmin ? '' : 'none';

    // Renderizar grimorio inicial
    renderGrimorio('');

    // Si hay admin, montar el pane admin
    if (st.esAdmin) _renderDrawerAdmin();
}

// ── Toggle drawer ─────────────────────────────────────────────
window._hmToggleDrawer = () => {
    const drawer = document.getElementById('hm-drawer');
    const tab    = document.getElementById('hm-drawer-tab');
    if (!drawer) return;
    const abierto = drawer.classList.toggle('open');
    tab?.classList.toggle('open', abierto);
    document.body.classList.toggle('drawer-open', abierto);
};

// ── Cambiar pestaña interna del drawer ────────────────────────
window._hmDrawerTab = (cual) => {
    document.getElementById('hm-pane-grimorio')?.classList.toggle('oculto', cual !== 'grimorio');
    document.getElementById('hm-pane-admin')?.classList.toggle('oculto',   cual !== 'admin');
    document.querySelectorAll('.hm-dtab').forEach(b => b.classList.remove('activo'));
    document.getElementById(`dt-${cual}`)?.classList.add('activo');
};

// ── Buscar en grimorio ────────────────────────────────────────
window._hmBuscar = (query) => renderGrimorio(query);

// ── Renderizar grimorio (acordeones por afinidad) ─────────────
export function renderGrimorio(query = '') {
    const lista = document.getElementById('hm-grimorio-list');
    if (!lista) return;

    const q = query.toLowerCase().trim();

    // Agrupar nodos por afinidad
    const grupos = {};
    st.nodos.forEach(nodo => {
        const af = nodo.afinidad || 'Desconocida';
        if (!grupos[af]) grupos[af] = [];
        // Filtrar por búsqueda (admin ve todos; jugador solo ve conocidos/poseídos)
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

    // Si hay búsqueda activa, abrir todos los grupos; si no, mantener estado previo
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

// ── Seleccionar nodo desde grimorio ──────────────────────────
window._hmGrimorioSel = (id) => {
    const nodo = st.nodos.find(n => n.id === id);
    if (!nodo) return;

    // Resaltar en lista
    document.querySelectorAll('.gr-hz-row').forEach(r => r.classList.remove('sel'));
    document.querySelector(`.gr-hz-row[data-id="${id}"]`)?.classList.add('sel');

    // Seleccionar y centrar en canvas
    st.nodoSel = nodo;
    renderInfoBar(nodo);
    centrarEnNodo(nodo);
};

// ══════════════════════════════════════════════════════════════
//  SIDE PANEL — información y acciones del nodo seleccionado
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

    const chips = [];
    if (mostrar) {
        chips.push(`<span style="color:${color};font-size:0.9em;font-weight:700;">${nodo.afinidad}</span>`);
        chips.push(`<span class="sp-chip" style="color:#5a5a7a;border-color:rgba(255,255,255,0.08);background:transparent;">Cl.${nodo.clase}</span>`);
        if (nodo.hex > 0) chips.push(`<span class="sp-chip sp-chip-hex">⬡${nodo.hex} HEX</span>`);
        if (nodo.vex > 0) chips.push(`<span class="sp-chip sp-chip-vex">⬡${nodo.vex} VEX</span>`);
        if (esPosesion)   chips.push(`<span class="sp-chip sp-chip-pos">✓ Aprendido</span>`);
        if (nodo.esEstado)   chips.push(`<span class="sp-chip sp-chip-est">Estado</span>`);
        if (nodo.esPrioridad)chips.push(`<span class="sp-chip sp-chip-pri">↑ Prioridad</span>`);
    }

    const campos = mostrar ? [
        { label:'Efecto',    val: nodo.efecto },
        { label:'Resumen',   val: nodo.resumen },
        { label:'Overcast',  val: nodo.overcast },
        { label:'Undercast', val: nodo.undercast },
        { label:'Especial',  val: nodo.especial },
    ].filter(c => c.val) : [];

    let adminHtml = '';
    if (st.esAdmin) {
        const multiNodos = st.modoSelMulti && st.seleccionados.size > 0 ? [...st.seleccionados] : [nodo];
        adminHtml = `
        <div class="sp-section-title">Acciones OP</div>
        <div class="sp-action-row">
            <button class="sp-btn ${nodo.esConocido?'sp-btn-ocultar':'sp-btn-pub'}"
                onclick="window._hmToggleConocido('${safe}',${!nodo.esConocido})">
                ${nodo.esConocido ? '🔒 Ocultar' : '👁 Publicar'}
            </button>
            <button class="sp-btn sp-btn-props" onclick="window._hmModalPropiedades()">⚙ Propiedades</button>
            <button class="sp-btn sp-btn-asignar" onclick="window._hmModalAsignarPJ()">👤 Asignar a PJ</button>
            ${esPosesion && st.jugadorPanel !== 'Todos' ?
              `<button class="sp-btn sp-btn-quitar" onclick="window._hmQuitarDePJ('${safe}')">✕ Quitar de ${st.jugadorPanel}</button>` : ''}
            ${nodo.esNuevo ?
              `<button class="sp-btn sp-btn-del" onclick="window._hmEliminarNuevo('${safe}')">🗑 Descartar</button>` : ''}
        </div>
        <div class="sp-section-title">Multi-selección (${st.seleccionados.size > 0 ? st.seleccionados.size+' sel.' : 'ninguno'})</div>
        <div class="sp-action-row">
            <button class="sp-btn ${st.modoSelMulti?'sp-btn-pub':'sp-btn-props'}" onclick="window._hmToggleMulti()">
                ${st.modoSelMulti ? '☑ Multi-sel activo' : '☐ Multi-sel'}
            </button>
            ${st.seleccionados.size > 0 ? `
            <button class="sp-btn sp-btn-props" onclick="window._hmModalPropiedades()">⚙ Batch props</button>
            <button class="sp-btn sp-btn-asignar" onclick="window._hmModalAsignarPJ()">👤 Asignar batch</button>
            <button class="sp-btn sp-btn-quitar" onclick="window._hmLimpiarSel()">✕ Limpiar sel.</button>
            ` : ''}
        </div>`;
    }

    body.innerHTML = `
        <div class="sp-nodo-nombre" style="color:${color}">${nombre}</div>
        <div class="sp-nodo-meta">${chips.join('')}</div>
        ${mostrar ? campos.map(c => `
            <div class="sp-desc-field">
                <div class="sp-desc-label">${c.label}</div>
                <div class="sp-desc-val">${c.val}</div>
            </div>`).join('') : `<div style="font-size:0.7em;color:#2a2a3a;font-style:italic;">Sellado — sin información</div>`}
        ${nodo.nota && mostrar ? `<div class="sp-desc-field"><div class="sp-desc-label">📌 Nota</div><div class="sp-desc-val" style="color:#d4a830;">${nodo.nota}</div></div>` : ''}
        ${adminHtml}
    `;
}

window._hmCerrarSidePanel = () => {
    st.nodoSel = null;
    renderSidePanel(null);
    renderInfoBar(null);
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

window._hmLimpiarSel = () => {
    st.seleccionados.clear();
    actualizarBadgeSel();
    if (st.nodoSel) renderSidePanel(st.nodoSel);
};

// ══════════════════════════════════════════════════════════════
//  PORTAPAPELES — resumen de operación de asignación
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

// ══════════════════════════════════════════════════════════════
//  HANDLERS GLOBALES
// ══════════════════════════════════════════════════════════════

window._hmCambiarPJ = async (nombre) => {
    st.jugadorPanel = nombre;
    await cargarInventarioPJ(nombre);
    calcSetsGlobales();
    renderInfoStats();
    renderGrimorio(document.getElementById('hm-search-central')?.value || '');
    renderPools();
    // Si el side panel está abierto y tiene un nodo, actualizar
    if (st.nodoSel) renderSidePanel(st.nodoSel);
};

window._hmBuscarCentral = (query) => {
    // Busca por nombre O por número ("7" o "hechizo 7")
    const q = query.trim().toLowerCase();
    const numMatch = q.match(/^(?:hechizo\s*)?(\d+)$/);
    if (numMatch) {
        // Buscar por ID numérico
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

window._hmCerrarOpPanel = () => {
    st.nodoSel = null;
    renderOpPanel(null);
    document.getElementById('hm-info-nodo').innerHTML = '<span style="color:#444;">Clic en un hechizo para ver detalles</span>';
};

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

window._hmToggleMulti = () => {
    st.modoSelMulti = !st.modoSelMulti;
    if (!st.modoSelMulti) { st.seleccionados.clear(); actualizarBadgeSel(); }
    const btn = document.getElementById('hm-btn-multi');
    if (btn) {
        btn.classList.toggle('activo', st.modoSelMulti);
        btn.textContent = st.modoSelMulti ? '☑ Multi-sel' : '☐ Multi-sel';
    }
    // También actualizar badge en toolbar si existe
    actualizarBadgeSel();
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
    toast('Nodo temporal creado. Abre Propiedades para guardarlo en DB.');
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
};

window._hmEliminarNuevo = (id) => {
    st.nodos   = st.nodos.filter(n => n.id !== id);
    st.enlaces = st.enlaces.filter(e => e.source.id!==id && e.target.id!==id);
    st.seleccionados.forEach(n => { if(n.id===id) st.seleccionados.delete(n); });
    if (st.nodoSel?.id === id) { st.nodoSel=null; renderInfoBar(null); }
    actualizarBadgeSel();
    renderGrimorio(document.getElementById('hm-search-central')?.value || '');
    toast('Nodo descartado');
};

// ── Modal: Propiedades batch ──────────────────────────────────
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

// ── Modal: Asignar PJ ─────────────────────────────────────────
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

    // Cobrar HEX si corresponde
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

    // Publicar si se pidió
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

    // Portapapeles
    _mostrarClipboard(pj, nombresHz.slice(0, ok), hexGastado, descubiertos);

    toast(`✓ ${ok} de ${total} hechizo${total!==1?'s':''} asignado${ok!==1?'s':''} a ${pj}${hexGastado>0?` · −${hexGastado} HEX`:''}`);
    renderGrimorio(document.getElementById('hm-search-central')?.value || '');
    if (st.nodoSel) renderSidePanel(st.nodoSel);
};

// ── Auto-ordenar (Fruchterman-Reingold) ───────────────────────
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

// ── Helpers modal ─────────────────────────────────────────────
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
