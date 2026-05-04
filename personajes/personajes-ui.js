// ============================================================
// personajes-ui.js — Renderizado de todas las vistas
// /personajes/personajes-ui.js
// ============================================================

import { AFINIDADES, VARS_FORMULA, personajes, estadoUI, formulas, regenConfig } from './personajes-state.js';
import { calcularStats, getMayorAfinidad, buildContext, evalExpr } from './personajes-logic.js';
import { db } from '../hex-db.js';

const STORAGE_URL = '';  // se sobreescribe en main con currentConfig.storageUrl

// ─────────────────────────────────────────────────────────────
// CATÁLOGO
// ─────────────────────────────────────────────────────────────
export function renderCatalogo() {
    const grid = document.getElementById('pj-grid');
    if (!grid) return;

    const lista = Object.entries(personajes).filter(([nombre, p]) => {
        if (estadoUI.filtroRol === 'Jugador' && !p.isPlayer) return false;
        if (estadoUI.filtroRol === 'NPC'     &&  p.isPlayer) return false;
        if (estadoUI.filtroAct === 'Activo'  && !p.isActive) return false;
        if (estadoUI.filtroAct === 'Inactivo'&&  p.isActive) return false;
        if (estadoUI.busqueda && !nombre.toLowerCase().includes(estadoUI.busqueda)) return false;
        return true;
    });

    if (lista.length === 0) {
        grid.innerHTML = `<div class="empty-state"><p>Sin resultados con los filtros actuales.</p></div>`;
        return;
    }

    grid.innerHTML = lista.map(([nombre, p]) => {
        const s = calcularStats(p);
        const mayor = getMayorAfinidad(p);
        const esJugador = p.isPlayer || p.npc_tipo === 'jugador';

        // Progreso de vida (porcentaje)
        const pctVida = s.vida_roja_max > 0 ? Math.min(100, Math.round(p.vida_roja_actual / s.vida_roja_max * 100)) : 0;
        const pctVex  = s.vex_max > 0 ? Math.min(100, Math.round(p.vex_actual / s.vex_max * 100)) : 0;
        const pctGuarda = s.guarda_max > 0 ? Math.min(100, Math.round((p.guarda_actual||0) / s.guarda_max * 100)) : 0;

        // Barras de afinidad
        const maxAfin = Math.max(1, ...AFINIDADES.map(a => (p.afinidadesBase?.[a.key]||0)+(p.afinidadesHz?.[a.key]||0)+(p.afinidadesEf?.[a.key]||0)+(p.afinidadesBf?.[a.key]||0)));
        const barras = AFINIDADES.map(a => {
            const v = (p.afinidadesBase?.[a.key]||0)+(p.afinidadesHz?.[a.key]||0)+(p.afinidadesEf?.[a.key]||0)+(p.afinidadesBf?.[a.key]||0);
            const pct = Math.round(v / maxAfin * 100);
            const esMayor = mayor && mayor.key === a.key;
            return `<div class="afin-bar-row">
                <span class="afin-bar-label ${esMayor ? 'mayor' : ''}">${a.abr}</span>
                <div class="afin-bar-track">
                    <div class="afin-bar-fill ${esMayor ? 'fill-gold' : 'fill-dim'}" style="width:${pct}%"></div>
                </div>
                <span class="afin-bar-val ${esMayor ? 'val-gold' : ''}">${v}</span>
            </div>`;
        }).join('');

        const esInactivo = !p.isActive;

        return `<div class="pj-card ${esInactivo ? 'pj-inactivo' : ''}" onclick="window.abrirDetalle('${nombre.replace(/'/g,"\\'")}')">
            <div class="pj-card-top">
                <div class="pj-inicial">${nombre[0]}</div>
                <div class="pj-info">
                    <div class="pj-name">${nombre}</div>
                    <div class="pj-tags">
                        <span class="tag ${p.isPlayer ? 'tag-jugador' : 'tag-npc'}">${p.isPlayer ? 'Jugador' : 'NPC'}</span>
                        ${!p.isPlayer ? `<span class="tag tag-dim">${p.npc_tipo === 'jugador' ? 'T. Jugador' : 'Sistema'}</span>` : ''}
                        <span class="tag ${p.isActive ? 'tag-activo' : 'tag-inactivo'}">${p.isActive ? 'Activo' : 'Inactivo'}</span>
                    </div>
                </div>
                ${estadoUI.esAdmin ? `<div class="pj-card-actions" onclick="event.stopPropagation()">
                    <button class="icon-btn" onclick="window.editarPersonaje('${nombre.replace(/'/g,"\\'")}')">✎</button>
                    <button class="icon-btn icon-btn-danger" onclick="window.pedirDelete('${nombre.replace(/'/g,"\\'")}')">✕</button>
                </div>` : ''}
            </div>

            <!-- Barras de recursos x/y -->
            <div class="recursos-section">
                <div class="recurso-row">
                    <span class="recurso-label">Vida</span>
                    <div class="recurso-bar-track">
                        <div class="recurso-bar-fill fill-vida" style="width:${pctVida}%"></div>
                    </div>
                    <span class="recurso-xy">${p.vida_roja_actual}<span class="xy-sep">/</span>${s.vida_roja_max}</span>
                </div>
                ${s.vex_max > 0 ? `<div class="recurso-row">
                    <span class="recurso-label">VEX</span>
                    <div class="recurso-bar-track">
                        <div class="recurso-bar-fill fill-vex" style="width:${pctVex}%"></div>
                    </div>
                    <span class="recurso-xy">${p.vex_actual}<span class="xy-sep">/</span>${s.vex_max}</span>
                </div>` : ''}
                ${s.guarda_max > 0 ? `<div class="recurso-row">
                    <span class="recurso-label">Guarda</span>
                    <div class="recurso-bar-track">
                        <div class="recurso-bar-fill fill-guarda" style="width:${pctGuarda}%"></div>
                    </div>
                    <span class="recurso-xy">${p.guarda_actual||0}<span class="xy-sep">/</span>${s.guarda_max}</span>
                </div>` : ''}
            </div>

            <!-- Afinidades -->
            <div class="afin-section">${barras}</div>

            <!-- HEX -->
            <div class="pj-hex">HEX ${(p.hex||0).toLocaleString()}</div>
        </div>`;
    }).join('');
}

