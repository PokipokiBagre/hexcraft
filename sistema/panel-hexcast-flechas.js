// ============================================================
// panel-hexcast-flechas.js — Sistema de flechas para HexCast
// Permite dibujar flechas de colores entre hechizos y personajes
// ============================================================

const fxState = {
  modo: null,          // 'flecha' | 'borrar' | null
  flechas: [],         // [{ id, puntos:[{x,y}], color, grosor, svgEl }]
  dibujando: null,     // { id, puntos, color, grosor }
  colores: [
    '#e84040', // rojo
    '#e87040', // naranja
    '#e8c040', // amarillo
    '#40c840', // verde
    '#40d0c0', // teal
    '#4090e8', // azul
    '#a040e8', // violeta
    '#e840b0', // rosa
    '#e8e8e8', // blanco
    '#888888', // gris
  ],
  colorActivo: '#40c840',
  grosor: 3,
  nextId: 1,
};

// ── CSS ────────────────────────────────────────────────────────
function _css() {
  if (document.getElementById('hxfx-styles')) return;
  const st = document.createElement('style');
  st.id = 'hxfx-styles';
  st.textContent = `
/* Canales de flechas */
.hxfx-canal {
  position: relative;
  overflow: visible;
  flex-shrink: 0;
}
.hxfx-svg {
  position: absolute;
  inset: 0;
  width: 100%; height: 100%;
  overflow: visible;
  z-index: 5;
  pointer-events: none;
}
.hxfx-svg.modo-flecha  { pointer-events: all; cursor: crosshair; }
.hxfx-svg.modo-borrar  { pointer-events: all; cursor: not-allowed; }

/* Toolbar de flechas */
.hxfx-toolbar {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 4px 8px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  flex-shrink: 0;
  flex-wrap: wrap;
  background: rgba(0,0,0,0.2);
}
.hxfx-btn {
  font-size: 0.62em;
  padding: 3px 8px;
  border-radius: 4px;
  border: 1px solid rgba(255,255,255,0.12);
  background: rgba(255,255,255,0.05);
  color: #888;
  cursor: pointer;
  transition: all 0.12s;
  white-space: nowrap;
  font-family: inherit;
}
.hxfx-btn:hover { background: rgba(255,255,255,0.12); color: #ccc; }
.hxfx-btn.activo { color: #fff; border-color: var(--activo-color, #40c840); background: rgba(64,200,64,0.12); box-shadow: 0 0 6px rgba(64,200,64,0.2); }
.hxfx-btn-borrar.activo { border-color: #e84040; background: rgba(232,64,64,0.12); box-shadow: 0 0 6px rgba(232,64,64,0.2); }
.hxfx-sep { width: 1px; height: 16px; background: rgba(255,255,255,0.1); flex-shrink: 0; }
.hxfx-colores { display: flex; gap: 3px; align-items: center; }
.hxfx-color-dot {
  width: 14px; height: 14px;
  border-radius: 50%;
  cursor: pointer;
  border: 2px solid transparent;
  transition: transform 0.12s, border-color 0.12s;
  flex-shrink: 0;
}
.hxfx-color-dot:hover { transform: scale(1.25); }
.hxfx-color-dot.sel { border-color: #fff; transform: scale(1.2); }
.hxfx-grosor-wrap { display: flex; align-items: center; gap: 4px; }
.hxfx-grosor-lbl { font-size: 0.58em; color: #666; }
.hxfx-grosor-inp {
  width: 30px;
  background: rgba(255,255,255,0.07);
  border: 1px solid rgba(255,255,255,0.14);
  border-radius: 3px;
  color: #ccc;
  font-size: 0.68em;
  padding: 2px 4px;
  text-align: center;
  outline: none;
  font-family: inherit;
}
.hxfx-btn-export {
  font-size: 0.62em;
  padding: 3px 9px;
  border-radius: 4px;
  border: 1px solid rgba(212,175,55,0.35);
  background: rgba(212,175,55,0.07);
  color: #d4af37;
  cursor: pointer;
  transition: all 0.12s;
  white-space: nowrap;
  font-family: inherit;
  margin-left: auto;
}
.hxfx-btn-export:hover { background: rgba(212,175,55,0.18); }
.hxfx-btn-clear {
  font-size: 0.62em;
  padding: 3px 7px;
  border-radius: 4px;
  border: 1px solid rgba(220,80,80,0.25);
  background: rgba(220,80,80,0.05);
  color: #e06060;
  cursor: pointer;
  transition: all 0.12s;
  font-family: inherit;
}
.hxfx-btn-clear:hover { background: rgba(220,80,80,0.15); }
`;
  document.head.appendChild(st);
}

