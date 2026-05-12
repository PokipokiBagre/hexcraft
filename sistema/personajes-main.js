// ============================================================
// personajes-main.js — Punto de entrada
// /personajes/personajes-main.js
// ============================================================

import { hexAuth, supabase, currentConfig } from '../hex-auth.js';
import { hexConfigs } from '../hex/config.js';
import { estadoUI, personajes, formulas, pushFormulas, pushUmbrales, pushCooldown,
         colaCambios, encolarCambio, FORMULAS_DEFAULT, PUSH_FORMULAS_DEFAULT,
         PUSH_UMBRALES_DEFAULT, PUSH_COOLDOWN_DEFAULT } from './personajes-state.js';
import { calcularStats, buildContext, evalExpr,
         calcularPushDisponibles, calcularValorPush, calcularCooldownPush } from './personajes-logic.js';
import { cargarDatos, sincronizarCola, guardarFormulasBD,
         guardarPushFormulasBD, guardarPushUmbralesBD, eliminarUmbralDB,
         persistirPush, persistirCampos } from './personajes-data.js';
import { renderCatalogo, renderFormulas,
         previsualizarFormulaConPJ, renderPreviewCompleto } from './personajes-ui.js';
import { abrirPanelPJ, cerrarPanelPJ, refreshPanelPJ } from './panel-pj.js';
import { montarOpPanel, refrescarOpPanel } from './panel-op-update.js';

window.hexConfigs = hexConfigs;

// ─────────────────────────────────────────────────────────────
// TIMER DE COOLDOWN EN VIVO
// ─────────────────────────────────────────────────────────────
let _timerInterval = null;

function _iniciarTimerCooldown() {
    if (_timerInterval) return;
    _timerInterval = setInterval(() => {
        if (!estadoUI.panelAbierto || !estadoUI.pjSeleccionado) return;
        refreshPanelPJ();
    }, 1000);
}

// ─────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────
window.onload = async () => {
    await hexAuth.init();
    estadoUI.esAdmin = hexAuth.esAdmin();
    if (estadoUI.esAdmin) montarOpPanel();

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
    refrescarOpPanel();
    _iniciarTimerCooldown();

    const urlParams = new URLSearchParams(window.location.search);
    const pjParam   = urlParams.get('pj');
    if (pjParam && personajes[pjParam]) {
        setTimeout(() => window.abrirDetalle(pjParam), 150);
    }
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
        renderFormulas();
    }
};

window.abrirLoginOP   = function() { hexAuth._mostrarModalLogin(); };
window.cambiarCampaña = function() {
    if (typeof window._hexGuardAbrirModal === 'function') window._hexGuardAbrirModal();
};

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
// PANEL LATERAL — usa panel-pj.js
// ─────────────────────────────────────────────────────────────
window.abrirDetalle = function(nombre) { abrirPanelPJ(nombre); };
window.cerrarDetalle = cerrarPanelPJ;

// ─────────────────────────────────────────────────────────────
// MODIFICAR STATS (actual)
// ─────────────────────────────────────────────────────────────
window.modStat = function(nombre, campo, delta) {
    const p = personajes[nombre]; if (!p) return;
    const s = calcularStats(p);

    if (campo === 'vida_azul_actual') {
        // vida_azul_actual es el modificador acumulado (base+mod = total, sin techo)
        p.vida_azul_actual = (p.vida_azul_actual ?? 0) + delta;
        // no hay Math.max(0) — puede quedar negativo si el OP lo desea
        persistirCampos(nombre, { vida_azul_actual: p.vida_azul_actual });
    } else {
        const caps = { vex_actual: s.vex_max, guarda_actual: s.guarda_max, vida_roja_actual: s.vida_roja_max };
        const max = caps[campo] ?? Infinity;
        p[campo] = Math.max(0, Math.min(max, (p[campo] || 0) + delta));
        persistirCampos(nombre, { [campo]: p[campo] });
    }
    renderCatalogo();
    refreshPanelPJ();
};

// ─────────────────────────────────────────────────────────────
// MODIFICAR LÍMITE MÁXIMO (override) — solo OP
// ─────────────────────────────────────────────────────────────
window.modStatMax = function(nombre, campo, delta) {
    if (!estadoUI.esAdmin) return;
    const p = personajes[nombre]; if (!p) return;

    if (campo === 'guarda_max_override') {
        // guarda_max = fórmula + override (suma). Override arranca en 0, no desde fórmula.
        p.guarda_max_override = (p.guarda_max_override || 0) + delta;
        persistirCampos(nombre, { guarda_max_op: p.guarda_max_override });
    } else if (campo === 'vida_roja_max_override') {
        // vida_roja_max = fórmula + override (suma). Override arranca en 0.
        p.vida_roja_max_override = (p.vida_roja_max_override || 0) + delta;
        persistirCampos(nombre, { vida_roja_max_op: p.vida_roja_max_override });
    }
    renderCatalogo();
    refreshPanelPJ();
};

