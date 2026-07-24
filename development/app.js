/* Full Q2 development record: timeline, archive views, and record detail. */
(function () {
  'use strict';

  const D = window.Q2DATA;
  if (!D || !Array.isArray(D.nodes)) throw new Error('Q2DATA is missing or invalid');

  const EDITORIAL = Object.create(null);
  function editorial(id, text) {
    if (Object.prototype.hasOwnProperty.call(EDITORIAL, id) && EDITORIAL[id] !== text) {
      throw new Error(`Editorial id reused with different text: ${id}`);
    }
    EDITORIAL[id] = text;
    return text;
  }

  const CLASS_INFO = Object.freeze({
    pivotal: {
      label: editorial('class.pivotal.label', 'Key record'),
      description: editorial('class.pivotal.description', 'A record that changed the candidate, proof, or formalization direction.'),
    },
    substantive: {
      label: editorial('class.substantive.label', 'Substantive step'),
      description: editorial('class.substantive.description', 'A mathematical or verification step used later in the work.'),
    },
    incremental: {
      label: editorial('class.incremental.label', 'Incremental step'),
      description: editorial('class.incremental.description', 'A smaller mathematical or verification step.'),
    },
    packaging: {
      label: editorial('class.packaging.label', 'Writing or data preparation'),
      description: editorial('class.packaging.description', 'A record devoted to writing, formatting, or machine-readable output.'),
    },
    superfluous: {
      label: editorial('class.superfluous.label', 'No new mathematical result'),
      description: editorial('class.superfluous.description', 'A retained response that did not add a new mathematical result.'),
    },
    failed: {
      label: editorial('class.failed.label', 'Failed or incomplete response'),
      description: editorial('class.failed.description', 'An empty, truncated, or incomplete response.'),
    },
    manual: {
      label: editorial('class.manual.label', 'Separate conversation'),
      description: editorial('class.manual.description', 'A separately run conversation included after review.'),
    },
    artifact: {
      label: editorial('class.artifact.label', 'Contextual event'),
      description: editorial('class.artifact.description', 'A dated event outside the saved turn sequence.'),
    },
  });
  const DECISIVE = new Set(['pivotal', 'substantive']);
  const MESSAGE_ROLE_LABELS = Object.freeze({
    user: editorial('detail.role.user', 'Instruction'),
    assistant: editorial('detail.role.assistant', 'Model message'),
    tool: editorial('detail.role.tool', 'Attached context or tool result'),
    note: editorial('detail.role.note', 'Editorial note'),
  });
  const LINK_NOT_PUBLISHED = editorial('link.not-published', 'Link not published');
  const ATTACHMENT_NOT_INCLUDED = editorial('link.attachment-missing', 'Attachment not included');
  const DETAIL_TERM_DEFINITIONS = Object.freeze({
    candidateA1: editorial('detail.terms.candidate-a1', 'Candidate A1 was the first late-June proposal. It passed several local finite checks but failed the required rank calculation.'),
    candidateA2: editorial('detail.terms.candidate-a2', 'Candidate A2 passed the available local finite checks, but a manuscript review exposed a false proposition and marked-abelianization obstruction.'),
    finalCandidate: editorial('detail.terms.final-candidate', 'The final candidate replaced A2 with the corrected relation $h_0u_1^{-1}x_1^{\\sigma}c_0=1$ and is the presentation proved in the paper and Lean developments.'),
    h0: editorial('detail.terms.h0', '$h_0$ is an auxiliary expression used to shorten the proposed wild relation $h_0u_1^{-1}x_1^{\\sigma}c_0=1$. It supplies the first factor of that relation.'),
    gammaA2: editorial('detail.terms.gamma-a2', '$\\Gamma_{A2}$ denotes the profinite group defined by the rejected A2 presentation in these early records. The final Lean theorem concerns the later presentation.'),
    gammaA: editorial('detail.terms.gamma-a', '$\\Gamma_A$ denotes the candidate profinite group defined by the presentation being discussed. In the final Lean files, `GammaA` refers to the final presentation; earlier records can use similar notation for proposals later rejected.'),
  });
  const BRIEF_TERM_DEFINITIONS = Object.freeze({
    candidateA1: editorial('record.terms.candidate-a1', 'A1 was rejected after the rank calculation.'),
    candidateA2: editorial('record.terms.candidate-a2', 'A2 passed local checks and was later structurally refuted.'),
    finalCandidate: editorial('record.terms.final-candidate', 'The final candidate is the presentation proved in the paper.'),
    h0: editorial('record.terms.h0', '$h_0$ is an auxiliary expression in the corrected wild relation.'),
    gammaA2: editorial('record.terms.gamma-a2', '$\\Gamma_{A2}$ is the group defined by the rejected A2 proposal.'),
    gammaA: editorial('record.terms.gamma-a', '$\\Gamma_A$ denotes the candidate profinite group defined by the presentation being discussed.'),
  });
  const TERM_LINKS = Object.freeze({
    candidateA1: '../presentations/#candidate-a1',
    candidateA2: '../presentations/#candidate-a2',
    finalCandidate: '../presentations/#proven-presentation',
    h0: '../presentations/#proven-presentation',
  });
  const TERM_LINK_LABELS = Object.freeze({
    candidateA1: editorial('candidate.link.a1', 'Candidate A1'),
    candidateA2: editorial('candidate.link.a2', 'Candidate A2'),
    finalCandidate: editorial('candidate.link.final', 'Proven presentation'),
    h0: editorial('candidate.link.h0', 'Proven presentation'),
  });
  const TERM_PATTERNS = Object.freeze({
    candidateA1: /\bA1\b/i,
    candidateA2: /\bA2\b/i,
    finalCandidate: /(?:\bfinal candidate\b|\bcorrected (?:candidate|presentation|relation)\b)/i,
    h0: /(?:\bh0\b|h_0|h_\{0\}|h₀)/,
    gammaA2: /(?:GammaA2|Gamma_A2|Γ_A2|ΓA2|\\Gamma_\{A_?2\}|\\Gamma_A2)(?![A-Za-z0-9₂])/,
    gammaA: /(?:GammaA|Gamma_A|Γ_A|ΓA|\\Gamma_\{A\}|\\Gamma_A)(?![A-Za-z0-9₂])/,
  });
  const ARTIFACT_SANITIZER_CONFIG = Object.freeze({
    RETURN_DOM_FRAGMENT: true,
    ALLOW_ARIA_ATTR: false,
    ALLOW_DATA_ATTR: false,
    ALLOW_UNKNOWN_PROTOCOLS: false,
    ALLOWED_TAGS: ['a', 'blockquote', 'br', 'code', 'del', 'em', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'li', 'ol', 'p', 'pre', 'strong', 'table', 'tbody', 'td', 'th', 'thead', 'tr', 'ul'],
    ALLOWED_ATTR: ['href', 'title'],
    FORBID_TAGS: ['script', 'style', 'svg', 'math', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'textarea', 'img', 'template'],
    FORBID_ATTR: ['style', 'srcset'],
  });
  const VIEW_NAMES = new Set(['timeline', 'key', 'list']);
  const STATE_FIELDS = Object.freeze(['view', 'stage', 'record', 'query']);
  const LARGE_TOOL_PLAIN_TEXT_THRESHOLD = 100_000;

  const $ = (id) => document.getElementById(id);
  const make = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  };
  const makeButton = (className, text) => {
    const node = document.createElement('button');
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    node.type = 'button';
    return node;
  };
  const svgMake = (tag, className) => {
    const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
    if (className) node.setAttribute('class', className);
    return node;
  };
  const setAttrs = (node, attrs) => {
    Object.entries(attrs).forEach(([name, value]) => {
      if (value !== undefined && value !== null) node.setAttribute(name, String(value));
    });
    return node;
  };

  function termKeysFor(...values) {
    const text = values.flat(Infinity).filter((value) => typeof value === 'string').join('\n');
    return Object.keys(TERM_PATTERNS).filter((term) => TERM_PATTERNS[term].test(text));
  }

  function termBrief(...values) {
    return termKeysFor(...values).map((term) => BRIEF_TERM_DEFINITIONS[term]).join(' ');
  }

  function appendCandidateText(container, text) {
    const value = String(text ?? '');
    const pattern = /\b(?:Candidate\s+)?A([12])\b/gi;
    let cursor = 0;
    for (const match of value.matchAll(pattern)) {
      container.append(value.slice(cursor, match.index));
      const key = `candidateA${match[1]}`;
      container.append(Object.assign(make('a', 'candidate-inline-link', match[0]), {href: TERM_LINKS[key]}));
      cursor = match.index + match[0].length;
    }
    container.append(value.slice(cursor));
    return container;
  }

  function makeCandidateText(tag, className, text) {
    return appendCandidateText(make(tag, className), text);
  }

  function replaceCandidateText(container, text) {
    container.replaceChildren();
    return appendCandidateText(container, text);
  }

  function updateDetailTerms(...values) {
    const terms = termKeysFor(...values);
    const box = $('d-terms');
    const definitions = $('d-term-definitions');
    definitions.replaceChildren(...terms.map((term) => {
      const paragraph = makeCandidateText('p', '', DETAIL_TERM_DEFINITIONS[term]);
      if (TERM_LINKS[term]) {
        paragraph.append(' ', Object.assign(make('a', 'candidate-detail-link', editorial('detail.terms.view-presentation', 'Presentation page')), {href: TERM_LINKS[term]}));
      }
      return paragraph;
    }));
    box.hidden = terms.length === 0;
    renderEditorialMath(definitions);
  }

  function appendCandidateLinks(container, ...values) {
    const links = new Map();
    termKeysFor(...values).forEach((term) => {
      if (TERM_LINKS[term]) links.set(TERM_LINKS[term], TERM_LINK_LABELS[term]);
    });
    if (!links.size) return;
    const paragraph = make('p', 'stage-candidate-links');
    paragraph.append(`${editorial('candidate.link.label', 'Presentation details')} · `);
    [...links].forEach(([href, label], index) => {
      if (index) paragraph.append(' · ');
      paragraph.append(Object.assign(make('a', '', label), {href}));
    });
    container.append(paragraph);
  }

  function attributionRuleFor(node) {
    return (D.model_attribution?.rules || []).find((rule) => {
      const selector = rule.selector || {};
      if (selector.lanes && !selector.lanes.includes(node.lane)) return false;
      if (selector.turn_min != null && Number(node.turn) < Number(selector.turn_min)) return false;
      if (selector.turn_max != null && Number(node.turn) > Number(selector.turn_max)) return false;
      return true;
    });
  }

  function modelAttributionFor(node) {
    if (node.model_public_text) return node.model_public_text;
    const rule = attributionRuleFor(node);
    if (rule?.public_text) return rule.public_text;
    return editorial('model.unattributed', 'Model not established from the retained artifact.');
  }

  function modelLabelFor(node) {
    if (node.model_public_text) return node.model_public_text;
    const rule = attributionRuleFor(node);
    return rule?.observed_label || editorial('model.unattributed-short', 'Model not established');
  }

  function renderEditorialMath(root) {
    if (!root || typeof window.renderMathInElement !== 'function') return;
    window.renderMathInElement(root, {
      delimiters: [
        {left: '$$', right: '$$', display: true},
        {left: '\\[', right: '\\]', display: true},
        {left: '$', right: '$', display: false},
        {left: '\\(', right: '\\)', display: false},
      ],
      ignoredTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code'],
      throwOnError: false,
      trust: false,
      output: 'mathml',
      maxExpand: 1000,
    });
    normalizeMathMLScriptChildren(root);
  }

  const laneOrder = [...(D.lane_order || [])];
  if (D.nodes.some((n) => n.lane === 'manual') && !laneOrder.includes('manual')) laneOrder.push('manual');
  const laneTitle = (id) => D.lanes?.[id]?.short || D.lanes?.[id]?.title || id;
  const byKey = new Map(D.nodes.map((node) => [node.key, node]));
  const laneNodes = new Map(laneOrder.map((lane) => [lane, []]));
  D.nodes.forEach((node) => {
    if (!laneNodes.has(node.lane)) laneNodes.set(node.lane, []);
    laneNodes.get(node.lane).push(node);
  });
  laneNodes.forEach((nodes) => nodes.sort(compareRecords));

  const stageOrder = Array.isArray(D.stage_order) && D.stage_order.length
    ? [...D.stage_order]
    : laneOrder.map((lane) => `lane:${lane}`);
  const stages = new Map();
  stageOrder.forEach((id, index) => {
    const supplied = D.stages?.[id];
    const lane = id.startsWith('lane:') ? id.slice(5) : null;
    stages.set(id, supplied || {
      id,
      order: index + 1,
      title: laneTitle(lane),
      date_label: '',
      summary: '',
      collapsed_by_default: false,
    });
  });
  const stageIdFor = (node) => node.stage_id || `lane:${node.lane}`;
  const stageNodes = new Map(stageOrder.map((id) => [id, []]));
  D.nodes.forEach((node) => {
    const id = stageIdFor(node);
    if (!stageNodes.has(id)) {
      stageNodes.set(id, []);
      if (!stages.has(id)) stages.set(id, {id, title: id, summary: '', date_label: ''});
      if (!stageOrder.includes(id)) stageOrder.push(id);
    }
    stageNodes.get(id).push(node);
  });
  stageNodes.forEach((nodes) => nodes.sort(compareRecords));

  function stageIdsFrom(value) {
    const values = (Array.isArray(value) ? value : [value])
      .flatMap((item) => String(item || '').split(','));
    const requested = new Set(values.filter(Boolean));
    return stageOrder.filter((id) => requested.has(id));
  }

  function selectedStageIds() {
    return stageIdsFrom(state.stage);
  }

  const keyMetadata = new Map();
  const keyRecordOrder = [];
  (D.key_records || []).forEach((entry) => {
    const item = typeof entry === 'string' ? {key: entry} : entry;
    if (item?.key && byKey.has(item.key) && !keyMetadata.has(item.key)) {
      keyMetadata.set(item.key, item);
      keyRecordOrder.push(item.key);
    }
  });
  if (!keyRecordOrder.length) {
    D.nodes.filter((node) => node.class === 'pivotal').sort(compareRecords).forEach((node) => keyRecordOrder.push(node.key));
  }

  function freshState() {
    return {
      view: 'timeline', record: '', event: '', stage: [], query: '', focus: 'all',
      disabledClasses: [], disabledLanes: [], dateStart: '', dateEnd: '', zoom: 1, mapStart: 0,
    };
  }

  function parseState(input) {
    const source = input instanceof URLSearchParams ? input.toString() : String(input ?? window.location.hash);
    const raw = input instanceof URLSearchParams
      ? source
      : source.includes('#') ? source.slice(source.indexOf('#') + 1) : source.replace(/^\?/, '');
    const params = new URLSearchParams(raw);
    const next = freshState();
    const view = params.get('view');
    if (VIEW_NAMES.has(view)) next.view = view;
    const record = params.get('record') || '';
    if (!record || byKey.has(record)) next.record = record;
    next.event = params.get('event') || '';
    next.stage = stageIdsFrom(params.getAll('stage'));
    next.query = params.get('q') || '';
    next.focus = ['all', 'decisive', 'pivotal'].includes(params.get('focus')) ? params.get('focus') : 'all';
    next.disabledClasses = splitParam(params.get('classes'));
    next.disabledLanes = splitParam(params.get('lanes'));
    next.dateStart = validDate(params.get('from')) ? params.get('from') : '';
    next.dateEnd = validDate(params.get('to')) ? params.get('to') : '';
    next.zoom = clampNumber(params.get('z'), 1, 1, 40);
    next.mapStart = clampNumber(params.get('x'), 0, 0, Number.MAX_SAFE_INTEGER);
    return next;
  }

  function serializeState(value) {
    const current = {...freshState(), ...(value || {})};
    const params = new URLSearchParams();
    params.set('view', VIEW_NAMES.has(current.view) ? current.view : 'timeline');
    const selectedStages = stageIdsFrom(current.stage);
    selectedStages.forEach((id) => params.append('stage', id));
    if (current.record) params.set('record', current.record);
    if (current.event) params.set('event', current.event);
    if (current.query) params.set('q', current.query);
    if (current.focus && current.focus !== 'all') params.set('focus', current.focus);
    const classes = normalizedList(current.disabledClasses);
    const lanes = normalizedList(current.disabledLanes);
    if (classes.length) params.set('classes', classes.join(','));
    if (lanes.length) params.set('lanes', lanes.join(','));
    if (validDate(current.dateStart)) params.set('from', current.dateStart);
    if (validDate(current.dateEnd)) params.set('to', current.dateEnd);
    const zoom = Number(current.zoom);
    const mapStart = Number(current.mapStart);
    if (Number.isFinite(zoom) && Math.abs(zoom - 1) > 0.001) params.set('z', trimNumber(zoom));
    if (Number.isFinite(mapStart) && mapStart > 0.5) params.set('x', trimNumber(mapStart));
    return `#${params.toString()}`;
  }

  function splitParam(value) { return value ? [...new Set(value.split(',').filter(Boolean))].sort() : []; }
  function normalizedList(value) {
    if (value instanceof Set) return [...value].sort();
    return Array.isArray(value) ? [...new Set(value.filter(Boolean))].sort() : [];
  }
  function validDate(value) { return /^\d{4}-\d{2}-\d{2}$/.test(value || ''); }
  function trimNumber(value) { return Number(value.toFixed(6)).toString(); }
  function clampNumber(value, fallback, min, max) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
  }

  const accountingLinkRequested = window.location.hash === '#accounting';
  let state = parseState(window.location.hash);
  let disabledClasses = new Set(state.disabledClasses);
  let disabledLanes = new Set(state.disabledLanes);
  let currentNode = null;
  let currentEvent = null;
  let returnFocus = null;
  let applyingLocation = false;
  let contentRequest = 0;

  function timestampValue(item) { return item?.timestamp?.value || item?.datetime || null; }
  function timestampMillis(item) {
    const value = timestampValue(item);
    if (!value) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return Date.parse(`${value}T12:00:00Z`);
    const aware = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value);
    const parsed = Date.parse(aware ? value : `${value}Z`);
    return Number.isFinite(parsed) ? parsed : null;
  }
  function compareRecords(a, b) {
    if (a.lane === b.lane && a.turn != null && b.turn != null) return a.turn - b.turn;
    const at = timestampMillis(a), bt = timestampMillis(b);
    if (at != null && bt != null && at !== bt) return at - bt;
    return String(a.key).localeCompare(String(b.key));
  }
  function formatTimestamp(item) {
    const ts = item?.timestamp;
    const value = timestampValue(item);
    if (!value) return editorial('time.unavailable', 'Recorded time unavailable');
    if (ts?.precision === 'date' || /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const parsed = new Date(`${value.slice(0, 10)}T12:00:00Z`);
      return parsed.toLocaleDateString('en-US', {year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC'});
    }
    const aware = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value);
    let rendered;
    if (!aware) {
      const raw = value.replace('T', ' ').replace(/\.\d+$/, '');
      rendered = `${raw} (${editorial('time.zone-unknown', 'time zone not recorded')})`;
    } else {
      const parsed = new Date(value);
      rendered = `${parsed.toLocaleString('en-US', {year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC'})} UTC`;
    }
    return ts?.precision === 'about_minute'
      ? `${editorial('time.approximate-prefix', 'About')} ${rendered}`
      : rendered;
  }

  function matches(node) {
    if (disabledClasses.has(node.class) || disabledLanes.has(node.lane)) return false;
    const selectedStages = selectedStageIds();
    if (state.view === 'list' && selectedStages.length && !selectedStages.includes(stageIdFor(node))) return false;
    if (state.focus === 'pivotal' && node.class !== 'pivotal') return false;
    if (state.focus === 'decisive' && !DECISIVE.has(node.class) && node.class !== 'manual') return false;
    if (!state.query) return true;
    const query = state.query.toLocaleLowerCase();
    return [node.key, node.summary, node.why, node.tag, node.class, modelAttributionFor(node), laneTitle(node.lane), stages.get(stageIdFor(node))?.title,
      node.turn == null ? '' : `turn ${node.turn}`, node.turn == null ? '' : `t${node.turn}`]
      .some((value) => String(value || '').toLocaleLowerCase().includes(query));
  }
  function visibleNodes() { return D.nodes.filter(matches); }

  function commit(mode) {
    state.disabledClasses = [...disabledClasses];
    state.disabledLanes = [...disabledLanes];
    const hash = serializeState(state);
    applyingLocation = true;
    if (mode === 'push') history.pushState(null, '', hash);
    else history.replaceState(null, '', hash);
    applyingLocation = false;
  }

  function restoreFromLocation() {
    if (applyingLocation) return;
    state = parseState(window.location.hash);
    disabledClasses = new Set(state.disabledClasses);
    disabledLanes = new Set(state.disabledLanes);
    mapZoom = state.zoom;
    mapViewStart = state.mapStart;
    syncControls();
    renderAllViews();
    if (state.record) openRecord(byKey.get(state.record), {history: 'none'});
    else if (state.event) openEvent((D.events || []).find((event) => event.id === state.event), {history: 'none'});
    else closeDetail({history: 'none'});
  }

  function buildFilters() {
    const laneBox = $('laneFilters');
    laneBox.replaceChildren();
    laneOrder.forEach((lane) => {
      const button = make('button', '', laneTitle(lane));
      button.type = 'button';
      button.dataset.lane = lane;
      button.setAttribute('aria-pressed', String(!disabledLanes.has(lane)));
      button.setAttribute('aria-label', `${editorial('filter.conversation.toggle', 'Include conversation')}: ${laneTitle(lane)}`);
      button.addEventListener('click', () => {
        if (disabledLanes.has(lane)) disabledLanes.delete(lane); else disabledLanes.add(lane);
        commit('push'); syncControls(); renderAllViews();
      });
      laneBox.append(button);
    });

    const classBox = $('legend');
    classBox.replaceChildren();
    Object.entries(CLASS_INFO).filter(([id]) => id !== 'artifact').forEach(([id, info]) => {
      const count = D.nodes.filter((node) => node.class === id).length;
      if (!count) return;
      const button = make('button', 'class-filter');
      button.type = 'button';
      button.dataset.class = id;
      button.setAttribute('aria-pressed', String(!disabledClasses.has(id)));
      button.setAttribute('title', info.description);
      const marker = make('i', `record-class-marker ${id}`);
      marker.setAttribute('aria-hidden', 'true');
      button.append(marker, document.createTextNode(`${info.label} ${count}`));
      button.addEventListener('click', () => {
        if (disabledClasses.has(id)) disabledClasses.delete(id); else disabledClasses.add(id);
        commit('push'); syncControls(); renderAllViews();
      });
      classBox.append(button);
    });
  }

  function buildTimelineLegend() {
    const box = $('timelineLegendItems');
    box.replaceChildren();
    Object.entries(CLASS_INFO).forEach(([id, info]) => {
      const isPresent = id === 'artifact'
        ? eventList.length > 0
        : D.nodes.some((node) => node.class === id);
      if (!isPresent) return;
      const item = make('span', 'timeline-legend-item');
      item.setAttribute('role', 'listitem');
      const marker = make('i', `timeline-legend-dot ${id}`);
      marker.setAttribute('aria-hidden', 'true');
      item.append(marker, document.createTextNode(info.label));
      box.append(item);
    });
  }

  function syncControls() {
    document.querySelectorAll('#viewSeg [data-v]').forEach((button) => {
      const selected = button.dataset.v === state.view;
      button.classList.toggle('on', selected);
      button.setAttribute('aria-selected', String(selected));
      button.tabIndex = selected ? 0 : -1;
    });
    ['timeline', 'key', 'list'].forEach((view) => {
      const panel = $(`${view === 'key' ? 'key' : view === 'list' ? 'list' : view}view`);
      if (panel) panel.hidden = state.view !== view;
    });
    $('search').value = state.query;
    document.querySelectorAll('#focusSeg [data-f]').forEach((button) => {
      const active = button.dataset.f === state.focus;
      button.classList.toggle('on', active);
      button.setAttribute('aria-pressed', String(active));
    });
    document.querySelectorAll('#laneFilters [data-lane]').forEach((button) => button.setAttribute('aria-pressed', String(!disabledLanes.has(button.dataset.lane))));
    document.querySelectorAll('#legend [data-class]').forEach((button) => button.setAttribute('aria-pressed', String(!disabledClasses.has(button.dataset.class))));
    $('dateStart').value = state.dateStart;
    $('dateEnd').value = state.dateEnd;
    updateResultCount();
  }

  function updateResultCount() {
    const shown = visibleNodes().length;
    $('resultCount').textContent = `${shown} ${editorial('filter.results.of', 'of')} ${D.nodes.length} ${editorial('filter.results.records', 'records')}`;
    const active = [];
    if (state.query) active.push(editorial('filter.control.active-search', 'Search term applied'));
    if (state.focus !== 'all') active.push(editorial('filter.active.importance', 'Importance level selected'));
    if (state.view === 'list' && selectedStageIds().length) active.push(editorial('filter.active.stage', 'Stage selected'));
    if (disabledClasses.size) active.push(editorial('filter.active.type', 'Some record types hidden'));
    if (disabledLanes.size) active.push(editorial('filter.active.conversation', 'Some conversations hidden'));
    $('activeFilters').textContent = active.join(' · ');
  }

  function buildStages() {
    const box = $('chapters');
    box.replaceChildren();
    const selected = new Set(selectedStageIds());
    const all = make('div', 'stage-button');
    const allAction = makeButton('stage-button-action');
    allAction.dataset.stageId = '';
    allAction.setAttribute('aria-label', editorial('stage.all.title', 'All stages'));
    allAction.setAttribute('aria-pressed', String(selected.size === 0));
    all.classList.toggle('is-selected', selected.size === 0);
    all.append(allAction, make('span', 'stage-title', editorial('stage.all.title', 'All stages')), make('span', 'stage-count', String(D.nodes.length)));
    allAction.addEventListener('click', () => selectStage(''));
    box.append(all);
    stageOrder.forEach((id, index) => {
      const stage = stages.get(id);
      const nodes = stageNodes.get(id) || [];
      const item = make('div', 'stage-button');
      const action = makeButton('stage-button-action');
      action.dataset.stageId = id;
      action.setAttribute('aria-label', `${editorial('stage.action.toggle', 'Toggle stage')} ${index + 1}: ${stage.title}`);
      action.setAttribute('aria-pressed', String(selected.has(id)));
      item.classList.toggle('is-selected', selected.has(id));
      item.append(action, make('span', 'stage-number', String(index + 1)), makeCandidateText('span', 'stage-title', stage.title), make('span', 'stage-count', `${nodes.length} ${editorial('stage.records', 'records')}`));
      if (stage.date_label) item.append(make('span', 'stage-blurb', stage.date_label));
      action.addEventListener('click', () => selectStage(id));
      box.append(item);
    });
    renderStageSummary();
    renderEditorialMath($('stage'));
  }

  function selectStage(id) {
    const selected = new Set(selectedStageIds());
    if (!id) selected.clear();
    else if (selected.has(id)) selected.delete(id);
    else selected.add(id);
    const ids = stageOrder.filter((stageId) => selected.has(stageId));
    state.stage = ids;
    if (ids.length) fitStages(ids, false); else fitAll(false);
    commit('push');
    buildStages();
  }

  function renderStageSummary() {
    const box = $('stage-summary');
    box.replaceChildren();
    const ids = selectedStageIds();
    if (!ids.length) {
      box.append(make('p', 'stage-summary-label', editorial('stage.summary.all-label', 'All stages')), make('h2', '', editorial('stage.summary.all-title', 'The full record')));
      return;
    }
    if (ids.length === 1) {
      const stage = stages.get(ids[0]);
      box.append(make('p', 'stage-summary-label', stage.date_label || editorial('stage.summary.selected', 'Selected stage')), makeCandidateText('h2', '', stage.title));
      if (stage.summary) box.append(makeCandidateText('p', '', stage.summary));
      appendCandidateLinks(box, stage.title, stage.summary);
      return;
    }
    box.append(make('p', 'stage-summary-label', editorial('stage.summary.multiple', 'Selected stages')));
    const list = make('div', 'stage-summary-list');
    ids.forEach((stageId) => {
      const stage = stages.get(stageId);
      const item = make('section', 'stage-summary-item');
      item.append(makeCandidateText('h2', '', stage.title));
      if (stage.date_label) item.append(make('p', 'stage-summary-date', stage.date_label));
      if (stage.summary) item.append(makeCandidateText('p', '', stage.summary));
      appendCandidateLinks(item, stage.title, stage.summary);
      list.append(item);
    });
    box.append(list);
  }

  function recordButton(node, extraClass, reason) {
    const row = make('div', `record-row ${extraClass || ''}`.trim());
    const button = makeButton('record-row-open');
    button.dataset.recordKey = node.key;
    button.setAttribute('aria-label', recordAriaLabel(node));
    const marker = make('span', `record-class-marker ${node.class}`);
    marker.setAttribute('aria-hidden', 'true');
    row.append(button, marker);
    row.append(make('span', 'record-turn', node.turn == null ? editorial('record.separate.short', 'Conversation') : `${editorial('record.turn.short', 'Turn')} ${node.turn}`));
    row.append(makeCandidateText('span', 'record-summary', node.summary || node.key));
    row.append(make('span', 'record-meta', formatTimestamp(node)));
    row.append(make('span', 'record-model', modelLabelFor(node)));
    const termNote = termBrief(node.summary, node.why);
    if (termNote) row.append(makeCandidateText('span', 'record-term-note', termNote));
    if (reason) row.append(makeCandidateText('span', 'record-reason', reason));
    button.addEventListener('click', (event) => openRecord(node, {history: 'push', opener: event.currentTarget}));
    return row;
  }
  function recordAriaLabel(node) {
    const prefix = node.turn == null ? editorial('record.action.open-conversation', 'Open conversation') : editorial('record.action.open-turn', 'Open turn');
    return `${prefix} ${node.turn ?? ''}: ${node.summary || node.key}. ${termBrief(node.summary, node.why)}`.replace(/\s+/g, ' ').trim();
  }

  function buildKeyRecords() {
    const box = $('keyRecords');
    box.replaceChildren();
    const grouped = new Map(stageOrder.map((id) => [id, []]));
    keyRecordOrder.forEach((key) => {
      const node = byKey.get(key);
      if (!node || !matches(node)) return;
      const stageId = stageIdFor(node);
      if (!grouped.has(stageId)) grouped.set(stageId, []);
      grouped.get(stageId).push(node);
    });

    let rendered = 0;
    stageOrder.forEach((id) => {
      const nodes = grouped.get(id) || [];
      if (!nodes.length) return;

      const stage = stages.get(id);
      const section = make('section', 'key-stage');
      const headingId = `key-stage-${id}-title`;
      section.dataset.stageId = id;
      section.setAttribute('aria-labelledby', headingId);

      const header = make('header', 'key-stage-header');
      const heading = makeCandidateText('h3', 'key-stage-heading', stage.title);
      heading.id = headingId;
      header.append(heading);
      if (stage.date_label) header.append(make('p', 'key-stage-date', stage.date_label));

      const rows = make('div', 'key-stage-records');
      nodes.forEach((node) => rows.append(recordButton(node, 'key-record', keyMetadata.get(node.key)?.reason || '')));
      section.append(header, rows);
      box.append(section);
      rendered += nodes.length;
    });

    if (!rendered) {
      box.append(make('p', 'empty-state', editorial('key.empty', 'No key records match the current filters.')));
    }
  }

  function buildAllRecords() {
    const box = $('allRecords');
    box.replaceChildren();
    let rendered = 0;
    laneOrder.forEach((lane) => {
      const nodes = (laneNodes.get(lane) || []).filter(matches);
      if (!nodes.length) return;
      rendered += nodes.length;
      const group = make('details', 'record-group');
      group.open = true;
      const summary = make('summary', 'record-group-toggle');
      summary.append(make('span', 'record-group-title', laneTitle(lane)), make('span', 'record-group-count', `${nodes.length} ${editorial('all.group.records', 'records')}`));
      const rows = make('div', 'record-rows');
      nodes.forEach((node) => rows.append(recordButton(node)));
      group.append(summary, rows);
      box.append(group);
    });
    if (!rendered) box.append(make('p', 'empty-state', editorial('all.empty', 'No records match the current filters.')));
  }

  function buildMobileTimeline() {
    const box = $('mobileTimeline');
    box.replaceChildren();
    stageOrder.forEach((id) => {
      const nodes = (stageNodes.get(id) || []).filter(matches);
      if (!nodes.length) return;
      const stage = stages.get(id);
      const section = make('section', 'mobile-stage');
      const heading = makeCandidateText('h3', 'mobile-stage-heading', stage.title);
      const rows = make('div', 'mobile-stage-records');
      nodes.forEach((node) => rows.append(recordButton(node, 'mobile-record')));
      section.append(heading, rows);
      box.append(section);
    });
    if (!box.childElementCount) box.append(make('p', 'empty-state', editorial('timeline.mobile.empty', 'No records match the current filters.')));
  }

  const timedNodes = D.nodes.map((node, index) => ({node, index, time: timestampMillis(node)}));
  let lastKnown = Math.max(...timedNodes.map((entry) => entry.time ?? 0));
  timedNodes.forEach((entry) => {
    if (entry.time == null) { lastKnown += 60000; entry.time = lastKnown; entry.synthetic = true; }
  });
  const displayTimeByKey = new Map(timedNodes.map((entry) => [entry.node.key, entry.time]));
  const eventList = (D.events || []).filter((event) => D.schema_version < 2 || event.publication_status === 'approved');
  const allTimes = [...displayTimeByKey.values(), ...eventList.map(timestampMillis).filter((time) => time != null)].sort((a, b) => a - b);
  const uniqueTimes = [...new Set(allTimes)];
  const GAP_CAP = 3 * 60 * 60 * 1000;
  const virtualSegments = [];
  let virtualCursor = 0;
  let previousTime = uniqueTimes[0] || Date.now();
  uniqueTimes.forEach((time, index) => {
    const rawGap = index ? time - previousTime : 0;
    const gap = rawGap > GAP_CAP ? GAP_CAP + Math.log2(rawGap / GAP_CAP) * GAP_CAP * 0.15 : rawGap;
    virtualCursor += gap;
    virtualSegments.push({time, virtual: virtualCursor, rawGap});
    previousTime = time;
  });
  const MAP_LEFT = 190;
  const MAP_RIGHT = 120;
  const MAP_SCALE = 150 / (60 * 60 * 1000);
  const mapWidth = Math.max(1200, MAP_LEFT + MAP_RIGHT + virtualCursor * MAP_SCALE);
  const mapHeight = 72 + (laneOrder.length + 1) * 72;
  let mapSvg = null;
  let mapViewStart = state.mapStart;
  let mapZoom = state.zoom;
  let dragState = null;
  let mapStageRanges = [];

  function virtualAt(time) {
    if (!virtualSegments.length) return 0;
    if (time <= virtualSegments[0].time) return virtualSegments[0].virtual;
    if (time >= virtualSegments.at(-1).time) return virtualSegments.at(-1).virtual;
    let low = 0, high = virtualSegments.length - 1;
    while (high - low > 1) {
      const middle = (low + high) >> 1;
      if (virtualSegments[middle].time <= time) low = middle; else high = middle;
    }
    const a = virtualSegments[low], b = virtualSegments[high];
    return a.virtual + (b.virtual - a.virtual) * ((time - a.time) / Math.max(1, b.time - a.time));
  }
  const mapX = (time) => MAP_LEFT + virtualAt(time) * MAP_SCALE;
  const laneY = (lane) => 58 + (laneOrder.indexOf(lane) + 1) * 72;

  function buildMap() {
    const root = $('edges');
    const overlay = $('timeline');
    root.replaceChildren();
    overlay.replaceChildren();
    root.classList.add('timeline-map-svg');
    setAttrs(root, {viewBox: `${mapViewStart} 0 ${viewportWidth()} ${mapHeight}`, preserveAspectRatio: 'none'});
    mapSvg = root;
    mapStageRanges = [];

    stageOrder.forEach((id, index) => {
      const nodes = stageNodes.get(id) || [];
      const xs = nodes.map((node) => mapX(displayTimeByKey.get(node.key)));
      if (!xs.length) return;
      const start = Math.max(MAP_LEFT, Math.min(...xs) - 10);
      const end = Math.min(mapWidth - MAP_RIGHT, Math.max(...xs) + 10);
      const rect = svgMake('rect', `map-stage-band${index % 2 ? ' map-stage-band-alt' : ''}`);
      setAttrs(rect, {x: start, y: 22, width: Math.max(2, end - start), height: mapHeight - 22});
      root.append(rect);
      mapStageRanges.push({id, index, start, end});
    });

    addDateTicks(root);
    laneOrder.forEach((lane) => {
      const y = laneY(lane);
      const line = svgMake('line', 'map-lane-line');
      setAttrs(line, {x1: MAP_LEFT, y1: y, x2: mapWidth - MAP_RIGHT, y2: y});
      root.append(line);
    });

    addEdges(root);
    mapStageRanges.forEach((range) => overlay.append(mapStageControl(range)));
    mapDateTicks().forEach((time) => overlay.append(mapDateControl(time)));
    laneOrder.forEach((lane) => overlay.append(mapLaneControl(lane)));
    D.nodes.forEach((node) => overlay.append(mapRecordControl(node)));
    eventList.forEach((event) => {
      const control = mapEventControl(event);
      if (control) overlay.append(control);
    });
    positionMapOverlay();
    updateMapSelection();
  }

  function mapDateTicks() {
    if (!uniqueTimes.length) return [];
    const start = new Date(uniqueTimes[0]);
    start.setUTCHours(0, 0, 0, 0);
    const end = uniqueTimes.at(-1) + 86400000;
    const ticks = [];
    for (let time = start.getTime(); time <= end; time += 86400000) ticks.push(time);
    return ticks;
  }

  function addDateTicks(root) {
    if (!uniqueTimes.length) return;
    mapDateTicks().forEach((time) => {
      const x = mapX(time);
      const line = svgMake('line', 'map-date-tick');
      setAttrs(line, {x1: x, y1: 42, x2: x, y2: mapHeight});
      root.append(line);
    });
    virtualSegments.filter((segment) => segment.rawGap > GAP_CAP).forEach((segment) => {
      const x = mapX(segment.time);
      const marker = svgMake('line', 'map-gap-marker');
      setAttrs(marker, {x1: x, y1: 22, x2: x, y2: mapHeight});
      root.append(marker);
    });
  }

  function addEdges(root) {
    (D.edges || []).forEach((edge) => {
      const from = byKey.get(edge.from), to = byKey.get(edge.to);
      if (!from || !to) return;
      const ax = mapX(displayTimeByKey.get(from.key)), ay = laneY(from.lane);
      const bx = mapX(displayTimeByKey.get(to.key)), by = laneY(to.lane);
      const middle = (ax + bx) / 2;
      const path = svgMake('path', `map-edge ${edge.type || 'weak'}`);
      setAttrs(path, {d: `M ${ax} ${ay} C ${middle} ${ay}, ${middle} ${by}, ${bx} ${by}`});
      root.append(path);
    });
  }

  function mapRecordControl(node) {
    const x = mapX(displayTimeByKey.get(node.key));
    const y = laneY(node.lane);
    const button = makeButton(`map-record-button ${node.class}${matches(node) ? '' : ' is-filtered'}`);
    button.dataset.recordKey = node.key;
    button.dataset.mapX = String(x);
    button.dataset.mapY = String(y);
    button.setAttribute('aria-label', recordAriaLabel(node));
    button.append(make('span', 'map-dot'));
    button.addEventListener('click', (event) => openRecord(node, {history: 'push', opener: event.currentTarget}));
    button.addEventListener('focus', (event) => showTooltipForRecord(node, event.currentTarget));
    button.addEventListener('blur', hideTooltip);
    button.addEventListener('mouseenter', (event) => showTooltipForRecord(node, event.currentTarget));
    button.addEventListener('mouseleave', hideTooltip);
    button.addEventListener('keydown', (event) => moveMapFocus(event, node));
    return button;
  }

  function mapEventControl(event) {
    const time = timestampMillis(event);
    if (time == null) return null;
    const x = mapX(time), y = 58;
    const button = makeButton('map-event-button');
    button.dataset.eventId = event.id || '';
    button.dataset.mapX = String(x);
    button.dataset.mapY = String(y);
    button.setAttribute('aria-label', `${editorial('event.action.open', 'Open contextual event')}: ${event.title}`);
    button.append(make('span', 'map-event-diamond'));
    button.addEventListener('click', (click) => openEvent(event, {history: 'push', opener: click.currentTarget}));
    return button;
  }

  function mapStageControl(range) {
    const stage = stages.get(range.id);
    const item = make('div', 'map-stage-button');
    const action = makeButton('map-stage-button-action');
    item.dataset.stageId = range.id;
    item.dataset.mapStart = String(range.start);
    item.dataset.mapEnd = String(range.end);
    action.title = stage.title;
    action.setAttribute('aria-label', `${editorial('stage.action.toggle', 'Toggle stage')} ${range.index + 1}: ${stage.title}`);
    action.setAttribute('aria-pressed', String(selectedStageIds().includes(range.id)));
    item.classList.toggle('is-selected', selectedStageIds().includes(range.id));
    item.append(action, make('span', 'map-stage-index', String(range.index + 1)), makeCandidateText('span', 'map-stage-name', stage.title));
    action.addEventListener('click', () => selectStage(range.id));
    return item;
  }

  function mapDateControl(time) {
    const label = make('span', 'map-date-label-html', new Date(time).toLocaleDateString('en-US', {month: 'short', day: 'numeric', timeZone: 'UTC'}));
    label.dataset.mapX = String(mapX(time));
    label.setAttribute('aria-hidden', 'true');
    return label;
  }

  function mapLaneControl(lane) {
    const label = make('span', 'map-lane-label-html', laneTitle(lane));
    label.dataset.mapY = String(laneY(lane));
    label.setAttribute('aria-hidden', 'true');
    return label;
  }

  function viewportWidth() { return Math.max(260, mapWidth / Math.max(1, mapZoom)); }
  function setMapView(writeState) {
    const width = viewportWidth();
    mapViewStart = Math.max(0, Math.min(mapWidth - width, mapViewStart));
    if (mapSvg) mapSvg.setAttribute('viewBox', `${mapViewStart} 0 ${width} ${mapHeight}`);
    state.zoom = mapZoom;
    state.mapStart = mapViewStart;
    positionMapOverlay();
    if (writeState) commit('replace');
  }

  function positionMapOverlay() {
    const overlay = $('timeline');
    if (!overlay) return;
    const width = Math.max(1, overlay.clientWidth);
    const height = Math.max(1, overlay.clientHeight);
    const viewWidth = viewportWidth();
    const screenX = (coordinate) => (coordinate - mapViewStart) / viewWidth * width;
    const screenY = (coordinate) => coordinate / mapHeight * height;

    overlay.querySelectorAll('.map-record-button, .map-event-button').forEach((button) => {
      const x = screenX(Number(button.dataset.mapX));
      const y = screenY(Number(button.dataset.mapY));
      button.style.left = `${x}px`;
      button.style.top = `${y}px`;
      button.hidden = x < -24 || x > width + 24;
    });

    overlay.querySelectorAll('.map-stage-button').forEach((button) => {
      const start = screenX(Number(button.dataset.mapStart));
      const end = screenX(Number(button.dataset.mapEnd));
      const left = Math.max(0, Math.min(start, end));
      const right = Math.min(width, Math.max(start, end));
      const visibleWidth = Math.max(0, right - left);
      button.hidden = visibleWidth < 20 || right < 0 || left > width;
      button.style.left = `${left}px`;
      button.style.width = `${visibleWidth}px`;
      button.classList.toggle('is-compact', visibleWidth < 112);
      const selected = selectedStageIds().includes(button.dataset.stageId);
      button.classList.toggle('is-selected', selected);
      button.querySelector('.map-stage-button-action')?.setAttribute('aria-pressed', String(selected));
    });

    let lastDateX = -Infinity;
    overlay.querySelectorAll('.map-date-label-html').forEach((label) => {
      const x = screenX(Number(label.dataset.mapX));
      const visible = x >= 12 && x <= width - 12 && x - lastDateX >= 68;
      label.hidden = !visible;
      if (visible) {
        label.style.left = `${x}px`;
        lastDateX = x;
      }
    });

    overlay.querySelectorAll('.map-lane-label-html').forEach((label) => {
      label.style.top = `${screenY(Number(label.dataset.mapY))}px`;
    });
  }
  function fitAll(writeState = true) {
    mapZoom = 1; mapViewStart = 0; setMapView(writeState);
  }
  function fitStages(ids, writeState = true) {
    const nodes = ids.flatMap((id) => stageNodes.get(id) || []);
    fitTimes(nodes.map((node) => displayTimeByKey.get(node.key)), writeState);
  }
  function fitTimes(times, writeState = true) {
    if (!times.length) return;
    const min = Math.min(...times), max = Math.max(...times);
    const left = Math.max(0, mapX(min) - 80), right = Math.min(mapWidth, mapX(max) + 80);
    const span = Math.max(220, right - left);
    mapZoom = Math.max(1, Math.min(40, mapWidth / span));
    mapViewStart = left;
    setMapView(writeState);
  }
  function zoomMap(factor) {
    const oldWidth = viewportWidth(), center = mapViewStart + oldWidth / 2;
    mapZoom = Math.max(1, Math.min(40, mapZoom * factor));
    mapViewStart = center - viewportWidth() / 2;
    setMapView(true);
  }
  function fitDateRange() {
    const start = state.dateStart ? Date.parse(`${state.dateStart}T00:00:00Z`) : uniqueTimes[0];
    const end = state.dateEnd ? Date.parse(`${state.dateEnd}T23:59:59Z`) : uniqueTimes.at(-1);
    if (Number.isFinite(start) && Number.isFinite(end) && start <= end) fitTimes([start, end]);
  }

  function moveMapFocus(event, node) {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    const visible = D.nodes.filter(matches).sort(compareRecords);
    let target = null;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      const index = visible.findIndex((candidate) => candidate.key === node.key);
      target = visible[index + (event.key === 'ArrowLeft' ? -1 : 1)];
    } else {
      const laneIndex = laneOrder.indexOf(node.lane) + (event.key === 'ArrowUp' ? -1 : 1);
      const candidates = (laneNodes.get(laneOrder[laneIndex]) || []).filter(matches);
      const time = displayTimeByKey.get(node.key);
      target = candidates.sort((a, b) => Math.abs(displayTimeByKey.get(a.key) - time) - Math.abs(displayTimeByKey.get(b.key) - time))[0];
    }
    document.querySelector(`.map-record-button[data-record-key="${CSS.escape(target?.key || '')}"]`)?.focus();
  }

  function showTooltipForRecord(node, anchor) {
    const tip = $('tooltip');
    const content = make('span', '', `${laneTitle(node.lane)} · ${node.turn == null ? editorial('tooltip.conversation', 'Conversation') : `${editorial('tooltip.turn', 'Turn')} ${node.turn}`} · ${formatTimestamp(node)} · ${node.summary || node.key}`);
    const termNote = termBrief(node.summary, node.why);
    tip.replaceChildren(content);
    if (termNote) tip.append(make('span', 'tooltip-term-note', termNote));
    renderEditorialMath(tip);
    tip.hidden = false;
    tip.setAttribute('aria-hidden', 'false');
    const anchorRect = anchor.getBoundingClientRect();
    const tipRect = tip.getBoundingClientRect();
    const margin = 10;
    const maxLeft = Math.max(margin, window.innerWidth - tipRect.width - margin);
    const left = Math.min(maxLeft, Math.max(margin, anchorRect.left + anchorRect.width / 2 - tipRect.width / 2));
    const above = anchorRect.top - tipRect.height - margin;
    const top = above >= margin ? above : Math.min(window.innerHeight - tipRect.height - margin, anchorRect.bottom + margin);
    tip.style.left = `${Math.round(left)}px`;
    tip.style.top = `${Math.round(Math.max(margin, top))}px`;
  }
  function hideTooltip() {
    const tip = $('tooltip');
    tip.hidden = true;
    tip.setAttribute('aria-hidden', 'true');
    tip.style.removeProperty('left');
    tip.style.removeProperty('top');
  }

  function updateMapSelection() {
    document.querySelectorAll('.map-record-button').forEach((button) => button.classList.toggle('is-selected', button.dataset.recordKey === currentNode?.key));
  }

  function renderAllViews() {
    buildStages();
    buildKeyRecords();
    buildAllRecords();
    buildMobileTimeline();
    buildMap();
    syncControls();
    renderEditorialMath($('stage'));
  }

  function openRecord(node, options = {}) {
    if (!node) return;
    if (options.opener) returnFocus = options.opener;
    currentNode = node; currentEvent = null;
    state.record = node.key; state.event = '';
    if (options.history !== 'none') commit(options.history || 'push');
    openDetailShell();
    const classLabel = CLASS_INFO[node.class]?.label || node.class;
    replaceCandidateText($('d-title'), `${classLabel}: ${node.summary || node.key}`);
    const pieces = [laneTitle(node.lane), node.turn == null ? editorial('detail.meta.conversation', 'Separate conversation') : `${editorial('detail.meta.turn', 'Turn')} ${node.turn}`, formatTimestamp(node), modelAttributionFor(node)];
    if (node.tag) pieces.push(node.tag);
    $('d-meta').textContent = pieces.join(' · ');
    replaceCandidateText($('d-why'), node.why || '');
    updateDetailTerms(node.summary, node.why);
    renderEditorialMath($('detail'));
    const sequence = (laneNodes.get(node.lane) || []).filter(matches);
    const fallback = laneNodes.get(node.lane) || [];
    const active = sequence.some((item) => item.key === node.key) ? sequence : fallback;
    const index = active.findIndex((item) => item.key === node.key);
    $('d-prev').disabled = index <= 0;
    $('d-next').disabled = index < 0 || index >= active.length - 1;
    $('d-prev').onclick = () => { if (index > 0) openRecord(active[index - 1], {history: 'push'}); };
    $('d-next').onclick = () => { if (index >= 0 && index < active.length - 1) openRecord(active[index + 1], {history: 'push'}); };
    $('d-pos').textContent = index >= 0 ? `${index + 1} ${editorial('detail.position.of', 'of')} ${active.length} · ${laneTitle(node.lane)}` : '';
    updateMapSelection();
    renderContent(node);
  }

  function openEvent(event, options = {}) {
    if (!event) return;
    if (options.opener) returnFocus = options.opener;
    currentNode = null; currentEvent = event;
    state.record = ''; state.event = event.id || '';
    if (options.history !== 'none') commit(options.history || 'push');
    openDetailShell();
    replaceCandidateText($('d-title'), `${editorial('detail.event.label', 'Contextual event')}: ${event.title}`);
    $('d-meta').textContent = formatTimestamp(event);
    replaceCandidateText($('d-why'), event.contemporary_status || '');
    updateDetailTerms(event.title, event.contemporary_status, event.later_status);
    $('d-prev').disabled = true; $('d-next').disabled = true; $('d-pos').textContent = '';
    $('d-src').hidden = true;
    const body = $('d-body'); body.replaceChildren();
    if (event.later_status) body.append(makeCandidateText('p', '', event.later_status));
  }

  function openDetailShell() {
    const detail = $('detail');
    detail.classList.add('open');
    detail.setAttribute('aria-hidden', 'false');
    detail.setAttribute('aria-modal', 'true');
    $('detail-backdrop').hidden = false;
    setBackgroundInert(true);
    detail.focus({preventScroll: true});
    requestAnimationFrame(() => {
      if (detail.classList.contains('open') && !detail.contains(document.activeElement)) {
        detail.focus({preventScroll: true});
      }
    });
  }

  function closeDetail(options = {}) {
    if (!$('detail').classList.contains('open') && !currentNode && !currentEvent) return;
    currentNode = null; currentEvent = null;
    state.record = ''; state.event = '';
    if (options.history !== 'none') commit(options.history || 'push');
    const detail = $('detail');
    detail.classList.remove('open');
    detail.setAttribute('aria-hidden', 'true');
    detail.setAttribute('aria-modal', 'false');
    $('detail-backdrop').hidden = true;
    setBackgroundInert(false);
    updateMapSelection();
    const fallback = returnFocus?.isConnected ? returnFocus : document.querySelector(`[data-record-key="${CSS.escape(options.returnKey || '')}"]`);
    returnFocus = null;
    fallback?.focus();
  }

  function setBackgroundInert(enabled) {
    document.querySelectorAll('.dashboard-header, .view-tabs, .record-controls, #stage').forEach((node) => {
      if (enabled) node.setAttribute('inert', ''); else node.removeAttribute('inert');
    });
  }

  async function renderContent(node) {
    const request = ++contentRequest;
    const body = $('d-body'), source = $('d-src');
    body.replaceChildren(make('p', 'hint', editorial('detail.loading', 'Loading record…')));
    source.hidden = true;
    try {
      const response = await fetch(`content/${encodeURIComponent(node.key)}.json`, {credentials: 'same-origin'});
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (request !== contentRequest) return;
      updateDetailTerms(node.summary, node.why, (data.msgs || []).map((message) => message.text));
      const sourceKind = data.source_detail?.kind || data.source || node.source_detail?.kind || node.source;
      source.textContent = sourceLabel(sourceKind);
      source.hidden = false;
      const fragment = document.createDocumentFragment();
      for (const message of data.msgs || []) {
        if (!Object.prototype.hasOwnProperty.call(MESSAGE_ROLE_LABELS, message.role)) throw new Error(`Unrecognized message role: ${message.role}`);
        const block = make('section', `msg ${message.role}`);
        let roleLabel = MESSAGE_ROLE_LABELS[message.role];
        if (message.role === 'assistant' && ['demangled', 'reconstructed'].includes(sourceKind)) roleLabel = editorial('detail.role.reconstructed', 'Reconstructed model response');
        if (message.role === 'assistant' && message.model) roleLabel = `${roleLabel} · ${message.model}`;
        block.append(make('h3', 'rolelbl', roleLabel), renderMessageArtifact(message));
        fragment.append(block);
      }
      if (!fragment.childNodes.length) fragment.append(make('p', 'hint', editorial('detail.empty', 'No message text is available for this record.')));
      const renderedMessages = document.createElement('div');
      renderedMessages.append(fragment);
      if (typeof window.renderMathInElement === 'function') {
        window.renderMathInElement(renderedMessages, {delimiters: [{left: '$$', right: '$$', display: true}, {left: '\\[', right: '\\]', display: true}, {left: '$', right: '$', display: false}, {left: '\\(', right: '\\)', display: false}], ignoredTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code'], throwOnError: true, errorCallback: () => {}, trust: false, output: 'mathml', maxExpand: 1000});
        normalizeMathMLScriptChildren(renderedMessages);
        renderedMessages.querySelectorAll('.katex > math[display="block"]').forEach((math) => math.parentElement.classList.add('katex-display'));
      }
      body.replaceChildren(...renderedMessages.childNodes);
    } catch (error) {
      if (request !== contentRequest) return;
      console.error(error);
      source.hidden = true;
      body.replaceChildren(make('p', 'content-error', editorial('detail.error', 'This record could not be loaded.')));
    }
  }

  function sourceLabel(kind) {
    const normalizedKind = String(kind || '').toLowerCase().replace(/[-_]/g, '');
    if (normalizedKind.startsWith('assistantonly') || normalizedKind === 'formalizationrecord') return editorial('source.formalization', 'Formalization record');
    if (['archived', 'archived_saved_response', 'saved', 'saved-response'].includes(kind)) return editorial('source.archived', 'Archived saved response');
    if (['demangled', 'reconstructed'].includes(kind)) return editorial('source.reconstructed', 'Reconstructed from a saved rendering of the response');
    if (['fetched', 'backend-fetched', 'backend_fetched'].includes(kind)) return editorial('source.fetched', 'Backend-fetched conversation text');
    return editorial('source.recorded', 'Recorded source');
  }

  function resolveArtifactHref(rawHref, attachmentLookup) {
    const href = String(rawHref || '').trim();
    if (!href) return Object.freeze({kind: 'blocked', href: null, label: LINK_NOT_PUBLISHED});
    if (/^(?:sandbox:|file:|\/mnt\/data(?:\/|$))/i.test(href)) {
      const mapped = attachmentLookup && Object.prototype.hasOwnProperty.call(attachmentLookup, href) ? attachmentLookup[href] : null;
      if (mapped && /^\.\/artifacts\/[A-Za-z0-9._/-]+$/.test(mapped)) return Object.freeze({kind: 'public-attachment', href: mapped, label: null});
      return Object.freeze({kind: 'attachment-missing', href: null, label: ATTACHMENT_NOT_INCLUDED});
    }
    if (href.startsWith('#')) return Object.freeze({kind: 'internal', href, label: null});
    let url;
    try { url = new URL(href, window.location.href); } catch { return Object.freeze({kind: 'blocked', href: null, label: LINK_NOT_PUBLISHED}); }
    if (!['http:', 'https:'].includes(url.protocol)) return Object.freeze({kind: 'blocked', href: null, label: LINK_NOT_PUBLISHED});
    const host = url.hostname.toLowerCase();
    if (host === 'localhost' || host.endsWith('.local') || host === '127.0.0.1' || host === '0.0.0.0' || /^10\./.test(host) || /^192\.168\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host)) {
      return Object.freeze({kind: 'blocked', href: null, label: LINK_NOT_PUBLISHED});
    }
    if (/(^|\.)chatgpt\.com$/.test(host) && /^\/(?:c|share)\//.test(url.pathname)) return Object.freeze({kind: 'blocked', href: null, label: LINK_NOT_PUBLISHED});
    return Object.freeze({kind: 'public', href: url.href, label: null});
  }

  function renderArtifactMarkdown(text) {
    const raw = String(text || '');
    if (typeof window.marked === 'undefined' || typeof window.DOMPurify === 'undefined') {
      const fallback = document.createDocumentFragment();
      fallback.append(make('pre', 'transcript-plain', raw));
      return fallback;
    }
    const renderer = new window.marked.Renderer();
    renderer.html = (html) => escapeMarkup(String(html));
    const linkTargets = [];
    renderer.link = (href, title, linkText) => {
      const index = linkTargets.push(String(href || '')) - 1;
      const titleAttribute = title ? ` title="${escapeMarkup(String(title))}"` : '';
      return `<a href="#q2-artifact-link-${index}"${titleAttribute}>${linkText}</a>`;
    };
    const math = [];
    const stashed = raw.replace(/\\\[[\s\S]+?\\\]|\$\$[\s\S]+?\$\$|\\\([\s\S]+?\\\)|(?<![\\\w])\$(?!\s)[^\n$]+?\$(?!\w)/g, (match) => {
      const token = `Q2MATH${math.length}TOKEN`;
      math.push(match);
      return token;
    });
    const parsed = window.marked.parse(stashed, {renderer, gfm: true, breaks: false});
    const fragment = window.DOMPurify.sanitize(parsed, ARTIFACT_SANITIZER_CONFIG);
    restoreMath(fragment, math);
    fragment.querySelectorAll('a').forEach((anchor) => {
      const sanitizedHref = anchor.getAttribute('href') || '';
      const token = /^#q2-artifact-link-(\d+)$/.exec(sanitizedHref);
      const originalHref = token ? linkTargets[Number(token[1])] : sanitizedHref;
      const resolution = resolveArtifactHref(originalHref);
      if (resolution.href) {
        anchor.setAttribute('href', resolution.href);
        anchor.setAttribute('rel', 'noreferrer noopener');
        anchor.setAttribute('data-artifact-link', resolution.kind);
      } else {
        const replacement = make('span', resolution.kind === 'attachment-missing' ? 'attachment-unavailable not-included' : 'link-unpublished artifact-link-blocked', resolution.label);
        if (resolution.kind === 'attachment-missing') replacement.setAttribute('data-attachment-status', 'not-included');
        else replacement.setAttribute('data-link-status', 'blocked');
        replacement.setAttribute('data-artifact-link', 'blocked');
        anchor.replaceWith(replacement);
      }
    });
    return fragment;
  }
  function renderMessageArtifact(message) {
    const raw = String(message?.text ?? '');
    if (message?.role === 'tool' && raw.length > LARGE_TOOL_PLAIN_TEXT_THRESHOLD) {
      const fragment = document.createDocumentFragment();
      fragment.append(make('pre', 'transcript-plain transcript-large-tool', raw));
      return fragment;
    }
    return renderArtifactMarkdown(raw);
  }
  function normalizeMathMLScriptChildren(root) {
    root.querySelectorAll('msub').forEach((script) => {
      const children = [...script.children];
      if (children.length <= 2) return;
      const subscript = document.createElementNS(script.namespaceURI, 'mrow');
      children.slice(1).forEach((child) => subscript.append(child));
      script.append(subscript);
    });
    root.querySelectorAll('msubsup').forEach((script) => {
      const children = [...script.children];
      if (children.length <= 3) return;
      const superscript = children.at(-1);
      const subscript = document.createElementNS(script.namespaceURI, 'mrow');
      children.slice(1, -1).forEach((child) => subscript.append(child));
      script.insertBefore(subscript, superscript);
    });
  }
  function escapeMarkup(value) { return value.replace(/[&<>"']/g, (char) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[char])); }
  function restoreMath(fragment, math) {
    const walker = document.createTreeWalker(fragment, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((textNode) => {
      const pattern = /Q2MATH(\d+)TOKEN/g;
      if (!pattern.test(textNode.data)) return;
      pattern.lastIndex = 0;
      const replacement = document.createDocumentFragment();
      let cursor = 0, match;
      while ((match = pattern.exec(textNode.data))) {
        replacement.append(document.createTextNode(textNode.data.slice(cursor, match.index)), document.createTextNode(math[Number(match[1])] || match[0]));
        cursor = match.index + match[0].length;
      }
      replacement.append(document.createTextNode(textNode.data.slice(cursor)));
      textNode.replaceWith(replacement);
    });
  }

  function bindControls() {
    $('viewSeg').addEventListener('click', (event) => {
      const button = event.target.closest('[data-v]');
      if (!button) return;
      state.view = button.dataset.v; commit('push'); syncControls();
      $(`${state.view === 'key' ? 'key' : state.view === 'list' ? 'list' : state.view}view`)?.focus();
    });
    $('viewSeg').addEventListener('keydown', (event) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      const tabs = [...document.querySelectorAll('#viewSeg [data-v]')];
      const current = tabs.indexOf(document.activeElement);
      const index = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (current + (event.key === 'ArrowLeft' ? -1 : 1) + tabs.length) % tabs.length;
      event.preventDefault(); tabs[index].focus(); tabs[index].click();
    });
    $('focusSeg').addEventListener('click', (event) => {
      const button = event.target.closest('[data-f]'); if (!button) return;
      state.focus = button.dataset.f; commit('push'); syncControls(); renderAllViews();
    });
    $('search').addEventListener('input', (event) => { state.query = event.target.value.trim(); commit('replace'); renderAllViews(); });
    $('clearFilters').addEventListener('click', () => {
      state.query = ''; state.focus = 'all'; state.stage = []; state.dateStart = ''; state.dateEnd = '';
      disabledClasses.clear(); disabledLanes.clear(); commit('push'); syncControls(); renderAllViews(); fitAll(false);
    });
    $('dateStart').addEventListener('change', (event) => { state.dateStart = event.target.value; commit('replace'); });
    $('dateEnd').addEventListener('change', (event) => { state.dateEnd = event.target.value; commit('replace'); });
    $('fitRangeBtn').addEventListener('click', fitDateRange);
    $('zin').addEventListener('click', () => zoomMap(1.35));
    $('zout').addEventListener('click', () => zoomMap(1 / 1.35));
    $('fitBtn').addEventListener('click', () => fitAll());
    $('mobileMapToggle').addEventListener('click', () => {
      const open = $('mobileMapToggle').getAttribute('aria-expanded') !== 'true';
      $('mobileMapToggle').setAttribute('aria-expanded', String(open));
      $('tlwrap').dataset.mobileOpen = String(open);
      $('tlwrap').classList.toggle('mobile-open', open);
      $('timelineview').classList.toggle('map-open', open);
      $('mobileMapToggle').textContent = open ? editorial('timeline.mobile-map.button.close', 'Close horizontal map') : editorial('timeline.mobile-map.button.open', 'Open horizontal map');
      if (open) requestAnimationFrame(positionMapOverlay);
    });
    const wrap = $('tlwrap');
    wrap.addEventListener('wheel', (event) => { event.preventDefault(); zoomMap(event.deltaY < 0 ? 1.15 : 1 / 1.15); }, {passive: false});
    wrap.addEventListener('pointerdown', (event) => {
      if (event.target.closest('button')) return;
      dragState = {pointerId: event.pointerId, x: event.clientX, start: mapViewStart};
      wrap.setPointerCapture(event.pointerId);
    });
    wrap.addEventListener('pointermove', (event) => {
      if (!dragState || dragState.pointerId !== event.pointerId) return;
      const width = Math.max(1, wrap.getBoundingClientRect().width);
      mapViewStart = dragState.start - (event.clientX - dragState.x) * viewportWidth() / width;
      setMapView(false);
    });
    const endDrag = (event) => { if (dragState?.pointerId === event.pointerId) { dragState = null; setMapView(true); } };
    wrap.addEventListener('pointerup', endDrag); wrap.addEventListener('pointercancel', endDrag);
    wrap.addEventListener('keydown', (event) => {
      if (event.target.closest('button')) return;
      if (event.key === 'Home') { event.preventDefault(); fitAll(); }
      if (event.key === '+' || event.key === '=') { event.preventDefault(); zoomMap(1.35); }
      if (event.key === '-') { event.preventDefault(); zoomMap(1 / 1.35); }
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault(); mapViewStart += viewportWidth() * (event.key === 'ArrowLeft' ? -0.1 : 0.1); setMapView(true);
      }
    });
    $('d-close').addEventListener('click', () => closeDetail({history: 'push'}));
    $('detail-backdrop').addEventListener('click', () => closeDetail({history: 'push'}));
    document.addEventListener('keydown', (event) => {
      if (!$('detail').classList.contains('open')) return;
      if (event.key === 'Escape') { event.preventDefault(); closeDetail({history: 'push'}); return; }
      if (event.key !== 'Tab') return;
      const focusable = [...$('detail').querySelectorAll('button:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])')];
      if (!focusable.length) { event.preventDefault(); $('detail').focus(); return; }
      const first = focusable[0], last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });
    window.addEventListener('popstate', restoreFromLocation);
    window.addEventListener('hashchange', restoreFromLocation);
    window.addEventListener('resize', positionMapOverlay);
  }

  function boot() {
    buildFilters();
    buildTimelineLegend();
    bindControls();
    renderAllViews();
    commit('replace');
    if (accountingLinkRequested) {
      const note = $('accounting');
      note.open = true;
      requestAnimationFrame(() => note.scrollIntoView({block: 'start'}));
    }
    if (state.record) openRecord(byKey.get(state.record), {history: 'none'});
    else if (state.event) openEvent(eventList.find((event) => event.id === state.event), {history: 'none'});
  }

  window.Q2DashboardTestHooks = Object.freeze({
    parseState,
    serializeState,
    resolveArtifactHref,
    renderArtifactMarkdown,
    renderMessageArtifact,
    normalizeMathMLScriptChildren,
    formatTimestamp,
    messageRoleLabels: MESSAGE_ROLE_LABELS,
    editorial: EDITORIAL,
    recordKeys: Object.freeze(D.nodes.map((node) => node.key)),
    stateFields: STATE_FIELDS,
  });

  boot();
}());