// ── Render toolbar ─────────────────────────────────────────────
export function renderToolbarFlechas() {
  _css();
  const modoFlecha = fxState.modo === 'flecha';
  const modoBorrar = fxState.modo === 'borrar';

  const coloresDots = fxState.colores.map(c =>
    `<div class="hxfx-color-dot ${c===fxState.colorActivo?'sel':''}"
      style="background:${c};"
      title="${c}"
      onclick="window._hxfxSetColor('${c}')"></div>`
  ).join('');

  return `<div class="hxfx-toolbar">
    <button class="hxfx-btn ${modoFlecha?'activo':''}"
      style="${modoFlecha?'--activo-color:'+fxState.colorActivo:''}"
      onclick="window._hxfxToggleFlecha()">✏ Flecha</button>
    <button class="hxfx-btn hxfx-btn-borrar ${modoBorrar?'activo':''}"
      onclick="window._hxfxToggleBorrar()">✕ Borrar</button>
    <div class="hxfx-sep"></div>
    <div class="hxfx-colores">${coloresDots}</div>
    <div class="hxfx-sep"></div>
    <div class="hxfx-grosor-wrap">
      <span class="hxfx-grosor-lbl">Grosor</span>
      <input class="hxfx-grosor-inp" type="number" min="1" max="12" value="${fxState.grosor}"
        oninput="window._hxfxSetGrosor(this.value)" onclick="event.stopPropagation()">
    </div>
    <div class="hxfx-sep"></div>
    <button class="hxfx-btn-clear" onclick="window._hxfxLimpiar()">✕ Borrar todo</button>
    <button class="hxfx-btn-export" onclick="window._hxfxExportar(false)">📷 Exportar claro</button>
    <button class="hxfx-btn-export" style="border-color:rgba(255,255,255,0.15);color:#888;background:rgba(255,255,255,0.04);" onclick="window._hxfxExportar(true)">📷 Oscuro</button>
  </div>`;
}

// ── Render canales SVG ─────────────────────────────────────────
export function renderCanalSVG(lado) {
  const modo = fxState.modo;
  const cls = modo === 'flecha' ? 'modo-flecha' : modo === 'borrar' ? 'modo-borrar' : '';
  return `<div class="hxfx-canal" id="hxfx-canal-${lado}">
    <svg class="hxfx-svg ${cls}" id="hxfx-svg-${lado}"
      onmousedown="window._hxfxMouseDown(event,'${lado}')"
      onmousemove="window._hxfxMouseMove(event,'${lado}')"
      onmouseup="window._hxfxMouseUp(event,'${lado}')"
      ontouchstart="window._hxfxTouchStart(event,'${lado}')"
      ontouchmove="window._hxfxTouchMove(event,'${lado}')"
      ontouchend="window._hxfxTouchEnd(event,'${lado}')">
      ${_renderFlechasSVG(lado)}
    </svg>
  </div>`;
}

// ── Dibuja todas las flechas en SVG ────────────────────────────
function _renderFlechasSVG(lado) {
  return fxState.flechas
    .filter(f => f.lado === lado)
    .map(f => _pathFlecha(f))
    .join('');
}

