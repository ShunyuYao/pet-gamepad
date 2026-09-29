'use strict';

(() => {
  const STORAGE_KEY = 'pet-gamepad-prototype.v1';
  const THEME_KEY = 'pet-gamepad-prototype.theme';
  const $ = (id) => document.getElementById(id);
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const controlKeys = ['south', 'east', 'west', 'north', 'lb', 'rb', 'lt', 'rt', 'start', 'select'];
  const labels = {
    ps: { south: '×', east: '○', west: '□', north: '△', lb: 'L1', rb: 'R1', lt: 'L2', rt: 'R2', start: 'Options', select: 'Create / Share' },
    xbox: { south: 'A', east: 'B', west: 'X', north: 'Y', lb: 'LB', rb: 'RB', lt: 'LT', rt: 'RT', start: 'Menu', select: 'View' },
  };
  const physical = { south: '下方按键', east: '右侧按键', west: '左侧按键', north: '上方按键', lb: '左肩键', rb: '右肩键', lt: '左扳机', rt: '右扳机', start: '菜单键', select: '辅助菜单键' };
  const gameProfiles = {
    'gold-miner': { name: '黄金矿工', actions: ['放下钩爪', '使用炸药', '道具操作', '打开菜单'], defaults: ['south', 'east', 'west', 'start'] },
    'pet-kart': { name: '宠物卡丁车', actions: ['加速', '刹车 / 倒车', '漂移', '打开菜单'], defaults: ['rt', 'lt', 'rb', 'start'] },
    'pet-brawl': { name: '宠物乱斗', actions: ['攻击', '跳跃', '防御', '打开菜单'], defaults: ['west', 'south', 'rb', 'start'] },
    'pet-hide-duel': { name: '躲猫猫', actions: ['确认姿势', '取消操作', '切换关节', '打开菜单'], defaults: ['south', 'east', 'rb', 'start'] },
    'pet-paint': { name: '宠物涂色', actions: ['喷涂', '潜行', '特殊操作', '打开菜单'], defaults: ['rt', 'lt', 'rb', 'start'] },
    'baba-bibi': { name: '巴巴比比', actions: ['点击目标', '返回', '辅助操作', '打开菜单'], defaults: ['south', 'east', 'west', 'start'] },
  };
  const defaults = { version: 1, revision: 0, layout: 'ps', global: ['south', 'east', 'west', 'start'], deadzones: { left: 12, right: 12 }, games: {} };
  function validMapping(mapping) { return Array.isArray(mapping) && mapping.length === 4 && mapping.every((key) => controlKeys.includes(key)); }
  function loadSettings() {
    let raw;
    try { raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch { return clone(defaults); }
    if (!raw || raw.version !== 1) return clone(defaults);
    const safe = clone(defaults);
    safe.revision = Number.isSafeInteger(raw.revision) && raw.revision >= 0 ? raw.revision : 0;
    safe.layout = raw.layout === 'xbox' ? 'xbox' : 'ps';
    if (validMapping(raw.global)) safe.global = raw.global;
    for (const side of ['left', 'right']) {
      const value = raw.deadzones?.[side];
      if (Number.isInteger(value) && value >= 0 && value <= 40) safe.deadzones[side] = value;
    }
    for (const key of Object.keys(gameProfiles)) {
      if (typeof raw.games?.[key]?.override === 'boolean' && validMapping(raw.games[key].mapping)) safe.games[key] = { override: raw.games[key].override, mapping: raw.games[key].mapping };
    }
    return safe;
  }
  let saved = loadSettings();
  let draft = clone(saved);
  let currentProfile = 'global';
  let mode = 'none';
  let selectedIndex = null;
  let connectedPad = null;
  let realError = '';
  let simAxes = [0, 0, 0, 0];
  let simButtons = [];
  let keyboardKeys = new Set();
  let rawInput = { axes: [0, 0, 0, 0], buttons: [] };
  let measurement = null;
  let recommendation = null;
  let toastTimer;
  let lastDeviceStamp = '';
  let externalChange = false;

  function showToast(message) {
    clearTimeout(toastTimer);
    $('toast').textContent = message;
    $('toast').hidden = false;
    toastTimer = setTimeout(() => { $('toast').hidden = true; }, 3800);
  }
  function dirty() { return JSON.stringify(draft) !== JSON.stringify(saved); }
  function resolvedMapping(profile = currentProfile) {
    if (profile === 'global') return draft.global;
    if (draft.games[profile]?.override) return draft.games[profile].mapping;
    const mapping = [...gameProfiles[profile].defaults];
    mapping[3] = draft.global[3];
    return mapping;
  }
  function conflicts(mapping) {
    return mapping.map((key, index) => mapping.some((other, i) => i !== index && other === key) ? index : -1).filter((index) => index >= 0);
  }
  function allConflictProfiles() {
    return ['global', ...Object.keys(gameProfiles)].filter((profile) => conflicts(resolvedMapping(profile)).length);
  }
  function updateSaveState() {
    const changed = dirty();
    const invalid = allConflictProfiles();
    document.querySelector('.savebar').classList.toggle('dirty', changed);
    $('save').disabled = !changed || invalid.length > 0 || externalChange;
    $('discard').disabled = !changed && !externalChange;
    $('save-state').textContent = externalChange ? '另一页面已更新设置' : invalid.length ? '请先解决按键冲突' : changed ? '有未保存的修改' : '设置已保存';
    $('save-detail').textContent = externalChange ? '草稿仍保留。撤销修改可加载最新设置。' : invalid.length ? `冲突范围：${invalid.map((key) => key === 'global' ? '全局' : gameProfiles[key].name).join('、')}` : '只影响此原型，不改变游戏或宿主。';
  }
  function renderMapping() {
    const isGlobal = currentProfile === 'global';
    const overrides = Boolean(draft.games[currentProfile]?.override);
    const mapping = resolvedMapping();
    const actionNames = isGlobal ? ['确认', '返回', '辅助操作', '打开菜单'] : gameProfiles[currentProfile].actions;
    const symbols = ['↵', '↩', '✧', '☰'];
    const duplicateIndices = conflicts(mapping);
    $('inherit-row').hidden = isGlobal;
    $('game-override').checked = overrides;
    $('mapping-group-title').textContent = isGlobal ? '通用菜单操作' : `${gameProfiles[currentProfile].name} · 游戏操作`;
    $('mapping-scope-tag').textContent = isGlobal ? '所有游戏共用' : overrides ? '独立设置' : '推荐布局';
    $('mapping-note').textContent = isGlobal ? '全局菜单设置统一确认、返回与菜单操作。每款游戏的移动、攻击等玩法操作在对应游戏中调整。' : '这里只演示游戏操作的映射提案，尚未接入游戏。菜单中的确认与返回继续使用全局设置；切换范围会保留未保存的草稿。';
    $('layout-ps').setAttribute('aria-pressed', String(draft.layout === 'ps'));
    $('layout-xbox').setAttribute('aria-pressed', String(draft.layout === 'xbox'));
    const table = $('mapping-table');
    table.replaceChildren();
    actionNames.forEach((name, index) => {
      const row = document.createElement('div');
      row.className = `mapping-row${duplicateIndices.includes(index) ? ' conflict' : ''}`;
      const label = document.createElement('label');
      label.className = 'action-label';
      label.htmlFor = `mapping-${index}`;
      const symbol = document.createElement('span');
      symbol.className = 'action-symbol';
      symbol.setAttribute('aria-hidden', 'true');
      symbol.textContent = symbols[index];
      const labelText = document.createElement('span');
      const title = document.createElement('strong');
      title.textContent = name;
      const hint = document.createElement('small');
      hint.textContent = duplicateIndices.includes(index) ? '与其他操作重复' : isGlobal ? '通用操作' : overrides ? '仅当前游戏' : index === 3 ? '跟随全局菜单' : '游戏推荐';
      labelText.append(title, hint);
      label.append(symbol, labelText);
      const select = document.createElement('select');
      select.id = `mapping-${index}`;
      select.className = 'binding-select';
      select.disabled = !isGlobal && !overrides;
      select.setAttribute('aria-label', `${name}对应按键`);
      if (duplicateIndices.includes(index)) select.setAttribute('aria-invalid', 'true');
      for (const key of controlKeys) {
        const option = document.createElement('option');
        option.value = key;
        option.textContent = `${labels[draft.layout][key]} · ${physical[key]}`;
        select.append(option);
      }
      select.value = mapping[index];
      select.addEventListener('change', () => {
        const next = [...resolvedMapping()];
        next[index] = select.value;
        if (currentProfile === 'global') draft.global = next;
        else draft.games[currentProfile] = { override: true, mapping: next };
        renderMapping();
        $(`mapping-${index}`).focus({ preventScroll: true });
        updateSaveState();
      });
      row.append(label, select);
      table.append(row);
    });
    $('mapping-conflict').hidden = !duplicateIndices.length;
    $('mapping-conflict').textContent = duplicateIndices.length ? `「${duplicateIndices.map((index) => actionNames[index]).join('」「')}」使用了相同按键，请调整后再保存。` : '';
    $('reset-mapping').disabled = !isGlobal && !overrides;
    updateLayout();
  }
  function updateLayout() {
    const layout = labels[draft.layout];
    for (const direction of ['north', 'west', 'east', 'south']) $(`face-${direction}`).textContent = layout[direction];
    $('trigger-label').textContent = `${layout.lt} / ${layout.rt}`;
    $('sim-press').textContent = `${simButtons[0] ? '松开' : '按下'} ${layout.south}`;
  }
  function renderDeadzones() {
    for (const side of ['left', 'right']) {
      $(`deadzone-${side}`).value = draft.deadzones[side];
      $(`deadzone-${side}-value`).textContent = `${draft.deadzones[side]}%`;
      $(`${side}-deadzone-disc`).style.width = `${draft.deadzones[side]}%`;
      $(`${side}-deadzone-disc`).style.height = `${draft.deadzones[side]}%`;
    }
  }
  function renderAll() { renderMapping(); renderDeadzones(); updateSaveState(); }

  for (const button of document.querySelectorAll('[data-page]')) {
    button.addEventListener('click', () => {
      for (const item of document.querySelectorAll('[data-page]')) {
        const active = item === button;
        item.classList.toggle('active', active);
        if (active) item.setAttribute('aria-current', 'page'); else item.removeAttribute('aria-current');
        $(`page-${item.dataset.page}`).hidden = !active;
      }
      document.querySelector('main').scrollTop = 0;
    });
  }
  document.querySelector('.brand').addEventListener('click', (event) => { event.preventDefault(); document.querySelector('[data-page="connection"]').click(); });
  $('profile').addEventListener('change', () => { currentProfile = $('profile').value; renderMapping(); updateSaveState(); });
  $('game-override').addEventListener('change', () => {
    if ($('game-override').checked) draft.games[currentProfile] = { override: true, mapping: [...(draft.games[currentProfile]?.mapping || resolvedMapping())] };
    else draft.games[currentProfile] = { override: false, mapping: [...resolvedMapping()] };
    renderMapping(); updateSaveState();
  });
  for (const layout of ['ps', 'xbox']) $(`layout-${layout}`).addEventListener('click', () => { draft.layout = layout; renderMapping(); updateSaveState(); });
  $('reset-mapping').addEventListener('click', () => {
    if (currentProfile === 'global') draft.global = [...defaults.global];
    else { const mapping = [...gameProfiles[currentProfile].defaults]; mapping[3] = draft.global[3]; draft.games[currentProfile] = { override: true, mapping }; }
    renderMapping(); updateSaveState(); showToast('已恢复当前范围默认，保存后生效。');
  });
  for (const side of ['left', 'right']) $(`deadzone-${side}`).addEventListener('input', () => {
    draft.deadzones[side] = Number($(`deadzone-${side}`).value);
    renderDeadzones(); updateSaveState();
  });
  $('reset-calibration').addEventListener('click', () => { draft.deadzones = clone(defaults.deadzones); renderDeadzones(); updateSaveState(); showToast('死区已恢复为 12%，保存后生效。'); });
  $('save').addEventListener('click', () => {
    if (allConflictProfiles().length) return;
    const latest = loadSettings();
    if (latest.revision !== saved.revision) { externalChange = true; updateSaveState(); return; }
    const next = clone(draft);
    next.revision = saved.revision + 1;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { showToast('当前无法保存，请保持页面打开以保留草稿。'); return; }
    saved = next; draft = clone(saved); updateSaveState(); showToast('已保存到此原型。');
  });
  $('discard').addEventListener('click', () => { saved = loadSettings(); draft = clone(saved); externalChange = false; renderAll(); showToast('已撤销未保存的修改。'); });
  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY) return;
    if (dirty()) externalChange = true;
    else { saved = loadSettings(); draft = clone(saved); renderAll(); }
    updateSaveState();
  });
  const themeMedia = window.matchMedia('(prefers-color-scheme: dark)');
  function applyTheme(value) { document.documentElement.dataset.theme = value === 'auto' ? themeMedia.matches ? 'dark' : 'light' : value; }
  let initialTheme = 'light';
  try { const value = localStorage.getItem(THEME_KEY); if (['light', 'dark', 'auto'].includes(value)) initialTheme = value; } catch { /* Local settings can be disabled by the browser. */ }
  $('theme').value = initialTheme; applyTheme(initialTheme);
  $('theme').addEventListener('change', () => { applyTheme($('theme').value); try { localStorage.setItem(THEME_KEY, $('theme').value); } catch { showToast('外观已切换，但当前无法保存。'); } });
  themeMedia.addEventListener('change', () => { if ($('theme').value === 'auto') applyTheme('auto'); });

  function clearSimulatedInput() { simAxes = [0, 0, 0, 0]; simButtons = []; keyboardKeys.clear(); updateLayout(); $('sim-stick').textContent = '摇杆向右'; }
  function cancelMeasurement(message = '') { measurement = null; recommendation = null; $('cancel-calibration').hidden = true; $('apply-calibration').hidden = true; $('calibration-result').textContent = message; lastDeviceStamp = ''; }
  function setMode(next) {
    cancelMeasurement(); clearSimulatedInput(); mode = next; selectedIndex = null; connectedPad = null; realError = ''; lastDeviceStamp = '';
    rawInput = { axes: [0, 0, 0, 0], buttons: [] }; renderDevice(); renderInput();
  }
  $('connect-real').addEventListener('click', () => { setMode('real'); pollRealDevice(); renderDevice(); });
  $('toggle-simulation').addEventListener('click', () => { setMode(mode === 'simulation' ? 'none' : 'simulation'); });
  $('stop-detection').addEventListener('click', () => { setMode('none'); });
  $('sim-press').addEventListener('click', () => { simButtons[0] = !simButtons[0]; updateLayout(); });
  $('sim-stick').addEventListener('click', () => { simAxes[0] = simAxes[0] ? 0 : .72; $('sim-stick').textContent = simAxes[0] ? '摇杆回中' : '摇杆向右'; });
  $('sim-clear').addEventListener('click', clearSimulatedInput);
  $('simulate-drift').addEventListener('click', () => {
    setMode('simulation'); simAxes = [.07, .03, -.04, .02];
    $('calibration-result').textContent = '正在演示轻微漂移，数据来自模拟手柄。调整死区，观察下方输出。';
    showToast('已开启模拟漂移，不是真实手柄读数。');
  });
  function isEditing(target) { return target instanceof HTMLElement && (target.matches('input,select,textarea') || target.isContentEditable); }
  document.addEventListener('keydown', (event) => {
    if (mode !== 'simulation' || isEditing(event.target) || !['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','j','k'].includes(event.key)) return;
    event.preventDefault(); keyboardKeys.add(event.key);
  });
  document.addEventListener('keyup', (event) => { keyboardKeys.delete(event.key); });
  window.addEventListener('blur', () => { clearSimulatedInput(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { clearSimulatedInput(); if (measurement) cancelMeasurement('测量已暂停，请回到页面重新开始。'); } });

  function pollRealDevice() {
    if (mode !== 'real') return;
    try {
      if (typeof navigator.getGamepads !== 'function') { realError = '当前浏览器不支持手柄检测，请使用桌面版 Chromium 浏览器。'; connectedPad = null; return; }
      const pads = Array.from(navigator.getGamepads()).filter(Boolean);
      let pad = selectedIndex === null ? null : pads.find((item) => item.index === selectedIndex);
      if (!pad) pad = pads.find((item) => item.buttons.some((button) => button.pressed)) || pads[0] || null;
      if (connectedPad && (!pad || connectedPad.index !== pad.index) && measurement) cancelMeasurement('设备连接发生变化，请重新测量。');
      connectedPad = pad; selectedIndex = pad?.index ?? null;
      realError = '';
    } catch { realError = '此页面暂时无法访问手柄。请在允许手柄访问的本地窗口或浏览器中重试。'; connectedPad = null; if (measurement) cancelMeasurement('检测中断，测量已取消。'); }
  }
  function renderDevice() {
    const standard = connectedPad?.mapping === 'standard';
    const stamp = [mode, connectedPad?.id, connectedPad?.index, standard, realError, Boolean(measurement)].join('|');
    if (stamp === lastDeviceStamp) return;
    lastDeviceStamp = stamp;
    const simulated = mode === 'simulation';
    const real = mode === 'real' && connectedPad;
    const status = $('connection-status');
    status.textContent = simulated ? '模拟连接' : real ? '已检测到手柄' : mode === 'real' ? '等待手柄' : '尚未连接';
    status.className = `status-chip${simulated ? ' simulation' : real ? ' connected' : ''}`;
    $('device-kicker').textContent = simulated ? '演示设备 · 非真实检测' : real ? '浏览器检测结果' : '支持标准手柄';
    $('device-name').textContent = simulated ? 'DualSense · 模拟手柄' : real ? /dualsense|054c.*0ce6/i.test(connectedPad.id) ? 'DualSense' : /dualshock|054c.*05c4|054c.*09cc/i.test(connectedPad.id) ? 'DualShock 4' : /xbox|xinput/i.test(connectedPad.id) ? 'Xbox 手柄' : '已连接手柄' : mode === 'real' ? '按一下手柄按钮' : '让手柄就位';
    $('device-description').textContent = simulated ? '试试下方的模拟操作，体验连接后的反馈。' : real ? connectedPad.id : mode === 'real' ? '已经开始检测，等待浏览器发现你的设备。' : '连接你的 PS5、PS4 或 Xbox 手柄，开始一次小测试。';
    $('connect-real').textContent = mode === 'real' ? '重新检测' : simulated ? '改用真实手柄' : '连接我的手柄 ↗';
    $('toggle-simulation').textContent = simulated ? '退出模拟' : '试试模拟手柄';
    $('stop-detection').hidden = mode !== 'real';
    $('device-help').textContent = realError || (simulated ? '模拟模式不会读取真实设备，也不会控制任何游戏。' : real ? standard ? '标准布局已识别。当前只展示输入；按键显示可在映射页切换。' : '检测到非标准布局，仅显示原始轴和按钮编号，不推断按键含义。' : '用 USB 连接，或先在 macOS 蓝牙设置中配对；然后按一下手柄按钮。');
    $('input-source').textContent = simulated ? '模拟数据' : real ? standard ? '真实设备输入' : '真实原始输入 · 非标准布局' : '等待设备';
    $('left-readout-label').textContent = real && !standard ? '原始轴 0 / 1' : '左摇杆';
    $('right-readout-label').textContent = real && !standard ? '原始轴 2 / 3' : '右摇杆';
    $('simulation-controls').hidden = !simulated;
    $('start-calibration').disabled = !real || !standard || Boolean(measurement) || connectedPad.axes.length < 4;
    $('start-calibration').textContent = measurement ? '正在测量…' : '测量静止漂移';
  }
  const clamp = (value, min = -1, max = 1) => Math.max(min, Math.min(max, Number.isFinite(value) ? value : 0));
  function renderInput() {
    const [lx, ly, rx, ry] = rawInput.axes;
    const standard = mode !== 'real' || connectedPad?.mapping === 'standard';
    $('left-value').innerHTML = `${lx.toFixed(2)} <small>/</small> ${ly.toFixed(2)}`;
    $('right-value').innerHTML = `${rx.toFixed(2)} <small>/</small> ${ry.toFixed(2)}`;
    $('left-track').style.width = `${Math.min(1, Math.hypot(lx, ly)) * 100}%`;
    $('right-track').style.width = `${Math.min(1, Math.hypot(rx, ry)) * 100}%`;
    const lt = standard ? rawInput.buttons[6] || 0 : 0;
    const rt = standard ? rawInput.buttons[7] || 0 : 0;
    $('trigger-value').innerHTML = standard ? `${Math.round(lt * 100)}% <small>/</small> ${Math.round(rt * 100)}%` : '—';
    $('trigger-track').style.width = `${Math.max(lt, rt) * 100}%`;
    const pressed = rawInput.buttons.flatMap((value, index) => value > .5 ? [index] : []);
    const buttonKeys = ['south', 'east', 'west', 'north', 'lb', 'rb', 'lt', 'rt', 'select', 'start'];
    $('button-value').textContent = pressed.length ? pressed.map((index) => standard ? labels[draft.layout][buttonKeys[index]] || `#${index}` : `#${index}`).slice(0, 3).join(' + ') : '—';
    $('button-detail').textContent = pressed.length ? `${pressed.length} 个按钮按下` : '松开即归零';
    for (const element of document.querySelectorAll('[data-button-index]')) element.classList.toggle('pressed', standard && pressed.includes(Number(element.dataset.buttonIndex)));
    $('left-stick-dot').setAttribute('transform', standard ? `translate(${lx * 9} ${ly * 9})` : 'translate(0 0)');
    $('right-stick-dot').setAttribute('transform', standard ? `translate(${rx * 9} ${ry * 9})` : 'translate(0 0)');
    for (const [side, x, y] of [['left', lx, ly], ['right', rx, ry]]) {
      $(`${side}-plot-dot`).style.left = `${50 + x * 50}%`;
      $(`${side}-plot-dot`).style.top = `${50 + y * 50}%`;
      const magnitude = Math.min(1, Math.hypot(x, y));
      const deadzone = draft.deadzones[side] / 100;
      const output = Math.max(0, (magnitude - deadzone) / (1 - deadzone));
      $(`cal-${side}-raw`).textContent = magnitude.toFixed(2);
      $(`cal-${side}-output`).textContent = output.toFixed(2);
    }
  }
  $('start-calibration').addEventListener('click', () => {
    if (mode !== 'real' || !connectedPad || connectedPad.mapping !== 'standard' || connectedPad.axes.length < 4) return;
    recommendation = null; measurement = { start: performance.now(), left: 0, right: 0, samples: 0, index: connectedPad.index };
    $('cancel-calibration').hidden = false; $('apply-calibration').hidden = true;
    $('calibration-result').textContent = '请松开两个摇杆并保持静止，测量约 3 秒。'; renderDevice();
  });
  $('cancel-calibration').addEventListener('click', () => { cancelMeasurement('已取消测量，原有设置不变。'); renderDevice(); });
  $('apply-calibration').addEventListener('click', () => {
    if (!recommendation) return;
    draft.deadzones = clone(recommendation); recommendation = null; $('apply-calibration').hidden = true;
    $('calibration-result').textContent = '建议值已放入草稿，保存后保留。'; renderDeadzones(); updateSaveState();
  });
  function tick(now) {
    pollRealDevice();
    if (mode === 'simulation') {
      const axes = [...simAxes]; const buttons = simButtons.map((value) => value ? 1 : 0);
      if (keyboardKeys.has('ArrowLeft') || keyboardKeys.has('ArrowRight')) axes[0] = (keyboardKeys.has('ArrowRight') ? 1 : 0) - (keyboardKeys.has('ArrowLeft') ? 1 : 0);
      if (keyboardKeys.has('ArrowUp') || keyboardKeys.has('ArrowDown')) axes[1] = (keyboardKeys.has('ArrowDown') ? 1 : 0) - (keyboardKeys.has('ArrowUp') ? 1 : 0);
      if (keyboardKeys.has('j')) buttons[0] = 1;
      if (keyboardKeys.has('k')) buttons[1] = 1;
      rawInput = { axes, buttons };
    } else if (mode === 'real' && connectedPad) rawInput = { axes: [0, 1, 2, 3].map((index) => clamp(connectedPad.axes[index])), buttons: connectedPad.buttons.map((button) => clamp(button.value, 0, 1)) };
    else rawInput = { axes: [0, 0, 0, 0], buttons: [] };
    if (measurement) {
      measurement.samples += 1;
      measurement.left = Math.max(measurement.left, Math.hypot(...rawInput.axes.slice(0, 2)));
      measurement.right = Math.max(measurement.right, Math.hypot(...rawInput.axes.slice(2, 4)));
      if (now - measurement.start >= 3000) {
        const complete = measurement; measurement = null; $('cancel-calibration').hidden = true;
        if (complete.samples < 30 || complete.left > .35 || complete.right > .35) {
          $('calibration-result').textContent = '偏移过大或样本不足。请松开摇杆，重新测量。';
        } else {
          recommendation = { left: Math.min(40, Math.max(5, Math.ceil(complete.left * 100) + 3)), right: Math.min(40, Math.max(5, Math.ceil(complete.right * 100) + 3)) };
          $('calibration-result').textContent = `建议左摇杆 ${recommendation.left}%，右摇杆 ${recommendation.right}%。尚未修改设置。`;
          $('apply-calibration').hidden = false;
        }
        lastDeviceStamp = '';
      }
    }
    renderDevice(); renderInput(); requestAnimationFrame(tick);
  }
  renderAll(); renderDevice(); requestAnimationFrame(tick);
})();
