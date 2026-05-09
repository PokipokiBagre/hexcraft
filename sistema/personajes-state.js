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
    vida_azul_max: { label: 'Vida Azul base (valor libre)',    expr: 'Math.floor((EneB + EspB + ManB + PsiB) / 4)', aplica: 'todos' },
    guarda_max:    { label: 'Guarda Dorada máx.',  expr: 'Math.floor(EspB / 3)',                         aplica: 'jugador' },
    vex_max:       { label: 'VEX máximo',          expr: 'Math.round(OscB * 75 / 50) * 50',             aplica: 'jugador' },
    dano_rojo:     { label: 'Daño Rojo base',      expr: 'Math.floor(FisB / 4)',                         aplica: 'todos' },
    dano_azul:     { label: 'Daño Azul base',      expr: 'Math.floor((EneB + ManB) / 4)',               aplica: 'todos' }
};

// ── Sistema Push ─────────────────────────────────────────────
// Fórmulas que calculan cuánto recupera cada push
export const PUSH_FORMULAS_DEFAULT = {
    valor_push_vex:    {
        label:      'Valor por push VEX',
        expr:       'Math.round((OscB * 75 / 50) * 50 * 0.5)',
        descripcion:'Cuánto VEX se recupera por cada push (redondeo a 50)'
    },
    valor_push_guarda: {
        label:      'Valor por push Guarda',
        expr:       'Math.max(1, Math.round(EspB / 3))',
        descripcion:'Cuánta Guarda Dorada se recupera por cada push (mín. 1)'
    }
};

// Umbrales que determinan cuántos pushes tiene disponibles un personaje
// Las condiciones usan: pct_vida_roja (0-100), vida_azul (valor absoluto)
export const PUSH_UMBRALES_DEFAULT = {
    vex: [
        { id: 'vex_1', descripcion: 'Vida Roja ≥ 50%', condicion: 'pct_vida_roja >= 50', pushes: 1, orden: 1 },
        { id: 'vex_2', descripcion: 'Vida Roja ≥ 75%', condicion: 'pct_vida_roja >= 75', pushes: 1, orden: 2 },
        { id: 'vex_3', descripcion: 'Vida Azul > 20',  condicion: 'vida_azul > 20',       pushes: 1, orden: 3 },
        { id: 'vex_4', descripcion: 'Vida Azul > 40',  condicion: 'vida_azul > 40',       pushes: 1, orden: 4 },
        { id: 'vex_5', descripcion: 'Vida Azul > 80',  condicion: 'vida_azul > 80',       pushes: 1, orden: 5 },
    ],
    guarda: [
        { id: 'g_1', descripcion: 'Vida Roja ≥ 50%', condicion: 'pct_vida_roja >= 50', pushes: 1, orden: 1 },
        { id: 'g_2', descripcion: 'Vida Roja ≥ 75%', condicion: 'pct_vida_roja >= 75', pushes: 1, orden: 2 },
        { id: 'g_3', descripcion: 'Vida Azul > 20',  condicion: 'vida_azul > 20',       pushes: 1, orden: 3 },
        { id: 'g_4', descripcion: 'Vida Azul > 40',  condicion: 'vida_azul > 40',       pushes: 1, orden: 4 },
        { id: 'g_5', descripcion: 'Vida Azul > 80',  condicion: 'vida_azul > 80',       pushes: 1, orden: 5 },
    ]
};

// Cooldown en minutos para cada tipo de push (editable por OP)
export const PUSH_COOLDOWN_DEFAULT = {
    vex:    60,   // 1 hora entre pushes de VEX
    guarda: 30    // 30 min entre pushes de Guarda
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

// Config del sistema Push (cargada de DB, con defaults como fallback)
export let pushFormulas = Object.fromEntries(
    Object.entries(PUSH_FORMULAS_DEFAULT).map(([k, v]) => [k, { ...v }])
);
export let pushUmbrales = {
    vex:    PUSH_UMBRALES_DEFAULT.vex.map(u => ({ ...u })),
    guarda: PUSH_UMBRALES_DEFAULT.guarda.map(u => ({ ...u }))
};
export let pushCooldown = { ...PUSH_COOLDOWN_DEFAULT };

// Cola de cambios pendientes para sync
export let colaCambios = {};

export function limpiarCola() {
    for (const k in colaCambios) delete colaCambios[k];
}
export function encolarCambio(nombre, campo, valor) {
    if (!colaCambios[nombre]) colaCambios[nombre] = {};
    colaCambios[nombre][campo] = valor;
}
