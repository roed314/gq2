/* Running-example sidebar for the paper page.
 *
 * Data: static per-group JSON bundles exported from the verifier's eltstore
 * (scripts/export-example-bundles.py) — one Aut(G)-orbit of admissible
 * markings per G-extension of Q_2, as permutation image lists, with canonical
 * invariants.  Nothing from a bundle is trusted blindly: the word ledger and
 * the relator are always recomputed here, and for |G| <= 2000 the tame,
 * pro-2, generation, and invariant claims are re-verified in the page.
 *
 * Injected into paper.html by scripts/inject-example-sidebar.py (build-site.sh).
 */
(function () {
  'use strict';
  var SCRIPT = document.currentScript;
  var ROOT = (function () {
    var src = SCRIPT && SCRIPT.src || '';
    return src.replace(/example-sidebar\.js.*$/, '');
  })();
  /* Bundle corpus: 5403 files / 264MB, regenerated wholesale, so it is
   * deployed to its own single-commit repo (scripts/deploy.sh --data) rather
   * than into the paper site's git history.  inject-example-sidebar.py stamps
   * data-base with that host when EXAMPLE_DATA_BASE is set at build time;
   * without it the corpus ships beside the page and this falls back to the
   * sibling directory, so local builds stay self-contained.  GitHub Pages
   * serves example-data with Access-Control-Allow-Origin: *, so the
   * cross-origin fetch needs nothing beyond this base. */
  var DATA = (function () {
    var base = SCRIPT && SCRIPT.getAttribute('data-base');
    if (!base) return ROOT + 'example-data/';
    return base.charAt(base.length - 1) === '/' ? base : base + '/';
  })();
  var LIVE_LIMIT = 2000;   // closure-based re-verification cap

  /* ================= permutation kernel ================= */
  function compose(p, q) { var n = p.length, r = new Array(n); for (var i = 0; i < n; i++) r[i] = q[p[i]]; return r; }
  function inverse(p) { var n = p.length, r = new Array(n); for (var i = 0; i < n; i++) r[p[i]] = i; return r; }
  function identity(n) { var r = new Array(n); for (var i = 0; i < n; i++) r[i] = i; return r; }
  function isId(p) { for (var i = 0; i < p.length; i++) if (p[i] !== i) return false; return true; }
  function eqp(p, q) { for (var i = 0; i < p.length; i++) if (p[i] !== q[i]) return false; return true; }
  function pkey(p) { return p.join(','); }
  function gcd(a, b) { return b ? gcd(b, a % b) : a; }
  function order(p) {
    var n = p.length, seen = new Array(n), o = 1, i, j, len;
    for (i = 0; i < n; i++) {
      if (seen[i]) continue;
      len = 0; j = i;
      do { seen[j] = true; j = p[j]; len++; } while (j !== i);
      o = o * len / gcd(o, len);
    }
    return o;
  }
  function power(p, e) {
    var o = BigInt(order(p));
    var k = Number(((e % o) + o) % o);
    var r = identity(p.length), b = p;
    while (k) { if (k & 1) r = compose(r, b); b = compose(b, b); k >>= 1; }
    return r;
  }
  function conj(x, g) { return compose(compose(inverse(g), x), g); }
  function cycles(p) {
    var n = p.length, seen = new Array(n), out = [], c, j, i;
    for (i = 0; i < n; i++) {
      if (seen[i] || p[i] === i) { seen[i] = true; continue; }
      c = []; j = i;
      do { seen[j] = true; c.push(j + 1); j = p[j]; } while (j !== i);
      out.push('(' + c.join(' ') + ')');
    }
    return out.length ? out.join('') : '()';
  }
  function cyclesClamped(p) {
    var s = cycles(p);
    if (s.length <= 300) return s;
    var moved = 0;
    for (var i = 0; i < p.length; i++) if (p[i] !== i) moved++;
    var cut = s.lastIndexOf(')', 280);
    return s.slice(0, cut + 1) + ' … (' + moved + ' of ' + p.length + ' points moved)';
  }
  function closure(gens, cap) {
    var n = gens[0].length, elts = [identity(n)], seen = {}, queue = [elts[0]], g, s, h, k, i;
    seen[pkey(elts[0])] = true;
    while (queue.length) {
      g = queue.shift();
      for (i = 0; i < gens.length; i++) {
        s = gens[i]; h = compose(g, s); k = pkey(h);
        if (!seen[k]) { seen[k] = true; elts.push(h); queue.push(h); if (cap && elts.length > cap) return elts; }
      }
    }
    return elts;
  }

  /* ---- straight-line programs (verifier rel.txt syntax) ---- */
  function tokenize(s) {
    var toks = [], i = 0, c, j;
    while (i < s.length) {
      c = s[i];
      if (/\s/.test(c)) { i++; continue; }
      if ('*^()'.indexOf(c) >= 0) { toks.push(c); i++; continue; }
      if (c === '-' || /[0-9]/.test(c)) {
        j = i + 1; while (j < s.length && /[0-9]/.test(s[j])) j++;
        toks.push({ num: s.slice(i, j) }); i = j; continue;
      }
      if (/[A-Za-z_]/.test(c)) {
        j = i + 1; while (j < s.length && /[A-Za-z0-9_]/.test(s[j])) j++;
        toks.push({ name: s.slice(i, j) }); i = j; continue;
      }
      throw new Error('unexpected character "' + c + '"');
    }
    return toks;
  }
  function parseExpr(toks, pos) {
    function atom() {
      var t = toks[pos.i];
      if (t === '(') { pos.i++; var e = expr(); if (toks[pos.i] !== ')') throw new Error('missing )'); pos.i++; return e; }
      if (t && t.name) { pos.i++; return { ref: t.name }; }
      throw new Error('expected a name or "("');
    }
    function term() {
      var base = atom(), t;
      while (toks[pos.i] === '^') {
        pos.i++; t = toks[pos.i];
        if (t && t.num !== undefined) { pos.i++; base = { pow: base, exp: BigInt(t.num) }; }
        else if (t && t.name) { pos.i++; base = { conj: base, by: { ref: t.name } }; }
        else if (t === '(') { pos.i++; var e = expr(); if (toks[pos.i] !== ')') throw new Error('missing )'); pos.i++; base = { conj: base, by: e }; }
        else throw new Error('bad exponent');
      }
      return base;
    }
    function expr() {
      var e = term();
      while (toks[pos.i] === '*') { pos.i++; e = { mul: [e, term()] }; }
      return e;
    }
    var out = expr();
    if (pos.i !== toks.length) throw new Error('trailing tokens');
    return out;
  }
  function parseProgram(text) {
    var lines = text.split('\n').map(function (l) { return l.trim(); }).filter(function (l) { return l && l[0] !== '#'; });
    if (!lines.length) throw new Error('empty program');
    if (lines[0].replace(/\s+/g, '') !== 'sigma,tau,x0,x1') throw new Error('first line must be "sigma,tau,x0,x1"');
    var defs = [], relators = [], m;
    lines.slice(1).forEach(function (line) {
      m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+)$/);
      if (m) defs.push({ name: m[1], ast: parseExpr(tokenize(m[2]), { i: 0 }) });
      else relators.push(parseExpr(tokenize(line), { i: 0 }));
    });
    if (!relators.length) throw new Error('no relator line');
    return { gens: ['sigma', 'tau', 'x0', 'x1'], defs: defs, relators: relators };
  }
  function evalAst(a, env) {
    if (a.ref) { var v = env.get(a.ref); if (!v) throw new Error('undefined name "' + a.ref + '"'); return v; }
    if (a.mul) return compose(evalAst(a.mul[0], env), evalAst(a.mul[1], env));
    if (a.pow !== undefined) return power(evalAst(a.pow, env), a.exp);
    return conj(evalAst(a.conj, env), evalAst(a.by, env));
  }
  function runProgram(prog, images) {
    var env = new Map(), ledger = [];
    prog.gens.forEach(function (g, i) { env.set(g, images[i]); });
    prog.defs.forEach(function (d) { var v = evalAst(d.ast, env); env.set(d.name, v); ledger.push([d.name, v]); });
    var values = prog.relators.map(function (r) { return evalAst(r, env); });
    return { ledger: ledger, values: values, ok: values.every(isId) };
  }
  function nclElts(elts, gens) {
    var real = gens.filter(function (g) { return !isId(g); });
    if (!real.length) return [identity(elts[0].length)];
    var cls = [], seen = {}, i, j, c, k;
    for (i = 0; i < real.length; i++) for (j = 0; j < elts.length; j++) {
      c = conj(real[i], elts[j]); k = pkey(c);
      if (!seen[k]) { seen[k] = true; cls.push(c); }
    }
    return closure(cls);
  }

  /* ================= presentations ================= */
  /* The playground programs: the two proven presentations, the three
     verifier-passed candidates, and the six rejected candidates from the
     presentations page (transcribed with [a,b] = a⁻¹b⁻¹ab; the shadow
     relations x_i^{ω_odd} = 1 are automatic here because x₀,x₁ range over
     O₂(G)).  Sweep baselines validated offline against the battery. */
  var PROGRAMS = {
    collector: 'sigma,tau,x0,x1\n\nsigma2 = sigma^40491355905\ng0 = sigma2^2\nu0 = (x0*tau)^40491355905\nu1 = (x1*tau)^40491355905\nd0 = u0*x0^-1\nz0 = x0^sigma2\nc0 = d0^-1*z0^-1*d0*z0\ndg = d0^g0\nhc = dg^-1*d0^-1*dg*d0\nh0 = x0^g0*x0*dg*d0*d0^2*hc\n\nh0*u1^-1*x1^sigma*c0',
    square_commutator: 'sigma,tau,x0,x1\n\nsigma2 = sigma^40491355905\na = (x0^-3*tau)^40491355905\ny1 = x1^sigma2\nc = x1^-1*y1^-1*x1*y1\n\n(x0^sigma)^-1*a*x1^2*c',
    twisted: 'sigma,tau,x0,x1\n\nsigma2 = sigma^40491355905\ng0 = sigma2^2\nu0 = (x0*tau)^40491355905\nu1 = (x1*tau)^40491355905\nd = u0*x0^-1\ny = x0*d^-1\nz0 = x0^sigma2\nc0 = d^-1*z0^-1*d*z0\n\ny^g0*x0*d*u1^-1*x1^sigma*c0',
    barreto: 'sigma,tau,x0,x1\n\nsigma2 = sigma^40491355905\nu = x1^sigma2*x1^-1\nc = u*sigma^2\ntheta = (x0*tau)^40491355905*x0^-1\n\nx1^c*sigma^-2*x1*sigma*x0^-1*sigma*x0*theta',
    thompson: 'sigma,tau,x0,x1\n\nsigma2 = sigma^40491355905\ns = sigma2^-1*sigma\na = x0*sigma^-2\nay = (x1*tau)^40491355905\nfy = ay^-1*x1\ne1 = x0^-1*x0^sigma\ne2 = x0^-1*x0^(sigma^2)\nax = (x0*s)^40491355905\nh1 = ax^-1*x0^sigma\nh2 = ax^-1*x0^(sigma^2)\n\na^2*sigma^3*sigma^x1*e1^-4*e2^3*h1^2*h2^-2*fy',
    tailless: 'sigma,tau,x0,x1\n\nsigma2 = sigma^40491355905\na = (x0^-3*tau)^40491355905\n\n(x0^sigma)^-1*a*x1^2',
    w3: 'sigma,tau,x0,x1\n\nc1 = sigma^-1*x0^-1*sigma*x0\nc2 = tau^-1*x0^-1*tau*x0\nc3 = tau^-1*x1^-1*tau*x1\n\nx1^2*c1*c2*c3',
    mar13a: 'sigma,tau,x0,x1\n\nc1 = sigma^-1*x1^-1*sigma*x1\nc2 = tau^-1*x1^-1*tau*x1\nu0 = (x0*tau)^40491355905\n\nx1^2*c1*c2*(x0^sigma)^-1*u0',
    mar15: 'sigma,tau,x0,x1\n\nsigma2 = sigma^40491355905\nc1 = sigma2^-1*x1^-1*sigma2*x1\nu0 = (x0*tau)^40491355905\n\nx1^2*c1*(x0^sigma)^-1*u0',
    splice_r0: 'sigma,tau,x0,x1\n\nu1 = (x1*tau)^40491355905\n\nx0^2*x1^4*u1^-1*x1^sigma',
    a1: 'sigma,tau,x0,x1\n\nu0 = (x0*tau)^40491355905\nu1 = (x1*tau)^40491355905\nd0 = u0*x0^-1\nd1 = u1*x1^-1\n\nx0^2*x1^4*u1^-1*x1^sigma*d0*d1^-1',
    a2: 'sigma,tau,x0,x1\n\nsigma2 = sigma^40491355905\nu1 = (x1*tau)^40491355905\nd0 = (x0*tau)^40491355905*x0^-1\nc0 = d0^-1*(x0^sigma2)^-1*d0*x0^sigma2\n\nx0^2*x1^4*u1^-1*x1^sigma*c0',
  };
  var PRES_NAMES = { collector: 'collector (Thm 1.2)', square_commutator: 'square-commutator (App C)' };

  /* Pool quick-picks + LMFDB field snapshot (2026-07-28).  Field (f,e) for
     abelian/S3 read from the new-style labels; S4 uses Galois-closure
     invariants from the three quartics' LMFDB pages (labels stand for their
     Galois closures; the closures differ only in slopes). */
  var POOL = ['4.1', '6.1', '24.12', '48.29'];
  /* The sweep also includes 16.7 (D₈): the smallest battery group that kills
     the March 11 candidate, which passes all four original pool groups. */
  var SWEEP_POOL = POOL.concat(['16.7']);
  var POOL_NAMES = { '4.1': 'ℤ/4', '6.1': 'S₃', '24.12': 'S₄', '48.29': 'GL(2,3)', '16.7': 'D₈' };
  var FIELDS = {
    '4.1': [
      { label: '2.4.1.0a1.1', f: 4, e: 1 },
      { label: '2.2.2.4a1.2', f: 2, e: 2 }, { label: '2.2.2.6a1.2', f: 2, e: 2 }, { label: '2.2.2.6a1.6', f: 2, e: 2 },
      { label: '2.1.4.11a1.9', f: 1, e: 4 }, { label: '2.1.4.11a1.10', f: 1, e: 4 }, { label: '2.1.4.11a1.11', f: 1, e: 4 },
      { label: '2.1.4.11a1.12', f: 1, e: 4 }, { label: '2.1.4.11a1.15', f: 1, e: 4 }, { label: '2.1.4.11a1.16', f: 1, e: 4 },
      { label: '2.1.4.11a1.17', f: 1, e: 4 }, { label: '2.1.4.11a1.18', f: 1, e: 4 }],
    '6.1': [{ label: '2.2.3.4a1.2', f: 2, e: 3 }],
    '24.12': [
      { label: '2.1.4.4a1.1', f: 2, e: 12, slopes: '[4/3, 4/3]' },
      { label: '2.1.4.8a1.1', f: 2, e: 12, slopes: '[8/3, 8/3]' },
      { label: '2.1.4.8a1.2', f: 2, e: 12, slopes: '[8/3, 8/3]' }],
  };
  var FIELD_NOTES = {
    '48.29': 'all 8 extensions share (f = 2, e = 24) — their degree-48 fields are beyond the LMFDB field tables; see the <a href="https://www.lmfdb.org/padicField/?p=2&gal=8T23" target="_blank" rel="noopener">octic subfields (8T23)</a>',
  };

  /* ================= state ================= */
  /* Which panels start open is a function of window width at load (never
     persisted): below W_ONE neither fits, from W_ONE the drawer fits beside
     the text, from W_BOTH the ToC fits as well.  W_ONE must match the css
     push-mode breakpoint in example-sidebar.css. */
  var W_ONE = 1050, W_BOTH = 1300;
  var state = { open: false, label: '24.12', pres: 'collector', oi: 0, mi: 0 };
  try {
    var saved = JSON.parse(localStorage.getItem('gqx.state') || '{}');
    ['label', 'pres', 'oi', 'mi'].forEach(function (k) { if (saved[k] !== undefined) state[k] = saved[k]; });
  } catch (e) { /* fresh state */ }
  var changeListeners = [];   // result-popup layer subscribes via gqxExample.onChange
  function persist() {
    try {
      localStorage.setItem('gqx.state', JSON.stringify({ label: state.label, pres: state.pres, oi: state.oi, mi: state.mi }));
    } catch (e) { /* private mode */ }
    changeListeners.forEach(function (f) { try { f(); } catch (e) { /* listener's problem */ } });
  }

  var bundles = {}, derivedCache = {}, indexData = null;
  function fetchJSON(url) {
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }
  function getBundle(label) {
    if (bundles[label]) return Promise.resolve(bundles[label]);
    return fetchJSON(DATA + label + '.json').then(function (b) { bundles[label] = b; return b; });
  }
  function getIndex() {
    if (indexData) return Promise.resolve(indexData);
    return fetchJSON(DATA + 'index.json').then(function (ix) { indexData = ix; return ix; });
  }
  function derived(label) {
    // elements + O2 mask + tame pairs, for live checks and the sweep (small groups only)
    if (derivedCache[label]) return derivedCache[label];
    var b = bundles[label];
    if (!b || b.order > LIVE_LIMIT) return null;
    var pres = b.presentations.collector || b.presentations.square_commutator;
    if (!pres || !pres.orbits.length) return null;
    var elts = closure(pres.orbits[0].rep.filter(function (g) { return !isId(g); }));
    var d = { elts: elts };
    derivedCache[label] = d;
    return d;
  }

  /* ================= DOM ================= */
  var esc = function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); };
  var SUBS = { sigma: 'σ', tau: 'τ' };
  function prettyName(n) {
    var m = n.match(/^([A-Za-z_]+?)([0-9]*)$/);
    if (!m) return esc(n);
    var base = SUBS[m[1]] || m[1], digits = m[2];
    if (!digits && /^[a-z]{2}$/.test(base)) return esc(base[0]) + '<sub>' + esc(base[1]) + '</sub>';
    return esc(base) + (digits ? '<sub>' + digits + '</sub>' : '');
  }

  var toggle = document.createElement('button');
  toggle.id = 'gqx-toggle';
  toggle.textContent = 'RUNNING EXAMPLE';
  toggle.setAttribute('aria-controls', 'gqx-drawer');
  document.body.appendChild(toggle);

  var drawer = document.createElement('aside');
  drawer.id = 'gqx-drawer';
  drawer.setAttribute('aria-label', 'Running example');
  drawer.innerHTML =
    '<div class="gqx-head"><span class="gqx-title">RUNNING EXAMPLE</span>' +
    '<button id="gqx-close" aria-label="close">×</button></div>' +
    '<div class="gqx-crumb" id="gqx-crumb"></div>' +
    '<section class="gqx-sec" id="gqx-sec-target"><h4>TARGET GROUP</h4>' +
    '<div class="gqx-pick" id="gqx-pick"></div>' +
    '<div class="gqx-row"><label for="gqx-label">label</label>' +
    '<input type="text" id="gqx-label" placeholder="e.g. 128.68" size="11">' +
    '<button class="gqx-run" id="gqx-load" style="margin-top:0">Load</button>' +
    '<button class="gqx-run" id="gqx-rand" style="margin-top:0" title="load a random group from the battery">Random</button></div>' +
    '<div class="gqx-msg" id="gqx-msg"></div>' +
    '<div class="gqx-row"><label for="gqx-pres">presentation</label><select id="gqx-pres"></select></div>' +
    '<div class="gqx-stat" id="gqx-gstat"></div></section>' +
    '<section class="gqx-sec" id="gqx-sec-marking"><h4>MARKING (σ, τ, x₀, x₁)</h4>' +
    '<div class="gqx-step" id="gqx-step-o"><button id="gqx-oprev" aria-label="previous extension">◀</button>' +
    '<button id="gqx-onext" aria-label="next extension">▶</button><span class="gqx-pos" id="gqx-opos"></span></div>' +
    '<div class="gqx-step" id="gqx-step-m"><button id="gqx-mprev" aria-label="previous marking">◀</button>' +
    '<button id="gqx-mnext" aria-label="next marking">▶</button><span class="gqx-pos" id="gqx-mpos"></span></div>' +
    '<div class="gqx-quad" id="gqx-quad"></div>' +
    '<div class="gqx-checks" id="gqx-checks"></div></section>' +
    '<section class="gqx-sec" id="gqx-sec-ledger"><h4>WORD LEDGER</h4>' +
    '<table class="gqx-ledger" id="gqx-ledger"></table></section>' +
    '<section class="gqx-sec" id="gqx-sec-count"><h4>THE COUNT</h4>' +
    '<div class="gqx-count" id="gqx-count"></div>' +
    '<div class="gqx-stat" id="gqx-countstat"></div>' +
    '<div class="gqx-card" id="gqx-orbitcard"></div></section>' +
    '<section class="gqx-sec" id="gqx-sec-play"><h4>RELATOR PLAYGROUND</h4>' +
    '<div class="gqx-kicker">Independent of the target above: edit any second relator and sweep it against ' +
    'the whole test pool, comparing counts with the verifier baseline.</div>' +
    '<div class="gqx-presets" id="gqx-presets">' +
    '<div class="gqx-prow"><span class="gqx-plabel">proven</span>' +
    '<button data-p="collector">collector</button>' +
    '<button data-p="square_commutator">square-commutator</button></div>' +
    '<div class="gqx-prow"><span class="gqx-plabel">candidates</span>' +
    '<button data-p="twisted">twisted-square</button>' +
    '<button data-p="barreto">Barreto</button>' +
    '<button data-p="thompson">Thompson</button></div>' +
    '<div class="gqx-prow"><span class="gqx-plabel">rejected</span>' +
    '<button data-p="w3" title="March 11 (W3): 1,578 battery mismatches; the sweep catches it at D₈">Mar 11 (W3)</button>' +
    '<button data-p="mar13a" title="March 13 A: 127 battery mismatches; the sweep catches it at GL(2,3)">Mar 13 A</button>' +
    '<button data-p="mar15" title="March 15 σ₂ repair: 7 battery failures, all beyond the sweep pool — passing here is not proof">Mar 15</button>' +
    '<button data-p="splice_r0" title="June splice R₀: 0 extensions at GL(2,3) where 8 are required">splice R₀</button>' +
    '<button data-p="a1" title="A1: refuted by a cup-product rank computation (17 vs 23), not by small counts">A1</button>' +
    '<button data-p="a2" title="A2: refuted by a marked-abelianization contradiction, not by small counts">A2</button>' +
    '<button data-p="tailless" title="square-commutator without its tail: caught at GL(2,3)">near-miss (drop the tail)</button></div></div>' +
    '<textarea id="gqx-prog" spellcheck="false" aria-label="relator program"></textarea>' +
    '<button class="gqx-run" id="gqx-sweep">Sweep the small pool</button>' +
    '<div class="gqx-sweep" id="gqx-sweepout"></div>' +
    '<div class="gqx-err" id="gqx-perr"></div>' +
    '<div class="gqx-stat">Sweeps ℤ/4, S₃, S₄, GL(2,3) and D₈ by brute enumeration in this page and compares ' +
    'against the verifier baseline; the full 5,402-group battery is an offline run (see ' +
    '<a href="' + ROOT + 'reproducibility/">reproducibility</a>).</div></section>' +
    '<div class="gqx-foot">One orbit per extension: markings are counted up to Aut(G), and the ' +
    'postcomposition action on surjections is free. Data: precomputed bundles decoded from the ' +
    'verifier\'s eltstore; the word ledger and relator are recomputed live here, and for |G| ≤ ' +
    LIVE_LIMIT + ' the tame, pro-2, generation, and invariant claims are re-verified in the page. ' +
    'LMFDB field snapshot 2026-07-28.</div>';
  document.body.appendChild(drawer);

  var $ = function (id) { return document.getElementById(id); };

  /* ---- page chrome: keep the drawer below the header / above the phone
     navbar, and coordinate with PreTeXt's ToC sidebar ---- */
  var masthead = document.querySelector('.ptx-masthead');
  var navbar = document.querySelector('.ptx-navbar');
  var lastTop = null, lastBottom = null;
  function layoutChrome() {
    var top = 0, bottom = 0, r;
    if (masthead) { r = masthead.getBoundingClientRect(); if (r.bottom > top) top = r.bottom; }
    if (navbar) {
      r = navbar.getBoundingClientRect();
      if (r.top <= window.innerHeight / 2) { if (r.bottom > top) top = r.bottom; }
      else bottom = Math.max(0, window.innerHeight - r.top);   // phone layout: navbar is a bottom bar
    }
    top = Math.max(0, Math.round(top)); bottom = Math.round(bottom);
    if (top !== lastTop) { document.documentElement.style.setProperty('--gqx-top', top + 'px'); lastTop = top; }
    if (bottom !== lastBottom) { document.documentElement.style.setProperty('--gqx-bottom', bottom + 'px'); lastBottom = bottom; }
  }

  function tocSidebar() { return document.getElementById('ptx-sidebar'); }
  function tocIsOpen() {
    var s = tocSidebar();
    return !!s && !s.classList.contains('hidden') &&
      (s.classList.contains('visible') || s.offsetParent !== null);
  }
  function setToc(open) {
    // mirror pretext-core's toggletoc() class discipline exactly
    var s = tocSidebar(); if (!s) return;
    s.classList.toggle('visible', open);
    s.classList.toggle('hidden', !open);
    var b = document.getElementById('ptx-toc-toggle');
    if (b) b.setAttribute('aria-expanded', String(open));
  }

  function setOpen(open) {
    state.open = open;
    document.body.dataset.gqx = open ? 'open' : 'closed';
    toggle.setAttribute('aria-expanded', String(open));
    if (open && window.innerWidth < W_BOTH && tocIsOpen()) setToc(false);
    persist();
  }

  /* ================= rendering ================= */
  function cur() {
    var b = bundles[state.label];
    if (!b) return null;
    var presKeys = Object.keys(b.presentations);
    if (!presKeys.length) return null;
    if (!b.presentations[state.pres]) state.pres = presKeys[0];
    var pd = b.presentations[state.pres];
    if (!pd.orbits.length) return { b: b, pd: pd, orbit: null, marking: null };
    if (state.oi >= pd.orbits.length || state.oi < 0) state.oi = 0;
    var orbit = pd.orbits[state.oi];
    var marks = [orbit.rep].concat(orbit.samples || []);
    if (state.mi >= marks.length || state.mi < 0) state.mi = 0;
    return { b: b, pd: pd, orbit: orbit, marking: marks[state.mi], nMarks: marks.length };
  }

  function renderTarget() {
    var b = bundles[state.label];
    $('gqx-pick').innerHTML = POOL.map(function (l) {
      return '<button data-l="' + l + '" aria-pressed="' + (l === state.label) + '"><b>' + POOL_NAMES[l] +
        '</b><span>' + l + '</span></button>';
    }).join('');
    var sel = $('gqx-pres');
    if (b) {
      sel.innerHTML = Object.keys(b.presentations).map(function (k) {
        return '<option value="' + k + '">' + (PRES_NAMES[k] || k) + '</option>';
      }).join('');
      sel.value = state.pres;
      var bits = [];
      // Verifier-internal labels carry a "._" marker (e.g. 163840._A); both
      // 24.12-style GAP ids and 1024.wh-style letter codes are LMFDB labels.
      var internal = b.label.indexOf('._') >= 0;
      if (!internal) {
        bits.push('<a href="https://www.lmfdb.org/Groups/Abstract/' + b.label + '" target="_blank" rel="noopener">LMFDB ' + b.label + '</a>');
      } else {
        bits.push('<span class="gqx-mono">' + esc(b.label) + '</span> <span class="gqx-dimtxt">(verifier-internal label)</span>');
      }
      bits.push('|G| = ' + b.order);
      bits.push('|O₂(G)| = ' + b.o2_order);
      bits.push(b.aut_order ? '|Aut(G)| = ' + b.aut_order : '|Aut(G)| not computed');
      bits.push('degree ' + b.degree);
      if (!internal) {
        bits.push('<a href="https://www.lmfdb.org/padicField/?p=2&gal=' + b.label +
          '" target="_blank" rel="noopener">2-adic fields with this Galois group</a>');
      }
      $('gqx-gstat').innerHTML = bits.join(' · ');
    } else {
      sel.innerHTML = '';
      $('gqx-gstat').textContent = '';
    }
  }

  function verifyLive(c) {
    // returns {live: bool, gen: bool|null, pro2: bool|null, invOK: bool|null}
    if (c.b.order > LIVE_LIMIT) return { live: false };
    var d = derived(state.label);
    if (!d) return { live: false };
    var gens = c.marking.filter(function (g) { return !isId(g); });
    var G = gens.length ? closure(gens, c.b.order + 1) : [identity(c.b.degree)];
    var gen = G.length === c.b.order;
    var W = nclElts(d.elts, [c.marking[2], c.marking[3]]).length;
    var I = nclElts(d.elts, [c.marking[1], c.marking[2], c.marking[3]]).length;
    var pro2 = (W & (W - 1)) === 0;
    var invOK = I === c.orbit.inv.e && W === c.orbit.inv.ew;
    return { live: true, gen: gen, pro2: pro2, invOK: invOK };
  }

  function renderMarking() {
    var c = cur();
    var hasOrbit = !!(c && c.orbit);
    $('gqx-step-o').style.display = hasOrbit ? '' : 'none';
    $('gqx-step-m').style.display = hasOrbit ? '' : 'none';
    if (!hasOrbit) {
      $('gqx-opos').textContent = '';
      $('gqx-mpos').textContent = '';
      $('gqx-quad').innerHTML = c
        ? '<span class="gqx-dimtxt">no admissible markings — no extension of ℚ₂ has this Galois group</span>' : '';
      $('gqx-checks').innerHTML = '';
      return;
    }
    $('gqx-opos').textContent = 'extension ' + (state.oi + 1) + ' of ' + c.pd.count +
      (c.pd.stored && c.pd.stored < c.pd.count ? ' (first ' + c.pd.stored + ' in bundle)' : '');
    var total = c.b.aut_order ? '|Aut| = ' + c.b.aut_order : 'orbit size |Aut|';
    $('gqx-mpos').textContent = c.nMarks > 1
      ? 'marking ' + (state.mi + 1) + ' of ' + total + ' (' + c.nMarks + ' shown)'
      : 'orbit representative (' + total + ' markings in the orbit)';
    $('gqx-mprev').disabled = $('gqx-mnext').disabled = c.nMarks <= 1;
    var names = ['σ', 'τ', 'x₀', 'x₁'];
    $('gqx-quad').innerHTML = c.marking.map(function (g, i) {
      return '<span class="gqx-gen">' + names[i] + ' ↦</span><span class="gqx-val">' + cyclesClamped(g) + '</span>';
    }).join('');

    var prog = parseProgram(PROGRAMS[state.pres] || PROGRAMS.collector);
    var tame = eqp(conj(c.marking[1], c.marking[0]), compose(c.marking[1], c.marking[1]));
    var wild = false;
    try { wild = runProgram(prog, c.marking).ok; } catch (e) { /* shown in ledger */ }
    var v = verifyLive(c);
    function chip(label, ok) { return '<span class="gqx-chk ' + (ok ? 'gqx-ok' : 'gqx-bad') + '">' + label + ' ' + (ok ? '✓' : '✗') + '</span>'; }
    function pre(label) { return '<span class="gqx-chk gqx-pre">' + label + ' ✓ (export)</span>'; }
    $('gqx-checks').innerHTML =
      chip('tame τ<sup>σ</sup>=τ²', tame) +
      chip('wild relator', wild) +
      (v.live ? chip('x₀,x₁ pro-2', v.pro2) : pre('x₀,x₁ pro-2')) +
      (v.live ? chip('generates', v.gen) : pre('generates')) +
      (v.live ? chip('invariants', v.invOK) : pre('invariants'));
  }

  function renderLedger() {
    var c = cur();
    $('gqx-sec-ledger').style.display = c && c.marking ? '' : 'none';
    if (!c || !c.marking) { $('gqx-ledger').innerHTML = ''; return; }
    var rows = '';
    try {
      var res = runProgram(parseProgram(PROGRAMS[state.pres] || PROGRAMS.collector), c.marking);
      rows = res.ledger.map(function (r) {
        return '<tr><td class="gqx-w">' + prettyName(r[0]) + '</td><td class="gqx-v">' + cyclesClamped(r[1]) + '</td></tr>';
      }).join('');
      rows += res.values.map(function (val) {
        return '<tr class="gqx-rel"><td class="gqx-w">relator</td><td class="gqx-v">' + cyclesClamped(val) + (isId(val) ? '&ensp;✓' : '&ensp;✗ ≠ ()') + '</td></tr>';
      }).join('');
    } catch (e) { rows = '<tr><td class="gqx-v" colspan="2">' + esc(e.message) + '</td></tr>'; }
    $('gqx-ledger').innerHTML = rows;
  }

  function fieldLink(fl) {
    return '<a href="https://www.lmfdb.org/padicField/' + fl.label + '" target="_blank" rel="noopener" class="gqx-mono">' +
      fl.label + '</a>' + (fl.slopes ? ' <span class="gqx-dimtxt">slopes ' + fl.slopes + '</span>' : '');
  }
  function renderCount() {
    var c = cur();
    $('gqx-orbitcard').style.display = c && c.orbit ? '' : 'none';
    if (!c) { $('gqx-count').textContent = ''; $('gqx-countstat').textContent = ''; $('gqx-orbitcard').innerHTML = ''; return; }
    var n = c.pd.count;
    var name = POOL_NAMES[state.label] || state.label;
    var line = n + ' ' + (n === 1 ? 'extension' : 'extensions') + ' of ℚ₂ with group ' + esc(name);
    if (c.b.aut_order) line += ' &ensp;·&ensp; |Sur(Γ, G)| = <b>' + (n * c.b.aut_order) + '</b> = ' + n + ' · ' + c.b.aut_order;
    $('gqx-count').innerHTML = line;
    var other = Object.keys(c.b.presentations).filter(function (k) { return k !== state.pres; })[0];
    $('gqx-countstat').innerHTML = other
      ? 'the ' + (PRES_NAMES[other] || other).replace(/ \(.*/, '') + ' presentation gives the same count: ' + c.b.presentations[other].count + (c.b.presentations[other].count === n ? ' ✓' : ' ✗')
      : '';
    if (!c.orbit) { $('gqx-orbitcard').innerHTML = ''; return; }
    var inv = c.orbit.inv;
    var invLine = 'this orbit — inertia image: e = ' + inv.e + ' = ' + inv.et + '·' + inv.ew + ' (tame·wild), f = ' + inv.f;
    var fieldLine = '';
    var fl = FIELDS[state.label];
    if (fl) {
      var matches = fl.filter(function (x) { return x.f === inv.f && x.e === inv.e; });
      if (matches.length === 1) fieldLine = '↔ ' + fieldLink(matches[0]) + ' — forced by (f, e)';
      else if (matches.length > 1) fieldLine = 'one of ' + matches.map(fieldLink).join(', ') +
        '<br><span class="gqx-dimtxt">(f = ' + inv.f + ', e = ' + inv.e + ') is shared by ' + matches.length + ' fields' +
        (state.label === '24.12' ? '; only the slopes differ, and slopes are not an invariant of the marking' : ' — the marking cannot canonically pick one') + '</span>';
    } else if (FIELD_NOTES[state.label]) {
      fieldLine = FIELD_NOTES[state.label];
    } else {
      fieldLine = '<span class="gqx-dimtxt">a G-extension of ℚ₂ has degree |G| = ' + c.b.order +
        '; per-orbit field matching beyond the small pool needs the LMFDB join (planned bundle upgrade)</span>';
    }
    $('gqx-orbitcard').innerHTML = '<div>' + invLine + '</div><div>' + fieldLine + '</div>';
  }

  function renderAll() { renderTarget(); renderMarking(); renderLedger(); renderCount(); persist(); }

  function selectGroup(label) {
    $('gqx-msg').textContent = 'loading ' + label + '…';
    getBundle(label).then(function () {
      state.label = label; state.oi = 0; state.mi = 0;
      $('gqx-msg').textContent = '';
      renderAll();
    }).catch(function (err) {
      getIndex().then(function (ix) {
        $('gqx-msg').textContent = ix.groups && ix.groups[label]
          ? 'could not load bundle for ' + label + ' (' + err.message + ')'
          : 'no bundle for "' + label + '" — labels come from the battery of ' + Object.keys(ix.groups).length +
            ' finite groups (gps.txt); e.g. 32.6, 128.68, 512.47711 (order 1024 has verifier-internal labels like 1024._BF)';
      }).catch(function () {
        $('gqx-msg').textContent = 'could not load ' + label + ': ' + err.message;
      });
    });
  }

  /* ================= playground ================= */
  var progText = PROGRAMS.collector;
  function renderPlay() {
    $('gqx-prog').value = progText;
    Array.prototype.forEach.call($('gqx-presets').querySelectorAll('button'), function (b) {
      b.setAttribute('aria-pressed', String(PROGRAMS[b.dataset.p] === progText));
    });
  }
  function poolCount(label, prog) {
    var b = bundles[label];
    var d = derived(label);
    var elts = d.elts;
    var o2 = [], i;
    if (!d.o2) {
      for (i = 0; i < elts.length; i++) {
        var w = nclElts(elts, [elts[i]]);
        if ((w.length & (w.length - 1)) === 0 && w.every(function (x) { var o = order(x); return (o & (o - 1)) === 0; })) o2.push(elts[i]);
      }
      d.o2 = o2;
    }
    o2 = d.o2;
    if (!d.tame) {
      var pairs = [];
      for (i = 0; i < elts.length; i++) {
        var t2 = compose(elts[i], elts[i]);
        for (var j = 0; j < elts.length; j++) if (eqp(conj(elts[i], elts[j]), t2)) pairs.push([elts[j], elts[i]]);
      }
      d.tame = pairs;
    }
    var count = 0;
    d.tame.forEach(function (st) {
      o2.forEach(function (x0) {
        o2.forEach(function (x1) {
          var quad = [st[0], st[1], x0, x1];
          if (runProgram(prog, quad).ok) {
            var gens = quad.filter(function (g) { return !isId(g); });
            var size = gens.length ? closure(gens, b.order + 1).length : 1;
            if (size === b.order) count++;
          }
        });
      });
    });
    return count;
  }
  function sweep() {
    progText = $('gqx-prog').value;
    $('gqx-perr').textContent = '';
    var prog;
    try { prog = parseProgram(progText); }
    catch (err) { $('gqx-perr').textContent = 'Parse error: ' + err.message; $('gqx-sweepout').innerHTML = ''; return; }
    $('gqx-sweepout').innerHTML = '<span class="gqx-chk">sweeping…</span>';
    Promise.all(SWEEP_POOL.map(getBundle)).then(function () {
      var out = SWEEP_POOL.map(function (label) {
        var b = bundles[label];
        var truth = (b.presentations.collector || b.presentations.square_commutator).count;
        try {
          var t0 = performance.now();
          var n = poolCount(label, prog);
          var ms = Math.round(performance.now() - t0);
          var aut = b.aut_order;
          var ext = aut ? n / aut : null;
          var ok = ext === truth;
          return '<span class="gqx-chk ' + (ok ? 'gqx-ok' : 'gqx-bad') + '">' + (POOL_NAMES[label] || label) + ': ' +
            (ext === null ? n + ' markings' : ext) + ' ' + (ok ? '✓' : '✗ (true ' + truth + ')') + ' · ' + ms + 'ms</span>';
        } catch (err) {
          return '<span class="gqx-chk gqx-bad">' + (POOL_NAMES[label] || label) + ': ' + esc(err.message) + '</span>';
        }
      });
      $('gqx-sweepout').innerHTML = out.join('');
    }).catch(function (err) {
      $('gqx-sweepout').innerHTML = '';
      $('gqx-perr').textContent = 'could not load pool bundles: ' + err.message;
    });
  }

  /* ================= scroll lens ================= */
  var LENSMAP = [
    { anchor: 'thm-main', label: 'Theorem 1.2 — the marking and the word ledger', secs: ['gqx-sec-marking', 'gqx-sec-ledger'] },
    { anchor: 'prop-epi-semantics', label: 'Proposition (epi semantics) — the count', secs: ['gqx-sec-count'] },
    { anchor: 'app-squarecommutator', label: 'Appendix C — switch the presentation', secs: ['gqx-sec-target'] },
    { anchor: 'app-worked', label: 'Appendix D — worked examples and the playground', secs: ['gqx-sec-play'] },
  ].filter(function (l) { return document.getElementById(l.anchor); });
  function updateLens() {
    if (!LENSMAP.length || document.body.dataset.gqx !== 'open') return;
    var cutoff = window.innerHeight * 0.45;
    var active = LENSMAP[0];
    LENSMAP.forEach(function (l) {
      var el = document.getElementById(l.anchor);
      if (el && el.getBoundingClientRect().top <= cutoff) active = l;
    });
    $('gqx-crumb').textContent = 'following ' + active.label;
    Array.prototype.forEach.call(drawer.querySelectorAll('.gqx-sec'), function (sec) {
      sec.classList.toggle('gqx-lens', active.secs.indexOf(sec.id) >= 0);
    });
  }
  window.addEventListener('scroll', function () { requestAnimationFrame(function () { layoutChrome(); updateLens(); }); }, { passive: true });
  window.addEventListener('resize', function () { requestAnimationFrame(layoutChrome); }, { passive: true });

  /* ================= events ================= */
  toggle.addEventListener('click', function () { setOpen(document.body.dataset.gqx !== 'open'); updateLens(); });
  var tocBtn = document.getElementById('ptx-toc-toggle');
  if (tocBtn) tocBtn.addEventListener('click', function () {
    // registered before pretext-core binds its own handler, so this sees the
    // pre-toggle state: if the ToC is about to open on a width where both
    // panels do not fit beside the text, the drawer yields the space.
    if (!tocIsOpen() && window.innerWidth < W_BOTH && state.open) setOpen(false);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && state.open && !(e.target.closest && e.target.closest('#gqx-drawer input, #gqx-drawer textarea, #gqx-drawer select'))) setOpen(false);
  });
  drawer.addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b) return;
    if (b.id === 'gqx-close') setOpen(false);
    else if (b.closest('#gqx-pick')) selectGroup(b.dataset.l);
    else if (b.id === 'gqx-load') { var v = $('gqx-label').value.trim(); if (v) selectGroup(v); }
    else if (b.id === 'gqx-rand') {
      getIndex().then(function (ix) {
        var keys = Object.keys(ix.groups);
        var pick = keys[Math.floor(Math.random() * keys.length)];
        $('gqx-label').value = pick;
        selectGroup(pick);
      }).catch(function (err) { $('gqx-msg').textContent = 'could not load index: ' + err.message; });
    }
    else if (b.id === 'gqx-onext' || b.id === 'gqx-oprev') {
      var c = cur();
      if (!c || !c.pd.orbits.length) return;
      var K = c.pd.orbits.length;
      state.oi = (state.oi + (b.id === 'gqx-onext' ? 1 : K - 1)) % K;
      state.mi = 0;
      renderMarking(); renderLedger(); renderCount(); persist();
    } else if (b.id === 'gqx-mnext' || b.id === 'gqx-mprev') {
      var c2 = cur();
      if (!c2 || c2.nMarks <= 1) return;
      state.mi = (state.mi + (b.id === 'gqx-mnext' ? 1 : c2.nMarks - 1)) % c2.nMarks;
      renderMarking(); renderLedger(); persist();
    } else if (b.closest('#gqx-presets')) {
      progText = PROGRAMS[b.dataset.p]; renderPlay(); $('gqx-perr').textContent = '';
    } else if (b.id === 'gqx-sweep') sweep();
  });
  drawer.addEventListener('change', function (e) {
    if (e.target.id === 'gqx-pres') {
      state.pres = e.target.value; state.oi = 0; state.mi = 0;
      renderAll();
    }
  });
  drawer.addEventListener('keydown', function (e) {
    if (e.target.id === 'gqx-label' && e.key === 'Enter') $('gqx-load').click();
  });

  /* ================= boot ================= */
  layoutChrome();
  var w0 = window.innerWidth;
  if (w0 >= W_BOTH) { setToc(true); setOpen(true); }
  else if (w0 >= W_ONE) { setToc(false); setOpen(true); }
  else { setToc(false); setOpen(false); }
  renderPlay();
  selectGroup(state.label);
  updateLens();

  /* Public handle: lets result-level popups (and tests) read the current
     example state and drive the drawer without reaching into the DOM. */
  window.gqxExample = {
    state: state,
    current: cur,
    bundles: bundles,
    getBundle: getBundle,
    selectGroup: selectGroup,
    setOpen: setOpen,
    setToc: setToc,
    layoutChrome: layoutChrome,
    updateLens: updateLens,
    selectPresentation: function (k) {
      var b = bundles[state.label];
      if (!b || !b.presentations[k]) return;
      state.pres = k; state.oi = 0; state.mi = 0;
      renderAll();
    },
    focusSection: function (id) {
      setOpen(true);
      var el = $(id);
      if (el) el.scrollIntoView({ block: 'start', behavior: 'smooth' });
    },
    evalCurrent: function () {
      // marking-level data for the result popups
      var c = cur();
      if (!c || !c.marking) return null;
      var res = null;
      try { res = runProgram(parseProgram(PROGRAMS[state.pres] || PROGRAMS.collector), c.marking); } catch (e) { /* shown as absent */ }
      return {
        marking: c.marking,
        tame: eqp(conj(c.marking[1], c.marking[0]), compose(c.marking[1], c.marking[1])),
        wild: res ? res.ok : false,
        ledger: res ? res.ledger : [],
        tauOrder: order(c.marking[1])
      };
    },
    kernel: { order: order, isId: isId, cycles: cyclesClamped, compose: compose, conj: conj, inverse: inverse },
    onChange: function (f) { changeListeners.push(f); }
  };
})();