function _pathFlecha(f) {
  if (f.puntos.length < 2) return '';
  const pts = f.puntos;
  // Bezier suavizado
  let d = `M ${pts[0].x} ${pts[0].y}`;
  if (pts.length === 2) {
    d += ` L ${pts[1].x} ${pts[1].y}`;
  } else {
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i].x + pts[i+1].x) / 2;
      const my = (pts[i].y + pts[i+1].y) / 2;
      d += ` Q ${pts[i].x} ${pts[i].y} ${mx} ${my}`;
    }
    d += ` L ${pts[pts.length-1].x} ${pts[pts.length-1].y}`;
  }

  // Punta de flecha
  const n = pts.length;
  const dx = pts[n-1].x - pts[n-2].x;
  const dy = pts[n-1].y - pts[n-2].y;
  const len = Math.sqrt(dx*dx + dy*dy) || 1;
  const ux = dx/len, uy = dy/len;
  const al = Math.max(10, f.grosor * 3.5);
  const aw = al * 0.45;
  const tip  = { x: pts[n-1].x, y: pts[n-1].y };
  const base = { x: tip.x - ux*al, y: tip.y - uy*al };
  const lp   = { x: base.x - uy*aw, y: base.y + ux*aw };
  const rp   = { x: base.x + uy*aw, y: base.y - ux*aw };

  return `<g data-fx-id="${f.id}">
    <path d="${d}" fill="none" stroke="${f.color}" stroke-width="${f.grosor}"
      stroke-linecap="round" stroke-linejoin="round" opacity="0.88"/>
    <polygon points="${tip.x},${tip.y} ${lp.x},${lp.y} ${rp.x},${rp.y}"
      fill="${f.color}" opacity="0.88"/>
  </g>`;
}

// ── Coordenadas relativas al SVG ───────────────────────────────
function _coord(e, lado) {
  const svg = document.getElementById(`hxfx-svg-${lado}`);
  if (!svg) return { x: 0, y: 0 };
  const rect = svg.getBoundingClientRect();
  const src = e.touches ? e.touches[0] : e;
  return { x: src.clientX - rect.left, y: src.clientY - rect.top };
}

// ── Event handlers ─────────────────────────────────────────────
window._hxfxMouseDown = (e, lado) => {
  if (fxState.modo === 'flecha') {
    e.preventDefault();
    const pt = _coord(e, lado);
    fxState.dibujando = { id: fxState.nextId++, puntos: [pt], color: fxState.colorActivo, grosor: fxState.grosor, lado };
  } else if (fxState.modo === 'borrar') {
    _borrarEnPunto(_coord(e, lado), lado);
  }
};

window._hxfxMouseMove = (e, lado) => {
  if (!fxState.dibujando || fxState.modo !== 'flecha') return;
  e.preventDefault();
  const pt = _coord(e, lado);
  const pts = fxState.dibujando.puntos;
  const last = pts[pts.length - 1];
  // Solo agregar si se movió suficiente (evita puntos redundantes)
  if (Math.hypot(pt.x - last.x, pt.y - last.y) > 4) {
    fxState.dibujando.puntos.push(pt);
    _updatePreview(lado);
  }
};

window._hxfxMouseUp = (e, lado) => {
  if (fxState.dibujando && fxState.dibujando.puntos.length >= 2) {
    fxState.flechas.push({ ...fxState.dibujando });
    _redrawSVG(lado);
  }
  fxState.dibujando = null;
  _clearPreview(lado);
};

window._hxfxTouchStart = (e, lado) => { window._hxfxMouseDown(e, lado); };
window._hxfxTouchMove  = (e, lado) => { window._hxfxMouseMove(e, lado); };
window._hxfxTouchEnd   = (e, lado) => { window._hxfxMouseUp(e, lado); };

function _borrarEnPunto(pt, lado) {
  const RADIO = 20;
  const antes = fxState.flechas.length;
  fxState.flechas = fxState.flechas.filter(f => {
    if (f.lado !== lado) return true;
    return !f.puntos.some(p => Math.hypot(p.x - pt.x, p.y - pt.y) < RADIO);
  });
  if (fxState.flechas.length !== antes) _redrawSVG(lado);
}

function _updatePreview(lado) {
  const svg = document.getElementById(`hxfx-svg-${lado}`);
  if (!svg || !fxState.dibujando) return;
  let prev = svg.querySelector('#hxfx-preview');
  if (!prev) { prev = document.createElementNS('http://www.w3.org/2000/svg','g'); prev.id='hxfx-preview'; svg.appendChild(prev); }
  const tmp = { ...fxState.dibujando, id: 'preview' };
  prev.innerHTML = _pathFlecha(tmp);
}

function _clearPreview(lado) {
  const svg = document.getElementById(`hxfx-svg-${lado}`);
  svg?.querySelector('#hxfx-preview')?.remove();
}

