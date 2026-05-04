// ============================================================
// personajes-logic.js — Cálculos y lógica de negocio
// /personajes/personajes-logic.js
// ============================================================

import { AFINIDADES, formulas, regenConfig, personajes } from './personajes-state.js';

// ─────────────────────────────────────────────────────────────
// Contexto de variables para evaluar fórmulas
// ─────────────────────────────────────────────────────────────
export function buildContext(p) {
    const af = p.afinidadesBase   || {};
    const hz = p.afinidadesHz     || {};
    const ef = p.afinidadesEf     || {};
    const bf = p.afinidadesBf     || {};

    const tot = (k) => (af[k]||0) + (hz[k]||0) + (ef[k]||0) + (bf[k]||0);

    return {
        // Totales
        Fis: tot('fisica'),
        Ene: tot('energetica'),
        Esp: tot('espiritual'),
        Man: tot('mando'),
        Psi: tot('psiquica'),
        Osc: tot('oscura'),
        // Solo base
        FisB: af.fisica     || 0,
        EneB: af.energetica || 0,
        EspB: af.espiritual || 0,
        ManB: af.mando      || 0,
        PsiB: af.psiquica   || 0,
        OscB: af.oscura     || 0,
        // Hechizos por clase
        Hz1: p.hz_clase1 || 0,
        Hz2: p.hz_clase2 || 0,
        Hz3: p.hz_clase3 || 0,
        Hz4: p.hz_clase4 || 0,
        Hz5: p.hz_clase5 || 0
    };
}

// Evalúa una expresión con el contexto de un personaje
export function evalExpr(expr, ctx) {
    try {
        const { Fis,Ene,Esp,Man,Psi,Osc,FisB,EneB,EspB,ManB,PsiB,OscB,Hz1,Hz2,Hz3,Hz4,Hz5 } = ctx;
        // eslint-disable-next-line no-new-func
        const resultado = new Function('Fis','Ene','Esp','Man','Psi','Osc','FisB','EneB','EspB','ManB','PsiB','OscB','Hz1','Hz2','Hz3','Hz4','Hz5',
            `return Math.max(0, ${expr});`
        )(Fis,Ene,Esp,Man,Psi,Osc,FisB,EneB,EspB,ManB,PsiB,OscB,Hz1,Hz2,Hz3,Hz4,Hz5);
        return isFinite(resultado) ? Math.round(resultado) : 0;
    } catch { return 0; }
}

// Calcula todos los stats derivados para un personaje
export function calcularStats(p) {
    const ctx = buildContext(p);
    const esJugador = p.isPlayer || p.npc_tipo === 'jugador';

    const vida_roja_max = evalExpr(formulas.vida_roja_max.expr, ctx)
        + (p.hz_vida_roja||0) + (p.ef_vida_roja||0) + (p.bf_vida_roja||0);

    const vida_azul_max = evalExpr(formulas.vida_azul_max.expr, ctx)
        + (p.hz_vida_azul||0) + (p.ef_vida_azul||0) + (p.bf_vida_azul||0);

    const guarda_max = evalExpr(formulas.guarda_max.expr, ctx)
        + (p.hz_guarda||0) + (p.ef_guarda||0) + (p.bf_guarda||0);

    const vex_max = esJugador
        ? evalExpr(formulas.vex_max.expr, ctx)
        : (p.vex_max || 0);

    const dano_rojo = evalExpr(formulas.dano_rojo.expr, ctx)
        + (p.hz_dano_rojo||0) + (p.ef_dano_rojo||0) + (p.bf_dano_rojo||0);

    const dano_azul = evalExpr(formulas.dano_azul.expr, ctx)
        + (p.hz_dano_azul||0) + (p.ef_dano_azul||0) + (p.bf_dano_azul||0);

    // Regen por hora
    const regen_vex    = evalExpr(regenConfig.vex.expr, ctx);
    const regen_guarda = evalExpr(regenConfig.guarda.expr, ctx);

    return { vida_roja_max, vida_azul_max, guarda_max, vex_max, dano_rojo, dano_azul, regen_vex, regen_guarda, ctx };
}

// Devuelve la afinidad con mayor valor total
export function getMayorAfinidad(p) {
    let max = -1, mayor = null;
    AFINIDADES.forEach(a => {
        const v = (p.afinidadesBase?.[a.key]||0)+(p.afinidadesHz?.[a.key]||0)+(p.afinidadesEf?.[a.key]||0)+(p.afinidadesBf?.[a.key]||0);
        if (v > max) { max = v; mayor = a; }
    });
    return max > 0 ? mayor : null;
}

