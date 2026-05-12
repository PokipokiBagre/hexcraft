// ============================================================
// personajes-logic.js — Cálculos y lógica de negocio
// /personajes/personajes-logic.js
// ============================================================

import { AFINIDADES, formulas, pushFormulas, pushUmbrales, pushCooldown, personajes } from './personajes-state.js';

// ─────────────────────────────────────────────────────────────
// Contexto de variables para evaluar fórmulas
// ─────────────────────────────────────────────────────────────
export function buildContext(p) {
    // Soporta tanto nuevo schema (afin_base/afin_extra/afin_alter) como legacy
    const af = p.afin_base  || p.afinidadesBase || {};
    const hz = p.afin_hcz   || p.afinidadesHz   || {};   // afinidades de hechizos (JSONB calculado por trigger)
    const ef = p.afin_alter || p.afinidadesEf   || {};
    const bf = p.afin_extra || p.afinidadesBf   || {};

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
        Hz5: p.hz_clase5 || 0,
        // Suma de valor_vex de todos los hechizos del inventario
        VexHz: p.hz_vex_total || 0
    };
}

// Evalúa una expresión con el contexto de un personaje
export function evalExpr(expr, ctx) {
    if (!expr || !expr.trim()) return 0;
    try {
        const { Fis,Ene,Esp,Man,Psi,Osc,FisB,EneB,EspB,ManB,PsiB,OscB,Hz1,Hz2,Hz3,Hz4,Hz5,VexHz } = ctx;
        // eslint-disable-next-line no-new-func
        const resultado = new Function('Fis','Ene','Esp','Man','Psi','Osc','FisB','EneB','EspB','ManB','PsiB','OscB','Hz1','Hz2','Hz3','Hz4','Hz5','VexHz',
            `"use strict"; return (${expr});`
        )(Fis,Ene,Esp,Man,Psi,Osc,FisB,EneB,EspB,ManB,PsiB,OscB,Hz1,Hz2,Hz3,Hz4,Hz5,VexHz);
        return isFinite(resultado) ? Math.round(resultado) : 0;
    } catch { return 0; }
}

// Evalúa una condición de umbral de push
// Contexto: pct_vida_roja (0-100), vida_azul (valor absoluto calculado)
function evalCondicion(condicion, pct_vida_roja, vida_azul) {
    try {
        // eslint-disable-next-line no-new-func
        return new Function('pct_vida_roja', 'vida_azul',
            `return !!(${condicion});`
        )(pct_vida_roja, vida_azul);
    } catch { return false; }
}

// Calcula todos los stats derivados para un personaje
export function calcularStats(p) {
    const ctx = buildContext(p);
    const esJugador = p.isPlayer || p.npc_tipo === 'jugador';

    const b = p.bonos_stats || {};
    const bonoVR = b.vida_roja || p.bono_vida_roja || 0;
    const bonoVA = b.vida_azul || p.bono_vida_azul || 0;
    const bonoG  = b.guarda    || p.bono_guarda    || 0;
    const bonoDR = b.dano_rojo || p.bono_dano_rojo || 0;
    const bonoDA = b.dano_azul || p.bono_dano_azul || 0;

    // ── Vida Roja ────────────────────────────────────────────────
    // Techo máximo = fórmula + override manual (suma, igual que Guarda)
    const vida_roja_max_formula = evalExpr(formulas.vida_roja_max.expr, ctx) + bonoVR;
    const vida_roja_max_override = p.vida_roja_max_override || 0;
    const vida_roja_max = vida_roja_max_formula + vida_roja_max_override;

    // ── Vida Azul ─────────────────────────────────────────────────
    // vida_azul NO tiene techo. Es un único valor acumulable.
    // vida_azul_base = valor calculado por la fórmula (lo que "da" el personaje)
    // vida_azul_mod  = guardado en vida_azul_actual (modificación acumulada por el OP)
    // vida_azul_total = base + mod  ← este es el valor real mostrado
    const vida_azul_base  = evalExpr(formulas.vida_azul_max.expr, ctx) + bonoVA;
    const vida_azul_mod   = p.vida_azul_actual ?? 0;  // delta guardado, puede ser neg
    const vida_azul_total = vida_azul_base + vida_azul_mod;

    // ── Guarda Dorada ─────────────────────────────────────────────
    // guarda_max_total = fórmula + override (suma, no reemplaza)
    // guarda_actual    = valor perdible (0 … guarda_max_total)
    const guarda_max_formula = evalExpr(formulas.guarda_max.expr, ctx) + bonoG;
    const guarda_max_override = p.guarda_max_override || 0;  // modificación manual sumada
    const guarda_max = guarda_max_formula + guarda_max_override;

    // ── VEX ──────────────────────────────────────────────────────
    // Si la fórmula aplica a 'todos', evaluarla para cualquier PJ (jugador o NPC)
    // Si aplica solo a 'jugador', los NPC sistema usan el campo fijo p.vex_max
    const vexFormAplica = formulas.vex_max?.aplica || 'jugador';
    const vex_max = (esJugador || vexFormAplica === 'todos')
        ? evalExpr(formulas.vex_max.expr, ctx)
        : (p.vex_max || 0);

    const dano_rojo = evalExpr(formulas.dano_rojo.expr, ctx) + bonoDR;
    const dano_azul = evalExpr(formulas.dano_azul.expr, ctx) + bonoDA;

    return {
        vida_roja_max,
        vida_roja_max_formula,
        vida_roja_max_override,
        vida_azul_base,   // valor calculado por fórmula (label: "base")
        vida_azul_mod,    // modificación acumulada guardada en DB
        vida_azul_total,  // = base + mod, el número que se muestra
        guarda_max,       // = fórmula + override (suma)
        guarda_max_formula,
        guarda_max_override,
        vex_max,
        dano_rojo, dano_azul, ctx
    };
}

