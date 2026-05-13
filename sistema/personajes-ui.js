// ============================================================
// personajes-ui.js — Renderizado de todas las vistas
// /personajes/personajes-ui.js
// ============================================================

import { AFINIDADES, VARS_FORMULA, personajes, estadoUI, formulas,
         pushFormulas, pushUmbrales, pushCooldown } from './personajes-state.js';
import { calcularStats, getMayorAfinidad, buildContext, evalExpr,
         calcularPushDisponibles, calcularValorPush, calcularCooldownPush } from './personajes-logic.js';
import { currentConfig } from '../hex-auth.js';

// ── Helpers de imagen ─────────────────────────────────────────
const _storageBase = currentConfig.storageUrl;

function _norm(s) {
    return s.toString().trim().toLowerCase()
        .replace(/[áàäâ]/g,'a').replace(/[éèëê]/g,'e').replace(/[íìïî]/g,'i')
        .replace(/[óòöô]/g,'o').replace(/[úùüû]/g,'u').replace(/[ñ]/g,'n')
        .replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,'');
}

function _imgUrl(icono) {
    const key = _norm(icono);
    return `${_storageBase}/imgpersonajes/${key}.png`;
}
function _imgIconUrl(icono) {
    const key = _norm(icono);
    return `${_storageBase}/imgpersonajes/${key}icon.png`;
}
const _imgFallback = `${_storageBase}/imginterfaz/no_encontrado.png`;

