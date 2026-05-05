// ============================================================
// personajes-main.js — Punto de entrada
// /personajes/personajes-main.js
// ============================================================

import { hexAuth } from '../hex-auth.js';
import { hexConfigs } from '../hex/config.js';
// Exponer configs globalmente para que hex-guard.js (no-module) pueda leer las campañas
window.hexConfigs = hexConfigs;
import { estadoUI, personajes, formulas, pushFormulas, pushUmbrales, pushCooldown,
         colaCambios, encolarCambio, FORMULAS_DEFAULT, PUSH_FORMULAS_DEFAULT,
         PUSH_UMBRALES_DEFAULT, PUSH_COOLDOWN_DEFAULT } from './personajes-state.js';
import { calcularStats, buildContext, evalExpr,
         calcularPushDisponibles, calcularValorPush, calcularCooldownPush } from './personajes-logic.js';
import { cargarDatos, sincronizarCola, guardarFormulasBD,
         guardarPushFormulasBD, guardarPushUmbralesBD, eliminarUmbralDB,
         persistirPush } from './personajes-data.js';
import { renderCatalogo, renderDetalle, renderFormulas,
         previsualizarFormulaConPJ, renderPreviewCompleto } from './personajes-ui.js';

// ─────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────
window.onload = async () => {
    await hexAuth.init();
    estadoUI.esAdmin = hexAuth.esAdmin();

    const badge = document.getElementById('hex-session-badge');
    if (badge) badge.innerHTML = hexAuth.renderStatusBadge();

    const barra  = document.getElementById('barra-progreso');
    const loader = document.getElementById('loader');

    const ok = await cargarDatos(barra);
    if (!ok) {
        if (loader) loader.innerHTML = '<span style="color:#c44;">Error al cargar datos.</span>';
        return;
    }
    if (loader) loader.style.display = 'none';

    mostrarVista('catalogo');
};

// ─────────────────────────────────────────────────────────────
// NAVEGACIÓN
// ─────────────────────────────────────────────────────────────
window.mostrarVista = function(vista) {
    estadoUI.vista = vista;
    document.querySelectorAll('.page').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    const page = document.getElementById('page-' + vista);
    if (page) page.classList.add('active');
    const tab = document.querySelector(`.tab-btn[data-vista="${vista}"]`);
    if (tab) tab.classList.add('active');

    if (vista === 'catalogo') renderCatalogo();
    if (vista === 'crear')    inicializarFormulario();
    if (vista === 'formulas') {
        if (!estadoUI.esAdmin) {
            mostrarToast('Solo el OP puede editar fórmulas', true);
            window.mostrarVista('catalogo');
            return;
        }
        renderFormulas();
    }
};

window.abrirLoginOP   = function() { hexAuth._mostrarModalLogin(); };

// Abre el selector de campaña como modal inline, sin salir de la página
window.cambiarCampaña = function() {
    // Reutilizar el mismo sistema del guard si está disponible
    if (typeof window._hexGuardSelect === 'function') {
        // El guard ya está cargado, forzar su modal
        _mostrarModalCampaña();
        return;
    }
    // Fallback: si por alguna razón el guard no está activo
    localStorage.removeItem('hex_selected');
    window.location.reload();
};

