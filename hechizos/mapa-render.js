// ============================================================
// mapa-render.js — Render canvas, info bar y panel OP
// /hechizos/mapa-render.js
// ============================================================

import { st, C } from './mapa-state.js';

// ── Redimensionar canvas ─────────────────────────────────────
export function redimensionar() {
    const wrap = document.getElementById('hm-canvas-wrap');
    if (!wrap || !st.canvas) return;
    const dpr = window.devicePixelRatio || 1;
    st.canvas.width  = wrap.clientWidth  * dpr;
    st.canvas.height = wrap.clientHeight * dpr;
    st.canvas.style.width  = wrap.clientWidth  + 'px';
    st.canvas.style.height = wrap.clientHeight + 'px';
}

// ── Centrar cámara sobre todos los nodos ─────────────────────
export function centrarCamara() {
    const wrap = document.getElementById('hm-canvas-wrap');
    if (!wrap || st.nodos.length === 0) return;
    const W = wrap.clientWidth, H = wrap.clientHeight;
    let minX=Infinity, maxX=-Infinity, minY=Infinity, maxY=-Infinity;
    st.nodos.forEach(n => {
        minX=Math.min(minX,n.x); maxX=Math.max(maxX,n.x);
        minY=Math.min(minY,n.y); maxY=Math.max(maxY,n.y);
    });
    const w = (maxX-minX)||800, h = (maxY-minY)||800;
    const zoom = Math.min(W/(w*1.15), H/(h*1.15), 1.5);
    st.camara.zoom = zoom;
    st.camara.x = W/2 - (minX + w/2)*zoom;
    st.camara.y = H/2 - (minY + h/2)*zoom;
}

// ── Centrar cámara en un nodo específico ─────────────────────
export function centrarEnNodo(nodo) {
    const wrap = document.getElementById('hm-canvas-wrap');
    if (!wrap || !nodo) return;
    const W = wrap.clientWidth, H = wrap.clientHeight;
    const z = Math.max(st.camara.zoom, 0.5);
    st.camara.zoom = z;
    st.camara.x = W/2 - nodo.x * z;
    st.camara.y = H/2 - nodo.y * z;
}

// ── Loop de render ───────────────────────────────────────────
export function iniciarLoop() {
    const tick = () => {
        dibujar();
        st.raf = requestAnimationFrame(tick);
    };
    tick();
}

export function detenerLoop() {
    if (st.raf) cancelAnimationFrame(st.raf);
}

