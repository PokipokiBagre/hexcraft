// ============================================================
// hex-guard.js — Guardián de Campaña + Botón Cambiar Campaña
// Coloca este archivo en la RAÍZ del proyecto.
// <script src="../hex-guard.js"></script>  ← NO type="module"
// ============================================================
(function () {

    // ── 1. Garantizar campaña seleccionada ───────────────────────
    var _sinCampana = !localStorage.getItem('hex_selected');
    if (_sinCampana) {
        localStorage.setItem('hex_selected', 'hex1');
    }

    // ── 2. Inyectar botón "cambiar campaña" en el nav ────────────
    function _inyectarBoton() {
        if (document.getElementById('hex-guard-btn-campana')) return;

        var btn = document.createElement('button');
        btn.id = 'hex-guard-btn-campana';
        btn.textContent = 'cambiar campaña';
        btn.style.cssText = [
            'background:transparent',
            'border:1px solid rgba(212,175,55,0.3)',
            'border-radius:6px',
            'color:rgba(212,175,55,0.6)',
            'padding:7px 14px',
            'font-size:0.78em',
            'font-family:Cinzel,serif',
            'letter-spacing:0.5px',
            'cursor:pointer',
            'transition:all 0.2s'
        ].join(';');
        btn.onmouseover = function() {
            this.style.borderColor = 'rgba(212,175,55,0.7)';
            this.style.color = '#d4af37';
        };
        btn.onmouseout = function() {
            this.style.borderColor = 'rgba(212,175,55,0.3)';
            this.style.color = 'rgba(212,175,55,0.6)';
        };
        btn.onclick = function() { window._hexGuardAbrirModal(); };

        var badge    = document.getElementById('hex-session-badge');
        var navRight = document.querySelector('.nav-right');

        if (badge && badge.parentElement) {
            badge.parentElement.insertBefore(btn, badge);
        } else if (navRight) {
            navRight.insertBefore(btn, navRight.firstChild);
        }

        // Ocultar cualquier btn-cambiar hard-codeado en el HTML
        document.querySelectorAll('.btn-cambiar').forEach(function(el) {
            el.style.display = 'none';
        });
    }

    // ── 3. Modal de selección de campaña ─────────────────────────
    window._hexGuardAbrirModal = function() {
        var viejo = document.getElementById('hex-guard-modal');
        if (viejo) { viejo.remove(); return; }

        var modal = document.createElement('div');
        modal.id = 'hex-guard-modal';
        modal.style.cssText = [
            'position:fixed', 'inset:0',
            'background:rgba(0,0,0,0.88)',
            'backdrop-filter:blur(8px)',
            '-webkit-backdrop-filter:blur(8px)',
            'z-index:999999',
            'display:flex', 'align-items:center', 'justify-content:center',
            'padding:32px 20px',
            'font-family:Inter,system-ui,sans-serif'
        ].join(';');
        modal.onclick = function(e) { if (e.target === modal) modal.remove(); };
        document.body.appendChild(modal);

        _renderModal(modal);
    };

    function _renderModal(modal) {
        var actual  = localStorage.getItem('hex_selected') || 'hex1';
        var configs = window.hexConfigs || null;

        var cardsHTML = '';
        if (configs) {
            Object.keys(configs).forEach(function(id) {
                var c = configs[id];
                var esActual = id === actual;
                var borderC  = esActual ? 'rgba(212,175,55,0.55)' : 'rgba(255,255,255,0.08)';
                var bgC      = esActual ? 'rgba(212,175,55,0.1)'  : 'rgba(255,255,255,0.03)';
                cardsHTML += '<div' +
                    ' onclick="window._hexGuardSelect(\'' + id + '\')"' +
                    ' data-hid="' + id + '"' +
                    ' style="background:' + bgC + ';border:1px solid ' + borderC + ';border-radius:10px;padding:18px 16px;cursor:pointer;transition:all 0.2s;display:flex;flex-direction:column;gap:6px;"' +
                    ' onmouseover="this.style.borderColor=\'rgba(212,175,55,0.55)\';this.style.background=\'rgba(212,175,55,0.1)\';"' +
                    ' onmouseout="this.style.borderColor=\'' + borderC + '\';this.style.background=\'' + bgC + '\';"' +
                    '>' +
                    '<div style="font-size:0.58em;color:#5a3a8a;letter-spacing:3px;text-transform:uppercase;">' + id.toUpperCase() + (esActual ? ' · ACTIVA' : '') + '</div>' +
                    '<div style="font-family:Cinzel,serif;font-size:0.88em;color:#d4af37;">' + (c.ui && c.ui.titulo ? c.ui.titulo : c.nombreCorto || id) + '</div>' +
                    '<div style="font-size:0.72em;color:#5a5a78;line-height:1.5;">' + (c.ui && (c.ui.lore || c.ui.subtitulo) ? (c.ui.lore || c.ui.subtitulo) : '') + '</div>' +
                    '</div>';
            });
        } else {
            ['hex1','hex2','hex3'].forEach(function(id) {
                cardsHTML += '<div onclick="window._hexGuardSelect(\'' + id + '\')"' +
                    ' style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:18px 16px;cursor:pointer;"' +
                    ' onmouseover="this.style.borderColor=\'rgba(212,175,55,0.5)\';"' +
                    ' onmouseout="this.style.borderColor=\'rgba(255,255,255,0.08)\';">' +
                    '<div style="font-family:Cinzel,serif;font-size:0.9em;color:#d4af37;">' + id.toUpperCase() + '</div>' +
                    '</div>';
            });
        }

        modal.innerHTML =
            '<div style="background:linear-gradient(160deg,#110020,#07060e);border:1px solid rgba(212,175,55,0.2);border-radius:14px;padding:28px 24px;width:100%;max-width:620px;max-height:90vh;overflow-y:auto;">' +
                '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;">' +
                    '<div>' +
                        '<div style="font-size:0.58em;color:#5a3a8a;letter-spacing:3px;text-transform:uppercase;margin-bottom:6px;">HEX ROL</div>' +
                        '<div style="font-family:Cinzel,serif;font-size:1em;color:#d4af37;letter-spacing:2px;margin-bottom:4px;">CAMBIAR CAMPAÑA</div>' +
                        '<div style="font-size:0.72em;color:#5a5a78;">La página se recargará con la campaña seleccionada.</div>' +
                    '</div>' +
                    '<button onclick="document.getElementById(\'hex-guard-modal\').remove()" style="background:none;border:none;color:#5a5a78;font-size:1.5em;cursor:pointer;line-height:1;padding:0 4px;margin-top:-4px;">×</button>' +
                '</div>' +
                '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;">' + cardsHTML + '</div>' +
                '<div style="margin-top:18px;font-size:0.68em;color:#3a3a52;text-align:center;">Puedes cambiar de campaña en cualquier momento desde la barra de navegación.</div>' +
            '</div>';
    }

    // ── 4. Seleccionar y recargar ────────────────────────────────
    window._hexGuardSelect = function(hexId) {
        localStorage.setItem('hex_selected', hexId);
        var modal = document.getElementById('hex-guard-modal');
        if (modal) {
            modal.style.transition = 'opacity 0.25s';
            modal.style.opacity = '0';
            setTimeout(function() { window.location.reload(); }, 280);
        } else {
            window.location.reload();
        }
    };

    // ── 5. Si no había campaña, mostrar selector al cargar ───────
    if (_sinCampana) {
        function _showInicial() {
            setTimeout(function() { window._hexGuardAbrirModal(); }, 500);
        }
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', _showInicial);
        } else {
            _showInicial();
        }
    }

    // ── 6. Inyectar botón al cargar DOM ──────────────────────────
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', _inyectarBoton);
    } else {
        _inyectarBoton();
    }
    // Segundo intento tras auth.init() que puede modificar el nav
    setTimeout(_inyectarBoton, 1500);

})();
