// ============================================================
// personajes-main.js — Punto de entrada
// /personajes/personajes-main.js
// ============================================================

import { hexAuth } from '../hex-auth.js';
import { db } from '../hex-db.js';
import { estadoUI, personajes, formulas, regenConfig, colaCambios, encolarCambio, FORMULAS_DEFAULT, REGEN_DEFAULT, setRegenTicker } from './personajes-state.js';
import { calcularStats, buildContext, evalExpr } from './personajes-logic.js';
import { cargarDatos, sincronizarCola, guardarFormulasBD, guardarRegenBD, ejecutarRegenBD } from './personajes-data.js';
import { renderCatalogo, renderDetalle, renderFormulas, previsualizarFormulaConPJ, previsualizarRegenConPJ, renderPreviewCompleto } from './personajes-ui.js';

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

    // Regeneración cliente: cada 10 segundos aplica regen proporcional
    const ticker = setInterval(() => {
        const TICK_SEG = 10;
        let cambio = false;
        for (const [nombre, p] of Object.entries(personajes)) {
            if (!p.isActive) continue;
            const s = calcularStats(p);

            // VEX: regen_vex por hora → por 10s
            if (s.vex_max > 0 && p.vex_actual < s.vex_max) {
                const regenPorTick = s.regen_vex_total / 3600 * TICK_SEG;
                const nuevo = Math.min(s.vex_max, (p.vex_actual || 0) + regenPorTick);
                if (nuevo > p.vex_actual + 0.001) {
                    p._vex_fraccion = (p._vex_fraccion || 0) + regenPorTick;
                    if (p._vex_fraccion >= 1) {
                        const entero = Math.floor(p._vex_fraccion);
                        p.vex_actual = Math.min(s.vex_max, (p.vex_actual || 0) + entero);
                        p._vex_fraccion -= entero;
                        encolarCambio(nombre, 'vex_actual', p.vex_actual);
                        cambio = true;
                    }
                }
            }

            // Guarda: regen_guarda por hora → por 10s
            if (s.guarda_max > 0 && (p.guarda_actual || 0) < s.guarda_max) {
                p._guarda_fraccion = (p._guarda_fraccion || 0) + (s.regen_guarda_total / 3600 * TICK_SEG);
                if (p._guarda_fraccion >= 1) {
                    const entero = Math.floor(p._guarda_fraccion);
                    p.guarda_actual = Math.min(s.guarda_max, (p.guarda_actual || 0) + entero);
                    p._guarda_fraccion -= entero;
                    encolarCambio(nombre, 'guarda_actual', p.guarda_actual);
                    cambio = true;
                }
            }
        }
        if (cambio) {
            if (estadoUI.panelAbierto && estadoUI.pjSeleccionado) renderDetalle(estadoUI.pjSeleccionado);
            renderCatalogo();
            actualizarBtnSync();
        }
    }, 10000);
    setRegenTicker(ticker);
};

// ─────────────────────────────────────────────────────────────
// NAVEGACIÓN
// ─────────────────────────────────────────────────────────────
window.mostrarVista = function(vista) {
    // Pestaña "Crear": solo OP puede crear jugadores; no-OP solo NPCs
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
        if (!estadoUI.esAdmin) { mostrarToast('Solo el OP puede editar fórmulas', true); window.mostrarVista('catalogo'); return; }
        renderFormulas();
    }
};