// ─────────────────────────────────────────────────────────────
// SISTEMA PUSH
// ─────────────────────────────────────────────────────────────

/**
 * Calcula cuántos pushes tiene disponibles un personaje para un recurso.
 * Evalúa cada umbral y suma los pushes que cumple.
 * Más el extra que el OP haya asignado directamente en su campo push_X_limit.
 */
export function calcularPushDisponibles(p, s, recurso) {
    const vidaRojaActual = p.vida_roja_actual || 0;
    const pct_vida_roja = s.vida_roja_max > 0
        ? Math.round(vidaRojaActual / s.vida_roja_max * 100)
        : 0;
    // s.vida_azul_total es el valor real (base + mod); vida_azul_max no existe en calcularStats
    const vida_azul = s.vida_azul_total ?? s.vida_azul_base ?? 0;

    const umbrales = pushUmbrales[recurso] || [];
    let total = 0;
    for (const u of umbrales) {
        if (evalCondicion(u.condicion, pct_vida_roja, vida_azul)) {
            total += u.pushes;
        }
    }
    // Extra asignado directamente por OP
    const extraKey = recurso === 'vex' ? 'push_vex_limit' : 'push_guarda_limit';
    total += p[extraKey] || 0;
    return total;
}

/**
 * Calcula el valor recuperado por cada push para un recurso.
 * Usa la fórmula de pushFormulas correspondiente.
 */
export function calcularValorPush(p, recurso) {
    const ctx = buildContext(p);
    const fKey = recurso === 'vex' ? 'valor_push_vex' : 'valor_push_guarda';
    const expr = pushFormulas[fKey]?.expr || '0';
    return evalExpr(expr, ctx);
}

/**
 * Calcula si el cooldown de push ha pasado.
 * Devuelve { disponible: bool, restaSeg: number }
 */
export function calcularCooldownPush(p, recurso) {
    const tsKey = recurso === 'vex' ? 'push_vex_ts' : 'push_guarda_ts';
    const ts = p[tsKey];
    const cooldownMin = pushCooldown[recurso] || 60;
    if (!ts) return { disponible: true, restaSeg: 0 };
    const pasadoSeg = (Date.now() - new Date(ts).getTime()) / 1000;
    const totalSeg  = cooldownMin * 60;
    if (pasadoSeg >= totalSeg) return { disponible: true, restaSeg: 0 };
    return { disponible: false, restaSeg: Math.ceil(totalSeg - pasadoSeg) };
}

/**
 * Devuelve la afinidad con mayor valor total
 */
export function getMayorAfinidad(p) {
    let max = -1, mayor = null;
    AFINIDADES.forEach(a => {
        const v = (p.afinidadesBase?.[a.key]||0)+(p.afinidadesHz?.[a.key]||0)+(p.afinidadesEf?.[a.key]||0)+(p.afinidadesBf?.[a.key]||0);
        if (v > max) { max = v; mayor = a; }
    });
    return max > 0 ? mayor : null;
}