function _redrawSVG(lado) {
  const svg = document.getElementById(`hxfx-svg-${lado}`);
  if (!svg) return;
  // Remove all non-preview children and re-render
  [...svg.children].forEach(c => { if (c.id !== 'hxfx-preview') c.remove(); });
  const html = _renderFlechasSVG(lado);
  const tmp = document.createElementNS('http://www.w3.org/2000/svg','g');
  tmp.innerHTML = html;
  [...tmp.children].forEach(c => svg.insertBefore(c, svg.querySelector('#hxfx-preview')));
}

// ── Toolbar handlers ───────────────────────────────────────────
window._hxfxToggleFlecha = () => {
  fxState.modo = fxState.modo === 'flecha' ? null : 'flecha';
  _actualizarCursores();
  if (typeof window._hxcRender === 'function') window._hxcRender();
};

window._hxfxToggleBorrar = () => {
  fxState.modo = fxState.modo === 'borrar' ? null : 'borrar';
  _actualizarCursores();
  if (typeof window._hxcRender === 'function') window._hxcRender();
};

window._hxfxSetColor = (c) => {
  fxState.colorActivo = c;
  if (fxState.modo !== 'flecha') fxState.modo = 'flecha';
  _actualizarCursores();
  if (typeof window._hxcRender === 'function') window._hxcRender();
};

window._hxfxSetGrosor = (v) => { fxState.grosor = Math.max(1, Math.min(12, parseInt(v)||3)); };

window._hxfxLimpiar = () => {
  fxState.flechas = [];
  _redrawSVG('izq');
  _redrawSVG('der');
};

function _actualizarCursores() {
  ['izq','der'].forEach(lado => {
    const svg = document.getElementById(`hxfx-svg-${lado}`);
    if (!svg) return;
    svg.classList.remove('modo-flecha','modo-borrar');
    svg.style.pointerEvents = fxState.modo ? 'all' : 'none';
    if (fxState.modo === 'flecha') svg.classList.add('modo-flecha');
    if (fxState.modo === 'borrar') svg.classList.add('modo-borrar');
  });
}

// ── Exportar imagen ────────────────────────────────────────────
window._hxfxExportar = async (oscuro = false) => {
  const panel = document.getElementById('hxc-drawer');
  if (!panel) return;

  // Importamos html2canvas dinámicamente
  let html2canvas;
  try {
    // Si está disponible globalmente
    if (window.html2canvas) {
      html2canvas = window.html2canvas;
    } else {
      // Cargamos desde CDN
      await new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
        s.onload = resolve; s.onerror = reject;
        document.head.appendChild(s);
      });
      html2canvas = window.html2canvas;
    }
  } catch(e) {
    _toast('No se pudo cargar html2canvas', true);
    return;
  }

  // Ocultar temporalmente elementos UI que no queremos en la captura
  const ocultar = panel.querySelectorAll('.hxc-header,.hxfx-toolbar,.hxc-center-top,.hxc-col-title');
  const estilosOriginales = [];
  ocultar.forEach(el => {
    estilosOriginales.push(el.style.display);
    el.style.display = 'none';
  });

  const bgOriginal = panel.style.background;
  if (!oscuro) panel.style.background = '#f5f0e8';

  // Capturar solo el hxc-body
  const body = panel.querySelector('.hxc-body');
  const canvas = await html2canvas(body || panel, {
    backgroundColor: oscuro ? '#08080e' : '#f5f0e8',
    scale: 2,
    useCORS: true,
    allowTaint: true,
    logging: false,
  });

  // Restaurar
  ocultar.forEach((el, i) => el.style.display = estilosOriginales[i]);
  panel.style.background = bgOriginal;

  // Si es claro, invertir colores de texto con un filtro
  const finalCanvas = canvas;

  // Descargar
  const link = document.createElement('a');
  const turno = document.querySelector('.hxc-turno-label')?.textContent?.replace(/\s+/g,'_') || 'turno';
  link.download = `hexcast_${turno}_${oscuro?'oscuro':'claro'}.png`;
  link.href = finalCanvas.toDataURL('image/png');
  link.click();

  _toast('✦ Imagen exportada');
};

function _toast(msg, err = false) {
  let el = document.getElementById('hxc-toast');
  if (!el) { el = document.createElement('div'); el.id = 'hxc-toast'; el.className = 'hxc-toast'; document.body.appendChild(el); }
  el.textContent = msg;
  el.style.color = err ? '#e07070' : '#c8a0f0';
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 2800);
}