function _mostrarModalCampaña() {
    // Evitar duplicados
    let modal = document.getElementById('hex-campana-modal');
    if (modal) { modal.remove(); return; }

    modal = document.createElement('div');
    modal.id = 'hex-campana-modal';
    modal.style.cssText = `
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.82);
        backdrop-filter: blur(6px);
        z-index: 999998;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 32px 20px;
        font-family: 'Inter', system-ui, sans-serif;
    `;
    modal.onclick = function(e) { if (e.target === modal) modal.remove(); };

    // Obtener configs
    const configs = window.hexConfigs || null;
    const actual  = localStorage.getItem('hex_selected') || 'hex1';

    let cardsHTML = '';
    if (configs) {
        cardsHTML = Object.entries(configs).map(([id, cfg]) => {
            const esActual = id === actual;
            return `<div onclick="window._hexGuardSelect('${id}')" style="
                background: ${esActual ? 'rgba(212,175,55,0.1)' : 'rgba(255,255,255,0.03)'};
                border: 1px solid ${esActual ? 'rgba(212,175,55,0.5)' : 'rgba(255,255,255,0.07)'};
                border-radius:10px; padding:18px 16px; cursor:pointer; transition:all 0.2s;
                display:flex; flex-direction:column; gap:5px;
            "
            onmouseover="this.style.borderColor='rgba(212,175,55,0.45)'; this.style.background='rgba(212,175,55,0.08)';"
            onmouseout="this.style.borderColor='${esActual ? 'rgba(212,175,55,0.5)' : 'rgba(255,255,255,0.07)'}'; this.style.background='${esActual ? 'rgba(212,175,55,0.1)' : 'rgba(255,255,255,0.03)'}';">
                <div style="font-size:0.58em; color:#5a3a8a; letter-spacing:3px; text-transform:uppercase;">${id.toUpperCase()}${esActual ? ' · ACTIVA' : ''}</div>
                <div style="font-family:'Cinzel',serif; font-size:0.88em; color:#d4af37;">${cfg.ui?.titulo || cfg.nombreCorto || id}</div>
                <div style="font-size:0.72em; color:#5a5a78; line-height:1.4;">${cfg.ui?.lore || cfg.ui?.subtitulo || ''}</div>
            </div>`;
        }).join('');
    } else {
        cardsHTML = ['hex1','hex2','hex3'].map(id => `
            <div onclick="window._hexGuardSelect('${id}')" style="
                background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.07);
                border-radius:10px; padding:18px 16px; cursor:pointer;
            ">
                <div style="font-family:'Cinzel',serif; font-size:0.88em; color:#d4af37;">${id.toUpperCase()}</div>
            </div>
        `).join('');
    }

    modal.innerHTML = `
        <div style="
            background:#0f0f18;
            border:1px solid rgba(212,175,55,0.2);
            border-radius:14px;
            padding:28px 24px;
            width:100%;
            max-width:600px;
            max-height:90vh;
            overflow-y:auto;
        ">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:22px;">
                <div>
                    <div style="font-family:'Cinzel',serif; font-size:0.95em; color:#d4af37; letter-spacing:2px; margin-bottom:3px;">CAMBIAR CAMPAÑA</div>
                    <div style="font-size:0.72em; color:#5a5a78;">La página se recargará con la campaña seleccionada</div>
                </div>
                <button onclick="document.getElementById('hex-campana-modal').remove()" style="
                    background:none; border:none; color:#5a5a78; font-size:1.4em;
                    cursor:pointer; line-height:1; padding:4px;
                ">×</button>
            </div>
            <div style="
                display:grid;
                grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
                gap:10px;
            ">${cardsHTML}</div>
        </div>
    `;

    document.body.appendChild(modal);
}

// Exponer para que el guard pueda usarla también
window._mostrarModalCampaña = _mostrarModalCampaña;

// ─────────────────────────────────────────────────────────────
// FILTROS
// ─────────────────────────────────────────────────────────────
window.setFiltro = function(tipo, val, btn) {
    if (tipo === 'rol') {
        estadoUI.filtroRol = val;
        document.querySelectorAll('.filtro-rol').forEach(b => b.classList.remove('active'));
    } else {
        estadoUI.filtroAct = val;
        document.querySelectorAll('.filtro-act').forEach(b => b.classList.remove('active'));
    }
    btn.classList.add('active');
    renderCatalogo();
};
window.buscar = function(v) { estadoUI.busqueda = v.toLowerCase(); renderCatalogo(); };

// ─────────────────────────────────────────────────────────────
// PANEL LATERAL
// ─────────────────────────────────────────────────────────────
window.abrirDetalle = function(nombre) {
    estadoUI.pjSeleccionado = nombre;
    estadoUI.panelAbierto = true;
    renderDetalle(nombre);
    document.getElementById('panel-lateral')?.classList.add('open');
};
window.cerrarDetalle = function() {
    estadoUI.panelAbierto = false;
    document.getElementById('panel-lateral')?.classList.remove('open');
};

window.modStat = function(nombre, campo, delta) {
    const p = personajes[nombre]; if (!p) return;
    const s = calcularStats(p);
    const maximos = { vida_roja_actual: s.vida_roja_max, vex_actual: s.vex_max, guarda_actual: s.guarda_max };
    const max = maximos[campo] ?? Infinity;
    p[campo] = Math.max(0, Math.min(max, (p[campo] || 0) + delta));
    encolarCambio(nombre, campo, p[campo]);
    renderDetalle(nombre);
    renderCatalogo();
    actualizarBtnSync();
};

