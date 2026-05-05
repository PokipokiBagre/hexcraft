// ============================================================
// personajes-state.js — Estado global del módulo de personajes
// /personajes/personajes-state.js
// ============================================================

export const AFINIDADES = [
    { key: 'fisica',     label: 'Física',     abr: 'Fis' },
    { key: 'energetica', label: 'Energética', abr: 'Ene' },
    { key: 'espiritual', label: 'Espiritual', abr: 'Esp' },
    { key: 'mando',      label: 'Mando',      abr: 'Man' },
    { key: 'psiquica',   label: 'Psíquica',   abr: 'Psi' },
    { key: 'oscura',     label: 'Oscura',     abr: 'Osc' }
];

// Variables disponibles en las fórmulas con sus descripciones legibles
export const VARS_FORMULA = [
    // Totales (base + hechizos + efectos + buffs)
    { key: 'Fis', label: 'Física total',      fuente: 'total' },
    { key: 'Ene', label: 'Energética total',  fuente: 'total' },
    { key: 'Esp', label: 'Espiritual total',  fuente: 'total' },
    { key: 'Man', label: 'Mando total',       fuente: 'total' },
    { key: 'Psi', label: 'Psíquica total',    fuente: 'total' },
    { key: 'Osc', label: 'Oscura total',      fuente: 'total' },
    // Solo base
    { key: 'FisB', label: 'Física base',      fuente: 'base' },
    { key: 'EneB', label: 'Energética base',  fuente: 'base' },
    { key: 'EspB', label: 'Espiritual base',  fuente: 'base' },
    { key: 'ManB', label: 'Mando base',       fuente: 'base' },
    { key: 'PsiB', label: 'Psíquica base',    fuente: 'base' },
    { key: 'OscB', label: 'Oscura base',      fuente: 'base' },
    // Hechizos por clase
    { key: 'Hz1', label: 'Hechizos Clase 1', fuente: 'hechizos' },
    { key: 'Hz2', label: 'Hechizos Clase 2', fuente: 'hechizos' },
    { key: 'Hz3', label: 'Hechizos Clase 3', fuente: 'hechizos' },
    { key: 'Hz4', label: 'Hechizos Clase 4', fuente: 'hechizos' },
    { key: 'Hz5', label: 'Hechizos Clase 5', fuente: 'hechizos' }
];

export const FORMULAS_DEFAULT = {
    vida_roja_max: { label: 'Vida Roja máxima',    expr: 'Math.floor(FisB / 2) + 10',                   aplica: 'todos' },
    vida_azul_max: { label: 'Vida Azul máxima',    expr: 'Math.floor((EneB + EspB + ManB + PsiB) / 4)', aplica: 'todos' },
    guarda_max:    { label: 'Guarda Dorada máx.',  expr: 'Math.floor(EspB / 3)',                         aplica: 'jugador' },
    vex_max:       { label: 'VEX máximo',          expr: 'Math.round(OscB * 75 / 50) * 50',             aplica: 'jugador' },
    dano_rojo:     { label: 'Daño Rojo base',      expr: 'Math.floor(FisB / 4)',                         aplica: 'todos' },
    dano_azul:     { label: 'Daño Azul base',      expr: 'Math.floor((EneB + ManB) / 4)',               aplica: 'todos' }
};

export const REGEN_DEFAULT = {
    vex:    { label: 'VEX / hora',            expr: 'Math.round(OscB * 75 / 50) * 50 * 0.5 + Hz3 * 25 + Hz4 * 60', intervalo: 12 },
    guarda: { label: 'Guarda Dorada / hora',  expr: 'Math.floor(EspB / 2)',                                          intervalo: 12 }
};

// Estado de UI
export let estadoUI = {
    vista: 'catalogo',       // 'catalogo' | 'crear' | 'formulas'
    filtroRol: 'Todos',
    filtroAct: 'Activo',
    busqueda: '',
    esAdmin: false,
    pjSeleccionado: null,
    panelAbierto: false,
    formMode: 'crear',       // 'crear' | 'editar'
    pjEditando: null
};

// Datos cargados de DB
export let personajes = {};
export let formulas = Object.fromEntries(
    Object.entries(FORMULAS_DEFAULT).map(([k, v]) => [k, { ...v }])
);
export let regenConfig = Object.fromEntries(
    Object.entries(REGEN_DEFAULT).map(([k, v]) => [k, { ...v }])
);

// Cola de cambios pendientes para sync
export let colaCambios = {};

export function limpiarCola() {
    for (const k in colaCambios) delete colaCambios[k];
}
export function encolarCambio(nombre, campo, valor) {
    if (!colaCambios[nombre]) colaCambios[nombre] = {};
    colaCambios[nombre][campo] = valor;
}

// Tick de regeneración en cliente (cada 10s)
export let regenTicker = null;
export function setRegenTicker(t) { regenTicker = t; }
