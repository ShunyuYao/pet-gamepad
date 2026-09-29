#!/usr/bin/env node
'use strict';

// Real Chromium keyboard pipeline + hidden Electron rendering. Gamepad samples below
// are explicitly test fixtures: this suite cannot prove physical DualSense support.
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');

if (!process.versions.electron) {
  const host = process.env.PET_HOST_DIR;
  if (!host) throw new Error('PET_HOST_DIR must point to the desktop-pet checkout with demo/node_modules/electron installed.');
  const electron = require(require.resolve('electron', { paths: [path.join(host, 'demo')] }));
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'pet-gamepad-prototype-e2e-'));
  const artifacts = process.env.PET_GAMEPAD_ARTIFACTS || path.join(root, 'prototype', 'artifacts');
  const environment = { ...process.env, PET_USERDATA_DIR: profile, PET_GAMEPAD_ARTIFACTS: artifacts };
  delete environment.ELECTRON_RUN_AS_NODE;
  fs.mkdirSync(artifacts, { recursive: true });
  try {
    for (const phase of ['interaction', 'persistence']) {
      const result = spawnSync(electron, [__filename, phase], { env: environment, encoding: 'utf8', timeout: 90000 });
      process.stdout.write(result.stdout || '');
      if (result.status !== 0) { process.stderr.write(result.stderr || ''); throw result.error || new Error(`Prototype ${phase} failed (${result.status})`); }
    }
    console.log(`PASS prototype E2E: hidden keyboard flows, fixture input, fresh-process persistence, screenshots: ${artifacts}`);
  } finally { fs.rmSync(profile, { recursive: true, force: true }); }
} else {
  const { app, BrowserWindow } = require('electron');
  app.setPath('userData', process.env.PET_USERDATA_DIR);
  app.commandLine.appendSwitch('disable-background-timer-throttling');
  app.commandLine.appendSwitch('disable-renderer-backgrounding');
  if (process.platform === 'darwin') app.dock.hide();
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  app.whenReady().then(async () => {
    const win = new BrowserWindow({ width: 1100, height: 820, show: false, webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false, backgroundThrottling: false } });
    const errors = [];
    win.webContents.on('console-message', (event) => { if (event.level === 'error') errors.push(event.message); });
    const debuggerAPI = win.webContents.debugger;
    debuggerAPI.attach('1.3');
    const command = (method, params) => debuggerAPI.sendCommand(method, params);
    const evaluate = async (expression) => {
      const result = await command('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
      return result.result.value;
    };
    const byId = (id) => `document.getElementById(${JSON.stringify(id)})`;
    const value = (id) => evaluate(`${byId(id)}.value`);
    const text = (id) => evaluate(`${byId(id)}.textContent`);
    const disabled = (id) => evaluate(`${byId(id)}.disabled`);
    let assertions = 0;
    const check = (condition, message) => { assertions += 1; assert.ok(condition, message); };
    async function key(keyName, down = true) {
      const codes = { Enter: 13, ' ': 32, ArrowRight: 39, ArrowLeft: 37, ArrowUp: 38, ArrowDown: 40, Home: 36, End: 35, Tab: 9, Escape: 27, j: 74, k: 75 };
      const code = keyName === ' ' ? 'Space' : keyName.length === 1 ? `Key${keyName.toUpperCase()}` : keyName;
      await command('Input.dispatchKeyEvent', { type: down ? 'keyDown' : 'keyUp', key: keyName, code, windowsVirtualKeyCode: codes[keyName], ...(down && keyName === 'Enter' ? { text: '\r', unmodifiedText: '\r' } : down && keyName.length === 1 ? { text: keyName } : {}) });
    }
    async function pressKey(keyName) { await key(keyName); await key(keyName, false); await sleep(50); }
    async function focus(id) { await evaluate(`${byId(id)}.focus({preventScroll:true})`); }
    async function activate(id) { await focus(id); await pressKey('Enter'); }
    async function navigation(page) { await evaluate(`document.querySelector('[data-page="${page}"]').focus({preventScroll:true})`); await pressKey('Enter'); }
    async function select(id, target) {
      const optionIndex = await evaluate(`Array.from(${byId(id)}.options).findIndex(option=>option.value===${JSON.stringify(target)})`);
      assert.ok(optionIndex >= 0, `missing option ${target}`);
      await focus(id);
      const optionText = await evaluate(`${byId(id)}.options[${optionIndex}].textContent`);
      for (const character of optionText) await command('Input.dispatchKeyEvent', {type:'char',text:character});
      await sleep(60);
      await pressKey('Tab');
      assert.equal(await value(id), target, `native select ${id}`);
    }
    async function screenshot(name) {
      await evaluate('document.activeElement?.blur()');
      if (await evaluate('!document.getElementById("toast").hidden')) await sleep(3900);
      await evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
      const image = await win.webContents.capturePage();
      check(!image.isEmpty(), `nonempty screenshot ${name}`);
      fs.writeFileSync(path.join(process.env.PET_GAMEPAD_ARTIFACTS, `${name}.png`), image.toPNG());
    }
    async function noOverflow(message) { check(await evaluate('document.documentElement.scrollWidth <= innerWidth && document.querySelector("main").scrollWidth <= document.querySelector("main").clientWidth'), message); }
    async function saveVisible() { check(await evaluate('document.getElementById("save").getBoundingClientRect().bottom <= innerHeight'), 'save button remains visible in viewport'); }
    try {
      await win.loadFile(path.join(root, 'prototype', 'index.html'));
      await command('Emulation.setFocusEmulationEnabled', { enabled: true });
      await evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
      check(!win.isVisible(), 'window never shown');
      await saveVisible();
      if (process.argv[2] === 'persistence') {
        await navigation('mapping');
        check(await value('mapping-0') === 'north', 'global mapping survived a fresh Electron process');
        check(await evaluate('document.getElementById("layout-xbox").getAttribute("aria-pressed")') === 'true', 'layout persisted');
        await select('profile', 'pet-kart');
        check(await evaluate('document.getElementById("game-override").checked'), 'per-game override persisted');
        check(await value('mapping-2') === 'west', 'per-game mapping persisted');
        await navigation('calibration');
        check(await value('deadzone-left') === '6', 'calibration persisted');
        check(await value('deadzone-right') === '6', 'right calibration persisted');
        check(await disabled('save'), 'fresh instance has no dirty draft');
        check(await text('connection-status') === '尚未连接', 'simulation and hardware claims not persisted');
      } else {
        check(await text('connection-status') === '尚未连接', 'initial state is honest disconnected state');
        check(await disabled('save'), 'no draft initially');
        await screenshot('connection-light');
        await activate('toggle-simulation');
        check(await text('connection-status') === '模拟连接', 'simulation explicitly marked');
        check((await text('device-kicker')).includes('非真实检测'), 'no fake hardware detection claim');
        await activate('sim-press'); await sleep(80);
        check((await text('button-value')).includes('×'), 'simulated button visible');
        await activate('sim-clear');
        check(await text('button-value') === '—', 'release neutral');
        await focus('sim-clear'); await key('ArrowRight'); await sleep(80);
        check((await text('left-value')).includes('1.00'), 'real Chromium keydown drives simulation');
        await key('ArrowRight', false); await sleep(80);
        check((await text('left-value')).replace(/\s+/g, '') === '0.00/0.00', 'keyup clears simulated movement');
        await activate('sim-stick'); await sleep(80);
        check((await text('left-value')).includes('0.72'), 'explicit simulated axis button');
        await screenshot('connection-simulation');
        await activate('toggle-simulation');
        check(await text('connection-status') === '尚未连接', 'leaving simulation disconnects');
        check((await text('left-value')).replace(/\s+/g, '') === '0.00/0.00', 'mode change clears axis');

        await navigation('mapping');
        await select('mapping-0', 'east');
        check(await disabled('save'), 'conflicting mapping blocks saving');
        check(await evaluate('!document.getElementById("mapping-conflict").hidden'), 'conflict message visible');
        await select('mapping-0', 'north');
        check(!await disabled('save'), 'resolving conflict enables saving');
        await activate('layout-xbox');
        check(await value('mapping-0') === 'north', 'layout change preserves physical binding');
        check((await evaluate('document.getElementById("mapping-0").selectedOptions[0].textContent')).startsWith('Y'), 'Xbox glyph labels updated');
        await select('profile', 'pet-kart');
        check(await disabled('mapping-0'), 'game default inherited until independent override');
        check(await value('mapping-0') === 'rt', 'kart recommendation is right trigger');
        await focus('game-override'); await pressKey(' ');
        check(!await disabled('mapping-2'), 'independent game mapping enabled');
        await select('mapping-2', 'west');
        await select('profile', 'gold-miner');
        check(await value('mapping-0') === 'south', 'other game mapping untouched');
        await select('profile', 'pet-kart');
        check(await value('mapping-2') === 'west', 'game draft retained across scope switches');
        await focus('game-override'); await pressKey(' ');
        check(await disabled('mapping-2'), 'disabling override returns to inherited controls');
        await focus('game-override'); await pressKey(' ');
        check(await value('mapping-2') === 'west', 'toggling independent mode preserves the draft');
        await activate('reset-mapping');
        check(await value('mapping-2') === 'rb', 'current scope reset uses game recommendation');
        await select('mapping-2', 'west');
        await select('profile', 'global');
        check(await value('mapping-0') === 'north', 'global draft retained');
        await screenshot('mapping-light');
        await activate('save');
        check(await disabled('save'), 'successful save clears dirty state');
        await select('mapping-0', 'south');
        await navigation('connection'); await navigation('mapping');
        check(await value('mapping-0') === 'south', 'tab navigation does not lose active draft');
        await activate('discard');
        check(await value('mapping-0') === 'north', 'discard restores saved mapping');

        await navigation('calibration');
        check(await disabled('start-calibration'), 'real measurement unavailable without actual device');
        await activate('simulate-drift'); await sleep(80);
        check((await text('calibration-result')).includes('模拟手柄'), 'drift demo marked simulation');
        check(Number(await text('cal-left-raw')) > 0, 'drift source visible');
        check(await text('cal-left-output') === '0.00', 'deadzone filters simulated drift');
        await focus('deadzone-left'); await pressKey('Home');
        check(await value('deadzone-left') === '0', 'native range keyboard changes deadzone');
        await sleep(80);
        check(Number(await text('cal-left-output')) > 0, 'deadzone adjustment changes output');
        await activate('reset-calibration');
        check(await value('deadzone-left') === '12', 'deadzone reset');
        await select('theme', 'dark');
        await screenshot('calibration-dark');
        await select('theme', 'light');

        // Fixture boundary starts here. No claim of physical device validation.
        await evaluate('window.__prototypeTestPads=[]; Object.defineProperty(navigator,"getGamepads",{configurable:true,value:()=>window.__prototypeTestPads})');
        await navigation('connection'); await activate('connect-real');
        check(await text('connection-status') === '等待手柄', 'real detector waits rather than fabricating device');
        await evaluate('window.__prototypeTestPads=[{id:"DualSense TEST FIXTURE",index:0,mapping:"standard",axes:[.02,.02,-.01,.02],buttons:Array.from({length:17},()=>({pressed:false,value:0}))}]');
        await sleep(150);
        check(await text('connection-status') === '已检测到手柄', 'fixture flows through navigator detector');
        await navigation('calibration');
        check(!await disabled('start-calibration'), 'standard device fixture enables measurement');
        await activate('start-calibration');
        await activate('cancel-calibration');
        check((await text('calibration-result')).includes('已取消'), 'calibration cancellation');
        await activate('start-calibration'); await sleep(3350);
        check((await text('calibration-result')).includes('建议左摇杆 6%'), 'measurement derives recommendation from samples');
        check(await value('deadzone-left') === '12', 'recommendation does not silently overwrite draft');
        await activate('apply-calibration');
        check(await value('deadzone-left') === '6', 'explicit apply updates draft');
        await activate('save');
        await activate('start-calibration');
        await evaluate('window.__prototypeTestPads=[]'); await sleep(100);
        check((await text('calibration-result')).includes('连接发生变化'), 'disconnect cancels calibration');
        check(await disabled('start-calibration'), 'disconnect disables further measurement');
        await navigation('connection'); await activate('stop-detection');
        await navigation('mapping'); await select('profile', 'pet-kart');
        win.setContentSize(390, 844); await sleep(100);
        await noOverflow('390px mapping has no horizontal overflow');
        await saveVisible();
        await screenshot('mapping-mobile');
        await navigation('calibration');
        await noOverflow('390px calibration has no horizontal overflow');
        await screenshot('calibration-mobile');
        await navigation('connection');
        await noOverflow('390px connection has no horizontal overflow');
        await screenshot('connection-mobile');
        check(errors.length === 0, `no renderer console errors: ${errors.join('; ')}`);
      }
      check(!win.isVisible(), 'test UI remained hidden');
      console.log(`PASS ${process.argv[2]}: ${assertions} assertions; Electron ${process.versions.electron}`);
      win.destroy(); app.exit(0);
    } catch (error) {
      try { await screenshot(`failure-${process.argv[2]}`); } catch { /* Keep original failure. */ }
      console.error(error.stack || error); win.destroy(); app.exit(1);
    }
  }).catch((error) => { console.error(error.stack || error); app.exit(1); });
}