window.modAfin = function(nombre, afinKey, delta) {
    if (!estadoUI.esAdmin) return;
    const p = personajes[nombre]; if (!p) return;
    if (!p.afinidadesBase) p.afinidadesBase = {};
    p.afinidadesBase[afinKey] = Math.max(0, (p.afinidadesBase[afinKey] || 0) + delta);
    encolarCambio(nombre, `af_${afinKey}`, p.afinidadesBase[afinKey]);
    renderDetalle(nombre); renderCatalogo(); actualizarBtnSync();
};

window.modBf = function(nombre, afinKey, delta) {
    const p = personajes[nombre]; if (!p) return;
    if (!estadoUI.esAdmin && p.isPlayer) return;
    if (!p.afinidadesBf) p.afinidadesBf = {};
    p.afinidadesBf[afinKey] = Math.max(-999, (p.afinidadesBf[afinKey] || 0) + delta);
    encolarCambio(nombre, `bf_${afinKey}`, p.afinidadesBf[afinKey]);
    renderDetalle(nombre); renderCatalogo(); actualizarBtnSync();
};

window.modEf = function(nombre, afinKey, delta) {
    const p = personajes[nombre]; if (!p) return;
    if (!estadoUI.esAdmin && p.isPlayer) return;
    if (!p.afinidadesEf) p.afinidadesEf = {};
    p.afinidadesEf[afinKey] = Math.max(-999, (p.afinidadesEf[afinKey] || 0) + delta);
    encolarCambio(nombre, `ef_${afinKey}`, p.afinidadesEf[afinKey]);
    renderDetalle(nombre); renderCatalogo(); actualizarBtnSync();
};

window.editarPersonaje = function(nombre) {
    const p = personajes[nombre];
    if (!estadoUI.esAdmin && p?.isPlayer) {
        mostrarToast('Solo el OP puede editar personajes jugadores', true);
        return;
    }
    estadoUI.formMode   = 'editar';
    estadoUI.pjEditando = nombre;
    window.mostrarVista('crear');
    cerrarDetalle();
    rellenarFormulario(nombre);
};

// ─────────────────────────────────────────────────────────────
// SISTEMA PUSH
// ─────────────────────────────────────────────────────────────

/**
 * Ejecuta un push de VEX o Guarda para un personaje.
 * Verifica cooldown, pushes disponibles, y actualiza estado + DB.
 */
window.ejecutarPush = async function(nombre, recurso) {
    const p = personajes[nombre]; if (!p) return;
    const s = calcularStats(p);

    // 1. Cooldown
    const cd = calcularCooldownPush(p, recurso);
    if (!cd.disponible) {
        const min = Math.ceil(cd.restaSeg / 60);
        mostrarToast(`⏳ Cooldown: faltan ${min} min para el siguiente push`, true);
        return;
    }

    // 2. Pushes disponibles vs. usados
    const disponibles = calcularPushDisponibles(p, s, recurso);
    const actualKey   = recurso === 'vex' ? 'push_vex_actual' : 'push_guarda_actual';
    const usados      = p[actualKey] || 0;

    if (usados >= disponibles) {
        mostrarToast(`Sin pushes de ${recurso === 'vex' ? 'VEX' : 'Guarda'} disponibles`, true);
        return;
    }

    // 3. Calcular valor y aplicar
    const valor    = calcularValorPush(p, recurso);
    const tsKey    = recurso === 'vex' ? 'push_vex_ts' : 'push_guarda_ts';
    const recursoKey = recurso === 'vex' ? 'vex_actual' : 'guarda_actual';
    const maxKey   = recurso === 'vex' ? 'vex_max' : 'guarda_max';
    const maxVal   = recurso === 'vex' ? s.vex_max : s.guarda_max;

    p[recursoKey]  = Math.min(maxVal, (p[recursoKey] || 0) + valor);
    p[actualKey]   = usados + 1;
    p[tsKey]       = new Date().toISOString();

    // 4. Persistir directamente a Supabase (no espera sync manual)
    const ok = await persistirPush(nombre, p);
    if (ok) {
        mostrarToast(`✨ Push ${recurso === 'vex' ? 'VEX' : 'Guarda'}: +${valor} (${usados + 1}/${disponibles})`);
    } else {
        mostrarToast('Error al guardar push', true);
    }

    renderDetalle(nombre);
    renderCatalogo();
};