// ─────────────────────────────────────────────────────────────
// PANEL LATERAL DE DETALLE
// ─────────────────────────────────────────────────────────────
export function renderDetalle(nombre) {
    const p = personajes[nombre];
    if (!p) return;
    const s = calcularStats(p);
    const esJugador = p.isPlayer || p.npc_tipo === 'jugador';

    const afinRows = AFINIDADES.map(a => {
        const base = p.afinidadesBase?.[a.key] || 0;
        const hz   = p.afinidadesHz?.[a.key]   || 0;
        const ef   = p.afinidadesEf?.[a.key]   || 0;
        const bf   = p.afinidadesBf?.[a.key]   || 0;
        const total = base + hz + ef + bf;
        const desglose = [hz && `Hz:+${hz}`, ef && `Ef:+${ef}`, bf && `Bf:+${bf}`].filter(Boolean).join(' ');
        return `<div class="det-stat-row">
            <span class="det-stat-label">${a.label}</span>
            <div class="det-stat-ctrl">
                ${estadoUI.esAdmin ? `<button class="ctrl-btn" onclick="window.modAfin('${nombre}','${a.key}',-1)">−</button>` : ''}
                <div style="text-align:center;">
                    <div class="det-stat-val">${total}</div>
                    ${desglose ? `<div class="det-stat-sub">${desglose}</div>` : ''}
                </div>
                ${estadoUI.esAdmin ? `<button class="ctrl-btn" onclick="window.modAfin('${nombre}','${a.key}',1)">+</button>` : ''}
            </div>
        </div>`;
    }).join('');

    document.getElementById('panel-nombre').textContent = nombre;
    document.getElementById('panel-body').innerHTML = `
        <!-- Stats derivados -->
        <div class="det-section">
            <div class="det-section-title">STATS CALCULADOS</div>
            <div class="det-calc-grid">
                <div class="det-calc-item">
                    <div class="det-calc-label">Vida Roja</div>
                    <div class="det-calc-xy">
                        ${estadoUI.esAdmin ? `<button class="ctrl-btn ctrl-btn-sm" onclick="window.modStat('${nombre}','vida_roja_actual',-1)">−</button>` : ''}
                        <span class="det-xy-x">${p.vida_roja_actual}</span><span class="det-xy-sep">/</span><span class="det-xy-y">${s.vida_roja_max}</span>
                        ${estadoUI.esAdmin ? `<button class="ctrl-btn ctrl-btn-sm" onclick="window.modStat('${nombre}','vida_roja_actual',1)">+</button>` : ''}
                    </div>
                    <div class="det-calc-formula">${formulas.vida_roja_max.expr}</div>
                </div>
                <div class="det-calc-item">
                    <div class="det-calc-label">Vida Azul</div>
                    <div class="det-calc-xy">
                        <span class="det-xy-x">${s.vida_azul_max}</span>
                    </div>
                    <div class="det-calc-formula">${formulas.vida_azul_max.expr}</div>
                </div>
                <div class="det-calc-item">
                    <div class="det-calc-label">VEX</div>
                    <div class="det-calc-xy">
                        ${estadoUI.esAdmin ? `<button class="ctrl-btn ctrl-btn-sm" onclick="window.modStat('${nombre}','vex_actual',-50)">−50</button>` : ''}
                        <span class="det-xy-x">${p.vex_actual}</span><span class="det-xy-sep">/</span><span class="det-xy-y">${s.vex_max}</span>
                        ${estadoUI.esAdmin ? `<button class="ctrl-btn ctrl-btn-sm" onclick="window.modStat('${nombre}','vex_actual',50)">+50</button>` : ''}
                    </div>
                    <div class="det-calc-formula">${esJugador ? formulas.vex_max.expr : 'Fijo (NPC sistema)'}</div>
                </div>
                ${s.guarda_max > 0 ? `<div class="det-calc-item">
                    <div class="det-calc-label">Guarda Dorada</div>
                    <div class="det-calc-xy">
                        ${estadoUI.esAdmin ? `<button class="ctrl-btn ctrl-btn-sm" onclick="window.modStat('${nombre}','guarda_actual',-1)">−</button>` : ''}
                        <span class="det-xy-x">${p.guarda_actual||0}</span><span class="det-xy-sep">/</span><span class="det-xy-y">${s.guarda_max}</span>
                        ${estadoUI.esAdmin ? `<button class="ctrl-btn ctrl-btn-sm" onclick="window.modStat('${nombre}','guarda_actual',1)">+</button>` : ''}
                    </div>
                    <div class="det-calc-formula">${formulas.guarda_max.expr}</div>
                </div>` : ''}
            </div>
        </div>

        <!-- Regeneración -->
        <div class="det-section">
            <div class="det-section-title">REGENERACIÓN / ${regenConfig.vex.intervalo}H</div>
            <div class="det-regen-row">
                <span>VEX</span>
                <span class="det-regen-val">+${s.regen_vex}</span>
            </div>
            ${s.guarda_max > 0 ? `<div class="det-regen-row">
                <span>Guarda</span>
                <span class="det-regen-val">+${s.regen_guarda}</span>
            </div>` : ''}
        </div>

        <!-- Afinidades -->
        <div class="det-section">
            <div class="det-section-title">AFINIDADES</div>
            ${afinRows}
        </div>

        ${estadoUI.esAdmin ? `
        <!-- HEX -->
        <div class="det-section">
            <div class="det-section-title">RECURSOS</div>
            <div class="det-stat-row">
                <span class="det-stat-label">HEX</span>
                <div class="det-stat-ctrl">
                    <button class="ctrl-btn" onclick="window.modStat('${nombre}','hex',-100)">−100</button>
                    <span class="det-stat-val">${(p.hex||0).toLocaleString()}</span>
                    <button class="ctrl-btn" onclick="window.modStat('${nombre}','hex',100)">+100</button>
                </div>
            </div>
        </div>` : ''}
    `;
}

