// ============================================================
// personajes-ui.js — Renderizado de todas las vistas
// /personajes/personajes-ui.js
// ============================================================

import { AFINIDADES, VARS_FORMULA, personajes, estadoUI, formulas,
         pushFormulas, pushUmbrales, pushCooldown } from './personajes-state.js';
import { calcularStats, getMayorAfinidad, buildContext, evalExpr,
         calcularPushDisponibles, calcularValorPush, calcularCooldownPush } from './personajes-logic.js';

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

        const pctVida   = s.vida_roja_max > 0 ? Math.min(100, Math.round(p.vida_roja_actual / s.vida_roja_max * 100)) : 0;
        const pctVex    = s.vex_max > 0 ? Math.min(100, Math.round(p.vex_actual / s.vex_max * 100)) : 0;
        const pctGuarda = s.guarda_max > 0 ? Math.min(100, Math.round((p.guarda_actual||0) / s.guarda_max * 100)) : 0;

        const maxAfin = Math.max(1, ...AFINIDADES.map(a =>
            (p.afinidadesBase?.[a.key]||0)+(p.afinidadesHz?.[a.key]||0)+(p.afinidadesEf?.[a.key]||0)+(p.afinidadesBf?.[a.key]||0)
        ));

        const barras = AFINIDADES.map(a => {
            const base = p.afinidadesBase?.[a.key] || 0;
            const bf   = p.afinidadesBf?.[a.key]   || 0;
            const ef   = p.afinidadesEf?.[a.key]   || 0;
            const hz   = p.afinidadesHz?.[a.key]   || 0;
            const total = base + bf + ef + hz;
            const esMayor = mayor && mayor.key === a.key;
            const pBase = Math.round(base / maxAfin * 100);
            const pBf   = Math.round(bf   / maxAfin * 100);
            const pEf   = Math.round(ef   / maxAfin * 100);
            const pHz   = Math.round(hz   / maxAfin * 100);
            return `<div class="afin-bar-row">
                <span class="afin-bar-label ${esMayor ? 'mayor' : ''}">${a.abr}</span>
                <div class="afin-bar-track">
                    <div class="afin-seg afin-seg-base" style="width:${pBase}%" title="Base: ${base}"></div>
                    <div class="afin-seg afin-seg-bf"   style="width:${pBf}%"   title="Buff: ${bf}"></div>
                    <div class="afin-seg afin-seg-ef"   style="width:${pEf}%"   title="Alt: ${ef}"></div>
                    <div class="afin-seg afin-seg-hz"   style="width:${pHz}%"   title="Hz: ${hz}"></div>
                </div>
                <span class="afin-bar-val ${esMayor ? 'val-gold' : ''}">${total}</span>
            </div>`;
        }).join('');

        const esInactivo = !p.isActive;
        const canEdit    = estadoUI.esAdmin || !p.isPlayer;
        const canDelete  = estadoUI.esAdmin;

        // Mini push indicador en tarjeta
        const pushVexDisp    = calcularPushDisponibles(p, s, 'vex');
        const pushGuardaDisp = calcularPushDisponibles(p, s, 'guarda');
        const pushVexUsados    = p.push_vex_actual    || 0;
        const pushGuardaUsados = p.push_guarda_actual || 0;

        const pushIndicadores = (s.vex_max > 0 || s.guarda_max > 0) ? `
            <div class="push-mini">
                ${s.vex_max > 0 ? `<span class="push-mini-item push-mini-vex" title="Push VEX">⚡ ${pushVexUsados}/${pushVexDisp}</span>` : ''}
                ${s.guarda_max > 0 ? `<span class="push-mini-item push-mini-guarda" title="Push Guarda">🛡 ${pushGuardaUsados}/${pushGuardaDisp}</span>` : ''}
            </div>` : '';

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
                <div class="pj-card-actions" onclick="event.stopPropagation()">
                    ${canEdit   ? `<button class="icon-btn" onclick="window.editarPersonaje('${nombre.replace(/'/g,"\\'")}')">✎</button>` : ''}
                    ${canDelete ? `<button class="icon-btn icon-btn-danger" onclick="window.pedirDelete('${nombre.replace(/'/g,"\\'")}')">✕</button>` : ''}
                </div>
            </div>

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
                    <span class="recurso-xy">${Math.floor(p.vex_actual)}<span class="xy-sep">/</span>${s.vex_max}</span>
                </div>` : ''}
                ${s.guarda_max > 0 ? `<div class="recurso-row">
                    <span class="recurso-label">Guarda</span>
                    <div class="recurso-bar-track">
                        <div class="recurso-bar-fill fill-guarda" style="width:${pctGuarda}%"></div>
                    </div>
                    <span class="recurso-xy">${Math.floor(p.guarda_actual||0)}<span class="xy-sep">/</span>${s.guarda_max}</span>
                </div>` : ''}
            </div>

            ${pushIndicadores}
            <div class="afin-section">${barras}</div>
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

    const canEditPlayer = estadoUI.esAdmin;
    const canEditThis   = estadoUI.esAdmin || !p.isPlayer;

    const afinRows = AFINIDADES.map(a => {
        const base = p.afinidadesBase?.[a.key] || 0;
        const hz   = p.afinidadesHz?.[a.key]   || 0;
        const ef   = p.afinidadesEf?.[a.key]   || 0;
        const bf   = p.afinidadesBf?.[a.key]   || 0;
        const total = base + hz + ef + bf;
        const safeNombre = nombre.replace(/'/g,"\\'");
        const canBase = estadoUI.esAdmin;
        const canMod  = canEditThis;
        return `<div class="det-afin-block">
            <div class="det-afin-header">
                <span class="det-stat-label">${a.label}</span>
                <span class="det-afin-total">${total}</span>
            </div>
            <div class="det-afin-source">
                <span class="det-afin-src-label src-base" title="Base">B</span>
                ${canBase ? `<button class="ctrl-btn ctrl-btn-xs" onclick="window.modAfin('${safeNombre}','${a.key}',-1)">−</button>` : ''}
                <span class="det-afin-src-val">${base}</span>
                ${canBase ? `<button class="ctrl-btn ctrl-btn-xs" onclick="window.modAfin('${safeNombre}','${a.key}',1)">+</button>` : ''}
            </div>
            <div class="det-afin-source">
                <span class="det-afin-src-label src-bf" title="Buff">Bf</span>
                ${canMod ? `<button class="ctrl-btn ctrl-btn-xs" onclick="window.modBf('${safeNombre}','${a.key}',-1)">−</button>` : ''}
                <span class="det-afin-src-val">${bf > 0 ? '+' : ''}${bf}</span>
                ${canMod ? `<button class="ctrl-btn ctrl-btn-xs" onclick="window.modBf('${safeNombre}','${a.key}',1)">+</button>` : ''}
            </div>
            <div class="det-afin-source">
                <span class="det-afin-src-label src-ef" title="Alteración">Alt</span>
                ${canMod ? `<button class="ctrl-btn ctrl-btn-xs" onclick="window.modEf('${safeNombre}','${a.key}',-1)">−</button>` : ''}
                <span class="det-afin-src-val">${ef > 0 ? '+' : ''}${ef}</span>
                ${canMod ? `<button class="ctrl-btn ctrl-btn-xs" onclick="window.modEf('${safeNombre}','${a.key}',1)">+</button>` : ''}
            </div>
            ${hz !== 0 ? `<div class="det-afin-source">
                <span class="det-afin-src-label src-hz" title="Hechizos">Hz</span>
                <span class="det-afin-src-val">${hz > 0 ? '+' : ''}${hz}</span>
            </div>` : ''}
        </div>`;
    }).join('');

    const safeN = nombre.replace(/'/g,"\\'");

    // ── Sección PUSH ──────────────────────────────────────────
    const pushHTML = _renderPushSection(p, s, nombre, canEditThis);

    document.getElementById('panel-nombre').textContent = nombre;
    document.getElementById('panel-body').innerHTML = `
        <!-- Stats calculados -->
        <div class="det-section">
            <div class="det-section-title">STATS CALCULADOS</div>
            <div class="det-calc-grid">
                <div class="det-calc-item">
                    <div class="det-calc-label">Vida Roja</div>
                    <div class="det-calc-xy">
                        ${canEditThis ? `<button class="ctrl-btn ctrl-btn-sm" onclick="window.modStat('${safeN}','vida_roja_actual',-1)">−</button>` : ''}
                        <span class="det-xy-x">${p.vida_roja_actual}</span><span class="det-xy-sep">/</span><span class="det-xy-y">${s.vida_roja_max}</span>
                        ${canEditThis ? `<button class="ctrl-btn ctrl-btn-sm" onclick="window.modStat('${safeN}','vida_roja_actual',1)">+</button>` : ''}
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
                        ${canEditThis ? `<button class="ctrl-btn ctrl-btn-sm" onclick="window.modStat('${safeN}','vex_actual',-50)">−50</button>` : ''}
                        <span class="det-xy-x">${Math.floor(p.vex_actual)}</span><span class="det-xy-sep">/</span><span class="det-xy-y">${s.vex_max}</span>
                        ${canEditThis ? `<button class="ctrl-btn ctrl-btn-sm" onclick="window.modStat('${safeN}','vex_actual',50)">+50</button>` : ''}
                    </div>
                    <div class="det-calc-formula">${esJugador ? formulas.vex_max.expr : 'Fijo (NPC sistema)'}</div>
                </div>
                ${s.guarda_max > 0 ? `<div class="det-calc-item">
                    <div class="det-calc-label">Guarda Dorada</div>
                    <div class="det-calc-xy">
                        ${canEditThis ? `<button class="ctrl-btn ctrl-btn-sm" onclick="window.modStat('${safeN}','guarda_actual',-1)">−</button>` : ''}
                        <span class="det-xy-x">${Math.floor(p.guarda_actual||0)}</span><span class="det-xy-sep">/</span><span class="det-xy-y">${s.guarda_max}</span>
                        ${canEditThis ? `<button class="ctrl-btn ctrl-btn-sm" onclick="window.modStat('${safeN}','guarda_actual',1)">+</button>` : ''}
                    </div>
                    <div class="det-calc-formula">${formulas.guarda_max.expr}</div>
                </div>` : ''}
            </div>
        </div>

        <!-- Sistema Push -->
        ${pushHTML}

        <!-- Afinidades -->
        <div class="det-section">
            <div class="det-section-title">AFINIDADES
                <span class="afin-leyenda">
                    <span class="ley-dot src-base-dot">B</span>base&nbsp;
                    <span class="ley-dot src-bf-dot">Bf</span>buff&nbsp;
                    <span class="ley-dot src-ef-dot">Alt</span>alt&nbsp;
                    <span class="ley-dot src-hz-dot">Hz</span>hz
                </span>
            </div>
            ${afinRows}
        </div>

        ${canEditThis ? `
        <!-- Recursos -->
        <div class="det-section">
            <div class="det-section-title">RECURSOS</div>
            <div class="det-stat-row">
                <span class="det-stat-label">HEX</span>
                <div class="det-stat-ctrl">
                    <button class="ctrl-btn" onclick="window.modStat('${safeN}','hex',-100)">−100</button>
                    <span class="det-stat-val">${(p.hex||0).toLocaleString()}</span>
                    <button class="ctrl-btn" onclick="window.modStat('${safeN}','hex',100)">+100</button>
                </div>
            </div>
        </div>` : ''}
    `;
}

// ── Render de la sección Push dentro del panel ─────────────────
function _renderPushSection(p, s, nombre, canEdit) {
    const safeN = nombre.replace(/'/g,"\\'");

    const _pushBloque = (recurso, label, emoji, hasMax) => {
        if (!hasMax) return '';

        const disponibles = calcularPushDisponibles(p, s, recurso);
        const usados      = recurso === 'vex' ? (p.push_vex_actual || 0) : (p.push_guarda_actual || 0);
        const restantes   = Math.max(0, disponibles - usados);
        const valorPush   = calcularValorPush(p, recurso);
        const cd          = calcularCooldownPush(p, recurso);
        const limitExtra  = recurso === 'vex' ? (p.push_vex_limit || 0) : (p.push_guarda_limit || 0);

        // Indicador visual de pushes (puntos)
        const dots = Array.from({ length: disponibles }, (_, i) =>
            `<span class="push-dot ${i < usados ? 'push-dot-used' : 'push-dot-avail'}"></span>`
        ).join('');

        // Cooldown display
        let cdInfo = '';
        if (!cd.disponible) {
            const min = Math.ceil(cd.restaSeg / 60);
            const seg = cd.restaSeg % 60;
            cdInfo = `<span class="push-cd">⏳ ${min}m ${seg}s</span>`;
        }

        return `<div class="push-bloque">
            <div class="push-bloque-header">
                <span class="push-bloque-label">${emoji} ${label}</span>
                <span class="push-dots">${dots}${cdInfo}</span>
                <span class="push-counter">${usados}/${disponibles}</span>
            </div>
            <div class="push-bloque-info">
                <span class="push-valor">+${valorPush} por push</span>
                ${restantes > 0 && cd.disponible ? `
                    <button class="btn-push ${canEdit ? '' : ''}"
                        onclick="window.ejecutarPush('${safeN}','${recurso}')">
                        Push ${label}
                    </button>` : `
                    <button class="btn-push btn-push-disabled" disabled>
                        ${!cd.disponible ? 'En cooldown' : 'Sin pushes'}
                    </button>`}
            </div>
            ${estadoUI.esAdmin ? `
            <div class="push-admin-row">
                <span class="push-admin-label">Extra OP</span>
                <button class="ctrl-btn ctrl-btn-xs" onclick="window.modPushExtra('${safeN}','${recurso}',-1)">−</button>
                <span class="push-admin-val">${limitExtra}</span>
                <button class="ctrl-btn ctrl-btn-xs" onclick="window.modPushExtra('${safeN}','${recurso}',1)">+</button>
                <button class="ctrl-btn ctrl-btn-xs push-reset-btn"
                    onclick="window.resetPushes('${safeN}','${recurso}')">Reset</button>
            </div>` : ''}
        </div>`;
    };

    const vexHTML    = _pushBloque('vex',    'VEX',    '⚡', s.vex_max > 0);
    const guardaHTML = _pushBloque('guarda', 'Guarda', '🛡', s.guarda_max > 0);

    if (!vexHTML && !guardaHTML) return '';

    return `<div class="det-section">
        <div class="det-section-title">PUSHES
            ${estadoUI.esAdmin ? `<button class="btn-ghost btn-ghost-xs"
                onclick="window.resetPushes('${safeN}','ambos')">Reset todos</button>` : ''}
        </div>
        <div class="push-help">Un push recupera recurso al instante. Los pushes disponibles dependen del estado de vida del personaje.</div>
        ${vexHTML}
        ${guardaHTML}
    </div>`;
}

// ─────────────────────────────────────────────────────────────
// VISTA DE FÓRMULAS (solo OP)
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

    // ── Push fórmulas ──────────────────────────────────────────
    const pushFormsHTML = Object.entries(pushFormulas).map(([key, f]) => `
        <div class="formula-item">
            <div class="formula-item-header">
                <span class="formula-item-label">${f.label}</span>
            </div>
            <div class="formula-item-desc">${f.descripcion || ''}</div>
            <div class="formula-input-row">
                <input class="formula-input" id="pinput-${key}"
                    value="${f.expr}"
                    onfocus="window.setFormulaActiva('${key}')"
                    oninput="window.previsualizarPushFormula('${key}')">
            </div>
            <div class="formula-preview" id="pprev-${key}"></div>
        </div>
    `).join('');

    // ── Cooldowns ──────────────────────────────────────────────
    const cooldownHTML = `
        <div class="formula-item">
            <div class="formula-item-header">
                <span class="formula-item-label">Cooldowns entre pushes</span>
            </div>
            <div class="push-cooldown-grid">
                <div class="push-cd-field">
                    <label>VEX (minutos)</label>
                    <input type="number" id="push-cooldown-vex" class="formula-input" style="width:80px;"
                        value="${pushCooldown.vex}" min="1">
                </div>
                <div class="push-cd-field">
                    <label>Guarda (minutos)</label>
                    <input type="number" id="push-cooldown-guarda" class="formula-input" style="width:80px;"
                        value="${pushCooldown.guarda}" min="1">
                </div>
            </div>
        </div>`;

    // ── Umbrales de push ──────────────────────────────────────
    const _umbralesHtml = (recurso, label) => `
        <div class="formula-item">
            <div class="formula-item-header">
                <span class="formula-item-label">Umbrales — ${label}</span>
                <button class="btn-ghost btn-ghost-xs" onclick="window.agregarUmbral('${recurso}')">+ Añadir</button>
            </div>
            <div class="umbral-help">
                Variables disponibles en condición: <code>pct_vida_roja</code> (0–100), <code>vida_azul</code> (valor absoluto máx calculado)
            </div>
            <div id="umbrales-${recurso}">
                ${(pushUmbrales[recurso] || []).map((u, idx) => `
                    <div class="umbral-row" data-umbral-idx="${idx}">
                        <input class="formula-input umbral-desc" data-campo="descripcion"
                            value="${u.descripcion}" placeholder="Descripción">
                        <input class="formula-input umbral-cond" data-campo="condicion"
                            value="${u.condicion}" placeholder="condición JS">
                        <input type="number" class="formula-input umbral-pushes" data-campo="pushes"
                            value="${u.pushes}" min="1" style="width:56px;" title="Pushes otorgados">
                        <button class="ctrl-btn ctrl-btn-xs icon-btn-danger"
                            onclick="window.eliminarUmbral('${recurso}',${idx})">✕</button>
                    </div>
                `).join('')}
            </div>
        </div>`;

    const pjOptions = Object.keys(personajes).map(n => `<option value="${n}">${n}</option>`).join('');

    cont.innerHTML = `
        ${poolHTML}

        <!-- Stats -->
        <div class="formulas-block">
            <div class="formulas-block-title">Stats derivados de afinidades</div>
            ${formulasHTML}
            <div class="formula-actions">
                <button class="btn-secondary" onclick="window.resetFormulas()">Restaurar defaults</button>
                <button class="btn-primary" onclick="window.guardarFormulas()">Guardar fórmulas</button>
            </div>
        </div>

        <!-- Push config -->
        <div class="formulas-block">
            <div class="formulas-block-title">Sistema Push — Recuperación activa</div>
            <p class="formulas-help">
                Los pushes permiten recuperar VEX o Guarda al instante, con cooldown entre cada uno.
                El número de pushes disponibles depende del estado de vida del personaje (umbrales configurables abajo).
                El OP puede además asignar pushes extra individuales desde el panel del personaje.
            </p>
            ${pushFormsHTML}
            ${cooldownHTML}
            <div class="formula-actions">
                <button class="btn-primary" onclick="window.guardarPushConfig()">Guardar fórmulas push</button>
            </div>
        </div>

        <!-- Umbrales -->
        <div class="formulas-block">
            <div class="formulas-block-title">Umbrales de pushes disponibles</div>
            <p class="formulas-help">
                Cada umbral otorga N pushes adicionales cuando la condición se cumple.
                Se evalúan todos y se suman. Un personaje con vida alta obtiene más pushes que uno malherido.
            </p>
            ${_umbralesHtml('vex', 'VEX')}
            ${_umbralesHtml('guarda', 'Guarda Dorada')}
            <div class="formula-actions">
                <button class="btn-primary" onclick="window.guardarPushUmbrales()">Guardar umbrales</button>
            </div>
        </div>

        <!-- Preview por personaje -->
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
            return `<div class="prev-line"><span class="prev-label">${f.label}</span><span class="prev-val">+${v} / push</span><code class="prev-expr">${f.expr}</code></div>`;
        }),
        `<div class="prev-separator"></div>`,
        `<div class="prev-line"><span class="prev-label">Pushes VEX disponibles</span><span class="prev-val">${calcularPushDisponibles(pj, s, 'vex')}</span></div>`,
        `<div class="prev-line"><span class="prev-label">Pushes Guarda disponibles</span><span class="prev-val">${calcularPushDisponibles(pj, s, 'guarda')}</span></div>`
    ];

    el.innerHTML = lineas.join('');
}