window.resetStatMax = function(nombre, campo) {
    if (!estadoUI.esAdmin) return;
    const p = personajes[nombre]; if (!p) return;
    if (campo === 'guarda_max_override') {
        p.guarda_max_override = 0;
        persistirCampos(nombre, { guarda_max_op: 0 });
    } else if (campo === 'vida_roja_max_override') {
        p.vida_roja_max_override = 0;
        persistirCampos(nombre, { vida_roja_max_op: 0 });
    } else {
        p[campo] = 0;
        const _dbMap2 = { vida_roja_max_override: 'vida_roja_max_op' };
        persistirCampos(nombre, { [_dbMap2[campo] || campo]: 0 });
    }
    renderCatalogo();
    mostrarToast('Máximo restaurado a fórmula');
    refreshPanelPJ();
};

// ─────────────────────────────────────────────────────────────
// MODIFICAR AFINIDADES
// ─────────────────────────────────────────────────────────────
window.modAfin = function(nombre, afinKey, delta) {
    if (!estadoUI.esAdmin) return;
    const p = personajes[nombre]; if (!p) return;
    if (!p.afin_base) p.afin_base = { fisica:0,energetica:0,espiritual:0,mando:0,psiquica:0,oscura:0 };
    p.afin_base[afinKey] = Math.max(0, (p.afin_base[afinKey] || 0) + delta);
    // mantener alias legacy en sincronía
    if (!p.afinidadesBase) p.afinidadesBase = {};
    p.afinidadesBase[afinKey] = p.afin_base[afinKey];
    persistirCampos(nombre, { afin_base: { ...p.afin_base } });
    renderCatalogo(); refreshPanelPJ();
    _autoSync();
};

window.modBf = function(nombre, afinKey, delta) {
    const p = personajes[nombre]; if (!p) return;
    if (!estadoUI.esAdmin && p.isPlayer) return;
    if (!p.afin_extra) p.afin_extra = { fisica:0,energetica:0,espiritual:0,mando:0,psiquica:0,oscura:0 };
    p.afin_extra[afinKey] = Math.max(-999, (p.afin_extra[afinKey] || 0) + delta);
    if (!p.afinidadesBf) p.afinidadesBf = {};
    p.afinidadesBf[afinKey] = p.afin_extra[afinKey];
    persistirCampos(nombre, { afin_extra: { ...p.afin_extra } });
    renderCatalogo(); refreshPanelPJ();
    _autoSync();
};

window.modEf = function(nombre, afinKey, delta) {
    const p = personajes[nombre]; if (!p) return;
    if (!estadoUI.esAdmin && p.isPlayer) return;
    if (!p.afin_alter) p.afin_alter = { fisica:0,energetica:0,espiritual:0,mando:0,psiquica:0,oscura:0 };
    p.afin_alter[afinKey] = Math.max(-999, (p.afin_alter[afinKey] || 0) + delta);
    if (!p.afinidadesEf) p.afinidadesEf = {};
    p.afinidadesEf[afinKey] = p.afin_alter[afinKey];
    persistirCampos(nombre, { afin_alter: { ...p.afin_alter } });
    renderCatalogo(); refreshPanelPJ();
    _autoSync();
};

// Aliases usados desde el panel de stats
window.modAfinExtra = window.modBf;
window.modAfinAlter = window.modEf;

window.editarPersonaje = function(nombre) {
    const p = personajes[nombre];
    if (!estadoUI.esAdmin && p?.isPlayer) {
        mostrarToast('Solo el OP puede editar personajes jugadores', true);
        return;
    }
    estadoUI.formMode   = 'editar';
    estadoUI.pjEditando = nombre;
    window.mostrarVista('crear');
    cerrarPanelPJ();
    rellenarFormulario(nombre);
};

