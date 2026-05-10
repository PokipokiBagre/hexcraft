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
}

// ── Selector de PJ ───────────────────────────────────────────
export function actualizarSelector() {
    const sel = document.getElementById('hm-pj-sel');
    if (!sel) return;
    const ops = ['Todos', ...st.jugadores];
    sel.innerHTML = ops.map(j =>
        `<option value="${j}" ${j===st.jugadorPanel?'selected':''}>${j}</option>`
    ).join('');
}

// ══════════════════════════════════════════════════════════════
//  TOOLBAR — solo lo esencial (selector PJ + centrar)
// ══════════════════════════════════════════════════════════════
export function renderToolbar() {
    const tb = document.getElementById('hm-toolbar');
    if (!tb) return;

    const pjSel = `<select id="hm-pj-sel" onchange="window._hmCambiarPJ(this.value)">
        ${['Todos',...st.jugadores].map(j =>
            `<option value="${j}" ${j===st.jugadorPanel?'selected':''}>${j}</option>`
        ).join('')}
    </select>`;

    tb.innerHTML = `
        ${pjSel}
        <div class="hm-tab-sep"></div>
        <button class="hm-btn" onclick="window._hmCentrar()" title="Centrar vista">⊙ Centrar</button>
        <span id="hm-sel-badge" style="display:none;font-size:0.6em;color:#d4af37;
            background:rgba(212,175,55,0.1);border:1px solid rgba(212,175,55,0.3);
            border-radius:10px;padding:2px 8px;">0 sel.</span>
    `;
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

// ── Pane admin (dentro del drawer) ───────────────────────────
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

// ══════════════════════════════════════════════════════════════
//  HANDLERS GLOBALES
// ══════════════════════════════════════════════════════════════

window._hmCambiarPJ = async (nombre) => {
    st.jugadorPanel = nombre;
    await cargarInventarioPJ(nombre);
    calcSetsGlobales();
    renderInfoStats();
    renderGrimorio(document.getElementById('hm-search')?.value || '');
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
    renderGrimorio(document.getElementById('hm-search')?.value || '');
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
        renderGrimorio(document.getElementById('hm-search')?.value || '');
    }
    toast(nuevoValor ? '👁 Publicado' : '🔒 Ocultado');
};

window._hmEliminarNuevo = (id) => {
    st.nodos   = st.nodos.filter(n => n.id !== id);
    st.enlaces = st.enlaces.filter(e => e.source.id!==id && e.target.id!==id);
    st.seleccionados.forEach(n => { if(n.id===id) st.seleccionados.delete(n); });
    if (st.nodoSel?.id === id) { st.nodoSel=null; renderInfoBar(null); }
    actualizarBadgeSel();
    renderGrimorio(document.getElementById('hm-search')?.value || '');
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
    renderGrimorio(document.getElementById('hm-search')?.value || '');
};

// ── Modal: Asignar PJ ─────────────────────────────────────────
window._hmModalAsignarPJ = () => {
    const nodos = _nodosOperacion();
    if (!nodos) return;

    _modal(`👤 Asignar a personaje — ${nodos.length} hechizo${nodos.length>1?'s':''}`, `
        <p style="font-size:0.68em;color:#666;margin-bottom:10px;">
            ${nodos.map(n=>n.nombre).slice(0,5).join(', ')}${nodos.length>5?` + ${nodos.length-5} más`:''}
        </p>
        <label>Personaje</label>
        <select id="hmap-pj">
            ${st.personajes.map(p=>`<option value="${p}">${p}</option>`).join('')}
        </select>
    `, `window._hmAplicarAsignar(${JSON.stringify(nodos.map(n=>n.nombre))})`);
};

window._hmAplicarAsignar = async (nombresHz) => {
    const pj = document.getElementById('hmap-pj')?.value;
    if (!pj) { toast('Selecciona un personaje'); return; }
    const { ok, total, yaEstan, err } = await asignarHechizosAPJ(nombresHz, pj);
    _cerrarModal();
    if (err)    { toast('Error: ' + err); return; }
    if (ok===0) { toast(`Todos ya estaban en inventario de ${pj}`); return; }
    toast(`✓ ${ok} de ${total} hechizo${total!==1?'s':''} asignado${ok!==1?'s':''} a ${pj}`);
    renderGrimorio(document.getElementById('hm-search')?.value || '');
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