/**
 * Reset de pushes del día para un personaje (solo OP, o al inicio del día).
 */
window.resetPushes = async function(nombre, recurso) {
    if (!estadoUI.esAdmin) return;
    const p = personajes[nombre]; if (!p) return;
    if (recurso === 'vex' || recurso === 'ambos') {
        p.push_vex_actual = 0;
        p.push_vex_ts     = null;
    }
    if (recurso === 'guarda' || recurso === 'ambos') {
        p.push_guarda_actual = 0;
        p.push_guarda_ts     = null;
    }
    await persistirPush(nombre, p);
    mostrarToast('Pushes reiniciados');
    renderDetalle(nombre);
};

/**
 * Modificar el límite extra de pushes asignado manualmente por OP.
 */
window.modPushExtra = function(nombre, recurso, delta) {
    if (!estadoUI.esAdmin) return;
    const p = personajes[nombre]; if (!p) return;
    const limitKey = recurso === 'vex' ? 'push_vex_limit' : 'push_guarda_limit';
    p[limitKey] = Math.max(0, (p[limitKey] || 0) + delta);
    encolarCambio(nombre, limitKey, p[limitKey]);
    renderDetalle(nombre);
    actualizarBtnSync();
};

// ─────────────────────────────────────────────────────────────
// FORMULARIO CREAR / EDITAR
// ─────────────────────────────────────────────────────────────
let fIsJugador = true;
let fIsActivo  = true;

function inicializarFormulario() {
    if (estadoUI.formMode === 'crear') {
        estadoUI.pjEditando = null;
        resetFormulario();
        if (!estadoUI.esAdmin) {
            setToggleJugador(false);
            const tg  = document.getElementById('toggle-jugador');
            const lbl = document.getElementById('lbl-jugador');
            if (tg)  tg.style.pointerEvents = 'none';
            if (lbl) lbl.style.opacity = '0.4';
        } else {
            const tg  = document.getElementById('toggle-jugador');
            const lbl = document.getElementById('lbl-jugador');
            if (tg)  tg.style.pointerEvents = '';
            if (lbl) lbl.style.opacity = '';
        }
    }
}

function resetFormulario() {
    fIsJugador = true; fIsActivo = true;
    document.getElementById('form-titulo').textContent = 'Crear personaje';
    document.getElementById('f-nombre').value     = '';
    document.getElementById('f-icono').value      = '';
    document.getElementById('f-hex').value        = '1000';
    document.getElementById('f-asistencia').value = '1';
    document.getElementById('f-vex-actual').value = '0';
    document.getElementById('f-vex-max').value    = '0';
    document.getElementById('f-vida-roja').value  = '10';
    document.getElementById('f-vida-azul').value  = '0';
    document.getElementById('f-guarda-act').value = '0';
    document.getElementById('f-guarda-max').value = '0';
    setToggleJugador(true);
    setToggleActivo(true);
    document.getElementById('npc-tipo-row').style.display  = 'none';
    document.getElementById('vex-max-row').style.display   = 'none';
    ['fisica','energetica','espiritual','mando','psiquica','oscura'].forEach(k => {
        const el = document.getElementById(`afin-${k}`); if (el) el.value = '0';
    });
    actualizarPreviewFormulario();
}

function rellenarFormulario(nombre) {
    const p = personajes[nombre]; if (!p) return;
    document.getElementById('form-titulo').textContent = `Editando: ${nombre}`;
    document.getElementById('f-nombre').value     = nombre;
    document.getElementById('f-icono').value      = p.iconoOverride || '';
    document.getElementById('f-hex').value        = p.hex || 0;
    document.getElementById('f-asistencia').value = p.asistencia || 1;
    document.getElementById('f-vex-actual').value = p.vex_actual || 0;
    document.getElementById('f-vex-max').value    = p.vex_max || 0;
    document.getElementById('f-vida-roja').value  = p.vida_roja_actual || 10;
    document.getElementById('f-vida-azul').value  = p.vida_azul_max || 0;
    document.getElementById('f-guarda-act').value = p.guarda_actual || 0;
    document.getElementById('f-guarda-max').value = p.guarda_max || 0;
    setToggleJugador(p.isPlayer);
    setToggleActivo(p.isActive);
    document.getElementById('f-npc-tipo').value  = p.npc_tipo || 'sistema';
    document.getElementById('npc-tipo-row').style.display = p.isPlayer ? 'none' : 'flex';
    document.getElementById('vex-max-row').style.display  = p.isPlayer ? 'none' : 'flex';
    ['fisica','energetica','espiritual','mando','psiquica','oscura'].forEach(k => {
        const el = document.getElementById(`afin-${k}`);
        if (el) el.value = p.afinidadesBase?.[k] || 0;
    });
    actualizarPreviewFormulario();
}