// ─────────────────────────────────────────────────────────────
// VISTA DE FÓRMULAS (interactiva con pool de variables)
// ─────────────────────────────────────────────────────────────
export function renderFormulas() {
    const cont = document.getElementById('formulas-cont');
    if (!cont) return;

    // Pool de variables clickeables
    const poolHTML = `
        <div class="var-pool">
            <div class="var-pool-label">Variables disponibles — clic para insertar en la fórmula activa</div>
            <div class="var-pool-grid">
                ${VARS_FORMULA.map(v => `<button class="var-chip var-chip-${v.fuente}" onclick="window.insertarVar('${v.key}')" title="${v.label}">${v.key}</button>`).join('')}
            </div>
            <div class="var-pool-legend">
                <span class="var-chip var-chip-total legend-item">Total</span>
                <span class="var-chip var-chip-base legend-item">Base</span>
                <span class="var-chip var-chip-hechizos legend-item">Hechizos</span>
                <span style="color:var(--dim);font-size:0.75em;">· Operadores: + − * / Math.floor() Math.round() Math.ceil()</span>
            </div>
        </div>`;

    const formulasHTML = Object.entries(formulas).map(([key, f]) => `
        <div class="formula-item" id="fitem-${key}">
            <div class="formula-item-header">
                <span class="formula-item-label">${f.label}</span>
                <span class="formula-aplica tag tag-dim">${f.aplica}</span>
            </div>
            <div class="formula-input-row">
                <input class="formula-input" id="finput-${key}"
                    value="${f.expr}"
                    onfocus="window.setFormulaActiva('${key}')"
                    oninput="window.previsualizarFormula('${key}')">
                <select class="formula-aplica-sel" id="faplica-${key}" onchange="window.cambiarAplica('${key}',this.value)">
                    <option value="todos"       ${f.aplica==='todos'       ?'selected':''}>Todos</option>
                    <option value="jugador"     ${f.aplica==='jugador'     ?'selected':''}>Solo Jugadores</option>
                    <option value="npc_sistema" ${f.aplica==='npc_sistema' ?'selected':''}>NPC Sistema</option>
                </select>
            </div>
            <div class="formula-preview" id="fprev-${key}"></div>
        </div>
    `).join('');

    const regenHTML = Object.entries(regenConfig).map(([key, r]) => `
        <div class="formula-item">
            <div class="formula-item-header">
                <span class="formula-item-label">${r.label}</span>
                <div style="display:flex;gap:8px;align-items:center;">
                    <span class="formula-aplica tag tag-dim">cada</span>
                    <input type="number" id="regen-iv-${key}" value="${r.intervalo}" min="1" max="168"
                        class="formula-input" style="width:56px;text-align:center;"
                        oninput="window.cambiarRegenIv('${key}',this.value)">
                    <span class="formula-aplica tag tag-dim">horas</span>
                </div>
            </div>
            <div class="formula-input-row">
                <input class="formula-input" id="rinput-${key}"
                    value="${r.expr}"
                    onfocus="window.setFormulaActiva('regen_${key}')"
                    oninput="window.previsualizarRegen('${key}')">
            </div>
            <div class="formula-preview" id="rprev-${key}"></div>
        </div>
    `).join('');

    // Preview por personaje
    const pjOptions = Object.keys(personajes).map(n => `<option value="${n}">${n}</option>`).join('');

    cont.innerHTML = `
        ${poolHTML}

        <div class="formulas-block">
            <div class="formulas-block-title">Stats derivados de afinidades</div>
            ${formulasHTML}
            <div class="formula-actions">
                <button class="btn-secondary" onclick="window.resetFormulas()">Restaurar defaults</button>
                <button class="btn-primary" onclick="window.guardarFormulas()">Guardar fórmulas</button>
            </div>
        </div>

        <div class="formulas-block">
            <div class="formulas-block-title">Regeneración automática</div>
            <p class="formulas-help">Las mismas variables de afinidad están disponibles. Hz3, Hz4, Hz5 = hechizos clase 3/4/5 del personaje.</p>
            ${regenHTML}
            <div class="formula-actions">
                <button class="btn-secondary" onclick="window.ejecutarRegenManual()">Ejecutar ahora (todos los personajes)</button>
                <button class="btn-primary" onclick="window.guardarRegen()">Guardar regeneración</button>
            </div>
        </div>

        <div class="formulas-block">
            <div class="formulas-block-title">Preview por personaje</div>
            <select id="preview-pj-sel" class="input-base" onchange="window.actualizarPreviewPJ()" style="margin-bottom:12px;width:280px;">
                <option value="">— Seleccionar personaje —</option>
                ${pjOptions}
            </select>
            <div id="preview-resultado" class="preview-box"></div>
        </div>
    `;

    // Inicializar previews con primer personaje
    const primero = Object.keys(personajes)[0];
    if (primero) {
        Object.keys(formulas).forEach(key => previsualizarFormulaConPJ(key, primero));
        Object.keys(regenConfig).forEach(key => previsualizarRegenConPJ(key, primero));
    }
}