// ─────────────────────────────────────────────────────────────
// BARRA SEGMENTADA DE VIDA
// Genera celdas individuales que representan puntos de vida.
// Máximo 30 celdas; si max > 30, agrupa múltiples HP por celda.
// ─────────────────────────────────────────────────────────────
function _barraSegmentada(actual, max, tipo, maxCells = 28) {
    if (!max || max <= 0) return `<div class="seg-bar-wrap"></div>`;
    const n = Math.min(maxCells, max); // si max <= maxCells → 1 celda por HP
    const hpPorCelda = max / n;
    const isOver = actual > max;
    let cells = '';
    for (let i = 0; i < n; i++) {
        const umbral = hpPorCelda * i;
        const filled = actual > umbral;
        cells += `<span class="seg-cell seg-${tipo} ${filled ? 'seg-on' : 'seg-off'}"></span>`;
    }
    return `<div class="seg-bar-wrap${isOver ? ' seg-over' : ''}" title="${actual}/${max}">${cells}</div>`;
}

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
        const safe  = nombre.replace(/'/g, "\\'");

        const pctVex = s.vex_max > 0 ? Math.min(100, Math.round((p.vex_actual||0) / s.vex_max * 100)) : 0;
        const hex    = p.hex || 0;

        // ── Push indicators ──────────────────────────────────
        const pushVexDisp    = calcularPushDisponibles(p, s, 'vex');
        const pushGuardaDisp = calcularPushDisponibles(p, s, 'guarda');
        const pushVexUsados  = p.push_vex_actual    || 0;
        const pushGuardaUsados = p.push_guarda_actual || 0;

        const pushHtml = (s.vex_max > 0 || s.guarda_max > 0) ? `
            <div class="pjc-pushes">
                ${s.vex_max > 0 ? `<span class="pjc-push pjc-push-vex" title="Relleno VEX">⚡ ${pushVexUsados}/${pushVexDisp}</span>` : ''}
                ${s.guarda_max > 0 ? `<span class="pjc-push pjc-push-gua" title="Relleno Guarda">🛡 ${pushGuardaUsados}/${pushGuardaDisp}</span>` : ''}
            </div>` : '';

        // ── VEX bar ───────────────────────────────────────────
        const vexHtml = s.vex_max > 0 ? `
            <div class="pjc-vex-row">
                <span class="pjc-vex-label">VEX</span>
                <div class="pjc-vex-track"><div class="pjc-vex-fill" style="width:${pctVex}%"></div></div>
                <span class="pjc-vex-val">${Math.floor(p.vex_actual||0)}<span class="pjc-sep">/</span>${s.vex_max}</span>
            </div>` : '';

        // ── HEX display ───────────────────────────────────────
        const hexK = hex >= 1000 ? (hex/1000).toFixed(hex%1000===0?0:1)+'k' : hex.toString();
        const hexGlow = hex > 2000 ? '#f0cc40' : hex > 500 ? '#d4af37' : '#a8881e';

        // ── Collapsed detail section ──────────────────────────
        const maxAfin = Math.max(1, ...AFINIDADES.map(a =>
            (p.afin_base?.[a.key]||p.afinidadesBase?.[a.key]||0)
            +(p.afin_hcz?.[a.key]||0)
            +(p.afinidadesBf?.[a.key]||0)
            +(p.afinidadesEf?.[a.key]||0)
        ));
        const afinBars = AFINIDADES.map(a => {
            const base  = p.afin_base?.[a.key]   || p.afinidadesBase?.[a.key] || 0;
            const hz    = p.afin_hcz?.[a.key]    || 0;
            const extra = p.afinidadesBf?.[a.key] || 0;
            const alter = p.afinidadesEf?.[a.key] || 0;
            const total = base + hz + extra + alter;
            const esMayor = mayor?.key === a.key;
            const tip = `Total: ${total}  ·  B: ${base}  ·  Hz: ${hz}  ·  Ext: ${extra>=0?'+':''}${extra}  ·  Alt: ${alter>=0?'+':''}${alter}`;
            const pBase  = total > 0 ? (base  / maxAfin * 100) : 0;
            const pHz    = total > 0 ? (hz    / maxAfin * 100) : 0;
            const pExtra = total > 0 ? (extra / maxAfin * 100) : 0;
            const pAlter = total > 0 ? (alter / maxAfin * 100) : 0;
            const segBar = `<div class="pjc-afin-track pjc-afin-seg" title="${tip}">`
                + (pBase  > 0 ? `<div class="pjc-seg pjc-seg-b"   style="width:${pBase.toFixed(1)}%"></div>`  : '')
                + (pHz    > 0 ? `<div class="pjc-seg pjc-seg-hz"  style="width:${pHz.toFixed(1)}%"></div>`   : '')
                + (pExtra > 0 ? `<div class="pjc-seg pjc-seg-ext" style="width:${pExtra.toFixed(1)}%"></div>` : '')
                + (pAlter > 0 ? `<div class="pjc-seg pjc-seg-alt" style="width:${pAlter.toFixed(1)}%"></div>` : '')
                + (total === 0 ? `<div class="pjc-seg pjc-seg-empty" style="width:100%"></div>` : '')
                + `</div>`;
            return `<div class="pjc-afin-row" title="${tip}">
                <span class="pjc-afin-lbl ${esMayor?'pjc-afin-mayor':''}">${a.abr}</span>
                ${segBar}
                <span class="pjc-afin-val ${esMayor?'pjc-afin-mayor':''}">${total}</span>
            </div>`;
        }).join('');

        const vidaRoja   = _barraSegmentada(p.vida_roja_actual||0, s.vida_roja_max, 'vida', 24);
        const vidaAzul   = s.vida_azul_total > 0 ? _barraSegmentada(Math.min(s.vida_azul_total, 60), 60, 'azul', 20) : null;
        const guardaBarra = s.guarda_max > 0 ? _barraSegmentada(p.guarda_actual||0, s.guarda_max, 'guarda', 20) : null;

        const detailHtml = `
            <div class="pjc-detail" id="pjc-detail-${safe}">
                <div class="pjc-vida-row">
                    <span class="pjc-vida-lbl" style="color:#c8404a;">Vida</span>
                    ${vidaRoja}
                    <span class="pjc-vida-xy">${p.vida_roja_actual||0}<span class="pjc-sep">/</span>${s.vida_roja_max}</span>
                </div>
                ${vidaAzul ? `<div class="pjc-vida-row">
                    <span class="pjc-vida-lbl" style="color:#4ab3e8;">Azul</span>
                    ${vidaAzul}
                    <span class="pjc-vida-xy" style="color:#4ab3e8;">${s.vida_azul_total}</span>
                </div>` : ''}
                ${guardaBarra ? `<div class="pjc-vida-row">
                    <span class="pjc-vida-lbl" style="color:var(--gold-dim);">Guarda</span>
                    ${guardaBarra}
                    <span class="pjc-vida-xy">${p.guarda_actual||0}<span class="pjc-sep">/</span>${s.guarda_max}</span>
                </div>` : ''}
                <div class="pjc-afin-section">${afinBars}</div>
            </div>`;

        const canDelete = estadoUI.esAdmin;

        return `<div class="pj-card pjc-new ${!p.isActive?'pj-inactivo':''}" onclick="window.abrirDetalle('${safe}')">

            <div class="pjc-header">
                <div class="pjc-avatar">
                    <img src="${_imgIconUrl(p.iconoOverride || nombre)}"
                         onerror="this.style.display='none';this.nextElementSibling.style.display='flex';"
                         style="width:100%;height:100%;border-radius:50%;object-fit:cover;object-position:top;display:block;">
                    <span style="display:none;width:100%;height:100%;align-items:center;justify-content:center;font-family:var(--font-display);font-size:1.1em;color:var(--gold-dim);">${nombre[0]}</span>
                </div>
                <div class="pjc-info">
                    <div class="pjc-name">${nombre}</div>
                    <div class="pjc-tags">
                        <span class="tag ${p.isPlayer ? 'tag-jugador' : 'tag-npc'}">${p.isPlayer ? 'Jugador' : 'NPC'}</span>
                        ${!p.isPlayer ? `<span class="tag tag-dim">${p.npc_tipo==='jugador'?'T.Jug':'Sis'}</span>` : ''}
                    </div>
                </div>
                <div class="pjc-actions" onclick="event.stopPropagation()">
                    ${estadoUI.esAdmin||!p.isPlayer ? `<button class="icon-btn icon-btn-img" onclick="window.abrirSubirImagen('${safe}')">🖼</button>` : ''}
                    ${canDelete ? `<button class="icon-btn icon-btn-danger" onclick="window.pedirDelete('${safe}')">✕</button>` : ''}
                </div>
            </div>

            ${vexHtml}
            ${pushHtml}

            <div class="pjc-hex-bar">
                <svg class="pjc-hex-mini" viewBox="0 0 20 18" style="color:${hexGlow}">
                    <polygon points="10,1 18.5,5.5 18.5,12.5 10,17 1.5,12.5 1.5,5.5"
                        fill="rgba(212,175,55,0.06)" stroke="currentColor" stroke-width="1.2"/>
                    <polygon points="10,4 15.5,7 15.5,11 10,14 4.5,11 4.5,7"
                        fill="none" stroke="currentColor" stroke-width="0.6" opacity="0.4"/>
                </svg>
                <span class="pjc-hex-num" style="color:${hexGlow};">${hexK}</span>
                <span class="pjc-hex-lbl">HEX</span>
                <button class="pjc-expand-btn" onclick="event.stopPropagation();window._pjcToggle('${safe}')" title="Ver stats">
                    <span id="pjc-arrow-${safe}" class="pjc-arrow">▾</span>
                </button>
            </div>

            ${detailHtml}

        </div>`;
    }).join('');
}

