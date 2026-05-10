// ============================================================
// mapa-ui.js — Toolbar, modales, toast y handlers globales
// /hechizos/mapa-ui.js
// ============================================================

import { st } from './mapa-state.js';
import {
    cargarInventarioPJ, calcSetsGlobales,
    guardarPosiciones, toggleConocido,
    aplicarPropiedades, asignarHechizosAPJ,
} from './mapa-data.js';
import { centrarCamara, renderInfoBar, renderInfoStats } from './mapa-render.js';

// ── Toast ────────────────────────────────────────────────────
export function toast(msg, dur=2300) {
    const t = document.getElementById('hm-toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._tid);
    t._tid = setTimeout(() => t.classList.remove('show'), dur);
}

// ── Actualizar badge de seleccionados ─────────────────────────
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

// ── Render toolbar completa ───────────────────────────────────
export function renderToolbar() {
    const tb = document.getElementById('hm-toolbar');
    if (!tb) return;

    const pjSel = `<select id="hm-pj-sel" onchange="window._hmCambiarPJ(this.value)">
        ${['Todos',...st.jugadores].map(j => `<option value="${j}" ${j===st.jugadorPanel?'selected':''}>${j}</option>`).join('')}
    </select>`;

    let adminBtns = '';
    if (st.esAdmin) {
        adminBtns = `
        <div class="hm-tab-sep"></div>
        <button class="hm-btn gold"  id="hm-btn-nuevo"  onclick="window._hmNuevoNodo()">➕ Nodo</button>
        <button class="hm-btn"       id="hm-btn-flecha" onclick="window._hmToggleConexion()">↗ Flecha</button>
        <button class="hm-btn gold"  id="hm-btn-guardar"onclick="window._hmGuardarPos()">💾 Guardar pos.</button>
        <div class="hm-tab-sep"></div>
        <button class="hm-btn"       id="hm-btn-multi"  onclick="window._hmToggleMulti()" title="Seleccionar múltiples nodos">☐ Multi-sel</button>
        <span id="hm-sel-badge" style="display:none;font-size:0.6em;color:#d4af37;background:rgba(212,175,55,0.1);border:1px solid rgba(212,175,55,0.3);border-radius:10px;padding:2px 8px;">0 sel.</span>
        <button class="hm-btn"       onclick="window._hmModalPropiedades()" title="Editar propiedades de los hechizos seleccionados">⚙ Propiedades</button>
        <button class="hm-btn verde" onclick="window._hmModalAsignarPJ()"   title="Asignar hechizos seleccionados a un personaje">👤 Asignar PJ</button>
        <div class="hm-tab-sep"></div>
        <button class="hm-btn"       onclick="window._hmAutoOrdenar()">🌀 Ordenar</button>`;
    }

    tb.innerHTML = `
        ${pjSel}
        <div class="hm-tab-sep"></div>
        <button class="hm-btn" onclick="window._hmCentrar()">⊙ Centrar</button>
        ${adminBtns}
    `;

    // Infobar CSS extra para botones
    if (!document.getElementById('hm-infobar-css')) {
        const s = document.createElement('style');
        s.id = 'hm-infobar-css';
        s.textContent = `.hm-infobar-btn{font-size:0.82em;padding:1px 7px;border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.05);color:#aaa;border-radius:4px;cursor:pointer;font-family:inherit;}
.hm-infobar-btn:hover{background:rgba(255,255,255,0.1);color:#fff;}
.hm-infobar-btn.danger{border-color:rgba(220,60,60,0.35);background:rgba(220,60,60,0.07);color:#e06060;}
.hm-infobar-btn.danger:hover{background:rgba(220,60,60,0.18);}`;
        document.head.appendChild(s);
    }
}

// ── Handlers globales ─────────────────────────────────────────

window._hmCambiarPJ = async (nombre) => {
    st.jugadorPanel = nombre;
    await cargarInventarioPJ(nombre);
    calcSetsGlobales();
    renderInfoStats();
};

window._hmCentrar = centrarCamara;

window._hmToggleConexion = () => {
    st.modoConexion = !st.modoConexion;
    st.tempFlecha   = null;
    const btn = document.getElementById('hm-btn-flecha');
    if (btn) {
        btn.classList.toggle('activo', st.modoConexion);
        btn.textContent = st.modoConexion ? '↗ Cancelar flecha' : '↗ Flecha';
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
    if (nodo) renderInfoBar(nodo);
    toast(nuevoValor ? '👁 Publicado' : '🔒 Ocultado');
};

window._hmEliminarNuevo = (id) => {
    st.nodos   = st.nodos.filter(n => n.id !== id);
    st.enlaces = st.enlaces.filter(e => e.source.id!==id && e.target.id!==id);
    st.seleccionados.forEach(n => { if(n.id===id) st.seleccionados.delete(n); });
    if (st.nodoSel?.id === id) { st.nodoSel=null; renderInfoBar(null); }
    actualizarBadgeSel();
    toast('Nodo descartado');
};

// ── Modal: Propiedades batch ──────────────────────────────────
window._hmModalPropiedades = () => {
    const nodos = _nodosOperacion();
    if (!nodos) return;

    const afinOps = Object.keys(st.colores).map(a => `<option value="${a}">${a}</option>`).join('');

    _modal(`⚙ Propiedades — ${nodos.length} hechizo${nodos.length>1?'s':''}`,`
        <p style="font-size:0.68em;color:#666;margin-bottom:10px;">
            Hechizos: ${nodos.map(n=>n.nombre).slice(0,5).join(', ')}${nodos.length>5?` + ${nodos.length-5} más`:''}
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
    if (err)     { toast('Error: ' + err); return; }
    if (ok===0)  { toast(`Todos ya estaban en inventario de ${pj}`); return; }
    toast(`✓ ${ok} de ${total} hechizo${total!==1?'s':''} asignado${ok!==1?'s':''} a ${pj}`);
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

        // Repulsión entre todos
        for (let i=0; i<nodos.length; i++) {
            for (let j=i+1; j<nodos.length; j++) {
                const u=nodos[i], v=nodos[j];
                let dx=u.x-v.x, dy=u.y-v.y;
                const d=Math.hypot(dx,dy)||1, f=(K*K)/d;
                disp.get(u.id).x+=dx/d*f; disp.get(u.id).y+=dy/d*f;
                disp.get(v.id).x-=dx/d*f; disp.get(v.id).y-=dy/d*f;
            }
        }
        // Atracción entre enlazados
        enlaces.forEach(({source:u, target:v}) => {
            let dx=u.x-v.x, dy=u.y-v.y;
            const d=Math.hypot(dx,dy)||1, f=d*d/K;
            disp.get(u.id).x-=dx/d*f; disp.get(u.id).y-=dy/d*f;
            disp.get(v.id).x+=dx/d*f; disp.get(v.id).y+=dy/d*f;
        });
        // Atracción al centro
        nodos.forEach(u => {
            const d=Math.hypot(u.x,u.y)||1, f=d*d/(K*2);
            disp.get(u.id).x-=u.x/d*f; disp.get(u.id).y-=u.y/d*f;
        });
        // Aplicar desplazamiento
        nodos.forEach(u => {
            const d2=disp.get(u.id), len=Math.hypot(d2.x,d2.y)||1, lim=Math.min(len,temp);
            u.x+=d2.x/len*lim; u.y+=d2.y/len*lim;
        });
        temp*=0.95; iter--;
        requestAnimationFrame(paso);
    };
    paso();
};

// ── Helpers de modal ─────────────────────────────────────────
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
