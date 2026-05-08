// ============================================================
// hexcast-state.js — Estado global del sistema HexCast
// ============================================================

// Colores distintivos por slot de personaje
// Grupo A → tonos rojos/cálidos, Grupo B → tonos azules/fríos
export const SLOT_COLORS = {
  A: [
    { bg: 'rgba(200,50,50,0.18)',  border: 'rgba(200,50,50,0.55)',  text: '#e87070', glow: 'rgba(200,50,50,0.25)'  },
    { bg: 'rgba(200,90,30,0.18)',  border: 'rgba(200,90,30,0.55)',  text: '#e89a55', glow: 'rgba(200,90,30,0.25)'  },
    { bg: 'rgba(180,40,100,0.18)', border: 'rgba(180,40,100,0.55)', text: '#e070b0', glow: 'rgba(180,40,100,0.25)' },
  ],
  B: [
    { bg: 'rgba(40,120,200,0.18)',  border: 'rgba(40,120,200,0.55)',  text: '#60a8e8', glow: 'rgba(40,120,200,0.25)'  },
    { bg: 'rgba(40,180,160,0.18)',  border: 'rgba(40,180,160,0.55)',  text: '#50d0c0', glow: 'rgba(40,180,160,0.25)'  },
    { bg: 'rgba(80,80,200,0.18)',   border: 'rgba(80,80,200,0.55)',   text: '#9090e8', glow: 'rgba(80,80,200,0.25)'   },
  ]
};

export const hxState = {
  // ── Sesiones ────────────────────────────────────────────────
  sesiones: [],         // lista de sesiones_hexcast de DB
  sesionActiva: null,   // objeto sesión seleccionada
  turnoActivo: null,    // objeto turno activo
  turnos: [],           // turnos de la sesión activa

  // ── Slots de personajes ──────────────────────────────────────
  // grupoA[0..2] y grupoB[0..2]: { nombre, color, inventario[] }
  grupoA: [null, null, null],
  grupoB: [null, null, null],

  // ── PJ seleccionado para mostrar su inventario ───────────────
  pjSeleccionado: null,    // { nombre, grupo, idx }
  inventarioPJ: {},        // { nombre: [hechizos...] }
  busquedaHz: '',

  // ── Stack de hechizos del turno ─────────────────────────────
  // [{ id, pjNombre, grupo, idx, hechizo, infalible, cobrarHex, esPrioridad,
  //    dado, afinidadEfectiva, abierto, resultado, ncCalc, costoEfectivo, mult }]
  stack: [],

  // ── Catálogo de hechizos ────────────────────────────────────
  catalogoDB: [],       // hechizos_nodos completo

  // ── Cooldowns acumulados en esta sesión ──────────────────────
  // { 'NombrePJ:afinidad': contadorLanzamientos }
  cooldownsSession: {},

  // ── Cooldown por afinidad de cada personaje ──────────────────
  // { 'NombrePJ': { fisica: 0.5, energetica: 0.5, ... } }
  cdPorPj: {},

  // Vistas del panel
  vistaActiva: 'sesiones', // 'sesiones' | 'cast'
};

// ── Helpers de cooldown ──────────────────────────────────────
/**
 * Obtiene el multiplicador de cooldown para un PJ+afinidad en el stack actual.
 * Si el mismo PJ lanza el mismo hechizo N veces en el mismo turno,
 * la N-ésima lanzada aplica un factor de cooldown.
 * factor = 1 + (n_usos_previos_de_esa_afinidad) * cd_afinidad
 */
export function calcularMultCooldown(pjNombre, afinidad, stack) {
  const afKey = afinidad?.toLowerCase() || 'fisica';
  // Contar cuántos hechizos de la misma afinidad lanzó este PJ antes en el stack
  const previos = stack.filter(item =>
    item.pjNombre === pjNombre &&
    (item.hechizo?.afinidad || '').toLowerCase() === afKey
  ).length;
  if (previos === 0) return 1.0;
  // cd es el factor de incremento por repetición (ej: 0.5 → cada rep. +50%)
  const cd = hxState.cdPorPj[pjNombre]?.[afKey] ?? 0.5;
  return 1 + previos * cd;
}

export function costoConCooldown(costoBase, mult) {
  return Math.round(costoBase * mult);
}