function setToggleJugador(val) {
    fIsJugador = val;
    const t = document.getElementById('toggle-jugador');
    if (t) t.classList.toggle('on', val);
    const lbl = document.getElementById('lbl-jugador');
    if (lbl) lbl.textContent = val ? 'Jugador (PC)' : 'NPC';
    document.getElementById('npc-tipo-row').style.display = val ? 'none' : 'flex';
    document.getElementById('vex-max-row').style.display  = val ? 'none' : 'flex';
    actualizarPreviewFormulario();
}
function setToggleActivo(val) {
    fIsActivo = val;
    const t = document.getElementById('toggle-activo');
    if (t) t.classList.toggle('on', val);
}

window.toggleJugador = () => { if (!estadoUI.esAdmin) return; setToggleJugador(!fIsJugador); };
window.toggleActivo  = () => setToggleActivo(!fIsActivo);

window.actualizarPreviewFormulario = function() {
    const vals = {};
    ['fisica','energetica','espiritual','mando','psiquica','oscura'].forEach(k => {
        vals[k] = parseInt(document.getElementById(`afin-${k}`)?.value || 0) || 0;
    });
    const ctx = {
        Fis: vals.fisica, Ene: vals.energetica, Esp: vals.espiritual,
        Man: vals.mando,  Psi: vals.psiquica,   Osc: vals.oscura,
        FisB: vals.fisica, EneB: vals.energetica, EspB: vals.espiritual,
        ManB: vals.mando,  PsiB: vals.psiquica,   OscB: vals.oscura,
        Hz1:0, Hz2:0, Hz3:0, Hz4:0, Hz5:0
    };
    const prev = document.getElementById('afin-preview');
    if (!prev) return;
    const v_vida  = evalExpr(formulas.vida_roja_max.expr, ctx);
    const v_azul  = evalExpr(formulas.vida_azul_max.expr, ctx);
    const v_guard = evalExpr(formulas.guarda_max.expr, ctx);
    const v_vex   = fIsJugador ? evalExpr(formulas.vex_max.expr, ctx) : parseInt(document.getElementById('f-vex-max')?.value||0)||0;
    prev.innerHTML = `Vida Roja: <strong>${v_vida}</strong> &nbsp;·&nbsp; Vida Azul: <strong>${v_azul}</strong> &nbsp;·&nbsp; Guarda: <strong>${v_guard}</strong> &nbsp;·&nbsp; VEX máx: <strong>${v_vex}</strong>`;
};

