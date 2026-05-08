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
  stack: [],

  // ── Catálogo de hechizos ────────────────────────────────────
  catalogoDB: [],       // hechizos_nodos completo

  // ── Historial de lanzamientos de turnos anteriores al activo ─
  // Se carga al navegar a un turno. Formato:
  // { 'NombrePJ:afinidad': count }  — solo turnos con numero < turnoActivo.numero
  historialSesion: {},

  // ── Cooldown por afinidad de cada personaje ──────────────────
  // { 'NombrePJ': { fisica: 0.5, energetica: 0.5, ... } }
  cdPorPj: {},

  // Vistas del panel
  vistaActiva: 'sesiones', // 'sesiones' | 'cast'
};

// ── Helpers de cooldown ──────────────────────────────────────
/**
 * Calcula el multiplicador de cooldown para un PJ+afinidad.
 *
 * El CD es acumulativo a lo largo de TODA la sesión:
 *   previosSesion  = lanzamientos de esa afinidad en turnos anteriores al turno activo
 *   previosStack   = lanzamientos ya en el stack del turno actual (antes de este item)
 *   totalPrevios   = previosSesion + previosStack
 *
 * mult = 1 + totalPrevios * cd_afinidad
 * Si totalPrevios === 0 → mult = 1.0 (sin CD)
 *
 * El mult NO modifica el costo HEX. Solo eleva el NC necesario para el éxito:
 *   NC_necesario = costoBase * mult
 */
export function calcularMultCooldown(pjNombre, afinidad, stackPrevio) {
  const afKey = (afinidad || '').toLowerCase();
  const k = `${pjNombre}:${afKey}`;

  // Lanzamientos en turnos anteriores de la sesión
  const previosSesion = hxState.historialSesion[k] || 0;

  // Lanzamientos ya en el stack del turno actual antes de este item
  const previosStack = stackPrevio.filter(item =>
    item.pjNombre === pjNombre &&
    (item.hechizo?.afinidad || '').toLowerCase() === afKey
  ).length;

  const totalPrevios = previosSesion + previosStack;
  if (totalPrevios === 0) return 1.0;

  const cd = hxState.cdPorPj[pjNombre]?.[afKey] ?? 0.5;
  return 1 + totalPrevios * cd;
}

/**
 * NC necesario para el éxito = costoBase × mult (redondeado).
 * El costo HEX real siempre es costoBase, sin multiplicar.
 */
export function ncNecesario(costoBase, mult) {
  return Math.round(costoBase * mult);
}

// Alias de compatibilidad (no se usa para cobrar HEX)
export function costoConCooldown(costoBase, mult) {
  return ncNecesario(costoBase, mult);
}
