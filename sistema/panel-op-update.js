// ============================================================
// panel-op-update.js — Panel de actualización masiva para OP
// Se monta como barra superior flotante sobre el nav.
// Importar desde personajes-main.js (solo visible si esAdmin)
// ============================================================

import { supabase }           from '../hex-auth.js';
import { personajes, estadoUI } from './personajes-state.js';
import { calcularStats }       from './personajes-logic.js';
import { persistirCampos }     from './personajes-data.js';

// ── Estado local ─────────────────────────────────────────────
const opState = {
    seleccionados: new Set(),   // nombres de PJ seleccionados
    log: [],                    // [ { ts, texto } ]
    historial: [],              // [ { entradas: [{nombre, campo, viejo, nuevo}] } ] para undo
};

// ── CSS ───────────────────────────────────────────────────────
function _css() {
    if (document.getElementById('op-update-styles')) return;
    const st = document.createElement('style');
    st.id = 'op-update-styles';
    st.textContent = `
#op-update-bar {
    position: fixed; top: 0; left: 0; right: 0; z-index: 1500;
    background: #09081a;
    border-bottom: 1px solid rgba(124,77,170,0.4);
    font-family: 'Inter', system-ui, sans-serif;
    box-shadow: 0 4px 24px rgba(0,0,0,0.6);
    transition: transform 0.28s cubic-bezier(0.4,0,0.2,1);
}
#op-update-bar.collapsed { transform: translateY(calc(-100% + 36px)); }
#op-bar-toggle {
    position: absolute; bottom: -1px; left: 50%;
    transform: translateX(-50%);
    background: #09081a; border: 1px solid rgba(124,77,170,0.4);
    border-top: none; color: rgba(124,77,170,0.8);
    font-size: 0.6em; letter-spacing: 1.5px; text-transform: uppercase;
    padding: 2px 14px 3px; border-radius: 0 0 6px 6px;
    cursor: pointer; transition: color 0.15s;
}
#op-bar-toggle:hover { color: #b080e0; }
.op-bar-inner {
    display: grid;
    grid-template-columns: 220px 1fr 320px;
    gap: 0;
    min-height: 0;
}
.op-col {
    padding: 10px 14px;
    border-right: 1px solid rgba(255,255,255,0.05);
}
.op-col:last-child { border-right: none; }
.op-col-title {
    font-size: 0.5em; letter-spacing: 2px; text-transform: uppercase;
    color: rgba(124,77,170,0.7); font-weight: 700; margin-bottom: 7px;
}

/* ── Selección de PJs ── */
.op-pj-grid {
    display: flex; flex-wrap: wrap; gap: 5px;
    max-height: 90px; overflow-y: auto;
    scrollbar-width: thin; scrollbar-color: rgba(124,77,170,0.3) transparent;
}
.op-pj-chip {
    display: flex; align-items: center; gap: 5px;
    padding: 3px 8px; border-radius: 20px;
    border: 1px solid rgba(255,255,255,0.1);
    background: rgba(255,255,255,0.03);
    cursor: pointer; transition: all 0.12s;
    font-size: 0.68em; color: #aaa;
    user-select: none;
}
.op-pj-chip:hover { border-color: rgba(124,77,170,0.4); color: #ccc; }
.op-pj-chip.sel {
    background: rgba(124,77,170,0.18);
    border-color: rgba(124,77,170,0.55);
    color: #c8a0f0;
}
.op-pj-chip img {
    width: 18px; height: 18px; border-radius: 50%;
    object-fit: cover; object-position: top;
    background: #222;
}
.op-sel-all {
    font-size: 0.55em; color: rgba(124,77,170,0.6);
    cursor: pointer; text-decoration: underline;
    margin-bottom: 4px; display: inline-block;
}
.op-sel-all:hover { color: #b080e0; }

/* ── Acciones ── */
.op-actions-grid {
    display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px;
}
.op-action-block { }
.op-action-label {
    font-size: 0.5em; letter-spacing: 1.5px; text-transform: uppercase;
    color: #555; font-weight: 700; margin-bottom: 4px;
}
.op-btns { display: flex; flex-wrap: wrap; gap: 3px; }
.op-btn {
    font-size: 0.62em; padding: 3px 7px; border-radius: 4px;
    cursor: pointer; font-weight: 700; border: 1px solid;
    transition: background 0.12s; font-family: inherit;
}
.op-btn-pos  { background: rgba(62,207,110,0.1); border-color: rgba(62,207,110,0.35); color: #3ecf6e; }
.op-btn-pos:hover  { background: rgba(62,207,110,0.22); }
.op-btn-neg  { background: rgba(220,80,80,0.1);  border-color: rgba(220,80,80,0.35);  color: #e06060; }
.op-btn-neg:hover  { background: rgba(220,80,80,0.22); }
.op-btn-hex  { background: rgba(212,175,55,0.1); border-color: rgba(212,175,55,0.35); color: #d4af37; }
.op-btn-hex:hover  { background: rgba(212,175,55,0.22); }
.op-btn-vex  { background: rgba(160,80,220,0.1); border-color: rgba(160,80,220,0.35); color: #b060e8; }
.op-btn-vex:hover  { background: rgba(160,80,220,0.22); }
.op-btn-gda  { background: rgba(212,175,55,0.08);border-color: rgba(212,175,55,0.25); color: #c8953a; }
.op-btn-gda:hover  { background: rgba(212,175,55,0.18); }
.op-btn-push { background: rgba(124,77,170,0.12);border-color: rgba(124,77,170,0.4);  color: #c8a0f0; }
.op-btn-push:hover { background: rgba(124,77,170,0.24); }
.op-btn-undo { background: rgba(220,120,40,0.1); border-color: rgba(220,120,40,0.35); color: #e88040; }
.op-btn-undo:hover { background: rgba(220,120,40,0.22); }
.op-custom-row { display: flex; gap: 3px; margin-top: 3px; }
.op-custom-input {
    width: 60px; background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.12); border-radius: 4px;
    color: #ccc; font-size: 0.65em; padding: 3px 5px;
    text-align: center; outline: none; font-family: inherit;
}
.op-custom-input::placeholder { color: #444; }
.op-custom-input:focus { border-color: rgba(124,77,170,0.5); }

/* ── Log ── */
.op-log-wrap {
    display: flex; flex-direction: column; height: 100%;
}
.op-log-area {
    flex: 1; overflow-y: auto; background: rgba(0,0,0,0.3);
    border-radius: 5px; border: 1px solid rgba(255,255,255,0.06);
    padding: 5px 8px; font-size: 0.62em; color: #888;
    font-family: 'Inter', monospace; line-height: 1.6;
    min-height: 60px; max-height: 90px;
    scrollbar-width: thin;
}
.op-log-entry { border-bottom: 1px solid rgba(255,255,255,0.04); padding: 1px 0; }
.op-log-entry:last-child { border-bottom: none; }
.op-log-name { color: #c8a0f0; font-weight: 600; }
.op-log-stat { color: #d4af37; }
.op-log-ts   { color: #333; margin-right: 4px; }
.op-log-actions {
    display: flex; gap: 5px; margin-top: 5px;
}
.op-log-btn {
    font-size: 0.55em; padding: 2px 9px; border-radius: 4px;
    cursor: pointer; border: 1px solid; font-family: inherit;
    font-weight: 600; letter-spacing: 0.5px;
}
`;
    document.head.appendChild(st);
}