window.guardarPersonaje = function() {
    const nombre = document.getElementById('f-nombre').value.trim();
    if (!nombre) return mostrarToast('El nombre es obligatorio', true);
    if (!estadoUI.esAdmin && fIsJugador) {
        mostrarToast('Solo el OP puede crear personajes jugadores', true);
        return;
    }
    const afinBase = {};
    ['fisica','energetica','espiritual','mando','psiquica','oscura'].forEach(k => {
        afinBase[k] = parseInt(document.getElementById(`afin-${k}`)?.value || 0) || 0;
    });
    const viejo = personajes[nombre] || {};
    personajes[nombre] = {
        isPlayer:  fIsJugador,
        isActive:  fIsActivo,
        npc_tipo:  fIsJugador ? 'jugador' : (document.getElementById('f-npc-tipo')?.value || 'sistema'),
        iconoOverride: document.getElementById('f-icono').value.trim() || nombre,
        hex:       parseInt(document.getElementById('f-hex').value)||0,
        asistencia: parseInt(document.getElementById('f-asistencia').value)||1,
        vex_actual: parseInt(document.getElementById('f-vex-actual').value)||0,
        vex_max:    parseInt(document.getElementById('f-vex-max').value)||0,
        vida_roja_actual: parseInt(document.getElementById('f-vida-roja').value)||10,
        vida_azul_max:    parseInt(document.getElementById('f-vida-azul').value)||0,
        guarda_actual: parseInt(document.getElementById('f-guarda-act').value)||0,
        guarda_max:    parseInt(document.getElementById('f-guarda-max').value)||0,
        afinidadesBase: afinBase,
        afinidadesHz: viejo.afinidadesHz || { fisica:0,energetica:0,espiritual:0,mando:0,psiquica:0,oscura:0 },
        afinidadesEf: viejo.afinidadesEf || { fisica:0,energetica:0,espiritual:0,mando:0,psiquica:0,oscura:0 },
        afinidadesBf: viejo.afinidadesBf || { fisica:0,energetica:0,espiritual:0,mando:0,psiquica:0,oscura:0 },
        hz_clase1:0, hz_clase2:0, hz_clase3:0, hz_clase4:0, hz_clase5:0,
        estados: viejo.estados || {},
        // Preservar push state si existía
        push_vex_actual:    viejo.push_vex_actual    || 0,
        push_vex_limit:     viejo.push_vex_limit     || 0,
        push_vex_extra:     viejo.push_vex_extra     || 0,
        push_vex_ts:        viejo.push_vex_ts        || null,
        push_guarda_actual: viejo.push_guarda_actual || 0,
        push_guarda_limit:  viejo.push_guarda_limit  || 0,
        push_guarda_extra:  viejo.push_guarda_extra  || 0,
        push_guarda_ts:     viejo.push_guarda_ts     || null,
    };
    encolarCambio(nombre, '__full__', true);
    actualizarBtnSync();
    mostrarToast(`Personaje "${nombre}" ${estadoUI.formMode === 'crear' ? 'creado' : 'actualizado'}`);
    estadoUI.formMode = 'crear';
    estadoUI.pjEditando = null;
    window.mostrarVista('catalogo');
};

window.cancelarFormulario = function() {
    estadoUI.formMode = 'crear';
    estadoUI.pjEditando = null;
    window.mostrarVista('catalogo');
};

// ─────────────────────────────────────────────────────────────
// ELIMINAR
// ─────────────────────────────────────────────────────────────
window.pedirDelete = function(nombre) {
    if (!estadoUI.esAdmin) return;
    if (!confirm(`¿Eliminar a "${nombre}" permanentemente?`)) return;
    delete personajes[nombre];
    encolarCambio(nombre, '__delete__', true);
    actualizarBtnSync();
    mostrarToast(`"${nombre}" eliminado`);
    renderCatalogo();
};

// ─────────────────────────────────────────────────────────────
// FÓRMULAS (stats)
// ─────────────────────────────────────────────────────────────
let formulaActiva = null;
window.setFormulaActiva = function(key) { formulaActiva = key; };

window.insertarVar = function(varKey) {
    if (!formulaActiva) return;
    const isPush  = formulaActiva.startsWith('push_');
    const inputId = isPush ? `pinput-${formulaActiva}` : `finput-${formulaActiva}`;
    const input   = document.getElementById(inputId);
    if (!input) return;
    const pos = input.selectionStart;
    const val = input.value;
    input.value = val.slice(0, pos) + varKey + val.slice(pos);
    input.focus();
    input.setSelectionRange(pos + varKey.length, pos + varKey.length);
    if (isPush) window.previsualizarPushFormula(formulaActiva);
    else        window.previsualizarFormula(formulaActiva);
};

window.previsualizarFormula = function(key) {
    const pjSel = document.getElementById('preview-pj-sel')?.value || Object.keys(personajes)[0];
    if (pjSel) previsualizarFormulaConPJ(key, pjSel);
};

window.previsualizarPushFormula = function(key) {
    const pjSel = document.getElementById('preview-pj-sel')?.value || Object.keys(personajes)[0];
    if (!pjSel) return;
    const pj = personajes[pjSel]; if (!pj) return;
    const el = document.getElementById(`pprev-${key}`);
    if (!el) return;
    const expr = document.getElementById(`pinput-${key}`)?.value || pushFormulas[key]?.expr || '';
    const ctx  = buildContext(pj);
    const val  = evalExpr(expr, ctx);
    el.innerHTML = `<span class="prev-pj">${pjSel}</span> → <strong>${val}</strong> por push`;
};

window.cambiarAplica = function(key, val) { formulas[key].aplica = val; };

window.guardarFormulas = async function() {
    Object.keys(formulas).forEach(key => {
        const el = document.getElementById(`finput-${key}`);
        if (el) formulas[key].expr = el.value;
    });
    const ok = await guardarFormulasBD();
    mostrarToast(ok ? 'Fórmulas guardadas' : 'Error al guardar', !ok);
    renderCatalogo();
};