// ─────────────────────────────────────────────────────────────
// SISTEMA PUSH
// ─────────────────────────────────────────────────────────────
window.ejecutarPush = async function(nombre, recurso) {
    const p = personajes[nombre]; if (!p) return;
    const s = calcularStats(p);

    const cd = calcularCooldownPush(p, recurso);
    if (!cd.disponible) {
        const min = Math.ceil(cd.restaSeg / 60);
        mostrarToast(`⏳ Cooldown: faltan ${min} min para el siguiente push`, true);
        return;
    }

    const disponibles  = calcularPushDisponibles(p, s, recurso);
    const actualKey    = recurso === 'vex' ? 'push_vex_actual' : 'push_guarda_actual';
    const usados       = p[actualKey] || 0;

    if (usados >= disponibles) {
        mostrarToast(`Sin pushes de ${recurso === 'vex' ? 'VEX' : 'Guarda'} disponibles`, true);
        return;
    }

    const valor      = calcularValorPush(p, recurso);
    const tsKey      = recurso === 'vex' ? 'push_vex_ts'  : 'push_guarda_ts';
    const recursoKey = recurso === 'vex' ? 'vex_actual'   : 'guarda_actual';
    const maxVal     = recurso === 'vex' ? s.vex_max      : s.guarda_max;

    p[recursoKey] = Math.min(maxVal, (p[recursoKey] || 0) + valor);
    p[actualKey]  = usados + 1;
    p[tsKey]      = new Date().toISOString();

    const ok = await persistirPush(nombre, p);
    mostrarToast(ok
        ? `✨ Push ${recurso === 'vex' ? 'VEX' : 'Guarda'}: +${valor} (${usados + 1}/${disponibles})`
        : 'Error al guardar push', !ok);

    renderCatalogo();
    refreshPanelPJ();
};

window.resetPushes = async function(nombre, recurso) {
    if (!estadoUI.esAdmin) return;
    const p = personajes[nombre]; if (!p) return;
    if (recurso === 'vex'    || recurso === 'ambos') { p.push_vex_actual    = 0; p.push_vex_ts    = null; }
    if (recurso === 'guarda' || recurso === 'ambos') { p.push_guarda_actual = 0; p.push_guarda_ts = null; }
    await persistirPush(nombre, p);
    mostrarToast('Pushes reiniciados');
    refreshPanelPJ();
};

window.modPushExtra = function(nombre, recurso, delta) {
    if (!estadoUI.esAdmin) return;
    const p = personajes[nombre]; if (!p) return;
    const limitKey = recurso === 'vex' ? 'push_vex_limit' : 'push_guarda_limit';
    p[limitKey] = Math.max(0, (p[limitKey] || 0) + delta);
    persistirCampos(nombre, { [limitKey]: p[limitKey] });
    refreshPanelPJ();
    _autoSync();
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
    const tg = document.getElementById('toggle-jugador');
    if (tg) tg.classList.toggle('on', val);
    const npcRow = document.getElementById('npc-tipo-row');
    const vexRow = document.getElementById('vex-max-row');
    if (npcRow) npcRow.style.display = val ? 'none' : 'flex';
    if (vexRow) vexRow.style.display = val ? 'none' : 'flex';
    const lbl = document.getElementById('lbl-jugador');
    if (lbl) lbl.textContent = val ? 'Jugador (PC)' : 'NPC';
}

function setToggleActivo(val) {
    fIsActivo = val;
    const tg = document.getElementById('toggle-activo');
    if (tg) tg.classList.toggle('on', val);
}

window.toggleJugador = function() { setToggleJugador(!fIsJugador); };
window.toggleActivo  = function() { setToggleActivo(!fIsActivo); };

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
    const _afin0 = { fisica:0,energetica:0,espiritual:0,mando:0,psiquica:0,oscura:0 };
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
        vida_roja_max_override: viejo.vida_roja_max_override || 0,
        vida_azul_actual: viejo.vida_azul_actual != null ? viejo.vida_azul_actual : 0,
        vida_azul_max:    parseInt(document.getElementById('f-vida-azul').value)||0,
        vida_azul_max_override: viejo.vida_azul_max_override || 0,
        guarda_actual: parseInt(document.getElementById('f-guarda-act').value)||0,
        guarda_max:    parseInt(document.getElementById('f-guarda-max').value)||0,
        // Afinidades nuevo schema
        afin_base:  { ..._afin0, ...afinBase },
        afin_extra: viejo.afin_extra  || viejo.afinidadesBf || { ..._afin0 },
        afin_alter: viejo.afin_alter  || viejo.afinidadesEf || { ..._afin0 },
        // Legacy aliases
        afinidadesBase: { ..._afin0, ...afinBase },
        afinidadesBf:   viejo.afin_extra  || viejo.afinidadesBf || { ..._afin0 },
        afinidadesEf:   viejo.afin_alter  || viejo.afinidadesEf || { ..._afin0 },
        afinidadesHz:   { ..._afin0 },
        bonos_stats: viejo.bonos_stats || { vida_roja:0, vida_azul:0, guarda:0, dano_rojo:0, dano_azul:0 },
        hz_clase1:0, hz_clase2:0, hz_clase3:0, hz_clase4:0, hz_clase5:0,
        estados: viejo.estados || {},
        cd_fisica:     viejo.cd_fisica     ?? 0.5,
        cd_energetica: viejo.cd_energetica ?? 0.5,
        cd_espiritual: viejo.cd_espiritual ?? 0.5,
        cd_mando:      viejo.cd_mando      ?? 0.5,
        cd_psiquica:   viejo.cd_psiquica   ?? 0.5,
        cd_oscura:     viejo.cd_oscura     ?? 0.5,
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
// FÓRMULAS
// ─────────────────────────────────────────────────────────────
let formulaActiva = null;
window.setFormulaActiva = function(key) { formulaActiva = key; };