// Mapea un registro crudo de Supabase al formato interno
// Compatible con schema nuevo (afin_base/afin_extra/afin_alter JSONB + bonos_stats + cd_*)
// y schema antiguo (columnas af_fisica, hz_fisica, etc.) como fallback
export function mapPersonaje(row) {
    const _afin0 = { fisica:0, energetica:0, espiritual:0, mando:0, psiquica:0, oscura:0 };

    // ── Afinidades: schema nuevo (JSONB) tiene prioridad ─────────
    const afinBase  = row.afin_base  && typeof row.afin_base  === 'object' ? row.afin_base
        : { fisica: row.af_fisica||0, energetica: row.af_energetica||0, espiritual: row.af_espiritual||0,
            mando: row.af_mando||0, psiquica: row.af_psiquica||0, oscura: row.af_oscura||0 };

    // afin_extra = "Ext" (antes afinidadesBf — buffs externos asignados por OP)
    const afinExtra = row.afin_extra && typeof row.afin_extra === 'object' ? row.afin_extra
        : { fisica: row.bf_fisica||0, energetica: row.bf_energetica||0, espiritual: row.bf_espiritual||0,
            mando: row.bf_mando||0, psiquica: row.bf_psiquica||0, oscura: row.bf_oscura||0 };

    // afin_alter = "Alt" (antes afinidadesEf — modificadores de efecto)
    const afinAlter = row.afin_alter && typeof row.afin_alter === 'object' ? row.afin_alter
        : { fisica: row.ef_fisica||0, energetica: row.ef_energetica||0, espiritual: row.ef_espiritual||0,
            mando: row.ef_mando||0, psiquica: row.ef_psiquica||0, oscura: row.ef_oscura||0 };

    // afin_hcz = afinidades de hechizos (calculado por trigger desde el inventario)
    const afinHz = row.afin_hcz && typeof row.afin_hcz === 'object' ? row.afin_hcz
        : { fisica:0, energetica:0, espiritual:0, mando:0, psiquica:0, oscura:0 };
    const bonos = row.bonos_stats && typeof row.bonos_stats === 'object' ? row.bonos_stats
        : { vida_roja:0, vida_azul:0, guarda:0, dano_rojo:0, dano_azul:0 };

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
        vida_azul_actual: row.vida_azul_actual || 0,
        vida_azul_max:    row.vida_azul_max    || 0,
        guarda_actual: row.guarda_actual || 0,
        guarda_max:    row.guarda_max    || 0,
        // Push VEX
        push_vex_actual:  row.push_vex_actual  || 0,
        push_vex_limit:   row.push_vex_limit   || 0,
        push_vex_extra:   row.push_vex_extra   || 0,
        push_vex_ts:      row.push_vex_ts      || null,
        // Push Guarda
        push_guarda_actual: row.push_guarda_actual || 0,
        push_guarda_limit:  row.push_guarda_limit  || 0,
        push_guarda_extra:  row.push_guarda_extra  || 0,
        push_guarda_ts:     row.push_guarda_ts     || null,
        // Afinidades (nuevo schema JSONB)
        afin_base:  { ..._afin0, ...afinBase  },
        afin_extra: { ..._afin0, ...afinExtra },
        afin_alter: { ..._afin0, ...afinAlter },
        afin_hcz:   { ..._afin0, ...afinHz   },   // hechizos — calculado por trigger
        // Alias legacy para compatibilidad con buildContext y renderCatalogo
        afinidadesBase: { ..._afin0, ...afinBase  },
        afinidadesHz:   { ..._afin0, ...afinHz   },   // ahora sí se lee de afin_hcz
        afinidadesEf:   { ..._afin0, ...afinAlter },
        afinidadesBf:   { ..._afin0, ...afinExtra },
        // Bonos de stats calculados (del trigger o manual)
        bonos_stats: bonos,
        bono_vida_roja: bonos.vida_roja || 0,
        bono_vida_azul: bonos.vida_azul || 0,
        bono_guarda:    bonos.guarda    || 0,
        bono_dano_rojo: bonos.dano_rojo || 0,
        bono_dano_azul: bonos.dano_azul || 0,
        // Overrides manuales de máximos (schema nuevo)
        vida_roja_max_override: row.vida_roja_max_op || 0,
        vida_azul_max_override: row.vida_azul_max_op || 0,
        guarda_max_override:    row.guarda_max_op    || 0,
        // Cooldowns por afinidad — lee cd_afin (JSONB) con fallback a columnas individuales
        cd_fisica:     (row.cd_afin?.fisica     ?? row.cd_fisica)     ?? 0.5,
        cd_energetica: (row.cd_afin?.energetica ?? row.cd_energetica) ?? 0.5,
        cd_espiritual: (row.cd_afin?.espiritual ?? row.cd_espiritual) ?? 0.5,
        cd_mando:      (row.cd_afin?.mando      ?? row.cd_mando)      ?? 0.5,
        cd_psiquica:   (row.cd_afin?.psiquica   ?? row.cd_psiquica)   ?? 0.5,
        cd_oscura:     (row.cd_afin?.oscura     ?? row.cd_oscura)     ?? 0.5,
        // Hechizos por clase
        hz_clase1: row.hz_clase1 || 0, hz_clase2: row.hz_clase2 || 0,
        hz_clase3: row.hz_clase3 || 0, hz_clase4: row.hz_clase4 || 0,
        hz_clase5: row.hz_clase5 || 0,
        // Suma de valor_vex de los hechizos del inventario (calculada por trigger)
        hz_vex_total: row.hz_vex_total || 0,
        estados: row.estados || {}
    };
}

