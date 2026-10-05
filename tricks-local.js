(function () {
    'use strict';

    // Защита от повторного запуска плагина
    if (window.plugin_local_tricks_ready) return;
    window.plugin_local_tricks_ready = true;

    /* =========================================================
       СТИЛИ: метки статуса сериала, прогресс сезона, часы
       ========================================================= */
    var css = document.createElement('style');
    css.id = 'local-tricks-css';
    css.textContent = [
        // Метка «Сериал» на карточке
        '.serial-status__type{position:absolute;left:0;top:.8em;padding:.2em .8em;font-size:.85em;border-radius:.5em;text-transform:uppercase;font-weight:700;z-index:2;box-shadow:0 2px 8px rgba(0,0,0,.2);letter-spacing:.04em;line-height:1.1;background:#ff4242;color:#fff}',
        // Метка статуса (В эфире / Завершён / Пауза)
        '.serial-status__status{position:absolute;left:0;top:2.7em;padding:.2em .8em;font-size:.85em;border-radius:.5em;text-transform:uppercase;font-weight:700;z-index:2;box-shadow:0 2px 8px rgba(0,0,0,.2);letter-spacing:.04em;line-height:1.1}',
        '.serial-status__status[data-status="ended"]{background:#4CAF50;color:#fff}',
        '.serial-status__status[data-status="airing"]{background:#2196F3;color:#fff}',
        '.serial-status__status[data-status="paused"],.serial-status__status[data-status="canceled"]{background:#FFC107;color:#222}',
        // Вариант 2 расположения меток (по углам)
        'body[data-status-badge-style="2"] .serial-status__type{top:0;left:0;border-radius:1.1em 0;box-shadow:none;background:rgba(0,0,0,.55)}',
        'body[data-status-badge-style="2"] .serial-status__status{top:0;left:auto;right:0;border-radius:0 1.1em;box-shadow:none;background:rgba(0,0,0,.55);color:#fff}',
        '.full-start-new__poster .serial-status__type,.full-start-new__poster .serial-status__status{font-size:.7em}',
        // Прогресс сезона: завершён (зелёный) / идёт (жёлтый)
        '.card--season-complete,.card--season-progress{position:absolute;left:0;bottom:.5em;z-index:12;width:fit-content;max-width:calc(100% - 1em);border-radius:0 .8em .8em 0;overflow:hidden;opacity:0;transition:opacity .22s ease}',
        '.card--season-complete{background:rgba(61,161,141,.85)}',
        '.card--season-progress{background:rgba(255,193,7,.85)}',
        '.card--season-complete div,.card--season-progress div{text-transform:uppercase;font-weight:700;font-size:1em;padding:.25em .4em;white-space:nowrap;display:flex;align-items:center;text-shadow:.5px .5px 1px rgba(0,0,0,.3)}',
        '.card--season-complete div{color:#fff}',
        '.card--season-progress div{color:#000}',
        '.card--season-complete.show,.card--season-progress.show{opacity:1}',
        // Часы поверх встроенного плеера
        '#MyClockDiv{position:fixed;z-index:100;font-size:1.4em;font-weight:600;color:#fff;text-shadow:0 1px 4px #000;pointer-events:none;bottom:90%;right:90%}'
    ].join('\n');
    document.head.appendChild(css);

    /* Определяет, является ли карточка сериалом */
    function isTv(data) {
        if (!data) return false;
        if (data.name || data.first_air_date || data.number_of_seasons) return true;
        var t = (data.type || data.media_type || '').toLowerCase();
        return t === 'tv' || t === 'serial';
    }

    /* Запрос к TMDB через API Lampa */
    function tmdbGet(path, cb) {
        try {
            var net = new Lampa.Reguest();
            net.timeout(6000);
            var lang = Lampa.Storage.get('language', 'ru');
            var url = Lampa.TMDB.api(path + (path.indexOf('?') >= 0 ? '&' : '?') + 'api_key=' + Lampa.TMDB.key() + '&language=' + lang);
            net.silent(url, function (json) { cb(json || null); }, function () { cb(null); });
        } catch (e) {
            cb(null);
        }
    }

    /* =========================================================
       НАСТРОЙКИ И КНОПКИ ИНТЕРФЕЙСА
       ========================================================= */
    function startUi() {
        // Раздел настроек «Tweaks (local)»
        Lampa.SettingsApi.addComponent({
            component: 'Local_Tricks',
            name: 'Tweaks (local)',
            icon: '<svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24"><path d="M12 15.5A3.5 3.5 0 0 1 8.5 12 3.5 3.5 0 0 1 12 8.5a3.5 3.5 0 0 1 3.5 3.5 3.5 3.5 0 0 1-3.5 3.5m7.43-2.53c.04-.32.07-.64.07-.97 0-.33-.03-.66-.07-1l2.11-1.63c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65A.488.488 0 0 0 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.22-.08-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64L4.57 11c-.04.34-.07.67-.07 1 0 .33.03.65.07.97l-2.11 1.66c-.19.15-.25.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1.01c.52.4 1.08.74 1.69.99l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49.42l.38-2.65c.61-.25 1.17-.59 1.69-.99l2.49 1.01c.22.08.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.66Z"/></svg>'
        });

        /* ----- Кнопка перезагрузки в шапке ----- */
        Lampa.SettingsApi.addParam({
            component: 'Local_Tricks',
            param: { name: 'Reloadbutton', type: 'trigger', default: true },
            field: {
                name: 'Кнопка перезагрузки',
                description: 'Оранжевая иконка в шапке рядом с часами'
            },
            onChange: toggleHeadButtons
        });

        // Создание кнопки в шапке
        function makeBtn(id, title, svg, fn) {
            var $b = $('<div class="head__action selector" id="' + id + '" title="' + title + '"><div style="width:1.5em;height:1.5em;display:flex;align-items:center;justify-content:center">' + svg + '</div></div>');
            $b.on('hover:enter hover:click hover:touch', fn);
            return $b;
        }

        // Оранжевый кружок с двумя стрелками
               var svgReload =
            '<svg viewBox="0 0 24 24" width="22" height="22" xmlns="http://www.w3.org/2000/svg">' +
            '<path fill="#FF9800" d="M17.65 6.35A7.95 7.95 0 0 0 12 4V1L7 6l5 5V7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.35 1.83l1.52.87C18.7 13.72 19 12.89 19 12c0-2.21-.9-4.21-2.35-5.65zM12 17c-2.76 0-5-2.24-5-5 0-.65.13-1.26.35-1.83l-1.52-.87C5.3 10.28 5 11.11 5 12c0 3.87 3.13 7 7 7v3l5-5-5-5v3z"/>' +
            '</svg>';

               var $actions = $('#app > div.head > div > div.head__actions');
        if ($actions.length) {
            $('#CONSOLE, #my_top_exit, #ExitButton, #RELOAD').remove();
            $actions.append(makeBtn('RELOAD', 'Перезагрузка', svgReload, function () {
                location.reload();
            }));
        }

        // Показать / скрыть кнопку перезагрузки
        function toggleHeadButtons() {
            var on = Lampa.Storage.field('Reloadbutton') == true;
            $('#RELOAD')[on ? 'removeClass' : 'addClass']('hide');
        }
        toggleHeadButtons();

        /* ----- Скрыть ленту трейлеров на главной ----- */
        Lampa.SettingsApi.addParam({
            component: 'Local_Tricks',
            param: { name: 'NoTrailerMainPage', type: 'trigger', default: false },
            field: {
                name: 'Скрыть трейлеры-новинки',
                description: 'Скрывает баннерную ленту на главной странице'
            },
            onChange: function () {}
        });
        setInterval(function () {
            if (Lampa.Storage.field('NoTrailerMainPage') != true) {
                $('#NoTrailerMainPage').remove();
                return;
            }
            var act = Lampa.Activity.active();
            if (!act) return;
            if (act.component === 'main' || (act.component === 'category' && act.url === 'movie')) {
                if (!$('#NoTrailerMainPage').length) {
                    $('body').append('<style id="NoTrailerMainPage">.items-line:first-child{display:none!important}</style>');
                }
            } else {
                $('#NoTrailerMainPage').remove();
            }
        }, 900);

        /* ----- Скрыть нижнюю панель навигации ----- */
        Lampa.SettingsApi.addParam({
            component: 'Local_Tricks',
            param: { name: 'NavyBar', type: 'trigger', default: false },
            field: {
                name: 'Скрыть панель навигации',
                description: 'Если неправильно определился тип устройства'
            },
            onChange: function () {
                $('#no_bar').remove();
                if (Lampa.Storage.field('NavyBar') == true) {
                    $('body').append('<style id="no_bar">.navigation-bar,.navigation-bar__body{display:none!important}</style>');
                }
            }
        });
        if (Lampa.Storage.field('NavyBar') == true) {
            $('body').append('<style id="no_bar">.navigation-bar,.navigation-bar__body{display:none!important}</style>');
        }

        /* ----- Скрыть Anime и «Клубничку» в меню ----- */
        Lampa.SettingsApi.addParam({
            component: 'Local_Tricks',
            param: { name: 'ANIME_FIX', type: 'trigger', default: false },
            field: {
                name: 'Скрыть Anime в меню',
                description: 'Убирает пункт Anime из бокового меню'
            },
            onChange: function () {
                $('[data-action=anime]')[Lampa.Storage.field('ANIME_FIX') == true ? 'hide' : 'show']();
            }
        });
        Lampa.SettingsApi.addParam({
            component: 'Local_Tricks',
            param: { name: 'SISI_FIX', type: 'trigger', default: false },
            field: {
                name: 'Скрыть «Клубничка»',
                description: 'Убирает взрослый раздел из меню'
            },
            onChange: function () {
                var on = Lampa.Storage.field('SISI_FIX') == true;
                $('[data-action=sisi]')[on ? 'hide' : 'show']();
                $('li:contains("Клубничка")')[on ? 'hide' : 'show']();
            }
        });
        if (Lampa.Storage.field('ANIME_FIX') == true) $('[data-action=anime]').hide();
        if (Lampa.Storage.field('SISI_FIX') == true) {
            $('[data-action=sisi]').hide();
            $('li:contains("Клубничка")').hide();
        }

        /* ----- Контрастная рамка при выборе торрента ----- */
        Lampa.SettingsApi.addParam({
            component: 'Local_Tricks',
            param: { name: 'TORRENT_FIX', type: 'trigger', default: false },
            field: {
                name: 'Контрастная рамка торрентов',
                description: 'Подсвечивает выбранный торрент зелёной рамкой'
            },
            onChange: function () {
                $('#torrent_focus_style').remove();
                if (Lampa.Storage.field('TORRENT_FIX') == true) {
                    $('body').append('<style id="torrent_focus_style">.torrent-item.focus,.torrent-item.selector.focus{outline:3px solid #00e676!important;outline-offset:2px;box-shadow:0 0 12px rgba(0,230,118,.55)}</style>');
                }
            }
        });
        if (Lampa.Storage.field('TORRENT_FIX') == true) {
            $('body').append('<style id="torrent_focus_style">.torrent-item.focus,.torrent-item.selector.focus{outline:3px solid #00e676!important;outline-offset:2px;box-shadow:0 0 12px rgba(0,230,118,.55)}</style>');
        }

        /* ----- Часы во встроенном плеере ----- */
        Lampa.SettingsApi.addParam({
            component: 'Local_Tricks',
            param: { name: 'ClockInPlayer', type: 'trigger', default: false },
            field: {
                name: 'Часы во встроенном плеере',
                description: 'Показывает текущее время поверх видео'
            },
            onChange: function () {}
        });
        setInterval(function () {
            if (Lampa.Storage.field('ClockInPlayer') != true) {
                $('#MyClockDiv').remove();
                return;
            }
            if (!$('.player').length) {
                $('#MyClockDiv').remove();
                return;
            }
            var t = '';
            try {
                var el = document.querySelector('.head__time-now');
                if (el) t = el.textContent;
            } catch (e) {}
            if (!t) {
                var d = new Date();
                t = ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
            }
            if (!$('#MyClockDiv').length) $('.player').append('<div id="MyClockDiv"></div>');
            $('#MyClockDiv').text(t);
        }, 500);

        /* ----- Стилизация панели плеера ----- */
        Lampa.SettingsApi.addParam({
            component: 'Local_Tricks',
            param: { name: 'YouTubeStyle', type: 'trigger', default: false },
            field: {
                name: 'Стилизация плеера',
                description: 'Более контрастная панель управления'
            },
            onChange: function () {
                $('#YOUTUBESTYLE').remove();
                if (Lampa.Storage.field('YouTubeStyle') == true) {
                    $('body').append('<style id="YOUTUBESTYLE">.player-panel{background:rgba(0,0,0,.75)!important}.player-panel .timeline__progress{background:#f00!important}</style>');
                }
            }
        });
        if (Lampa.Storage.field('YouTubeStyle') == true) {
            $('body').append('<style id="YOUTUBESTYLE">.player-panel{background:rgba(0,0,0,.75)!important}.player-panel .timeline__progress{background:#f00!important}</style>');
        }

        /* ----- Статус сериала на карточках ----- */
        Lampa.SettingsApi.addParam({
            component: 'Local_Tricks',
            param: { name: 'serial_status_enabled', type: 'trigger', default: true },
            field: {
                name: 'Статус сериала на карточках',
                description: 'Метки: В эфире, Завершён, Пауза'
            },
            onChange: function () {}
        });
        Lampa.SettingsApi.addParam({
            component: 'Local_Tricks',
            param: {
                name: 'serial_status_style',
                type: 'select',
                values: {
                    '1': 'Вариант 1 (слева, цветные)',
                    '2': 'Вариант 2 (по углам)'
                },
                default: '1'
            },
            field: {
                name: 'Расположение статуса',
                description: 'Где показывать метки на постере'
            },
            onChange: function (v) {
                if (String(v) === '2') document.body.setAttribute('data-status-badge-style', '2');
                else document.body.removeAttribute('data-status-badge-style');
            }
        });
        if (String(Lampa.Storage.field('serial_status_style') || '1') === '2') {
            document.body.setAttribute('data-status-badge-style', '2');
        }

        /* ----- Прогресс текущего сезона ----- */
        Lampa.SettingsApi.addParam({
            component: 'Local_Tricks',
            param: { name: 'season_badge_enabled', type: 'trigger', default: true },
            field: {
                name: 'Прогресс сезона на карточках',
                description: 'Например S2 8/12 или S2 ✓'
            },
            onChange: function () {}
        });

        /* ----- Инфо на полной карточке фильма/сериала ----- */
        Lampa.SettingsApi.addParam({
            component: 'Local_Tricks',
            param: { name: 'full_card_info', type: 'trigger', default: true },
            field: {
                name: 'Инфо на полной карточке',
                description: 'Рейтинг TMDB, статус, длительность, число сезонов и серий'
            },
            onChange: function () {}
        });
    }

    /* =========================================================
       СТАТУС СЕРИАЛА (В эфире / Завершён / Пауза)
       ========================================================= */
    var statusCache = {};

    function statusEnabled() {
        return Lampa.Storage.field('serial_status_enabled') != false;
    }

    // Рисует метки на постере карточки
    function applyStatus(viewEl, data) {
        if (!statusEnabled() || !viewEl || !data || !isTv(data)) return;

        var old = viewEl.querySelectorAll('.serial-status__type, .serial-status__status, .card__type, .card__status');
        for (var i = 0; i < old.length; i++) old[i].remove();

        var type = document.createElement('div');
        type.className = 'serial-status__type';
        type.textContent = 'Сериал';
        viewEl.appendChild(type);

        function put(st) {
            if (!st || viewEl.querySelector('.serial-status__status[data-status]')) return;
            var map = {
                ended: ['ended', 'Завершён'],
                'returning series': ['airing', 'В эфире'],
                airing: ['airing', 'В эфире'],
                'in production': ['airing', 'В эфире'],
                'on hiatus': ['paused', 'Пауза'],
                paused: ['paused', 'Пауза'],
                canceled: ['canceled', 'Отменён'],
                cancelled: ['canceled', 'Отменён']
            };
            var key = (st || '').toLowerCase();
            var m = map[key];
            if (!m) return;
            var el = document.createElement('div');
            el.className = 'serial-status__status';
            el.setAttribute('data-status', m[0]);
            el.textContent = m[1];
            viewEl.appendChild(el);
        }

        if (data.status) {
            put(data.status);
            return;
        }

        var id = data.id || data.tmdb_id;
        if (!id) return;
        if (statusCache[id]) {
            put(statusCache[id]);
            return;
        }

        tmdbGet('tv/' + id, function (json) {
            if (json && json.status) {
                statusCache[id] = json.status;
                put(json.status);
            }
        });
    }

    function processStatusCard(cardEl) {
        if (!cardEl) return;
        var data = cardEl.card_data || cardEl.data;
        var view = cardEl.querySelector ? cardEl.querySelector('.card__view') : null;
        if (!view || !data) return;
        applyStatus(view, data);
    }

    /* =========================================================
       ПРОГРЕСС СЕЗОНА (S2 8/12 или S2 ✓)
       ========================================================= */
    var seasonCache = {};
    var SEASON_TTL = 24 * 60 * 60 * 1000; // кеш на 24 часа

    try {
        seasonCache = JSON.parse(localStorage.getItem('localSeasonBadgeCache') || '{}');
    } catch (e) {
        seasonCache = {};
    }

    function seasonEnabled() {
        return Lampa.Storage.field('season_badge_enabled') != false;
    }

    // Считает вышедшие серии текущего сезона
    function getSeasonProgress(tmdbData) {
        if (!tmdbData || !tmdbData.seasons || !tmdbData.last_episode_to_air) return null;
        var last = tmdbData.last_episode_to_air;
        var cur = null;
        for (var i = 0; i < tmdbData.seasons.length; i++) {
            var s = tmdbData.seasons[i];
            if (s.season_number === last.season_number && s.season_number > 0) {
                cur = s;
                break;
            }
        }
        if (!cur) return null;
        var total = cur.episode_count || 0;
        var aired = last.episode_number || 0;
        return {
            seasonNumber: last.season_number,
            airedEpisodes: aired,
            totalEpisodes: total,
            isComplete: total > 0 && aired >= total
        };
    }

    // Поднимает метку сезона над меткой качества, если она есть
    function adjustSeasonBadge(cardEl, badge) {
        if (!badge) return;
        var q = cardEl.querySelector('.card__quality');
        if (q) {
            var h = q.offsetHeight || 0;
            var b = parseFloat(getComputedStyle(q).bottom) || 0;
            badge.style.bottom = (h + b) + 'px';
        } else {
            badge.style.bottom = '0.5em';
        }
    }

    // Добавляет метку прогресса сезона на карточку
    function addSeasonBadge(cardEl) {
        if (!seasonEnabled() || !cardEl || cardEl.getAttribute('data-season-processed')) return;

        var data = cardEl.card_data || cardEl.data;
        if (!data) {
            requestAnimationFrame(function () { addSeasonBadge(cardEl); });
            return;
        }
        if (!isTv(data)) return;

        var view = cardEl.querySelector('.card__view');
        if (!view) return;

        var old = view.querySelectorAll('.card--season-complete, .card--season-progress');
        for (var i = 0; i < old.length; i++) old[i].remove();

        var badge = document.createElement('div');
        badge.className = 'card--season-progress';
        badge.innerHTML = '<div>...</div>';
        view.appendChild(badge);
        adjustSeasonBadge(cardEl, badge);
        cardEl.setAttribute('data-season-processed', 'loading');

        var id = data.id || data.tmdb_id;
        if (!id) {
            badge.remove();
            cardEl.setAttribute('data-season-processed', 'error');
            return;
        }

        function render(info) {
            if (!info) {
                badge.remove();
                cardEl.setAttribute('data-season-processed', 'error');
                return;
            }
            var text = info.isComplete
                ? ('S' + info.seasonNumber + ' ✓')
                : ('S' + info.seasonNumber + ' ' + info.airedEpisodes + '/' + info.totalEpisodes);
            badge.className = info.isComplete ? 'card--season-complete' : 'card--season-progress';
            badge.innerHTML = '<div>' + text + '</div>';
            adjustSeasonBadge(cardEl, badge);
            setTimeout(function () {
                badge.classList.add('show');
                adjustSeasonBadge(cardEl, badge);
            }, 40);
            cardEl.setAttribute('data-season-processed', info.isComplete ? 'complete' : 'in-progress');
        }

        var cached = seasonCache[id];
        if (cached && (Date.now() - cached.timestamp < SEASON_TTL)) {
            render(getSeasonProgress(cached.data));
            return;
        }

        tmdbGet('tv/' + id, function (json) {
            if (json) {
                seasonCache[id] = { data: json, timestamp: Date.now() };
                try {
                    localStorage.setItem('localSeasonBadgeCache', JSON.stringify(seasonCache));
                } catch (e) {}
                render(getSeasonProgress(json));
            } else {
                badge.remove();
                cardEl.setAttribute('data-season-processed', 'error');
            }
        });
    }

    /* Обработка новой карточки в списке */
    function handleCard(node) {
        if (!node || node.nodeType !== 1) return;
        if (node.classList && node.classList.contains('card')) {
            processStatusCard(node);
            addSeasonBadge(node);
        }
        if (node.querySelectorAll) {
            var cards = node.querySelectorAll('.card');
            for (var i = 0; i < cards.length; i++) {
                processStatusCard(cards[i]);
                addSeasonBadge(cards[i]);
            }
        }
    }

    /* Следит за появлением новых карточек в интерфейсе */
    function startBadges() {
        var observer = new MutationObserver(function (mutations) {
            for (var m = 0; m < mutations.length; m++) {
                var nodes = mutations[m].addedNodes;
                if (!nodes) continue;
                for (var i = 0; i < nodes.length; i++) handleCard(nodes[i]);
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });

        var existing = document.querySelectorAll('.card');
        for (var i = 0; i < existing.length; i++) {
            (function (card, idx) {
                setTimeout(function () {
                    processStatusCard(card);
                    addSeasonBadge(card);
                }, idx * 40);
            })(existing[i], i);
        }

        // Статус на постере полной карточки
        Lampa.Listener.follow('full', function (e) {
            if (e.type === 'complite' && e.data && e.data.movie) {
                var poster = document.querySelector('.full-start-new__poster');
                if (poster) applyStatus(poster, e.data.movie);
            }
        });
    }

    /* =========================================================
       ИНФО НА ПОЛНОЙ КАРТОЧКЕ
       (рейтинг, статус, длительность, сезоны/серии)
       ========================================================= */
        /* Формат времени: 2 ч 25 мин */
    function fmtRuntime(min) {
        if (!min || min <= 0) return '';
        var h = Math.floor(min / 60), m = min % 60;
        if (h > 0 && m > 0) return h + ' ч ' + m + ' мин';
        if (h > 0) return h + ' ч';
        return m + ' мин';
    }

    /* Строка инфо на полной карточке */
    function buildFullInfo(movie) {
        if (!movie || Lampa.Storage.field('full_card_info') == false) return;

        $('#local-full-info').remove();

        var isSeries = !!(movie.name || movie.first_air_date || movie.number_of_seasons);
        var parts = [];
        var runtimeText = '';

        if (isSeries) {
            var epMin = 0;
            if (movie.episode_run_time && movie.episode_run_time.length) {
                epMin = movie.episode_run_time[0];
            } else if (movie.last_episode_to_air && movie.last_episode_to_air.runtime) {
                epMin = movie.last_episode_to_air.runtime;
            }
            if (epMin) runtimeText = 'Длительность серии: ' + fmtRuntime(epMin);
        } else if (movie.runtime) {
            runtimeText = 'Длительность фильма: ' + fmtRuntime(movie.runtime);
        }

        if (movie.vote_average && movie.vote_average > 0) {
            parts.push('<span class="local-info-badge local-info-rate">★ ' +
                Number(movie.vote_average).toFixed(1) + ' TMDB</span>');
        }

        if (movie.status) {
            var stMap = {
                'Released': 'Выпущен',
                'Ended': 'Завершён',
                'Returning Series': 'В эфире',
                'In Production': 'В производстве',
                'Post Production': 'Постпродакшн',
                'Canceled': 'Отменён',
                'Cancelled': 'Отменён',
                'On Hiatus': 'Пауза'
            };
            parts.push('<span class="local-info-badge local-info-status">' +
                (stMap[movie.status] || movie.status) + '</span>');
        }

        if (isSeries) {
            var seasons = movie.number_of_seasons || 0;
            var episodes = movie.number_of_episodes || 0;
            var se = [];
            if (seasons) se.push(seasons + ' сез.');
            if (episodes) se.push(episodes + ' сер.');
            if (se.length) {
                parts.push('<span class="local-info-badge">' + se.join(' · ') + '</span>');
            }
        }

        if (!runtimeText && !parts.length) return;

        if (!$('#local-full-info-css').length) {
            $('body').append(
                '<style id="local-full-info-css">' +
                '#local-full-info{margin:.55em 0 .4em;display:flex;flex-direction:column;gap:.45em}' +
                '#local-full-info .local-runtime{display:inline-block;padding:.35em .75em;border-radius:.45em;' +
                'background:rgba(38,198,218,.22);color:#7fdbef;font-size:.95em;font-weight:600}' +
                '#local-full-info .local-badges{display:flex;flex-wrap:wrap;gap:.4em;align-items:center}' +
                '.local-info-badge{display:inline-block;padding:.25em .7em;border-radius:.5em;' +
                'background:rgba(255,255,255,.12);font-size:.92em;font-weight:600}' +
                '.local-info-rate{background:#f5c518;color:#111}' +
                '.local-info-status{background:rgba(76,175,80,.25);color:#a5d6a7}' +
                '</style>'
            );
        }

        var html = '<div id="local-full-info">';
        if (runtimeText) html += '<div class="local-runtime">' + runtimeText + '</div>';
        if (parts.length) html += '<div class="local-badges">' + parts.join('') + '</div>';
        html += '</div>';

        var $tag = $('.full-start-new__tagline, .full-start__tagline').first();
        var $title = $('.full-start-new__title, .full-start__title').first();
        var $details = $('.full-start-new__details, .full-start__details, .full-start-new__body').first();

        if ($tag.length) $tag.after(html);
        else if ($title.length) $title.after(html);
        else if ($details.length) $details.prepend(html);
    }

    // Подписка на открытие полной карточки
    function startFullInfo() {
        Lampa.Listener.follow('full', function (e) {
            if (e.type !== 'complite' || !e.data || !e.data.movie) return;
            var movie = e.data.movie;

            // Если не хватает данных — догружаем из TMDB
            var need = isTv(movie)
                ? (!movie.episode_run_time || !movie.number_of_episodes || !movie.status)
                : (!movie.runtime || !movie.status);

            if (need && (movie.id || movie.tmdb_id)) {
                var path = (movie.name || movie.first_air_date ? 'tv/' : 'movie/') + (movie.id || movie.tmdb_id);
                tmdbGet(path, function (json) {
                    if (json) {
                        for (var k in json) {
                            if (movie[k] == null || movie[k] === '') movie[k] = json[k];
                        }
                    }
                    buildFullInfo(movie);
                });
            } else {
                buildFullInfo(movie);
            }
        });
    }

    /* =========================================================
       ЗАПУСК ПЛАГИНА
       ========================================================= */
    function boot() {
        startUi();        // настройки и кнопка перезагрузки
        startBadges();    // метки статуса и прогресса сезона
        startFullInfo();  // инфо-строка на полной карточке
    }

    if (window.appready) boot();
    else {
        Lampa.Listener.follow('app', function (e) {
            if (e.type === 'ready') boot();
        });
    }
})();