window.insertarVar = function(varKey) {
    if (!formulaActiva) return;
    const isPush  = formulaActiva.startsWith('push_') || formulaActiva.startsWith('valor_push');
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

window.cambiarAplica  = function(key, val) { formulas[key].aplica = val; };

window.guardarFormulas = async function() {
    Object.keys(formulas).forEach(key => {
        const el = document.getElementById(`finput-${key}`);
        if (el) formulas[key].expr = el.value;
    });
    const err = await guardarFormulasBD();
    mostrarToast(err ? `Error: ${err}` : 'Fórmulas guardadas', !!err);
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

window.guardarPushConfig = async function() {
    Object.keys(pushFormulas).forEach(key => {
        const el = document.getElementById(`pinput-${key}`);
        if (el) pushFormulas[key].expr = el.value;
    });
    const cdVex    = document.getElementById('push-cooldown-vex');
    const cdGuarda = document.getElementById('push-cooldown-guarda');
    if (cdVex)    pushCooldown.vex    = parseFloat(cdVex.value)    || 60;
    if (cdGuarda) pushCooldown.guarda = parseFloat(cdGuarda.value) || 30;
    const ok = await guardarPushFormulasBD();
    mostrarToast(ok ? 'Config de push guardada' : 'Error al guardar', !ok);
};

window.guardarPushUmbrales = async function() {
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
// SYNC
// ─────────────────────────────────────────────────────────────
// Auto-sincroniza en segundo plano tras cada cambio de stat.
// Si falla, el botón de sync permanece visible como fallback.
async function _autoSync() {
    const res = await sincronizarCola();
    if (res.ok) actualizarBtnSync();
}

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
// SUBIR IMAGEN
// ─────────────────────────────────────────────────────────────
window.abrirSubirImagen = function(nombre) {
    const p = personajes[nombre];
    if (!p) return;
    const puedeSubir = estadoUI.esAdmin || !p.isPlayer;
    if (!puedeSubir) { mostrarToast('Sin permiso para subir imágenes de jugadores', true); return; }

    const viejo = document.getElementById('hex-img-upload-modal');
    if (viejo) viejo.remove();

    const modal = document.createElement('div');
    modal.id = 'hex-img-upload-modal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.82);backdrop-filter:blur(6px);z-index:999999;display:flex;align-items:center;justify-content:center;padding:24px;font-family:Inter,system-ui,sans-serif;';
    modal.onclick = e => { if (e.target === modal) modal.remove(); };

    const icono = p.iconoOverride || nombre;
    const storageBase = currentConfig.storageUrl;
    const previewUrl  = `${storageBase}/imgpersonajes/${_normImg(icono)}icon.png`;

    modal.innerHTML = `
        <div style="background:#0f0f18;border:1px solid rgba(212,175,55,0.25);border-radius:12px;padding:24px;width:100%;max-width:420px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
                <div style="font-family:Cinzel,serif;font-size:0.9em;color:#d4af37;letter-spacing:1px;">SUBIR IMAGEN — ${nombre}</div>
                <button onclick="document.getElementById('hex-img-upload-modal').remove()" style="background:none;border:none;color:#5a5a78;font-size:1.4em;cursor:pointer;line-height:1;">×</button>
            </div>
            <div style="display:flex;gap:16px;align-items:flex-start;margin-bottom:20px;">
                <img id="hex-img-preview" src="${previewUrl}" onerror="this.src=''" alt=""
                     style="width:80px;height:80px;border-radius:8px;object-fit:cover;object-position:top;border:1px solid rgba(212,175,55,0.2);background:#161622;">
                <div style="flex:1;font-size:0.78em;color:#5a5a78;line-height:1.6;">
                    Imagen principal del personaje.<br>
                    Se guardará como <code style="color:#d4af37;">${_normImg(icono)}icon.png</code><br>
                    <span style="color:#3a3a52;">Recomendado: PNG cuadrado, mín 200×200px</span>
                </div>
            </div>
            <label style="display:block;margin-bottom:12px;">
                <div style="font-size:0.75em;color:#5a5a78;margin-bottom:6px;">Seleccionar archivo</div>
                <input type="file" id="hex-img-file" accept="image/*"
                       style="width:100%;padding:8px;background:#161622;border:1px solid rgba(255,255,255,0.28);border-radius:6px;color:#c4c4d4;font-size:0.82em;cursor:pointer;">
            </label>
            <div id="hex-img-status" style="font-size:0.78em;min-height:20px;margin-bottom:14px;"></div>
            <div style="display:flex;gap:10px;justify-content:flex-end;">
                <button onclick="document.getElementById('hex-img-upload-modal').remove()"
                        style="padding:7px 16px;background:transparent;border:1px solid rgba(255,255,255,0.28);border-radius:6px;color:#5a5a78;font-size:0.8em;cursor:pointer;">
                    Cancelar
                </button>
                <button id="hex-img-upload-btn" onclick="window._ejecutarSubidaImagen('${nombre}')"
                        style="padding:7px 18px;background:rgba(212,175,55,0.1);border:1px solid rgba(212,175,55,0.4);border-radius:6px;color:#d4af37;font-family:Cinzel,serif;font-size:0.78em;cursor:pointer;letter-spacing:0.5px;">
                    SUBIR
                </button>
            </div>
        </div>`;

    document.body.appendChild(modal);
    document.getElementById('hex-img-file').onchange = function() {
        const file = this.files[0];
        if (file) {
            const url = URL.createObjectURL(file);
            document.getElementById('hex-img-preview').src = url;
        }
    };
};

function _normImg(s) {
    return s.toString().trim().toLowerCase()
        .replace(/[áàäâ]/g,'a').replace(/[éèëê]/g,'e').replace(/[íìïî]/g,'i')
        .replace(/[óòöô]/g,'o').replace(/[úùüû]/g,'u').replace(/[ñ]/g,'n')
        .replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,'');
}

window._ejecutarSubidaImagen = async function(nombre) {
    const p = personajes[nombre]; if (!p) return;
    const fileInput = document.getElementById('hex-img-file');
    const statusEl  = document.getElementById('hex-img-status');
    const btn       = document.getElementById('hex-img-upload-btn');

    if (!fileInput?.files?.length) {
        statusEl.style.color = '#c47070';
        statusEl.textContent = 'Selecciona un archivo primero.';
        return;
    }

    const file  = fileInput.files[0];
    const icono = p.iconoOverride || nombre;
    const path  = `imgpersonajes/${_normImg(icono)}icon.png`;

    btn.textContent = 'Subiendo...';
    btn.disabled = true;
    statusEl.style.color = '#5a5a78';
    statusEl.textContent = 'Subiendo imagen…';

    let uploadFile = file;
    if (!file.type.includes('png')) {
        try {
            const bitmap = await createImageBitmap(file);
            const canvas = document.createElement('canvas');
            canvas.width  = bitmap.width;
            canvas.height = bitmap.height;
            canvas.getContext('2d').drawImage(bitmap, 0, 0);
            const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
            uploadFile = new File([blob], path, { type: 'image/png' });
        } catch(e) { /* usar original si falla */ }
    }

    const { error } = await supabase.storage
        .from('imagenes-hex')
        .upload(path, uploadFile, { upsert: true, contentType: 'image/png' });

    if (error) {
        statusEl.style.color = '#c47070';
        statusEl.textContent = '❌ Error: ' + error.message;
        btn.textContent = 'SUBIR';
        btn.disabled = false;
        return;
    }

    statusEl.style.color = '#3ecf6e';
    statusEl.textContent = '✅ Imagen subida correctamente.';
    renderCatalogo();
    refreshPanelPJ();
    setTimeout(() => {
        document.getElementById('hex-img-upload-modal')?.remove();
    }, 1500);
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
