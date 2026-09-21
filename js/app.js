/* Mr. Mauks - class sites. Shared by index.html, algebra1.html and math8.html.
   Reads two feeds from the Apps Script web app:
     ?class=algebra1              -> lessons (already filtered/timed on Google's side)
     ?class=algebra1&part=links   -> Essentials + Games & Projects (with images)
   Nothing from the feeds is ever inserted as HTML: text goes in as text, links are
   checked to be http(s), images must be data:image URIs. */
(function () {
  'use strict';

  var CFG = window.SITE_CONFIG || {};
  var root = document.documentElement;
  var classKey = root.getAttribute('data-class');       // null on the landing page
  var reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var TZ = 'America/New_York';

  // ---------- tiny helpers ----------
  function $(sel, ctx) { return (ctx || document).querySelector(sel); }

  function append(el, c) {
    if (c === null || c === undefined || c === false) return;
    if (Array.isArray(c)) { c.forEach(function (x) { append(el, x); }); return; }
    el.appendChild(c.nodeType ? c : document.createTextNode(String(c)));
  }
  function h(tag, attrs) {
    var el = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v === null || v === undefined || v === false) return;
        if (k === 'class') el.className = v;
        else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
        else el.setAttribute(k, v === true ? '' : v);
      });
    }
    for (var i = 2; i < arguments.length; i++) append(el, arguments[i]);
    return el;
  }
  function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); }

  function safeUrl(u) { return /^https?:\/\//i.test(u || '') ? u : null; }
  function safeImage(u) { return /^data:image\/(png|jpeg|gif|webp|svg\+xml);base64,/i.test(u || '') ? u : null; }

  // A cell arrives as pieces: [{text, url}]. Build text + links safely.
  function segs(list) {
    var frag = document.createDocumentFragment();
    (list || []).forEach(function (s) {
      if (!s || !s.text) return;
      var url = safeUrl(s.url);
      var m = /^(\s*)([\s\S]*?)(\s*)$/.exec(s.text);
      if (url && m[2]) {
        if (m[1]) frag.appendChild(document.createTextNode(m[1]));
        frag.appendChild(h('a', { href: url, target: '_blank', rel: 'noopener noreferrer' }, m[2]));
        if (m[3]) frag.appendChild(document.createTextNode(m[3]));
      } else {
        frag.appendChild(document.createTextNode(s.text));
      }
    });
    return frag;
  }
  function segText(list) { return (list || []).map(function (s) { return s.text || ''; }).join('').replace(/\s+/g, ' ').trim(); }
  function hasText(list) { return segText(list).length > 0; }

  // ---------- dates (feed dates are plain yyyy-mm-dd; no time zone math needed) ----------
  function ymd(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function fmt(d, opts) { return d.toLocaleDateString('en-US', opts); }
  function longDate(d) { return fmt(d, { weekday: 'long', month: 'long', day: 'numeric' }); }
  function shortDate(d) { return fmt(d, { weekday: 'short', month: 'short', day: 'numeric' }); }
  function weekStart(d) { var x = new Date(d.getTime()); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; }
  function unlockText(iso) {
    try {
      return new Date(iso).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: TZ });
    } catch (e) { return 'tomorrow morning'; }
  }

  // ---------- theme ----------
  function initTheme() {
    var btn = $('#theme-toggle');
    if (!btn) return;
    function apply(t) {
      root.setAttribute('data-theme', t);
      btn.textContent = t === 'light' ? 'Dark mode' : 'Light mode';
    }
    apply(root.getAttribute('data-theme') === 'light' ? 'light' : 'dark');
    btn.addEventListener('click', function () {
      var next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
      apply(next);
      try { localStorage.setItem('mauks-theme', next); } catch (e) {}
    });
  }

  // ---------- local cache (last good copy, so a hiccup never leaves a blank page) ----------
  function cacheKey(part) { return 'mauks:' + classKey + ':' + part; }
  function readCache(part) {
    try { var raw = localStorage.getItem(cacheKey(part)); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
  }
  function writeCache(part, data) {
    try { localStorage.setItem(cacheKey(part), JSON.stringify({ t: Date.now(), data: data })); } catch (e) {}
  }

  function fetchFeed(part) {
    if (!CFG.WEB_APP_URL) {
      return Promise.resolve(window.SAMPLE_FEEDS[part === 'links' ? 'links' : 'lessons'](classKey));
    }
    var base = CFG.WEB_APP_URL;
    var url = base + (base.indexOf('?') > -1 ? '&' : '?') + 'class=' + encodeURIComponent(classKey) + (part === 'links' ? '&part=links' : '');
    var ctl = ('AbortController' in window) ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctl) ctl.abort(); }, 20000);
    // Deliberately no custom headers: that keeps this a "simple" request the Apps Script web app accepts.
    return fetch(url, ctl ? { signal: ctl.signal } : undefined)
      .then(function (r) { clearTimeout(timer); if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (d) { if (!d || !d.ok) throw new Error((d && d.error) || 'Bad response'); return d; });
  }

  // ---------- state ----------
  var S = { lessons: null, links: null, selected: null, picked: false };

  function dayByDate(date) {
    var days = S.lessons ? S.lessons.days : [];
    for (var i = 0; i < days.length; i++) if (days[i].date === date) return days[i];
    return null;
  }
  function firstWithStatus(status) {
    var days = S.lessons ? S.lessons.days : [];
    for (var i = 0; i < days.length; i++) if (days[i].status === status) return days[i];
    return null;
  }
  function defaultDate() {
    var d = firstWithStatus('today') || firstWithStatus('next');
    if (d) return d.date;
    var days = S.lessons.days;
    return days.length ? days[days.length - 1].date : null;
  }

  // ---------- notices ----------
  function notice(msg) {
    var el = $('#notice');
    if (!el) return;
    el.textContent = msg || '';
    el.classList.toggle('hidden', !msg);
  }

  // ---------- rendering: header line ----------
  function renderStatusLine() {
    var el = $('#today-line');
    if (!el || !S.lessons) return;
    var t = ymd(S.lessons.today);
    el.textContent = firstWithStatus('today')
      ? 'Today is ' + longDate(t) + '.'
      : 'No class today (' + longDate(t) + ').';
  }

  // ---------- rendering: day strip ----------
  function statusLabel(d) {
    return d.status === 'today' ? 'Today' : d.status === 'next' ? 'Next class day' : d.status === 'past' ? 'Past lesson' : 'Coming up';
  }
  function tile(d) {
    var dt = ymd(d.date);
    var flag = d.isQuiz ? h('span', { class: 'flag flag-quiz' }, 'Quiz')
      : d.status === 'today' ? h('span', { class: 'flag flag-today' }, 'Today')
      : d.status === 'next' ? h('span', { class: 'flag flag-next' }, 'Next') : null;
    var label = longDate(dt) + ', ' + d.letterDay + ' day' + (d.isQuiz ? ', quiz' : '') + ', ' + statusLabel(d).toLowerCase();
    return h('button', {
      type: 'button', class: 'tile' + (d.status === 'today' ? ' is-today' : ''),
      'data-date': d.date, 'aria-label': label, 'aria-current': d.date === S.selected ? 'true' : 'false',
      onclick: function () { selectDay(d.date, { user: true }); }
    },
      h('span', { class: 'wd' }, fmt(dt, { weekday: 'short' })),
      h('span', { class: 'dn' }, String(dt.getDate())),
      h('span', { class: 'mo' }, fmt(dt, { month: 'short' })),
      h('span', { class: 'ld' }, d.letterDay),
      h('span', { class: 'flags' }, flag)
    );
  }
  function renderStrip() {
    var strip = $('#strip');
    clear(strip);
    S.lessons.days.forEach(function (d) { strip.appendChild(tile(d)); });
  }
  function markSelectedTile() {
    var tiles = document.querySelectorAll('#strip .tile');
    for (var i = 0; i < tiles.length; i++) {
      tiles[i].setAttribute('aria-current', tiles[i].getAttribute('data-date') === S.selected ? 'true' : 'false');
    }
  }
  function centerTile(date, smooth) {
    var strip = $('#strip');
    var t = strip && strip.querySelector('[data-date="' + date + '"]');
    if (!t) return;
    strip.scrollTo({ left: t.offsetLeft - strip.clientWidth / 2 + t.offsetWidth / 2, behavior: (smooth && !reduceMotion) ? 'smooth' : 'auto' });
  }

  // ---------- rendering: the day card ----------
  function block(title, list) {
    if (!hasText(list)) return null;
    return h('div', { class: 'block' }, h('h3', null, title), h('div', { class: 'content' }, segs(list)));
  }
  function keysBlock(d) {
    if (!d.answerKeys || !d.answerKeys.hasKeys) return null;
    if (d.answerKeys.released) return block('Answer keys', d.fields.answerKeys);
    return h('div', { class: 'block' }, h('h3', null, 'Answer keys'),
      h('div', { class: 'content locked' }, '\uD83D\uDD12 Unlocks ' + unlockText(d.answerKeys.releaseAt) + ' ET'));
  }
  function callout(title, list) {
    if (!hasText(list)) return null;
    return h('div', { class: 'callout' }, h('h3', null, title), h('div', { class: 'content' }, segs(list)));
  }
  function renderLesson() {
    var box = $('#lesson');
    clear(box);
    var d = dayByDate(S.selected);
    if (!d) {
      box.appendChild(h('p', { class: 'empty' }, 'No lessons have been posted yet. Check back soon.'));
      return;
    }
    var f = d.fields;
    box.appendChild(h('div', { class: 'lesson-head' },
      h('p', { class: 'date' }, longDate(ymd(d.date))),
      h('div', { class: 'pills' },
        h('span', { class: 'pill' }, d.letterDay + ' day'),
        h('span', { class: 'pill pill-accent' }, statusLabel(d)),
        d.isQuiz ? h('span', { class: 'pill pill-quiz' }, 'Quiz') : null)
    ));
    box.appendChild(h('h2', null, hasText(f.lesson) ? segs(f.lesson) : 'Lesson to be announced'));
    var blocks = [block('Classwork', f.classwork), block('Assignment', f.assignment), keysBlock(d)].filter(Boolean);
    if (blocks.length) box.appendChild(h('div', { class: 'blocks' }, blocks));
    var callouts = [callout('Math reminder', f.mathReminders), callout('School reminder', f.schoolReminders)].filter(Boolean);
    if (callouts.length) box.appendChild(h('div', { class: 'callouts' }, callouts));
    box.appendChild(h('div', { class: 'lesson-foot' },
      h('button', { type: 'button', class: 'btn', onclick: function () { window.print(); } }, 'Print this day')));
  }

  // ---------- rendering: look ahead ----------
  function aheadCard(kicker, d) {
    return h('button', { type: 'button', class: 'ahead-card', onclick: function () { selectDay(d.date, { user: true, scrollTop: true }); } },
      h('p', { class: 'k' }, kicker, d.isQuiz ? h('span', { class: 'pill pill-quiz' }, 'Quiz') : null),
      h('div', { class: 'd' }, shortDate(ymd(d.date)) + ' (' + d.letterDay + ' day)'),
      h('p', { class: 't' }, segText(d.fields.lesson) || 'Lesson to be announced'));
  }
  function renderAhead() {
    var host = $('#ahead');
    var wrap = $('#ahead-wrap');
    clear(host);
    var next = firstWithStatus('next');
    var quiz = firstWithStatus('upcomingQuiz');
    var cards = [];
    if (next) cards.push(aheadCard('Next class day', next));
    if (quiz && (!next || quiz.date !== next.date)) cards.push(aheadCard('Next quiz', quiz));
    wrap.classList.toggle('hidden', cards.length === 0);
    cards.forEach(function (c) { host.appendChild(c); });
  }

  // ---------- rendering: Essentials / Games & Projects ----------
  var SECTION_NOTES = {
    'Essentials': 'Sites you will use all the time.',
    'Games & Projects': 'Play, explore, and practice.'
  };
  function slug(s) { return 'sec-' + String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-'); }
  function linkCard(it) {
    var img = safeImage(it.image);
    var frame = h('div', { class: 'frame' }, img
      ? h('img', { src: img, alt: '', loading: 'lazy' })
      : h('span', { class: 'emoji', 'aria-hidden': 'true' }, it.icon || '\uD83D\uDD17'));
    return h('a', { class: 'card', href: safeUrl(it.url) || '#', target: '_blank', rel: 'noopener noreferrer' },
      frame,
      h('div', { class: 'card-body' },
        h('div', { class: 'card-title' }, h('h3', null, it.title), it.tag ? h('span', { class: 'tag' }, it.tag) : null),
        it.description ? h('p', null, it.description) : null));
  }
  function renderLinks() {
    var host = $('#link-sections');
    if (!host) return;
    clear(host);
    if (!S.links || !S.links.sections) return;
    S.links.sections.forEach(function (sec) {
      var id = slug(sec.name);
      host.appendChild(h('section', { class: 'section', 'aria-labelledby': id },
        h('h2', { id: id }, sec.name),
        SECTION_NOTES[sec.name] ? h('p', { class: 'sub' }, SECTION_NOTES[sec.name]) : null,
        h('div', { class: 'cards' }, sec.items.map(linkCard))));
    });
  }

  // ---------- rendering: archive ----------
  function searchText(d) {
    if (!d._s) d._s = (segText(d.fields.lesson) + ' ' + segText(d.fields.classwork) + ' ' + segText(d.fields.assignment)).toLowerCase();
    return d._s;
  }
  function renderArchive() {
    var host = $('#archive-list');
    var countEl = $('#archive-count');
    if (!host || !S.lessons) return;
    clear(host);
    var q = (($('#archive-q') || {}).value || '').trim().toLowerCase();
    var list = S.lessons.days.filter(function (d) { return d.status === 'past' || d.status === 'today'; }).reverse();
    var total = list.length;
    if (q) list = list.filter(function (d) { return searchText(d).indexOf(q) > -1; });
    countEl.textContent = q ? list.length + ' of ' + total + ' lessons' : total + ' lessons';
    if (!list.length) {
      host.appendChild(h('p', { class: 'empty' }, q ? 'No lessons match "' + q + '". Try a different word.' : 'Past lessons will show up here.'));
      return;
    }
    var currentWeek = null, weekEl = null;
    list.forEach(function (d) {
      var ws = weekStart(ymd(d.date));
      var key = ws.getTime();
      if (key !== currentWeek) {
        currentWeek = key;
        weekEl = h('section', { class: 'week' }, h('h3', null, 'Week of ' + fmt(ws, { month: 'long', day: 'numeric' })));
        host.appendChild(weekEl);
      }
      weekEl.appendChild(h('button', { type: 'button', class: 'row', onclick: function () { selectDay(d.date, { user: true, scrollTop: true }); } },
        h('span', { class: 'rd' }, shortDate(ymd(d.date))),
        h('span', { class: 'rl' }, d.letterDay),
        h('span', { class: 'rt' }, segText(d.fields.lesson) || 'Lesson to be announced'),
        d.isQuiz ? h('span', { class: 'pill pill-quiz' }, 'Quiz') : null));
    });
  }

  // ---------- selection ----------
  function selectDay(date, opts) {
    opts = opts || {};
    if (!dayByDate(date)) return;
    S.selected = date;
    if (opts.user) {
      S.picked = true;
      try { history.replaceState(null, '', '#' + date); } catch (e) {}
    }
    markSelectedTile();
    renderLesson();
    centerTile(date, true);
    if (opts.scrollTop) {
      var top = $('#lesson-top');
      if (top) top.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    }
  }

  function renderAll() {
    renderStatusLine();
    renderStrip();
    renderLesson();
    renderAhead();
    renderArchive();
    var up = $('#updated');
    if (up && S.lessons.generatedAt) {
      up.textContent = 'Updated ' + new Date(S.lessons.generatedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: TZ }) + ' ET';
    }
    centerTile(S.selected, false);
  }

  function applyLessons(data) {
    S.lessons = data;
    var hash = (location.hash || '').replace('#', '');
    if (hash && dayByDate(hash)) { S.selected = hash; S.picked = true; }
    else if (!S.picked || !dayByDate(S.selected)) S.selected = defaultDate();
    renderAll();
  }

  function timeAgo(t) {
    return new Date(t).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' });
  }

  function loadClassPage() {
    var sample = !CFG.WEB_APP_URL;
    var cachedL = sample ? null : readCache('lessons');
    var cachedK = sample ? null : readCache('links');
    if (cachedL) applyLessons(cachedL.data);
    if (cachedK) { S.links = cachedK.data; renderLinks(); }
    if (sample) notice('Preview mode: these are made-up sample lessons, not real ones.');

    fetchFeed('lessons').then(function (d) {
      if (!sample) writeCache('lessons', d);
      applyLessons(d);
      if (!sample) notice('');
    }).catch(function () {
      if (S.lessons && cachedL) notice('Could not refresh. Showing lessons saved ' + timeAgo(cachedL.t) + '. Reload to try again.');
      else {
        clear($('#lesson'));
        $('#lesson').appendChild(h('p', { class: 'empty' }, 'Could not load the lessons. Check your internet connection, then reload this page.'));
      }
    });

    fetchFeed('links').then(function (d) {
      if (!sample) writeCache('links', d);
      S.links = d;
      renderLinks();
    }).catch(function () { /* keep whatever we have; lessons matter most */ });
  }

  // ---------- go ----------
  function init() {
    initTheme();
    if (!classKey) return;   // landing page: theme toggle only
    var input = $('#archive-q');
    if (input) input.addEventListener('input', renderArchive);
    var left = $('#strip-left'), right = $('#strip-right');
    function nudge(dir) { var s = $('#strip'); s.scrollBy({ left: dir * s.clientWidth * 0.7, behavior: reduceMotion ? 'auto' : 'smooth' }); }
    if (left) left.addEventListener('click', function () { nudge(-1); });
    if (right) right.addEventListener('click', function () { nudge(1); });
    window.addEventListener('hashchange', function () {
      var hsh = (location.hash || '').replace('#', '');
      if (S.lessons && hsh && dayByDate(hsh) && hsh !== S.selected) selectDay(hsh, { user: true });
    });
    loadClassPage();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