// ── Dibujar frame completo ───────────────────────────────────
export function dibujar() {
    const { canvas, ctx, camara, nodos, enlaces,
            descubiertos, aprendibles, parciales, posesiones,
            nodoSel, modoConexion, tempFlecha, seleccionados, modoSelMulti } = st;
    if (!ctx || !canvas) return;

    const wrap = document.getElementById('hm-canvas-wrap');
    if (!wrap) return;
    const W   = wrap.clientWidth;
    const dpr = window.devicePixelRatio || 1;
    const sf  = Math.max(camara.zoom, 0.05);

    ctx.setTransform(1,0,0,1,0,0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = C.FONDO;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.scale(dpr, dpr);
    ctx.translate(camara.x, camara.y);
    ctx.scale(camara.zoom, camara.zoom);

    // ── Calcular conjuntos de enfoque ──
    let enfocado = null;
    const enfoqPrev = new Set(), enfoqNext = new Set(), enfoqRel = new Set();
    if (nodoSel && seleccionados.size <= 1) {
        enfocado = nodoSel;
        enlaces.forEach(e => { if (e.source === enfocado) enfoqNext.add(e.target); });
        const exp = (n) => {
            enlaces.forEach(e => {
                if (e.target === n && !enfoqPrev.has(e.source)) {
                    enfoqPrev.add(e.source); exp(e.source);
                }
            });
        };
        exp(enfocado);
        enfoqRel.add(enfocado);
        enfoqPrev.forEach(n => enfoqRel.add(n));
        enfoqNext.forEach(n => enfoqRel.add(n));
    }
    const hayEnfoque = enfocado !== null;

    // ── ENLACES ──
    _dibujarEnlaces(ctx, enlaces, descubiertos, aprendibles, posesiones, enfocado, enfoqPrev, enfoqNext, hayEnfoque, sf, st.modoEliminarFlecha, st.enlaceHover);

    // Flecha temporal (modo conexión)
    if (modoConexion && tempFlecha) {
        const ang = Math.atan2(tempFlecha.endY-tempFlecha.source.y, tempFlecha.endX-tempFlecha.source.x);
        const hl  = 16/sf;
        ctx.beginPath();
        ctx.moveTo(tempFlecha.source.x, tempFlecha.source.y);
        ctx.lineTo(tempFlecha.endX, tempFlecha.endY);
        ctx.strokeStyle=C.NUEVO; ctx.lineWidth=3/sf;
        ctx.setLineDash([8/sf,6/sf]); ctx.stroke(); ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(tempFlecha.endX, tempFlecha.endY);
        ctx.lineTo(tempFlecha.endX-hl*Math.cos(ang-Math.PI/7), tempFlecha.endY-hl*Math.sin(ang-Math.PI/7));
        ctx.lineTo(tempFlecha.endX-hl*Math.cos(ang+Math.PI/7), tempFlecha.endY-hl*Math.sin(ang+Math.PI/7));
        ctx.closePath(); ctx.fillStyle=C.NUEVO; ctx.fill();
    }

    // ── NODOS ──
    _dibujarNodos(ctx, nodos, descubiertos, aprendibles, parciales, posesiones,
        seleccionados, modoSelMulti, nodoSel, enfocado, enfoqPrev, enfoqNext, enfoqRel, hayEnfoque, camara, sf);

    ctx.setTransform(1,0,0,1,0,0);

    // ── Rectángulo de selección (screen space) ──
    if (st.rectSel.activo) {
        const toScr = (wx,wy) => ({
            x: wx * camara.zoom + camara.x,
            y: wy * camara.zoom + camara.y,
        });
        const a = toScr(st.rectSel.startX, st.rectSel.startY);
        const b = toScr(st.rectSel.endX,   st.rectSel.endY);
        const rx = Math.min(a.x,b.x), ry = Math.min(a.y,b.y);
        const rw = Math.abs(a.x-b.x),  rh = Math.abs(a.y-b.y);
        ctx.save();
        ctx.strokeStyle = 'rgba(212,175,55,0.7)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6,4]);
        ctx.strokeRect(rx, ry, rw, rh);
        ctx.fillStyle = 'rgba(212,175,55,0.06)';
        ctx.fillRect(rx, ry, rw, rh);
        ctx.setLineDash([]);
        ctx.restore();
    }

    // Actualizar zoom label
    const zl = document.getElementById('hm-zoom-label');
    if (zl) zl.textContent = Math.round(camara.zoom*100) + '%';
}

// ── Dibujar enlaces ──────────────────────────────────────────
function _dibujarEnlaces(ctx, enlaces, descubiertos, aprendibles, posesiones, enfocado, enfoqPrev, enfoqNext, hayEnfoque, sf, modoEliminarFlecha, enlaceHover) {
    const esTodos = st.jugadorPanel === 'Todos';
    enlaces.forEach(e => {
        const dx = e.target.x-e.source.x, dy = e.target.y-e.source.y;
        const ang = Math.atan2(dy, dx);
        const tx = e.target.x - Math.cos(ang)*(e.target.radio+4/sf);
        const ty = e.target.y - Math.sin(ang)*(e.target.radio+4/sf);

        let color = C.L_OC, lw = 0.7/sf, dash = [];
        const sD=descubiertos.has(e.source), tD=descubiertos.has(e.target);
        const tA=aprendibles.has(e.target);
        const sP=posesiones.has(e.source), tP=posesiones.has(e.target);

        if (hayEnfoque) {
            const sA=enfoqPrev.has(e.source), tA2=enfoqPrev.has(e.target)||e.target===enfocado;
            if (sA&&tA2)        { color=C.PREV; lw=2/sf; }
            else if (e.source===enfocado&&enfoqNext.has(e.target)) { color=C.NEXT; lw=2/sf; }
            else                { color='rgba(160,155,175,0.18)'; lw=0.5/sf; }
        } else if (sP&&tP)      { color=C.L_PJ; lw=2/sf; }
        else if (sP||tP)        { color='rgba(0,200,240,0.3)'; lw=1.2/sf; }
        else if (sD&&tD)        { color=C.L_POS; lw=1.4/sf; }
        else if (sD&&tA)        { color=C.L_APR; lw=1.1/sf; }
        else if (esTodos)       { color='rgba(170,155,100,0.35)'; lw=1/sf; }
        else if (!e.target.esConocido&&!tA) { color='rgba(170,155,100,0.2)'; dash=[6/sf,5/sf]; }

        // ── Override en modo eliminar flecha ──
        if (modoEliminarFlecha) {
            const esHover = enlaceHover === e;
            color = esHover ? 'rgba(255,70,70,1)' : C.DEL;
            lw    = esHover ? 3.5/sf : 1.5/sf;
            dash  = [];
            if (esHover) { ctx.shadowBlur=12; ctx.shadowColor='rgba(255,60,60,0.8)'; }
        }

        ctx.beginPath();
        ctx.moveTo(e.source.x, e.source.y);
        ctx.lineTo(tx, ty);
        ctx.strokeStyle=color; ctx.lineWidth=lw;
        ctx.setLineDash(dash); ctx.stroke(); ctx.setLineDash([]);
        ctx.shadowBlur=0;

        const hl = lw*3 + 8/sf;
        ctx.beginPath();
        ctx.moveTo(tx,ty);
        ctx.lineTo(tx-hl*Math.cos(ang-Math.PI/7), ty-hl*Math.sin(ang-Math.PI/7));
        ctx.lineTo(tx-hl*Math.cos(ang+Math.PI/7), ty-hl*Math.sin(ang+Math.PI/7));
        ctx.closePath(); ctx.fillStyle=color; ctx.fill();
    });
}

// ── Dibujar nodos ────────────────────────────────────────────
function _dibujarNodos(ctx, nodos, descubiertos, aprendibles, parciales, posesiones,
    seleccionados, modoSelMulti, nodoSel, enfocado, enfoqPrev, enfoqNext, enfoqRel, hayEnfoque, camara, sf)
{
    const esTodos = st.jugadorPanel === 'Todos';

    nodos.forEach(nodo => {
        const esDes=descubiertos.has(nodo), esApr=aprendibles.has(nodo), esPar=parciales.has(nodo);
        const esPos=posesiones.has(nodo);
        const esSel=nodoSel===nodo || seleccionados.has(nodo);
        const enSelMulti=seleccionados.has(nodo);
        const esNuevo=nodo.esNuevo;
        const esEnfocado=hayEnfoque&&nodoSel===nodo;
        const esPrecedente=hayEnfoque&&enfoqPrev.has(nodo);
        const esSaliente=hayEnfoque&&enfoqNext.has(nodo);
        const esIrrel=hayEnfoque&&!enfoqRel.has(nodo)&&nodoSel!==nodo;

        let colorN, colorT;
        const apagadoMulti = modoSelMulti && seleccionados.size > 0 && !enSelMulti && nodoSel !== nodo;
        if (esNuevo) {
            colorN=C.NUEVO; colorT=C.NUEVO;
        } else if (apagadoMulti) {
            colorN = esDes ? 'rgba(100,90,130,0.45)' : 'rgba(100,95,70,0.38)';
            colorT = esDes ? 'rgba(130,120,160,0.5)' : 'rgba(120,115,85,0.45)';
        } else if (hayEnfoque) {
            if (esEnfocado)       { colorN=esDes?C.POS:esApr?C.APR:esPos?C.PJ:'rgba(200,195,220,0.95)'; colorT=colorN; }
            else if (esPrecedente){ colorN=C.PREV; colorT=C.PREV; }
            else if (esSaliente)  { colorN=C.NEXT; colorT=C.NEXT; }
            else                  { colorN='rgba(90,85,110,0.5)'; colorT='rgba(120,115,140,0.55)'; }
        } else if (esPos&&!esTodos) {
            colorN=C.PJ; colorT=C.PJ;
        } else if (esTodos) {
            colorN=esDes?C.POS:esApr?C.APR:'rgba(100,95,130,0.7)';
            colorT=esDes?C.POS:esApr?C.APR:'rgba(160,155,175,0.9)';
        } else {
            colorN=esDes?(esPar?C.RASTR:C.POS):esApr?C.APR:'rgba(80,75,105,0.75)';
            colorT=esDes?(esPar?C.RASTR:C.POS):esApr?C.APR:'rgba(160,155,175,0.9)';
        }

        ctx.globalAlpha = (esIrrel || apagadoMulti) ? (apagadoMulti ? 0.55 : 0.4) : 1.0;

        const forma = (extraR=0) => {
            const R=nodo.radio+extraR;
            if (nodo.esEstado) { const h=R*0.88,r=R*0.22; ctx.beginPath(); ctx.roundRect(nodo.x-h,nodo.y-h,h*2,h*2,r); }
            else               { ctx.beginPath(); ctx.arc(nodo.x,nodo.y,R,0,Math.PI*2); }
        };
        const formaR = (r) => {
            if (nodo.esEstado) { const h=r*0.88,rd=r*0.22; ctx.beginPath(); ctx.roundRect(nodo.x-h,nodo.y-h,h*2,h*2,rd); }
            else               { ctx.beginPath(); ctx.arc(nodo.x,nodo.y,r,0,Math.PI*2); }
        };

        if (enSelMulti && modoSelMulti) {
            forma(14/sf);
            ctx.strokeStyle='rgba(212,175,55,0.9)'; ctx.lineWidth=2.5/sf;
            ctx.setLineDash([4/sf,3/sf]); ctx.stroke(); ctx.setLineDash([]);
        }
        if (esSel && !enSelMulti) {
            forma(12/sf);
            ctx.strokeStyle='rgba(236,213,154,0.9)'; ctx.lineWidth=2.5/sf;
            ctx.setLineDash([6/sf,4/sf]); ctx.stroke(); ctx.setLineDash([]);
        }
        if (esNuevo) {
            forma(14/sf);
            ctx.shadowBlur=20; ctx.shadowColor=C.NUEVO;
            ctx.strokeStyle=`rgba(0,255,255,${0.4+0.3*Math.sin(Date.now()/300)})`;
            ctx.lineWidth=3/sf; ctx.stroke(); ctx.shadowBlur=0;
        }
        if (esPos && !esTodos && !hayEnfoque) {
            forma(8/sf);
            ctx.shadowBlur=12; ctx.shadowColor='rgba(0,210,255,0.6)';
            ctx.strokeStyle='rgba(0,210,255,0.7)'; ctx.lineWidth=2.5/sf;
            ctx.stroke(); ctx.shadowBlur=0;
        }
        if (esPrecedente || esSaliente) {
            const hc = esPrecedente ? C.PREV : C.NEXT;
            forma(8/sf);
            ctx.shadowBlur=14; ctx.shadowColor=hc;
            ctx.strokeStyle=hc; ctx.lineWidth=2.5/sf;
            ctx.stroke(); ctx.shadowBlur=0;
        }

        forma(0); ctx.fillStyle='#0d0d1a'; ctx.fill();

        formaR(Math.max(1, nodo.radio-7));
        ctx.fillStyle=colorN;
        if (!esIrrel) {
            ctx.shadowBlur  = esNuevo?14:(esPos||esPrecedente||esSaliente||esEnfocado?10:5);
            ctx.shadowColor = colorN;
        }
        ctx.fill(); ctx.shadowBlur=0;

        forma(0);
        ctx.strokeStyle=colorN; ctx.lineWidth=(esSel?3:1.5)/sf;
        if (!nodo.esConocido&&!esNuevo&&!esTodos&&esIrrel) ctx.setLineDash([5/sf,4/sf]);
        ctx.stroke(); ctx.setLineDash([]);
        ctx.globalAlpha=1.0;

        if (camara.zoom > 0.08 || esSel) {
            _dibujarTextoNodo(ctx, nodo, colorT, esDes, esIrrel, esSel, camara.zoom, sf);
        }
    });
}

// ── Texto + medallitas de un nodo ────────────────────────────
function _dibujarTextoNodo(ctx, nodo, colorT, esDes, esIrrel, esSel, zoom, sf) {
    const fs = esDes ? 28 : 22;
    ctx.font=`bold ${fs}px sans-serif`;
    ctx.textAlign='center'; ctx.textBaseline='top';
    const ty2 = nodo.y + nodo.radio + 10/sf;

    const texto = (st.esAdmin || nodo.esConocido)
        ? nodo.nombre
        : (nodo.id.match(/\d+/) ? `Hechizo ${nodo.id.match(/\d+/)[0]}` : nodo.id);

    ctx.globalAlpha = esIrrel ? 0.4 : 1.0;
    ctx.strokeStyle='rgba(0,0,0,0.95)'; ctx.lineWidth=5/sf;
    ctx.strokeText(texto, nodo.x, ty2);
    ctx.fillStyle=colorT; ctx.fillText(texto, nodo.x, ty2);

    if (zoom > 0.25 && !esIrrel) {
        let pillY = ty2 + fs + 6/sf;
        if (nodo.hex > 0) {
            pillY = _medallita(ctx, `⬡${nodo.hex}`, nodo.x, pillY, 'rgba(212,175,55,0.85)', 'rgba(212,175,55,0.35)', sf);
        }
        if (nodo.vex > 0) {
            _medallita(ctx, `⬡${nodo.vex} VEX`, nodo.x, pillY, 'rgba(176,96,232,0.9)', 'rgba(150,80,220,0.4)', sf);
        }
    }
    ctx.globalAlpha=1.0;
}

function _medallita(ctx, txt, cx, y, colorTxt, colorBorder, sf) {
    const fsp = 17;
    ctx.font=`${fsp}px sans-serif`;
    const pW=ctx.measureText(txt).width+8/sf, pH=fsp+4/sf;
    const pX=cx-pW/2;
    ctx.beginPath();
    ctx.roundRect?.(pX,y,pW,pH,4/sf) || ctx.rect(pX,y,pW,pH);
    ctx.fillStyle='rgba(10,5,25,0.88)'; ctx.fill();
    ctx.strokeStyle=colorBorder; ctx.lineWidth=1/sf; ctx.stroke();
    ctx.font=`bold ${fsp}px sans-serif`; ctx.textAlign='center';
    ctx.fillStyle=colorTxt; ctx.strokeStyle='rgba(0,0,0,0.9)'; ctx.lineWidth=3/sf;
    ctx.strokeText(txt, cx, y+2/sf); ctx.fillText(txt, cx, y+2/sf);
    return y + pH + 3/sf;
}

// ── Info bar inferior (strip) ─────────────────────────────────
export function renderInfoBar(nodo) {
    const el = document.getElementById('hm-info-nodo');
    if (!el) return;

    if (!nodo) {
        el.innerHTML = '<span style="color:#444;">Clic en un hechizo para ver detalles</span>';
        // Cerrar side panel derecho
        import('./mapa-ui.js').then(m => m.renderSidePanel(null)).catch(()=>{});
        return;
    }

    const esPosesion = st.posesiones.has(nodo);
    const mostrar    = nodo.esConocido || esPosesion || st.esAdmin;
    const color      = (st.colores[nodo.afinidad] || {}).t || '#888';
    const nombre     = mostrar ? nodo.nombre : (nodo.id.match(/\d+/) ? `Hechizo ${nodo.id.match(/\d+/)[0]}` : nodo.id);

    // Strip inferior: solo nombre + meta básica
    const parts = [`<span style="color:${color};font-weight:700;">${nombre}</span>`];
    if (mostrar) {
        parts.push(`<span style="color:#555;">${nodo.afinidad}</span>`);
        parts.push(`<span style="color:#3a3a55;">Cl.${nodo.clase}</span>`);
        if (nodo.hex > 0) parts.push(`<span style="color:#c9953a;">⬡${nodo.hex} HEX</span>`);
        if (nodo.vex > 0) parts.push(`<span style="color:#b060e8;">⬡${nodo.vex} VEX</span>`);
        if (esPosesion)   parts.push(`<span style="color:rgba(150,131,200,0.9);">✓</span>`);
    } else {
        parts.push('<span style="color:#2a2a3a;font-style:italic;">Sellado</span>');
    }
    el.innerHTML = parts.join('<span style="color:#1a1a2a;margin:0 5px;">·</span>');

    // Abrir side panel DERECHO con info del nodo
    import('./mapa-ui.js').then(m => {
        m.renderSidePanel(nodo);
    }).catch(()=>{});
}

// ── Panel OP (flotante legacy — mantenido para compatibilidad) ─
export function renderOpPanel(nodo) {
    // No-op: la UI se maneja desde el panel izquierdo y derecho
}

// ── Stats del info bar ────────────────────────────────────────
export function renderInfoStats() {
    const el = document.getElementById('hm-info-stats');
    if (!el) return;
    const total    = st.nodos.length;
    const conocidos = st.descubiertos.size;
    const pjCount  = st.posesiones.size;
    let txt = `${total} nodos · ${conocidos} conocidos`;
    if (st.jugadorPanel !== 'Todos' && pjCount > 0)
        txt += ` · ${pjCount} de ${st.jugadorPanel}`;
    el.textContent = txt;
}