// ── Helpers ───────────────────────────────────────────────────
function _norm(s) {
    return s ? s.toString().trim().toLowerCase()
        .replace(/[áàäâ]/g,'a').replace(/[éèëê]/g,'e').replace(/[íìïî]/g,'i')
        .replace(/[óòöô]/g,'o').replace(/[úùüû]/g,'u').replace(/[ñ]/g,'n')
        .replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,'') : '';
}
function _sb() { try { return window.currentConfig?.storageUrl || ''; } catch { return ''; } }
function _imgPj(p, nombre) {
    const icono = p?.iconoOverride || nombre;
    return `${_sb()}/imgpersonajes/${_norm(icono)}icon.png`;
}
function _ts() {
    const d = new Date();
    return `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
}

function _addLog(linea) {
    opState.log.unshift({ ts: _ts(), texto: linea });
    if (opState.log.length > 200) opState.log.pop();
    _renderLog();
}

function _pjsSeleccionados() {
    return [...opState.seleccionados].filter(n => personajes[n]);
}

// ── Render ────────────────────────────────────────────────────
function _renderChips() {
    const grid = document.getElementById('op-pj-grid');
    if (!grid) return;
    const jugadores = Object.entries(personajes)
        .filter(([, p]) => p.isActive)
        .sort(([a], [b]) => a.localeCompare(b));
    grid.innerHTML = jugadores.map(([nombre, p]) => {
        const sel = opState.seleccionados.has(nombre);
        return `<div class="op-pj-chip ${sel ? 'sel' : ''}" onclick="window._opTogglePJ('${nombre.replace(/'/g,"\\'")}')">
            <img src="${_imgPj(p, nombre)}" onerror="this.style.display='none'" >
            ${nombre}
        </div>`;
    }).join('');
}

function _renderLog() {
    const el = document.getElementById('op-log-area');
    if (!el) return;
    if (opState.log.length === 0) {
        el.innerHTML = '<span style="color:#333;font-style:italic;">Sin cambios aún…</span>';
        return;
    }
    el.innerHTML = opState.log.map(e =>
        `<div class="op-log-entry"><span class="op-log-ts">${e.ts}</span>${e.texto}</div>`
    ).join('');
}

// ── Acciones ─────────────────────────────────────────────────
async function _aplicarCambio(campo, delta, label, colorClass) {
    const pjs = _pjsSeleccionados();
    if (!pjs.length) { _toast('Selecciona al menos un personaje'); return; }

    const lote = [];
    const snaps = [];

    for (const nombre of pjs) {
        const p = personajes[nombre];
        const s = calcularStats(p);
        const viejo = p[campo] ?? 0;
        const caps = { vex_actual: s.vex_max, guarda_actual: s.guarda_max, vida_roja_actual: s.vida_roja_max };
        const max = caps[campo] ?? Infinity;
        const nuevo = campo === 'vida_azul_actual'
            ? viejo + delta
            : Math.max(0, Math.min(max, viejo + delta));
        snaps.push({ nombre, campo, viejo, nuevo });
        p[campo] = nuevo;
        lote.push(persistirCampos(nombre, { [campo]: nuevo }));
    }

    await Promise.all(lote);
    opState.historial.push(snaps);

    const linea = pjs.map(n => {
        const s = snaps.find(x => x.nombre === n);
        return `<span class="op-log-name">${n}</span> <span class="${colorClass}">${delta > 0 ? '+' : ''}${delta} ${label}</span> → <span class="op-log-stat">${s.nuevo}</span>`;
    }).join(' · ');
    _addLog(linea);

    window.renderCatalogo?.();
    window.refreshPanelPJ?.();
}

async function _darHexPush(tipo, monto) {
    const pjs = _pjsSeleccionados();
    if (!pjs.length) { _toast('Selecciona al menos un personaje'); return; }

    const lote = [];
    const snaps = [];

    for (const nombre of pjs) {
        const p = personajes[nombre];
        const viejo = p.hex ?? 0;
        const nuevo = viejo + monto;
        snaps.push({ nombre, campo: 'hex', viejo, nuevo });
        p.hex = nuevo;
        lote.push(
            persistirCampos(nombre, { hex: nuevo }),
            supabase.from('hex_push_log').insert({
                personaje: nombre, tipo, cantidad: monto,
                nota: '', otorgado_por: 'OP'
            })
        );
    }

    await Promise.all(lote.flat());
    opState.historial.push(snaps);

    const linea = pjs.map(n => {
        const s = snaps.find(x => x.nombre === n);
        return `<span class="op-log-name">${n}</span> <span class="op-log-stat">+${monto} HEX (${tipo.replace('_',' ')})</span> → <span class="op-log-stat">${s.nuevo}</span>`;
    }).join(' · ');
    _addLog(linea);

    window.renderCatalogo?.();
    window.refreshPanelPJ?.();
}

async function _darPushVexGuarda(recurso) {
    const pjs = _pjsSeleccionados();
    if (!pjs.length) { _toast('Selecciona al menos un personaje'); return; }

    const campo     = recurso === 'vex' ? 'vex_actual' : 'guarda_actual';
    const tsKey     = recurso === 'vex' ? 'push_vex_ts' : 'push_guarda_ts';
    const actKey    = recurso === 'vex' ? 'push_vex_actual' : 'push_guarda_actual';
    const label     = recurso === 'vex' ? 'VEX' : 'Guarda';
    const lote      = [];
    const snaps     = [];

    for (const nombre of pjs) {
        const p = personajes[nombre];
        const s = calcularStats(p);
        const { calcularValorPush, calcularPushDisponibles } = await import('./personajes-logic.js');
        const valor  = calcularValorPush(p, recurso);
        const disp   = calcularPushDisponibles(p, s, recurso);
        const usado  = p[actKey] || 0;
        if (usado >= disp) continue;  // sin pushes disponibles

        const max    = recurso === 'vex' ? s.vex_max : s.guarda_max;
        const viejo  = p[campo] ?? 0;
        const nuevo  = Math.min(max, viejo + valor);
        const nuevoAct = usado + 1;
        const ts       = new Date().toISOString();

        snaps.push({ nombre, campo, viejo, nuevo });
        p[campo]  = nuevo;
        p[actKey] = nuevoAct;
        p[tsKey]  = ts;

        lote.push(persistirCampos(nombre, {
            [campo]: nuevo,
            [actKey]: nuevoAct,
            [tsKey]: ts
        }));
    }

    if (!snaps.length) { _toast(`Sin pushes de ${label} disponibles`); return; }
    await Promise.all(lote);
    opState.historial.push(snaps);

    const linea = snaps.map(s =>
        `<span class="op-log-name">${s.nombre}</span> Push ${label} +${s.nuevo - s.viejo} → <span class="op-log-stat">${s.nuevo}</span>`
    ).join(' · ');
    _addLog(linea);

    window.renderCatalogo?.();
    window.refreshPanelPJ?.();
}

async function _undo() {
    if (!opState.historial.length) { _toast('Nada que deshacer'); return; }
    const snaps = opState.historial.pop();
    const lote  = [];

    for (const s of snaps) {
        const p = personajes[s.nombre];
        if (!p) continue;
        p[s.campo] = s.viejo;
        lote.push(persistirCampos(s.nombre, { [s.campo]: s.viejo }));
    }

    await Promise.all(lote);
    const linea = `<span style="color:#e88040;">↺ Deshecho:</span> ` +
        snaps.map(s => `<span class="op-log-name">${s.nombre}</span> ${s.campo} ${s.nuevo} → <span class="op-log-stat">${s.viejo}</span>`).join(' · ');
    _addLog(linea);

    window.renderCatalogo?.();
    window.refreshPanelPJ?.();
}

function _copiarLog() {
    const txt = opState.log.map(e => `[${e.ts}] ${e.texto.replace(/<[^>]+>/g, '')}`).join('\n');
    navigator.clipboard.writeText(txt).then(() => _toast('Log copiado'));
}

function _toast(msg) {
    let el = document.getElementById('op-toast');
    if (!el) {
        el = document.createElement('div');
        el.id = 'op-toast';
        el.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#1a1a2a;border:1px solid rgba(124,77,170,0.5);color:#c8a0f0;font-size:0.75em;padding:7px 16px;border-radius:6px;z-index:9999;font-family:Inter,sans-serif;';
        document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.opacity = '1';
    clearTimeout(el._t);
    el._t = setTimeout(() => { el.style.opacity = '0'; }, 2000);
}

// ── Montaje ───────────────────────────────────────────────────
function _montar() {
    if (document.getElementById('op-update-bar')) return;
    _css();

    const bar = document.createElement('div');
    bar.id = 'op-update-bar';
    bar.classList.add('collapsed');

    bar.innerHTML = `
    <div class="op-bar-inner">

        <!-- COL 1: Selección PJs -->
        <div class="op-col">
            <div class="op-col-title">Personajes</div>
            <span class="op-sel-all" onclick="window._opSelAll()">Seleccionar todos · <span id="op-sel-count">0</span></span>
            <div class="op-pj-grid" id="op-pj-grid"></div>
        </div>

        <!-- COL 2: Acciones -->
        <div class="op-col">
            <div class="op-col-title">Actualizar</div>
            <div class="op-actions-grid">

                <!-- HEX -->
                <div class="op-action-block">
                    <div class="op-action-label">HEX</div>
                    <div class="op-btns">
                        <button class="op-btn op-btn-pos" onclick="window._opHex(100)">+100</button>
                        <button class="op-btn op-btn-pos" onclick="window._opHex(300)">+300</button>
                        <button class="op-btn op-btn-pos" onclick="window._opHex(500)">+500</button>
                        <button class="op-btn op-btn-pos" onclick="window._opHex(1000)">+1k</button>
                        <button class="op-btn op-btn-neg" onclick="window._opHex(-100)">−100</button>
                        <button class="op-btn op-btn-neg" onclick="window._opHex(-500)">−500</button>
                    </div>
                    <div class="op-custom-row">
                        <input class="op-custom-input" id="op-hex-custom" type="number" placeholder="±HEX" onclick="event.stopPropagation()">
                        <button class="op-btn op-btn-hex" onclick="window._opHexCustom()">ok</button>
                    </div>
                    <div class="op-btns" style="margin-top:4px;">
                        <button class="op-btn op-btn-push" style="font-size:0.55em;" onclick="window._opHexPush('turno_extra',500)">Turno +500</button>
                        <button class="op-btn op-btn-push" style="font-size:0.55em;" onclick="window._opHexPushCustom()">Contenido</button>
                    </div>
                    <div class="op-custom-row" style="margin-top:2px;">
                        <input class="op-custom-input" id="op-contenido-custom" type="number" placeholder="100-1000" value="500" onclick="event.stopPropagation()">
                    </div>
                </div>

                <!-- VEX -->
                <div class="op-action-block">
                    <div class="op-action-label">VEX</div>
                    <div class="op-btns">
                        <button class="op-btn op-btn-pos" onclick="window._opVex(50)">+50</button>
                        <button class="op-btn op-btn-pos" onclick="window._opVex(100)">+100</button>
                        <button class="op-btn op-btn-pos" onclick="window._opVex(200)">+200</button>
                        <button class="op-btn op-btn-neg" onclick="window._opVex(-50)">−50</button>
                        <button class="op-btn op-btn-neg" onclick="window._opVex(-100)">−100</button>
                    </div>
                    <div class="op-custom-row">
                        <input class="op-custom-input" id="op-vex-custom" type="number" placeholder="±VEX" onclick="event.stopPropagation()">
                        <button class="op-btn op-btn-vex" onclick="window._opVexCustom()">ok</button>
                    </div>
                    <div class="op-btns" style="margin-top:4px;">
                        <button class="op-btn op-btn-push" style="font-size:0.55em;" onclick="window._opPushVex()">⚡ Push VEX</button>
                    </div>
                </div>

                <!-- GUARDA -->
                <div class="op-action-block">
                    <div class="op-action-label">Guarda dorada</div>
                    <div class="op-btns">
                        <button class="op-btn op-btn-pos" onclick="window._opGuarda(1)">+1</button>
                        <button class="op-btn op-btn-pos" onclick="window._opGuarda(3)">+3</button>
                        <button class="op-btn op-btn-pos" onclick="window._opGuarda(5)">+5</button>
                        <button class="op-btn op-btn-neg" onclick="window._opGuarda(-1)">−1</button>
                        <button class="op-btn op-btn-neg" onclick="window._opGuarda(-3)">−3</button>
                        <button class="op-btn op-btn-neg" onclick="window._opGuarda(-5)">−5</button>
                    </div>
                    <div class="op-custom-row">
                        <input class="op-custom-input" id="op-gda-custom" type="number" placeholder="±Gda" onclick="event.stopPropagation()">
                        <button class="op-btn op-btn-gda" onclick="window._opGuardaCustom()">ok</button>
                    </div>
                    <div class="op-btns" style="margin-top:4px;">
                        <button class="op-btn op-btn-push" style="font-size:0.55em;" onclick="window._opPushGuarda()">🛡 Push Guarda</button>
                    </div>
                </div>

            </div>
        </div>

        <!-- COL 3: Log + Undo -->
        <div class="op-col">
            <div class="op-col-title" style="display:flex;justify-content:space-between;align-items:center;">
                Log de cambios
                <button class="op-btn op-btn-undo" onclick="window._opUndo()" style="font-size:0.55em;padding:2px 8px;">↺ Deshacer</button>
            </div>
            <div class="op-log-wrap">
                <div class="op-log-area" id="op-log-area">
                    <span style="color:#333;font-style:italic;">Sin cambios aún…</span>
                </div>
                <div class="op-log-actions">
                    <button class="op-log-btn op-btn" style="background:rgba(212,175,55,0.08);border-color:rgba(212,175,55,0.25);color:#d4af37;" onclick="window._opCopiarLog()">📋 Copiar log</button>
                    <button class="op-log-btn op-btn" style="background:rgba(220,80,80,0.08);border-color:rgba(220,80,80,0.25);color:#e06060;" onclick="window._opLimpiarLog()">🗑 Limpiar</button>
                </div>
            </div>
        </div>

    </div>
    <button id="op-bar-toggle" onclick="window._opToggleBar()">▲ OP Panel</button>`;

    document.body.prepend(bar);

    // Compensar el nav para que no quede debajo
    _ajustarNav(false);
    _renderChips();
}

function _ajustarNav(expanded) {
    const nav = document.querySelector('.nav');
    if (!nav) return;
    const barH = document.getElementById('op-update-bar')?.offsetHeight || 0;
    nav.style.top = expanded ? barH - 36 + 'px' : '0px';
    nav.style.position = 'fixed';
    nav.style.left = '0'; nav.style.right = '0';
    nav.style.zIndex = '1400';
}

// ── Handlers globales ─────────────────────────────────────────
window._opToggleBar = () => {
    const bar = document.getElementById('op-update-bar');
    if (!bar) return;
    const collapsed = bar.classList.toggle('collapsed');
    document.getElementById('op-bar-toggle').textContent = collapsed ? '▲ OP Panel' : '▼ OP Panel';
    // Ajustar nav después de transición
    setTimeout(() => _ajustarNav(!collapsed), 300);
};

window._opTogglePJ = (nombre) => {
    if (opState.seleccionados.has(nombre)) opState.seleccionados.delete(nombre);
    else opState.seleccionados.add(nombre);
    document.getElementById('op-sel-count').textContent = opState.seleccionados.size;
    _renderChips();
};

window._opSelAll = () => {
    const pjs = Object.keys(personajes).filter(n => personajes[n].isActive);
    if (opState.seleccionados.size === pjs.length) {
        opState.seleccionados.clear();
    } else {
        pjs.forEach(n => opState.seleccionados.add(n));
    }
    document.getElementById('op-sel-count').textContent = opState.seleccionados.size;
    _renderChips();
};

window._opHex        = (d) => _aplicarCambio('hex', d, 'HEX', 'op-log-stat');
window._opVex        = (d) => _aplicarCambio('vex_actual', d, 'VEX', 'op-log-vex');
window._opGuarda     = (d) => _aplicarCambio('guarda_actual', d, 'Guarda', 'op-log-stat');

window._opHexCustom  = () => {
    const v = parseInt(document.getElementById('op-hex-custom')?.value);
    if (!v || isNaN(v)) return;
    _aplicarCambio('hex', v, 'HEX', 'op-log-stat');
    document.getElementById('op-hex-custom').value = '';
};
window._opVexCustom  = () => {
    const v = parseInt(document.getElementById('op-vex-custom')?.value);
    if (!v || isNaN(v)) return;
    _aplicarCambio('vex_actual', v, 'VEX', 'op-log-stat');
    document.getElementById('op-vex-custom').value = '';
};
window._opGuardaCustom = () => {
    const v = parseInt(document.getElementById('op-gda-custom')?.value);
    if (!v || isNaN(v)) return;
    _aplicarCambio('guarda_actual', v, 'Guarda', 'op-log-stat');
    document.getElementById('op-gda-custom').value = '';
};

window._opHexPush       = (tipo, monto) => _darHexPush(tipo, monto);
window._opHexPushCustom = () => {
    const v = parseInt(document.getElementById('op-contenido-custom')?.value) || 500;
    _darHexPush('contenido', Math.max(100, Math.min(1000, v)));
};

window._opPushVex    = () => _darPushVexGuarda('vex');
window._opPushGuarda = () => _darPushVexGuarda('guarda');
window._opUndo       = () => _undo();
window._opCopiarLog  = () => _copiarLog();
window._opLimpiarLog = () => { opState.log = []; _renderLog(); };

// ── Exportar función de montaje ───────────────────────────────
export function montarOpPanel() {
    if (!estadoUI.esAdmin) return;
    _montar();
}

// ── Refrescar chips cuando cambian los personajes ─────────────
export function refrescarOpPanel() {
    if (document.getElementById('op-update-bar')) _renderChips();
}