window.resetFormulas = function() {
    Object.entries(FORMULAS_DEFAULT).forEach(([k, v]) => { formulas[k] = { ...v }; });
    renderFormulas();
};

window.actualizarPreviewPJ = function() {
    const sel = document.getElementById('preview-pj-sel')?.value;
    if (sel) {
        renderPreviewCompleto(sel);
        Object.keys(formulas).forEach(k => previsualizarFormulaConPJ(k, sel));
        Object.keys(pushFormulas).forEach(k => window.previsualizarPushFormula(k));
    }
};

// ─────────────────────────────────────────────────────────────
// FÓRMULAS PUSH (guardado)
// ─────────────────────────────────────────────────────────────
window.guardarPushConfig = async function() {
    // Leer fórmulas push del DOM
    Object.keys(pushFormulas).forEach(key => {
        const el = document.getElementById(`pinput-${key}`);
        if (el) pushFormulas[key].expr = el.value;
    });
    // Leer cooldowns
    const cdVex    = document.getElementById('push-cooldown-vex');
    const cdGuarda = document.getElementById('push-cooldown-guarda');
    if (cdVex)    pushCooldown.vex    = parseFloat(cdVex.value)    || 60;
    if (cdGuarda) pushCooldown.guarda = parseFloat(cdGuarda.value) || 30;

    const ok = await guardarPushFormulasBD();
    mostrarToast(ok ? 'Config de push guardada' : 'Error al guardar', !ok);
};

window.guardarPushUmbrales = async function() {
    // Leer umbrales del DOM
    for (const recurso of ['vex', 'guarda']) {
        const cont = document.getElementById(`umbrales-${recurso}`);
        if (!cont) continue;
        const filas = cont.querySelectorAll('[data-umbral-idx]');
        filas.forEach((fila, idx) => {
            const u = pushUmbrales[recurso][idx];
            if (!u) return;
            u.descripcion = fila.querySelector('[data-campo="descripcion"]')?.value || u.descripcion;
            u.condicion   = fila.querySelector('[data-campo="condicion"]')?.value   || u.condicion;
            u.pushes      = parseInt(fila.querySelector('[data-campo="pushes"]')?.value) || 1;
        });
    }
    const ok = await guardarPushUmbralesBD();
    mostrarToast(ok ? 'Umbrales guardados' : 'Error al guardar', !ok);
};

window.agregarUmbral = function(recurso) {
    pushUmbrales[recurso].push({
        descripcion: 'Nueva condición',
        condicion:   'pct_vida_roja >= 50',
        pushes:      1,
        orden:       pushUmbrales[recurso].length + 1
    });
    renderFormulas();
};

window.eliminarUmbral = async function(recurso, idx) {
    const u = pushUmbrales[recurso][idx];
    if (u?.id) await eliminarUmbralDB(u.id);
    pushUmbrales[recurso].splice(idx, 1);
    renderFormulas();
};

// ─────────────────────────────────────────────────────────────
// SYNC (cambios manuales del OP)
// ─────────────────────────────────────────────────────────────
function actualizarBtnSync() {
    const btn = document.getElementById('btn-sync');
    const n   = Object.keys(colaCambios).length;
    if (!btn) return;
    btn.style.display = n > 0 ? 'block' : 'none';
    btn.textContent   = `Guardar cambios (${n})`;
}

window.ejecutarSync = async function() {
    const btn = document.getElementById('btn-sync');
    btn.disabled = true; btn.textContent = 'Guardando...';
    const res = await sincronizarCola();
    btn.disabled = false;
    actualizarBtnSync();
    if (res.ok) {
        mostrarToast('Guardado correctamente');
        renderCatalogo();
    } else {
        mostrarToast('Error al guardar: ' + res.errores.join(', '), true);
    }
};

// ─────────────────────────────────────────────────────────────
// TOAST
// ─────────────────────────────────────────────────────────────
let _toastTimer;
function mostrarToast(msg, error = false) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent   = msg;
    el.className     = 'toast ' + (error ? 'toast-error' : 'toast-ok');
    el.style.display = 'block';
    clearTimeout(_toastTimer);
    _toastTimer = setTimeout(() => { el.style.display = 'none'; }, 3000);
}
window.mostrarToast = mostrarToast;
