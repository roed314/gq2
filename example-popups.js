/* Result-level popups tying individual results of the paper to the
 * running-example drawer (plan: directives/running-example/result-popups.md).
 *
 * Each configured anchor gets a "running example" chip in its heading; the
 * chip opens an inset panel whose text is instantiated from the CURRENT
 * drawer state via window.gqxExample (and re-renders when that changes).
 * Panels use the sidebar's plain-Unicode visual language, not MathJax.
 *
 * Injected into paper.html by scripts/inject-example-sidebar.py, after
 * example-sidebar.js.
 */
(function () {
  'use strict';

  var esc = function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); };
  var NAMES = { '2.1': 'C₂', '4.1': 'ℤ/4', '4.2': 'V₄', '6.1': 'S₃', '8.3': 'D₄', '8.4': 'Q₈', '24.12': 'S₄', '48.29': 'GL(2,3)' };
  function gname(label) {
    var n = NAMES[label];
    return n ? n + ' <span class="gqx-mono">(' + esc(label) + ')</span>' : '<span class="gqx-mono">' + esc(label) + '</span>';
  }
  function chip(label, ok) {
    return '<span class="gqx-chk ' + (ok ? 'gqx-ok' : 'gqx-bad') + '">' + label + ' ' + (ok ? '✓' : '✗') + '</span>';
  }
  function btn(act, label) {
    return '<button type="button" class="gqxp-btn" data-act="' + esc(act) + '">' + label + '</button>';
  }
  function actions() {
    var list = Array.prototype.slice.call(arguments).filter(Boolean);
    return list.length ? '<div class="gqxp-actions">' + list.join('') + '</div>' : '';
  }
  function loadBtn(label) { return btn('load:' + label, 'load ' + (NAMES[label] || label) + ' (' + label + ')'); }
  var OPEN_DRAWER = btn('open', 'open the drawer');

  function ctx() {
    var api = window.gqxExample;
    var c = api.current();
    return { api: api, c: c, b: c && c.b, pd: c && c.pd, orbit: c && c.orbit, pres: api.state.pres };
  }
  function presName(k) { return k === 'square_commutator' ? 'square-commutator' : k; }
  function surLine(pd, b) {
    if (!b.aut_order) return '<span class="gqxp-num">' + pd.count + ' extensions</span>';
    return '<span class="gqxp-num"><b>|Sur(Γ, G)| = ' + (pd.count * b.aut_order) + '</b> = ' +
      pd.count + ' extensions × |Aut(G)| = ' + b.aut_order + '</span>';
  }
  function bothCounts(b) {
    var c1 = b.presentations.collector, c2 = b.presentations.square_commutator;
    if (!c1 || !c2) return null;
    return { c1: c1.count, c2: c2.count, eq: c1.count === c2.count };
  }

  /* ================= panel renders ================= */

  function pThmMain(x) {
    if (!x.b) return '<p>Loading the drawer’s current target…</p>';
    if (!x.orbit) {
      return '<p>The drawer’s current target G = ' + gname(x.b.label) + ' has <b>no admissible markings</b>: ' +
        'the theorem’s two relations have no common solution generating G, so |Sur(Γ, G)| = 0 and no extension of ℚ₂ has this Galois group. ' +
        'Pick a target with markings to evaluate the relations live.</p>' +
        actions(loadBtn('24.12'), OPEN_DRAWER);
    }
    var ev = x.api.evalCurrent();
    var note = x.pres !== 'collector'
      ? '<p class="gqx-dimtxt">The drawer is currently on the ' + esc(presName(x.pres)) + ' presentation; Theorem 1.2 states the collector relator.</p>'
      : '';
    return '<p>The theorem’s two defining relations, evaluated at the drawer’s current marking of G = ' + gname(x.b.label) + ': ' +
      chip('tame τ<sup>σ</sup> = τ²', ev.tame) + ' ' + chip('wild relator = ()', ev.wild) + '</p>' +
      '<p>The auxiliary words of (1.1)–(1.3) — σ₂, u₀, u₁, d₀, z₀, c₀, d<sub>g</sub>, h<sub>c</sub>, h₀ — are exactly the rows of the ' +
      'drawer’s <b>word ledger</b>, recomputed live at this marking (' + ev.ledger.length + ' rows here).</p>' + note +
      actions(btn('focus:gqx-sec-ledger', 'show the word ledger'),
        x.pres !== 'collector' ? btn('pres:collector', 'switch to the collector presentation') : '', OPEN_DRAWER);
  }

  function pEpiSemantics(x) {
    if (!x.b) return '<p>Loading…</p>';
    var s = '<p>For the drawer’s target G = ' + gname(x.b.label) + ' this proposition is the bookkeeping behind <b>the count</b>: ' +
      'epimorphisms Γ ↠ G correspond exactly to quadruples (σ, τ, x₀, x₁) ∈ G⁴ that satisfy the tame relation, kill the wild relator, ' +
      'lie with x₀, x₁ in O₂(G) (here |O₂(G)| = ' + x.b.o2_order + '), and generate G — precisely what the drawer’s chips certify for the displayed marking.</p>';
    s += x.pd.count > 0
      ? '<p>Counting both sides: ' + surLine(x.pd, x.b) + '.</p>'
      : '<p>For this G no such quadruple exists: <b>|Sur(Γ, G)| = 0</b> — the correspondence still computes the count; it just comes out empty, ' +
        'showing G is not a Galois group over ℚ₂.</p>';
    return s + actions(OPEN_DRAWER);
  }

  function pPro2(x) {
    var is2 = x.b && x.b.order > 1 && x.b.o2_order === x.b.order;
    if (is2 && x.orbit) {
      var ev = x.api.evalCurrent(), k = x.api.kernel, m = ev.marking;
      var s = m[0], x0 = m[2], x1 = m[3];
      if (x.pres === 'collector') {
        // collapse of the collector relator: h₀u₁⁻¹x₁^σc₀ → x₀^{σ²}x₀[x₁,σ]
        var comm = k.compose(k.compose(k.inverse(x1), k.inverse(s)), k.compose(x1, s));
        var dem = k.compose(k.compose(k.conj(x0, k.compose(s, s)), x0), comm);
        return '<p>G = ' + gname(x.b.label) + ' is a 2-group, so τ ↦ () and the collector ledger <b>collapses</b>: ' +
          'u<sub>i</sub> = x<sub>i</sub> and d₀ = c₀ = h<sub>c</sub> = () (those rows of the word ledger all read “()”). ' +
          'What survives of the wild relation is the Demushkin relator of the maximal pro-2 quotient Π, checked here at the current marking: ' +
          chip('x₀<sup>σ²</sup> x₀ [x₁, σ] = ()', k.isId(dem)) + '</p>' +
          '<p>Prop 3.11’s Nielsen transform turns the boundary relator a²s⁴[s, y] into this same word.</p>' +
          actions(btn('focus:gqx-sec-ledger', 'show the ledger'), OPEN_DRAWER);
      }
      // square-commutator markings collapse to D_R's relator instead (Lem C.8)
      var xs = k.conj(x0, s), ys = k.conj(x1, s);
      var x0m3 = k.inverse(k.compose(x0, k.compose(x0, x0)));
      var cR = k.compose(k.compose(k.inverse(x1), k.inverse(ys)), k.compose(x1, ys));
      var dR = k.compose(k.compose(k.compose(k.inverse(xs), x0m3), k.compose(x1, x1)), cR);
      return '<p>G = ' + gname(x.b.label) + ' is a 2-group, so τ ↦ () — but the drawer is on the <b>square-commutator</b> presentation, ' +
        'whose markings collapse to the relator of D<sub>R</sub> (Lem C.8) rather than to Π’s Demushkin word, checked here at the current marking: ' +
        chip('(x₀<sup>σ</sup>)⁻¹ x₀⁻³ x₁² [x₁, x₁<sup>σ</sup>] = ()', k.isId(dR)) + '</p>' +
        '<p>The two presentations share every count but not their marking sets; the collapse to Π’s relator x₀<sup>σ²</sup> x₀ [x₁, σ] ' +
        'stated in this proposition is the collector ledger’s.</p>' +
        actions(btn('pres:collector', 'switch to the collector presentation'), btn('focus:gqx-sec-ledger', 'show the ledger'), OPEN_DRAWER);
    }
    var here = x.b
      ? ' Your current target G = ' + gname(x.b.label) + ' has |O₂(G)| = ' + x.b.o2_order + ' &lt; |G| = ' + x.b.order + ', so its tame part is in the way — load a 2-group to watch.'
      : '';
    return '<p>On a 2-group target the whole collector ledger collapses — u<sub>i</sub> = x<sub>i</sub>, d₀ = c₀ = h<sub>c</sub> = () — ' +
      'and the wild relation becomes the Demushkin relator x₀<sup>σ²</sup> x₀ [x₁, σ] of Π, which the panel then verifies live on the drawer’s marking.' + here + '</p>' +
      actions(btn('loadc:4.1', 'load ℤ/4 (4.1)'), btn('loadc:32.6', 'load 32.6'), OPEN_DRAWER);
  }

  function pWordLedger(x) {
    var live = '';
    if (x.orbit) {
      var ev = x.api.evalCurrent();
      live = '<p>At the drawer’s current marking of G = ' + gname(x.b.label) + ' the ' + esc(presName(x.pres)) +
        ' ledger has ' + ev.ledger.length + ' rows, and the relator row closes to (): ' + chip('relator', ev.wild) + '</p>';
    }
    return '<p>The drawer’s <b>word ledger</b> is this lemma made concrete: the auxiliary words σ₂, u<sub>i</sub>, d₀, z₀, c₀, d<sub>g</sub>, h<sub>c</sub>, h₀ ' +
      'of the wild relator, evaluated at whatever marking is displayed. The lemma tabulates the finite-Fox first-order rules of exactly these words — ' +
      'the tame row Pb + (P + S⁻¹)d and the central ledger — which drive the evaluated Jacobian (Lem 5.5) and the mixed Hessian (Lem 5.14).</p>' +
      live + actions(btn('focus:gqx-sec-ledger', 'show the ledger'), OPEN_DRAWER);
  }

  function pTwoPresentations(x) {
    if (!x.b) return '<p>Loading…</p>';
    var both = bothCounts(x.b);
    var s;
    if (both) {
      s = '<p>Two presentations, one count — for G = ' + gname(x.b.label) + ': collector ' +
        '<span class="gqxp-num">' + both.c1 + '</span>, square-commutator <span class="gqxp-num">' + both.c2 + '</span> extensions ' +
        chip('equal', both.eq) + '</p>';
    } else {
      s = '<p>For G = ' + gname(x.b.label) + ' this bundle carries only the square-commutator run (' +
        '<span class="gqxp-num">' + x.pd.count + '</span> extensions).</p>';
    }
    s += '<p>Definition C.1’s admissibility conditions are the drawer’s chips with the App C relator; Theorem C.3 upgrades the battery-wide ' +
      'agreement (5,402 groups) to Γ<sub>R</sub> ≅ G<sub>ℚ₂</sub> — proved by re-running the paper’s argument over the source interface ' +
      '(Cor 6.19), not by any change of generators (that route is closed by Prop C.6).</p>';
    var other = x.pres === 'collector' ? 'square_commutator' : 'collector';
    return s + actions(
      x.b.presentations[other] ? btn('pres:' + other, 'switch the drawer to ' + presName(other)) : '', OPEN_DRAWER);
  }

  function pSqNumerics(x) {
    var labels = ['2.1', '4.1', '4.2', '8.3', '8.4'], expect = [7, 24, 42, 144, 144];
    return Promise.all(labels.map(x.api.getBundle)).then(function (bs) {
      var rows = bs.map(function (b, i) {
        var pd = b.presentations.square_commutator || b.presentations.collector;
        var sur = pd.count * b.aut_order;
        return '<tr><td>' + gname(b.label) + '</td><td>' + pd.count + '</td><td>' + b.aut_order + '</td><td><b>' + sur + '</b></td><td>' +
          chip(String(expect[i]), sur === expect[i]) + '</td></tr>';
      }).join('');
      return '<p>The remark’s early-evidence numbers, recomputed in this page from the shipped verifier bundles — ' +
        '|Sur(Γ<sub>R</sub>, G)| = #extensions × |Aut(G)|:</p>' +
        '<table class="gqxp-table"><tr><th>G</th><th>ext</th><th>|Aut|</th><th>|Sur|</th><th>remark</th></tr>' + rows + '</table>' +
        '<p>Computed against |Sur(G<sub>ℚ₂</sub>, G)| long before a proof existed; Theorem C.3 turned the agreement into an identity.</p>' +
        actions(loadBtn('8.3'), loadBtn('8.4'), OPEN_DRAWER);
    });
  }

  function pWorkedC4() {
    return '<p>This subsection, live: on a 2-group target τ ↦ (), the ledger collapses (u₀ = x₀, d₀ = c₀ = h<sub>c</sub> = ()) and the wild relation ' +
      'reads x₀<sup>σ²</sup> x₀ [x₁, σ] = (). For ℤ/4 the drawer shows 12 extensions × |Aut| = 2, so |Sur(Γ, ℤ/4)| = 24; ' +
      'the seven quadratic extensions (7 = 2³ − 1) are the C₂ count.</p>' +
      actions(btn('loadc:4.1', 'load ℤ/4 (4.1)'), btn('loadc:2.1', 'load C₂ (2.1)'), OPEN_DRAWER);
  }
  function pWorkedS3() {
    return '<p>This subsection, live: O₂(S₃) = 1 forces x₀, x₁ ↦ (), every ledger word is (), and the wild relator is vacuous — ' +
      'the whole count is carried by the tame pair (σ, τ) with τ<sup>σ</sup> = τ². One extension × |Aut(S₃)| = 6.</p>' +
      actions(btn('loadc:6.1', 'load S₃ (6.1)'), OPEN_DRAWER);
  }
  function pWorkedS4() {
    return '<p>This subsection, live: the first genuinely mixed case, L = O₂(S₄) = V₄ with simple head the 2-dimensional F₂[S₃]-module ' +
      '(the non-scalar layer that Theorem 8.17’s recursion consumes). The drawer shows 3 extensions × |Aut(S₄)| = 24, so |Sur| = 72, in three ' +
      'Aut-orbits sharing the tame frame (f, e<sub>t</sub>) = (2, 3) with wild part e<sub>w</sub> = 4; the three quartic fields differ only in their slopes.</p>' +
      actions(btn('loadc:24.12', 'load S₄ (24.12)'), OPEN_DRAWER);
  }
  function pWorkedVerifier() {
    return '<p>The drawer <i>is</i> this verifier made browsable: 5,402 battery groups, each bundle decoded from the verification run’s eltstore, ' +
      'with the word ledger and relator recomputed in-page, and extension counts cross-checked against the LMFDB 2-adic field tables. ' +
      'The playground sweeps the small pool with any relator you type — including the rejected candidates from the presentations page.</p>' +
      actions(btn('focus:gqx-sec-play', 'open the playground'), btn('rand', 'random group'), OPEN_DRAWER);
  }

  function pTameFinite(x) {
    if (!x.orbit) {
      return '<p>In any finite quotient generated by s, t with t<sup>s</sup> = t², the image of t has odd order and the group is ' +
        'C<sub>e</sub> ⋊ C<sub>n</sub> with e odd. Load a target with markings and this panel reads o(τ) off the drawer’s marking.</p>' +
        actions(loadBtn('24.12'), OPEN_DRAWER);
    }
    var ev = x.api.evalCurrent();
    var odd = ev.tauOrder % 2 === 1;
    return '<p>At the drawer’s marking of G = ' + gname(x.b.label) + ': ' + chip('o(τ) = ' + ev.tauOrder + ' odd', odd) + ' — as the lemma forces. ' +
      'The tame direction contributes e<sub>t</sub> = ' + x.orbit.inv.et + ' of the inertia degree (the drawer’s e = e<sub>t</sub>·e<sub>w</sub> line), ' +
      'and the finite tame quotient G/O₂(G) here has order ' + (x.b.order / x.b.o2_order) + '.</p>' + actions(OPEN_DRAWER);
  }

  function pTameQuotient(x) {
    if (!x.b) return '<p>Loading…</p>';
    return '<p>For G = ' + gname(x.b.label) + ': |O₂(G)| = ' + x.b.o2_order + ' — the drawer’s “x₀, x₁ pro-2” chip certifies the wild ' +
      'generators land there — and G/O₂(G) (order ' + (x.b.order / x.b.o2_order) + ') receives the tame frame. ' +
      'Prop 3.2 identifies Γ<sub>A</sub>/W<sub>A</sub> ≅ T<sub>tame</sub> ≅ G<sub>ℚ₂</sub>/W<sub>F</sub> canonically; Lem 3.3 is why O₂ is intrinsic: ' +
      'T<sub>tame</sub> has no nontrivial closed normal pro-2 subgroup, so the wild subgroup is the characteristic 2-core on both sides — ' +
      'which is what makes “x₀, x₁ ∈ O₂(G)” a well-posed condition in the drawer.</p>' + actions(OPEN_DRAWER);
  }

  function pFramed(x) {
    if (!x.orbit) {
      return '<p>A boundary frame fixes the tame data of a target; the framed count e<sup>β</sup><sub>Γ</sub> refines the drawer’s count by it, ' +
        'and Theorem 4.2 proves the framed counts agree for Γ<sub>A</sub> and G<sub>ℚ₂</sub> for every framed target. Load a target with markings ' +
        'to see its frame data.</p>' + actions(loadBtn('24.12'), OPEN_DRAWER);
    }
    var inv = x.orbit.inv;
    return '<p>The drawer’s current orbit carries (f, e<sub>t</sub>, e<sub>w</sub>) = (' + inv.f + ', ' + inv.et + ', ' + inv.ew + '). ' +
      'The boundary frame of Definition 4.1 is precisely the tame part (f, e<sub>t</sub>) of this data — well-defined because the tame and pro-2 ' +
      'quotients share one unramified marking ν (Prop 3.14) — and Theorem 4.2’s framed count equality over every framed target is the engine ' +
      'behind every number the drawer displays.</p>' + actions(OPEN_DRAWER);
  }

  function pFrameExhaustion(x) {
    if (!x.pd || !x.pd.orbits.length) {
      return '<p>Every epimorphism Γ ↠ G induces a unique tame frame on G/O₂(G); with decoration E = 0, framed epimorphisms with a fixed frame are ' +
        'exactly the ordinary ones inducing it. Load a target with markings to see its frame partition.</p>' + actions(loadBtn('24.12'), OPEN_DRAWER);
    }
    var frames = {};
    x.pd.orbits.forEach(function (o) {
      var k = '(f = ' + o.inv.f + ', e<sub>t</sub> = ' + o.inv.et + ')';
      frames[k] = (frames[k] || 0) + 1;
    });
    var parts = Object.keys(frames).map(function (k) { return k + ' × ' + frames[k]; }).join(', &ensp;');
    var caveat = x.pd.stored && x.pd.stored < x.pd.count
      ? ' <span class="gqx-dimtxt">(from the first ' + x.pd.stored + ' of ' + x.pd.count + ' stored orbits)</span>' : '';
    return '<p>The ' + x.pd.count + ' extensions of ℚ₂ with group G = ' + gname(x.b.label) + ' partition by tame frame: ' +
      '<span class="gqxp-num">' + parts + '</span>' + caveat + '.</p>' +
      '<p>With decoration E = 0, framed epimorphisms with a fixed frame are exactly the ordinary epimorphisms inducing it, and distinct frames are ' +
      'disjoint — the step that turns Theorem 4.2 into |Sur(Γ<sub>A</sub>, G)| = |Sur(G<sub>ℚ₂</sub>, G)| for every finite G.</p>' + actions(OPEN_DRAWER);
  }

  function pCommonScalars(x) {
    return x.api.getBundle('2.1').then(function (b) {
      var pd = b.presentations.collector || b.presentations.square_commutator;
      return '<p>Both sources have |Hom<sub>cont</sub>(Γ, F₂)| = 8. The 7 nontrivial scalar characters match the seven quadratic extensions of ℚ₂, ' +
        'live from the shipped data: C₂ has ' + pd.count + ' extensions ' + chip('7 = 2³ − 1', pd.count === 7) + '</p>' +
        '<p>These are the characters that twist the central double covers running through §8’s transform.</p>' +
        actions(loadBtn('2.1'), OPEN_DRAWER);
    });
  }

  function pRecursion(x) {
    if (!x.b) return '<p>Loading…</p>';
    return '<p>For the drawer’s G = ' + gname(x.b.label) + ' the marked 2-kernel is L<sub>Y</sub> = O₂(G) with |L<sub>Y</sub>| = ' + x.b.o2_order + '. ' +
      'The theorem writes its exact-image count in terms of the source interface (Cor 6.19) plus counts for framed targets of strictly smaller 2-kernel ' +
      '(Lem 8.16), terminating where only trivial module factors remain (Lem 9.2) — descending from G toward its tame frame G/O₂(G), order ' +
      (x.b.order / x.b.o2_order) + '. Every coefficient in the recursion is source-independent: that is why matching interface data forces the equal ' +
      'counts the drawer certifies.</p>' + actions(OPEN_DRAWER);
  }

  function pReconstruction(x) {
    var live = '';
    if (x.b) {
      var both = bothCounts(x.b);
      if (both) live = ' (for G = ' + gname(x.b.label) + ': collector ' + both.c1 + ' = square-commutator ' + both.c2 + ' ' + chip('agree', both.eq) + ')';
    }
    return '<p>The drawer certifies count equality one finite group at a time' + live + ', and the battery checks 5,402 of them. ' +
      'This lemma is the bridge from counting to isomorphism: a topologically finitely generated profinite P with |Sur(P, H)| = |Sur(Q, H)| for ' +
      '<i>every</i> finite H is isomorphic to Q. Evidence stops at the battery; the paper’s induction covers every H.</p>' + actions(OPEN_DRAWER);
  }

  function pOldPro2() {
    return '<p>The classical Labute-shaped relator x₀²x₁⁴[x₁, σ] has the same mod-2 quadratic shadow as Π’s relator x₀<sup>σ²</sup>x₀[x₁, σ], ' +
      'but admits no unramified marking: it would send x̄₁ to an element of infinite order, against the injectivity of (ν<sub>ur</sub>, χ) on D<sup>ab</sup>. ' +
      'The playground’s rejected candidates splice R₀, A1 and A2 are x₀²x₁⁴-shaped attempts — sweep them and watch which small groups object ' +
      '(and which are only refuted by finer invariants).</p>' +
      actions(btn('focus:gqx-sec-play', 'open the playground'), btn('load:32.6', 'load a 2-group (32.6)'), OPEN_DRAWER);
  }

  function pCongruence() {
    return '<p>⟨A, S, Y | A²S⁸[S, Y]⟩ matches D₀ in rank, q and abelianization, yet its orientation image differs — and its analogue of the S₄ ' +
      'count is <b>empty</b>, while the drawer shows the true group has 3 extensions with group S₄. The congruence clause of the stage lemma (C.17) ' +
      'is exactly what rules out such impostors.</p>' + actions(loadBtn('24.12'), OPEN_DRAWER);
  }

  function pNoWord(x) {
    var live = '';
    if (x.b) {
      var both = bothCounts(x.b);
      if (both) live = 'For the current G = ' + gname(x.b.label) + ' both presentations count identically ' + chip(both.c1 + ' = ' + both.c2, both.eq) + ', and the battery agrees on all 5,402 groups — yet ';
    }
    if (!live) live = 'The two presentations agree on every battery group — yet ';
    return '<p>' + live + 'no triple of words rewrites one presentation into the other (C.6), and no finite search could settle the difference (C.7): ' +
      'the orientation congruences are solvable mod 2<sup>k</sup> for every k, so approximate identifications of unbounded length exist forever. ' +
      'Equality of the groups needed the paper’s argument, not a bigger computation — that is Theorem C.3.</p>' +
      actions(OPEN_DRAWER);
  }

  function pStokes() {
    return '<p>The regression test lives in C = GL₂(F₂) ≅ S₃ — the drawer’s S₃ target: its marking sends σ to a transposition and τ to a ' +
      '3-cycle, realizing S⁻¹TS = T². On the natural module the tame relator alone returns mixed central value 0 where the duality pairing demands 1; ' +
      'only the traced sum of the tame and wild coordinates satisfies the Stokes identity (Prop 5.8).</p>' +
      actions(loadBtn('6.1'), OPEN_DRAWER);
  }

  /* ================= wiring ================= */
  var PANELS = [
    { ids: ['thm-main'], render: pThmMain },
    { ids: ['prop-epi-semantics'], render: pEpiSemantics },
    { ids: ['prop-pro2'], render: pPro2 },
    { ids: ['lem-fullwordledger'], render: pWordLedger },
    { ids: ['def-gammaR', 'thm-mainR'], render: pTwoPresentations },
    { ids: ['rem-sqcommnumerics'], render: pSqNumerics },
    { ids: ['app-worked-c4'], render: pWorkedC4 },
    { ids: ['app-worked-s3'], render: pWorkedS3 },
    { ids: ['app-worked-s4'], render: pWorkedS4 },
    { ids: ['app-worked-verifier'], render: pWorkedVerifier },
    { ids: ['lem-tamefinite'], render: pTameFinite },
    { ids: ['prop-tamequotient', 'lem-o2tame'], render: pTameQuotient },
    { ids: ['prop-compatiblemarking', 'def-framed', 'thm-fixedframe'], render: pFramed },
    { ids: ['lem-tameframeexhaustion'], render: pFrameExhaustion },
    { ids: ['lem-commonscalars'], render: pCommonScalars },
    { ids: ['thm-closedrecursion'], render: pRecursion },
    { ids: ['lem-reconstruction'], render: pReconstruction },
    { ids: ['rem-oldpro2'], render: pOldPro2 },
    { ids: ['rem-congruencenecessary'], render: pCongruence },
    { ids: ['prop-nowordidentification', 'rem-nowordsearch'], render: pNoWord },
    { ids: ['rem-stokesregression'], render: pStokes },
  ];

  var open = {};   // anchor id -> { panel, def, token }

  function renderInto(id) {
    var slot = open[id];
    if (!slot) return;
    var token = ++slot.token;
    var body = slot.panel.querySelector('.gqxp-body');
    var out;
    try { out = slot.def.render(ctx()); } catch (e) { out = '<p class="gqx-dimtxt">' + esc(e.message) + '</p>'; }
    if (out && typeof out.then === 'function') {
      body.innerHTML = '<p class="gqx-dimtxt">loading bundles…</p>';
      out.then(function (html) { if (slot.token === token && open[id]) body.innerHTML = html; })
        .catch(function (e) { if (slot.token === token && open[id]) body.innerHTML = '<p class="gqx-dimtxt">could not load: ' + esc(e.message) + '</p>'; });
    } else {
      body.innerHTML = out;
    }
  }

  function closePanel(id) {
    var slot = open[id];
    if (!slot) return;
    slot.panel.parentNode && slot.panel.parentNode.removeChild(slot.panel);
    slot.chipEl.setAttribute('aria-expanded', 'false');
    delete open[id];
  }

  function openPanel(id, def, chipEl, host) {
    var panel = document.createElement('div');
    panel.className = 'gqxp-panel';
    panel.id = 'gqxp-' + id;
    panel.innerHTML = '<div class="gqxp-head"><span class="gqxp-title">RUNNING EXAMPLE</span>' +
      '<button type="button" aria-label="close" data-act="close">×</button></div><div class="gqxp-body"></div>';
    panel.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-act]');
      if (!b) return;
      var act = b.dataset.act, api = window.gqxExample;
      if (act === 'close') closePanel(id);
      else if (act === 'open') api.setOpen(true);
      else if (act === 'rand') { var r = document.getElementById('gqx-rand'); api.setOpen(true); if (r) r.click(); }
      else if (act.indexOf('load:') === 0) { api.setOpen(true); api.selectGroup(act.slice(5)); }
      else if (act.indexOf('loadc:') === 0) { api.state.pres = 'collector'; api.setOpen(true); api.selectGroup(act.slice(6)); }
      else if (act.indexOf('pres:') === 0) { api.setOpen(true); api.selectPresentation(act.slice(5)); }
      else if (act.indexOf('focus:') === 0) api.focusSection(act.slice(6));
    });
    host.insertAdjacentElement('afterend', panel);
    chipEl.setAttribute('aria-expanded', 'true');
    open[id] = { panel: panel, def: def, chipEl: chipEl, token: 0 };
    renderInto(id);
  }

  function init() {
    var api = window.gqxExample;
    if (!api) { setTimeout(init, 80); return; }
    PANELS.forEach(function (def) {
      def.ids.forEach(function (id) {
        var el = document.getElementById(id);
        if (!el) return;
        var heading = el.querySelector('.heading');
        if (!heading) return;
        var isDetails = el.tagName === 'DETAILS';
        // panel host: after the heading inside articles/sections, after the
        // whole element for born-hidden <details> remarks (else it would be
        // hidden inside the collapsed disclosure)
        var host = isDetails ? el : heading;
        var chipEl = document.createElement('button');
        chipEl.type = 'button';
        chipEl.className = 'gqxp-chip';
        chipEl.textContent = 'running example';
        chipEl.setAttribute('aria-expanded', 'false');
        chipEl.setAttribute('aria-controls', 'gqxp-' + id);
        chipEl.addEventListener('click', function (e) {
          e.preventDefault();     // inside <summary>: do not toggle the disclosure
          e.stopPropagation();
          if (open[id]) closePanel(id); else openPanel(id, def, chipEl, host);
        });
        heading.appendChild(chipEl);
      });
    });
    api.onChange(function () {
      Object.keys(open).forEach(renderInto);
    });
  }
  init();
})();