export function previsualizarFormulaConPJ(key, nombrePJ) {
    const pj = personajes[nombrePJ];
    const el = document.getElementById(`fprev-${key}`);
    if (!el || !pj) return;
    const expr = document.getElementById(`finput-${key}`)?.value || formulas[key]?.expr || '';
    const ctx  = buildContext(pj);
    const val  = evalExpr(expr, ctx);
    el.innerHTML = `<span class="prev-pj">${nombrePJ}</span> → <strong>${val}</strong>`;
    el.classList.remove('prev-error');
}

export function previsualizarRegenConPJ(key, nombrePJ) {
    const pj = personajes[nombrePJ];
    const el = document.getElementById(`rprev-${key}`);
    if (!el || !pj) return;
    const expr = document.getElementById(`rinput-${key}`)?.value || regenConfig[key]?.expr || '';
    const ctx  = buildContext(pj);
    const val  = evalExpr(expr, ctx);
    el.innerHTML = `<span class="prev-pj">${nombrePJ}</span> → <strong>+${val}</strong> / ${regenConfig[key]?.intervalo || 12}h`;
}

export function renderPreviewCompleto(nombrePJ) {
    const el = document.getElementById('preview-resultado');
    if (!el) return;
    const pj = personajes[nombrePJ];
    if (!pj) { el.innerHTML = ''; return; }
    const ctx = buildContext(pj);
    const s   = calcularStats(pj);

    const lineas = [
        ...Object.entries(formulas).map(([k, f]) => {
            const v = evalExpr(f.expr, ctx);
            return `<div class="prev-line"><span class="prev-label">${f.label}</span><span class="prev-val">${v}</span><code class="prev-expr">${f.expr}</code></div>`;
        }),
        `<div class="prev-separator"></div>`,
        ...Object.entries(regenConfig).map(([k, r]) => {
            const v = evalExpr(r.expr, ctx);
            return `<div class="prev-line"><span class="prev-label">${r.label}</span><span class="prev-val">+${v} / ${r.intervalo}h</span><code class="prev-expr">${r.expr}</code></div>`;
        })
    ];

    el.innerHTML = lineas.join('');
}