// Mapea un registro crudo de Supabase al formato interno
export function mapPersonaje(row) {
    return {
        isPlayer:  row.is_player,
        isActive:  row.is_active,
        npc_tipo:  row.npc_tipo || 'sistema',
        iconoOverride: row.icono_override || row.nombre,
        hex:       row.hex        || 0,
        asistencia: row.asistencia || 1,
        vex_actual: row.vex_actual || 0,
        vex_max:    row.vex_max    || 0,
        vida_roja_actual: row.vida_roja_actual || 10,
        vida_azul_max:    row.vida_azul_max    || 0,
        guarda_actual: row.guarda_actual || 0,
        guarda_max:    row.guarda_max    || 0,
        afinidadesBase: {
            fisica:     row.af_fisica     || 0,
            energetica: row.af_energetica || 0,
            espiritual: row.af_espiritual || 0,
            mando:      row.af_mando      || 0,
            psiquica:   row.af_psiquica   || 0,
            oscura:     row.af_oscura     || 0
        },
        afinidadesHz: {
            fisica:     row.hz_fisica     || 0,
            energetica: row.hz_energetica || 0,
            espiritual: row.hz_espiritual || 0,
            mando:      row.hz_mando      || 0,
            psiquica:   row.hz_psiquica   || 0,
            oscura:     row.hz_oscura     || 0
        },
        afinidadesEf: {
            fisica:     row.ef_fisica     || 0,
            energetica: row.ef_energetica || 0,
            espiritual: row.ef_espiritual || 0,
            mando:      row.ef_mando      || 0,
            psiquica:   row.ef_psiquica   || 0,
            oscura:     row.ef_oscura     || 0
        },
        afinidadesBf: {
            fisica:     row.bf_fisica     || 0,
            energetica: row.bf_energetica || 0,
            espiritual: row.bf_espiritual || 0,
            mando:      row.bf_mando      || 0,
            psiquica:   row.bf_psiquica   || 0,
            oscura:     row.bf_oscura     || 0
        },
        hz_vida_roja: row.hz_vida_roja || 0, hz_vida_azul: row.hz_vida_azul || 0,
        hz_guarda:    row.hz_guarda    || 0, hz_dano_rojo: row.hz_dano_rojo || 0,
        hz_dano_azul: row.hz_dano_azul || 0,
        ef_vida_roja: row.ef_vida_roja || 0, ef_vida_azul: row.ef_vida_azul || 0,
        ef_guarda:    row.ef_guarda    || 0, ef_dano_rojo: row.ef_dano_rojo || 0,
        ef_dano_azul: row.ef_dano_azul || 0,
        bf_vida_roja: row.bf_vida_roja || 0, bf_vida_azul: row.bf_vida_azul || 0,
        bf_guarda:    row.bf_guarda    || 0, bf_dano_rojo: row.bf_dano_rojo || 0,
        bf_dano_azul: row.bf_dano_azul || 0,
        hz_clase1: row.hz_clase1 || 0, hz_clase2: row.hz_clase2 || 0,
        hz_clase3: row.hz_clase3 || 0, hz_clase4: row.hz_clase4 || 0,
        hz_clase5: row.hz_clase5 || 0,
        estados: row.estados || {}
    };
}

// Serializa el estado interno al formato de Supabase para upsert
export function serializarPersonaje(nombre, p) {
    const af = p.afinidadesBase || {};
    const hz = p.afinidadesHz   || {};
    const ef = p.afinidadesEf   || {};
    const bf = p.afinidadesBf   || {};
    return {
        nombre,
        is_player:   p.isPlayer,
        is_active:   p.isActive,
        npc_tipo:    p.npc_tipo,
        icono_override: p.iconoOverride || nombre,
        hex:         p.hex        || 0,
        asistencia:  p.asistencia || 1,
        vex_actual:  p.vex_actual || 0,
        vex_max:     p.vex_max    || 0,
        vida_roja_actual: p.vida_roja_actual || 0,
        vida_azul_max:    p.vida_azul_max    || 0,
        guarda_actual: p.guarda_actual || 0,
        guarda_max:    p.guarda_max    || 0,
        af_fisica:    af.fisica     || 0, af_energetica: af.energetica || 0,
        af_espiritual:af.espiritual || 0, af_mando:      af.mando      || 0,
        af_psiquica:  af.psiquica   || 0, af_oscura:     af.oscura     || 0,
        hz_fisica:    hz.fisica     || 0, hz_energetica: hz.energetica || 0,
        hz_espiritual:hz.espiritual || 0, hz_mando:      hz.mando      || 0,
        hz_psiquica:  hz.psiquica   || 0, hz_oscura:     hz.oscura     || 0,
        ef_fisica:    ef.fisica     || 0, ef_energetica: ef.energetica || 0,
        ef_espiritual:ef.espiritual || 0, ef_mando:      ef.mando      || 0,
        ef_psiquica:  ef.psiquica   || 0, ef_oscura:     ef.oscura     || 0,
        bf_fisica:    bf.fisica     || 0, bf_energetica: bf.energetica || 0,
        bf_espiritual:bf.espiritual || 0, bf_mando:      bf.mando      || 0,
        bf_psiquica:  bf.psiquica   || 0, bf_oscura:     bf.oscura     || 0,
        hz_vida_roja: p.hz_vida_roja||0, hz_vida_azul: p.hz_vida_azul||0,
        hz_guarda:    p.hz_guarda   ||0, hz_dano_rojo: p.hz_dano_rojo||0,
        hz_dano_azul: p.hz_dano_azul||0,
        ef_vida_roja: p.ef_vida_roja||0, ef_vida_azul: p.ef_vida_azul||0,
        ef_guarda:    p.ef_guarda   ||0, ef_dano_rojo: p.ef_dano_rojo||0,
        ef_dano_azul: p.ef_dano_azul||0,
        bf_vida_roja: p.bf_vida_roja||0, bf_vida_azul: p.bf_vida_azul||0,
        bf_guarda:    p.bf_guarda   ||0, bf_dano_rojo: p.bf_dano_rojo||0,
        bf_dano_azul: p.bf_dano_azul||0,
        hz_clase1: p.hz_clase1||0, hz_clase2: p.hz_clase2||0,
        hz_clase3: p.hz_clase3||0, hz_clase4: p.hz_clase4||0,
        hz_clase5: p.hz_clase5||0,
        estados: p.estados || {}
    };
}