// Toggle detail panel
window._pjcToggle = (nombre) => {
    const det = document.getElementById(`pjc-detail-${nombre}`);
    const arrow = document.getElementById(`pjc-arrow-${nombre}`);
    if (!det) return;
    const open = det.classList.toggle('open');
    if (arrow) arrow.textContent = open ? '▴' : '▾';
};

// ─────────────────────────────────────────────────────────────
// PANEL LATERAL DE DETALLE
// ─────────────────────────────────────────────────────────────

export function renderFormulas() {
    const cont = document.getElementById('formulas-cont');
    if (!cont) return;

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

    const _ro = !estadoUI.esAdmin;  // readonly para no-OP
    const formulasHTML = Object.entries(formulas).map(([key, f]) => `
        <div class="formula-item" id="fitem-${key}">
            <div class="formula-item-header">
                <span class="formula-item-label">${f.label}</span>
                <span class="formula-aplica tag tag-dim">${f.aplica}</span>
            </div>
            <div class="formula-input-row">
                <input class="formula-input${_ro?' formula-input-ro':''}" id="finput-${key}"
                    value="${f.expr}"
                    ${_ro ? 'readonly tabindex="-1"' : `onfocus="window.setFormulaActiva('${key}')" oninput="window.previsualizarFormula('${key}')"`}>
                <select class="formula-aplica-sel" id="faplica-${key}"
                    ${_ro ? 'disabled' : `onchange="window.cambiarAplica('${key}',this.value)"`}>
                    <option value="todos"       ${f.aplica==='todos'       ?'selected':''}>Todos</option>
                    <option value="jugador"     ${f.aplica==='jugador'     ?'selected':''}>Solo Jugadores</option>
                    <option value="npc_sistema" ${f.aplica==='npc_sistema' ?'selected':''}>NPC Sistema</option>
                </select>
            </div>
            <div class="formula-preview" id="fprev-${key}"></div>
        </div>
    `).join('');

    const pushFormsHTML = Object.entries(pushFormulas).map(([key, f]) => `
        <div class="formula-item">
            <div class="formula-item-header">
                <span class="formula-item-label">${f.label}</span>
            </div>
            <div class="formula-item-desc">${f.descripcion || ''}</div>
            <div class="formula-input-row">
                <input class="formula-input${_ro?' formula-input-ro':''}" id="pinput-${key}"
                    value="${f.expr}"
                    ${_ro ? 'readonly tabindex="-1"' : `onfocus="window.setFormulaActiva('${key}')" oninput="window.previsualizarPushFormula('${key}')"`}>
            </div>
            <div class="formula-preview" id="pprev-${key}"></div>
        </div>
    `).join('');

    const cooldownHTML = `
        <div class="formula-item">
            <div class="formula-item-header">
                <span class="formula-item-label">Cooldowns entre rellenos</span>
            </div>
            <div class="push-cooldown-grid">
                <div class="push-cd-field">
                    <label>VEX (minutos)</label>
                    <input type="number" id="push-cooldown-vex" class="formula-input${_ro?' formula-input-ro':''}" style="width:80px;"
                        value="${pushCooldown.vex}" min="1" ${_ro?'readonly tabindex="-1"':''}>
                </div>
                <div class="push-cd-field">
                    <label>Guarda (minutos)</label>
                    <input type="number" id="push-cooldown-guarda" class="formula-input${_ro?' formula-input-ro':''}" style="width:80px;"
                        value="${pushCooldown.guarda}" min="1" ${_ro?'readonly tabindex="-1"':''}>
                </div>
            </div>
        </div>`;

    const _umbralesHtml = (recurso, label) => `
        <div class="formula-item">
            <div class="formula-item-header">
                <span class="formula-item-label">Umbrales — ${label}</span>
${!_ro ? `<button class="btn-ghost btn-ghost-xs" onclick="window.agregarUmbral('${recurso}')">+ Añadir</button>` : ''}
            </div>
            <div class="umbral-help">
                Variables disponibles en condición: <code>pct_vida_roja</code> (0–100), <code>vida_azul</code> (valor absoluto máx calculado)
            </div>
            <div id="umbrales-${recurso}">
                ${(pushUmbrales[recurso] || []).map((u, idx) => `
                    <div class="umbral-row" data-umbral-idx="${idx}">
                        <input class="formula-input umbral-desc${_ro?' formula-input-ro':''}" data-campo="descripcion"
                            value="${u.descripcion}" placeholder="Descripción" ${_ro?'readonly tabindex="-1"':''}>
                        <input class="formula-input umbral-cond${_ro?' formula-input-ro':''}" data-campo="condicion"
                            value="${u.condicion}" placeholder="condición JS" ${_ro?'readonly tabindex="-1"':''}>
                        <input type="number" class="formula-input umbral-pushes${_ro?' formula-input-ro':''}" data-campo="pushes"
                            value="${u.pushes}" min="1" style="width:56px;" title="Rellenos otorgados" ${_ro?'readonly tabindex="-1"':''}>
${!_ro ? `<button class="ctrl-btn ctrl-btn-xs icon-btn-danger"
                            onclick="window.eliminarUmbral('${recurso}',${idx})">✕</button>` : ''}
                    </div>
                `).join('')}
            </div>
        </div>`;

    const pjOptions = Object.keys(personajes).map(n => `<option value="${n}">${n}</option>`).join('');

    if (!document.getElementById('formula-ro-styles')) {
        const s = document.createElement('style');
        s.id = 'formula-ro-styles';
        s.textContent = '.formula-input-ro{opacity:0.6;cursor:default;background:rgba(255,255,255,0.02)!important;border-color:rgba(255,255,255,0.06)!important;color:#999!important;pointer-events:none;user-select:text;} .formula-ro-banner{display:flex;align-items:center;gap:8px;padding:8px 14px;margin-bottom:16px;background:rgba(212,175,55,0.06);border:1px solid rgba(212,175,55,0.15);border-radius:7px;font-size:0.72em;color:#7a6a30;}';
        document.head.appendChild(s);
    }

    cont.innerHTML = `
        ${estadoUI.esAdmin ? poolHTML : ""}
        ${!estadoUI.esAdmin ? '<div class="formula-ro-banner">🔒 Vista de solo lectura — solo el OP puede editar las fórmulas</div>' : ''}

        <div class="formulas-block">
            <div class="formulas-block-title">Stats derivados de afinidades</div>
            ${formulasHTML}
            ${!estadoUI.esAdmin ? '' : `<div class="formula-actions"><button class="btn-secondary" onclick="window.resetFormulas()">Restaurar defaults</button><button class="btn-primary" onclick="window.guardarFormulas()">Guardar fórmulas</button></div>`}
        </div>

        <div class="formulas-block">
            <div class="formulas-block-title">Sistema Relleno — Recuperación activa</div>
            <p class="formulas-help">
                Los rellenos permiten recuperar VEX o Guarda al instante, con cooldown entre cada uno.
                El número de rellenos disponibles depende del estado de vida del personaje (umbrales configurables abajo).
                El OP puede además asignar rellenos extra individuales desde el panel del personaje.
            </p>
            ${pushFormsHTML}
            ${cooldownHTML}
            ${!estadoUI.esAdmin ? '' : `<div class="formula-actions"><button class="btn-primary" onclick="window.guardarPushConfig()">Guardar fórmulas relleno</button></div>`}
        </div>

        <div class="formulas-block">
            <div class="formulas-block-title">Umbrales de rellenos disponibles</div>
            <p class="formulas-help">
                Cada umbral otorga N rellenos adicionales cuando la condición se cumple.
                Se evalúan todos y se suman. Un personaje con vida alta obtiene más rellenos que uno malherido.
            </p>
            ${_umbralesHtml('vex', 'VEX')}
            ${_umbralesHtml('guarda', 'Guarda Dorada')}
            ${!estadoUI.esAdmin ? '' : `<div class="formula-actions"><button class="btn-primary" onclick="window.guardarPushUmbrales()">Guardar umbrales</button></div>`}
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

    const primero = Object.keys(personajes)[0];
    if (primero) {
        Object.keys(formulas).forEach(key => previsualizarFormulaConPJ(key, primero));
        Object.keys(pushFormulas).forEach(key => window.previsualizarPushFormula(key));
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
        ...Object.entries(pushFormulas).map(([k, f]) => {
            const v = evalExpr(f.expr, ctx);
            return `<div class="prev-line"><span class="prev-label">${f.label}</span><span class="prev-val">+${v} / relleno</span><code class="prev-expr">${f.expr}</code></div>`;
        }),
        `<div class="prev-separator"></div>`,
        `<div class="prev-line"><span class="prev-label">Rellenos VEX disponibles</span><span class="prev-val">${calcularPushDisponibles(pj, s, 'vex')}</span></div>`,
        `<div class="prev-line"><span class="prev-label">Rellenos Guarda disponibles</span><span class="prev-val">${calcularPushDisponibles(pj, s, 'guarda')}</span></div>`
    ];

    el.innerHTML = lineas.join('');
}
