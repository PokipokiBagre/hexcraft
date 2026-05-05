// ============================================================
// hex-guard.js — Guardián de Campaña
// Coloca este archivo en la RAÍZ del proyecto (junto a hex-auth.js)
// <script src="../hex-guard.js"></script>   ← NO type="module"
//
// Comportamiento nuevo:
//   1. Si hay campaña seleccionada → no hace nada, la página carga normal.
//   2. Si NO hay campaña → en lugar de redirigir (que podría 404),
//      selecciona hex1 por defecto Y muestra un modal de selección de campaña
//      inline, sin salir de la página actual.
//   3. Al elegir campaña en el modal, recarga la página actual con la campaña ya seteada.
// ============================================================
(function () {
    // ── Si ya hay campaña seleccionada, no hacer nada ────────
    if (localStorage.getItem('hex_selected')) return;

    // ── Fallback inmediato: usar hex1 para que la página cargue ──
    // Esto evita el 404 cuando alguien llega directamente a una subpágina
    // El usuario podrá cambiar la campaña desde el modal que aparecerá a continuación
    localStorage.setItem('hex_selected', 'hex1');

    // ── Inyectar modal de selección de campaña inline ────────
    // Se muestra encima de la página actual sin redirigir a ningún sitio
    // El guard espera a que el DOM esté listo para insertar el modal
    function mostrarSelectorCampaña() {
        // Evitar doble inserción
        if (document.getElementById('hex-guard-modal')) return;

        const modal = document.createElement('div');
        modal.id = 'hex-guard-modal';
        modal.style.cssText = `
            position: fixed;
            inset: 0;
            background: radial-gradient(ellipse at 40% 30%, #130026 0%, #05000a 60%, #000 100%);
            z-index: 999999;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 40px 20px;
            font-family: 'Inter', system-ui, sans-serif;
        `;

        modal.innerHTML = `
            <div style="text-align:center; margin-bottom:32px;">
                <div style="font-size:2.4em; color:#d4af37; opacity:0.7; margin-bottom:10px; text-shadow:0 0 40px rgba(212,175,55,0.4);">⬡</div>
                <div style="font-family:'Cinzel',serif; font-size:1.6em; font-weight:600; color:#d4af37; letter-spacing:4px; text-shadow:0 0 30px rgba(212,175,55,0.4); margin-bottom:6px;">HEX ROL</div>
                <div style="font-size:0.82em; color:#5a5a78; letter-spacing:2px;">ELIGE TU CAMPAÑA</div>
            </div>
            <div id="hex-guard-grid" style="
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 14px;
                width: 100%;
                max-width: 680px;
            ">
                <!-- Las cards se generan desde config.js si está disponible, o con los defaults -->
            </div>
            <div style="margin-top:24px; font-size:0.72em; color:#3a3a52;">
                Puedes cambiar de campaña en cualquier momento desde la barra de navegación
            </div>
        `;

        document.body.appendChild(modal);

        // ── Intentar cargar las campañas desde window.hexConfigs ──
        // (disponible si config.js ya fue importado por el módulo principal)
        // Con un pequeño delay para dar tiempo a que los módulos carguen
        let intentos = 0;
        const tryRender = setInterval(function() {
            intentos++;
            const configs = window.hexConfigs;
            const grid = document.getElementById('hex-guard-grid');
            if (!grid) { clearInterval(tryRender); return; }

            if (configs) {
                clearInterval(tryRender);
                _renderCards(grid, configs);
            } else if (intentos >= 20) {
                // Después de 2s sin configs, usar defaults hardcodeados
                clearInterval(tryRender);
                _renderCardsDefault(grid);
            }
        }, 100);
    }

    function _renderCards(grid, configs) {
        grid.innerHTML = Object.entries(configs).map(([id, cfg]) => `
            <div onclick="window._hexGuardSelect('${id}')" style="
                background: rgba(255,255,255,0.03);
                border: 1px solid rgba(255,255,255,0.07);
                border-radius: 10px;
                padding: 20px 18px;
                cursor: pointer;
                transition: all 0.2s;
                display: flex;
                flex-direction: column;
                gap: 6px;
            "
            onmouseover="this.style.borderColor='rgba(212,175,55,0.35)'; this.style.background='rgba(212,175,55,0.06)';"
            onmouseout="this.style.borderColor='rgba(255,255,255,0.07)'; this.style.background='rgba(255,255,255,0.03)';">
                <div style="font-size:0.6em; color:#5a3a8a; letter-spacing:3px; text-transform:uppercase;">${id.toUpperCase()}</div>
                <div style="font-family:'Cinzel',serif; font-size:0.9em; color:#d4af37; margin-bottom:4px;">${cfg.ui?.titulo || cfg.nombreCorto || id}</div>
                <div style="font-size:0.75em; color:#5a5a78; flex:1; line-height:1.4;">${cfg.ui?.lore || cfg.ui?.subtitulo || ''}</div>
                <div style="margin-top:10px; padding:4px 12px; border:1px solid rgba(212,175,55,0.3); border-radius:20px; font-family:'Cinzel',serif; font-size:0.65em; color:#d4af37; display:inline-block; align-self:flex-start;">
                    SELECCIONAR
                </div>
            </div>
        `).join('');
    }

    function _renderCardsDefault(grid) {
        const defaults = [
            { id: 'hex1', titulo: 'HEX 1', desc: 'Primera campaña de rol' },
            { id: 'hex2', titulo: 'HEX 2', desc: 'Segunda era del sistema' },
            { id: 'hex3', titulo: 'HEX 3', desc: 'Tercera era del sistema' }
        ];
        grid.innerHTML = defaults.map(d => `
            <div onclick="window._hexGuardSelect('${d.id}')" style="
                background: rgba(255,255,255,0.03);
                border: 1px solid rgba(255,255,255,0.07);
                border-radius: 10px;
                padding: 20px 18px;
                cursor: pointer;
                transition: all 0.2s;
            "
            onmouseover="this.style.borderColor='rgba(212,175,55,0.35)'; this.style.background='rgba(212,175,55,0.06)';"
            onmouseout="this.style.borderColor='rgba(255,255,255,0.07)'; this.style.background='rgba(255,255,255,0.03)';">
                <div style="font-size:0.6em; color:#5a3a8a; letter-spacing:3px; text-transform:uppercase;">${d.id.toUpperCase()}</div>
                <div style="font-family:'Cinzel',serif; font-size:0.9em; color:#d4af37; margin-bottom:6px;">${d.titulo}</div>
                <div style="font-size:0.75em; color:#5a5a78;">${d.desc}</div>
                <div style="margin-top:10px; padding:4px 12px; border:1px solid rgba(212,175,55,0.3); border-radius:20px; font-family:'Cinzel',serif; font-size:0.65em; color:#d4af37; display:inline-block;">
                    SELECCIONAR
                </div>
            </div>
        `).join('');
    }

    // ── Función global para seleccionar campaña ──────────────
    window._hexGuardSelect = function(hexId) {
        localStorage.setItem('hex_selected', hexId);
        const modal = document.getElementById('hex-guard-modal');
        if (modal) {
            modal.style.transition = 'opacity 0.3s';
            modal.style.opacity = '0';
            setTimeout(() => { modal.remove(); window.location.reload(); }, 300);
        } else {
            window.location.reload();
        }
    };

    // ── Mostrar el modal cuando el DOM esté listo ────────────
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', mostrarSelectorCampaña);
    } else {
        // DOM ya listo (script cargó tarde)
        mostrarSelectorCampaña();
    }
})();