// Serializa el estado interno al formato de Supabase para upsert (schema nuevo)
export function serializarPersonaje(nombre, p) {
    const _afin0 = { fisica:0, energetica:0, espiritual:0, mando:0, psiquica:0, oscura:0 };
    const afinBase  = { ..._afin0, ...(p.afin_base  || p.afinidadesBase || {}) };
    const afinExtra = { ..._afin0, ...(p.afin_extra  || p.afinidadesBf   || {}) };
    const afinAlter = { ..._afin0, ...(p.afin_alter  || p.afinidadesEf   || {}) };

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
        vida_azul_actual: p.vida_azul_actual || 0,
        vida_azul_max:    p.vida_azul_max    || 0,
        guarda_actual: p.guarda_actual || 0,
        guarda_max:    p.guarda_max    || 0,
        // Push
        push_vex_actual:    p.push_vex_actual    || 0,
        push_vex_limit:     p.push_vex_limit     || 0,
        push_vex_extra:     p.push_vex_extra     || 0,
        push_vex_ts:        p.push_vex_ts        || null,
        push_guarda_actual: p.push_guarda_actual || 0,
        push_guarda_limit:  p.push_guarda_limit  || 0,
        push_guarda_extra:  p.push_guarda_extra  || 0,
        push_guarda_ts:     p.push_guarda_ts     || null,
        // Afinidades JSONB (schema nuevo)
        afin_base:  afinBase,
        afin_extra: afinExtra,
        afin_alter: afinAlter,
        // Override máximos
        vida_roja_max_op: p.vida_roja_max_override || 0,
        vida_azul_max_op: p.vida_azul_max_override || 0,
        guarda_max_op:    p.guarda_max_override    || 0,
        // Cooldowns — escribe cd_afin (JSONB) y también columnas individuales por retrocompat
        cd_afin: {
            fisica:     p.cd_fisica     ?? 0.5,
            energetica: p.cd_energetica ?? 0.5,
            espiritual: p.cd_espiritual ?? 0.5,
            mando:      p.cd_mando      ?? 0.5,
            psiquica:   p.cd_psiquica   ?? 0.5,
            oscura:     p.cd_oscura     ?? 0.5,
        },
        cd_fisica:     p.cd_fisica     ?? 0.5,
        cd_energetica: p.cd_energetica ?? 0.5,
        cd_espiritual: p.cd_espiritual ?? 0.5,
        cd_mando:      p.cd_mando      ?? 0.5,
        cd_psiquica:   p.cd_psiquica   ?? 0.5,
        cd_oscura:     p.cd_oscura     ?? 0.5,
        // Hechizos por clase
        hz_clase1: p.hz_clase1||0, hz_clase2: p.hz_clase2||0,
        hz_clase3: p.hz_clase3||0, hz_clase4: p.hz_clase4||0,
        hz_clase5: p.hz_clase5||0,
        estados: p.estados || {}
    };
}