window.abrirLoginOP = function() { hexAuth._mostrarModalLogin(); };
window.cambiarCampaña = function() {
    localStorage.removeItem('hex_selected');
    window.location.href = '../index.html';
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

// Modificar afinidad BASE (solo OP)
window.modAfin = function(nombre, afinKey, delta) {
    if (!estadoUI.esAdmin) return;
    const p = personajes[nombre]; if (!p) return;
    if (!p.afinidadesBase) p.afinidadesBase = {};
    p.afinidadesBase[afinKey] = Math.max(0, (p.afinidadesBase[afinKey] || 0) + delta);
    encolarCambio(nombre, `af_${afinKey}`, p.afinidadesBase[afinKey]);
    renderDetalle(nombre); renderCatalogo(); actualizarBtnSync();
};

// Modificar buff (bf) — disponible sin OP para NPCs, con OP para todos
window.modBf = function(nombre, afinKey, delta) {
    const p = personajes[nombre]; if (!p) return;
    if (!estadoUI.esAdmin && p.isPlayer) return; // no-OP no toca jugadores
    if (!p.afinidadesBf) p.afinidadesBf = {};
    p.afinidadesBf[afinKey] = Math.max(-999, (p.afinidadesBf[afinKey] || 0) + delta);
    encolarCambio(nombre, `bf_${afinKey}`, p.afinidadesBf[afinKey]);
    renderDetalle(nombre); renderCatalogo(); actualizarBtnSync();
};

// Modificar alteración (ef) — mismo permiso que bf
window.modEf = function(nombre, afinKey, delta) {
    const p = personajes[nombre]; if (!p) return;
    if (!estadoUI.esAdmin && p.isPlayer) return;
    if (!p.afinidadesEf) p.afinidadesEf = {};
    p.afinidadesEf[afinKey] = Math.max(-999, (p.afinidadesEf[afinKey] || 0) + delta);
    encolarCambio(nombre, `ef_${afinKey}`, p.afinidadesEf[afinKey]);
    renderDetalle(nombre); renderCatalogo(); actualizarBtnSync();
};

// Modificar regen bf (buff sobre regen_vex o regen_guarda)
window.modRegenBf = function(nombre, recurso, delta) {
    const p = personajes[nombre]; if (!p) return;
    if (!estadoUI.esAdmin && p.isPlayer) return;
    const campo = `regen_${recurso}_bf`;
    p[campo] = (p[campo] || 0) + delta;
    encolarCambio(nombre, campo, p[campo]);
    renderDetalle(nombre); actualizarBtnSync();
};

window.modRegenEf = function(nombre, recurso, delta) {
    const p = personajes[nombre]; if (!p) return;
    if (!estadoUI.esAdmin && p.isPlayer) return;
    const campo = `regen_${recurso}_ef`;
    p[campo] = (p[campo] || 0) + delta;
    encolarCambio(nombre, campo, p[campo]);
    renderDetalle(nombre); actualizarBtnSync();
};

window.editarPersonaje = function(nombre) {
    const p = personajes[nombre];
    // No-OP solo puede editar NPCs
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
// FORMULARIO CREAR/EDITAR
// ─────────────────────────────────────────────────────────────
let fIsJugador = true;
let fIsActivo  = true;

function inicializarFormulario() {
    if (estadoUI.formMode === 'crear') {
        estadoUI.pjEditando = null;
        resetFormulario();
        // No-OP: forzar NPC
        if (!estadoUI.esAdmin) {
            setToggleJugador(false);
            // Ocultar toggle de tipo jugador/NPC para no-OP
            const tg = document.getElementById('toggle-jugador');
            if (tg) tg.style.pointerEvents = 'none';
            const lbl = document.getElementById('lbl-jugador');
            if (lbl) lbl.style.opacity = '0.4';
        } else {
            const tg = document.getElementById('toggle-jugador');
            if (tg) tg.style.pointerEvents = '';
            const lbl = document.getElementById('lbl-jugador');
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

window.toggleJugador = () => {
    if (!estadoUI.esAdmin) return; // no-OP no puede cambiar a jugador
    setToggleJugador(!fIsJugador);
};
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

    // No-OP solo puede crear NPCs
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
        regen_vex_bf:    viejo.regen_vex_bf    || 0,
        regen_vex_ef:    viejo.regen_vex_ef    || 0,
        regen_guarda_bf: viejo.regen_guarda_bf || 0,
        regen_guarda_ef: viejo.regen_guarda_ef || 0,
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
    const isRegen = formulaActiva.startsWith('regen_');
    const realKey = isRegen ? formulaActiva.replace('regen_', '') : formulaActiva;
    const inputId = isRegen ? `rinput-${realKey}` : `finput-${realKey}`;
    const input = document.getElementById(inputId);
    if (!input) return;
    const pos = input.selectionStart;
    const val = input.value;
    input.value = val.slice(0, pos) + varKey + val.slice(pos);
    input.focus();
    input.setSelectionRange(pos + varKey.length, pos + varKey.length);
    if (isRegen) window.previsualizarRegen(realKey);
    else         window.previsualizarFormula(realKey);
};

window.previsualizarFormula = function(key) {
    const pjSel = document.getElementById('preview-pj-sel')?.value || Object.keys(personajes)[0];
    if (pjSel) previsualizarFormulaConPJ(key, pjSel);
};
window.previsualizarRegen = function(key) {
    const pjSel = document.getElementById('preview-pj-sel')?.value || Object.keys(personajes)[0];
    if (pjSel) previsualizarRegenConPJ(key, pjSel);
};

window.cambiarAplica = function(key, val) { formulas[key].aplica = val; };
window.cambiarRegenIv = function(key, val) { regenConfig[key].intervalo = parseFloat(val)||12; };

window.guardarFormulas = async function() {
    Object.keys(formulas).forEach(key => {
        const el = document.getElementById(`finput-${key}`);
        if (el) formulas[key].expr = el.value;
    });
    const ok = await guardarFormulasBD();
    mostrarToast(ok ? 'Fórmulas guardadas' : 'Error al guardar', !ok);
    renderCatalogo();
};

window.guardarRegen = async function() {
    Object.keys(regenConfig).forEach(key => {
        const el = document.getElementById(`rinput-${key}`);
        if (el) regenConfig[key].expr = el.value;
    });
    const ok = await guardarRegenBD();
    mostrarToast(ok ? 'Regeneración guardada' : 'Error al guardar', !ok);
};

window.resetFormulas = function() {
    Object.entries(FORMULAS_DEFAULT).forEach(([k, v]) => { formulas[k] = { ...v }; });
    Object.entries(REGEN_DEFAULT).forEach(([k, v]) => { regenConfig[k] = { ...v }; });
    renderFormulas();
};

window.ejecutarRegenManual = async function() {
    const btn = event.target; btn.disabled = true; btn.textContent = 'Ejecutando...';
    const res = await ejecutarRegenBD();
    mostrarToast(res.ok ? res.mensaje : 'Error: ' + res.mensaje, !res.ok);
    btn.disabled = false; btn.textContent = 'Ejecutar ahora (todos los personajes)';
    if (res.ok) { const ok2 = await cargarDatos(null); if (ok2) renderCatalogo(); }
};

window.actualizarPreviewPJ = function() {
    const sel = document.getElementById('preview-pj-sel')?.value;
    if (sel) {
        renderPreviewCompleto(sel);
        Object.keys(formulas).forEach(k => previsualizarFormulaConPJ(k, sel));
        Object.keys(regenConfig).forEach(k => previsualizarRegenConPJ(k, sel));
    }
};

// ─────────────────────────────────────────────────────────────
// SYNC
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
