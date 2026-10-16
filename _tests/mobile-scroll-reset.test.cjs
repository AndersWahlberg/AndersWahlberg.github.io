// Lifecycle regression tests; these do not automate a native mobile browser.
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = resolve(__dirname, '..');
const include = readFileSync(resolve(root, '_includes/mobile-scroll-reset.html'), 'utf8');
const script = include.match(/<script>\s*([\s\S]*?)<\/script>/)[1];
const fragments = ['#about', '#skills', '#portfolio', '#resume', '#contact', '#writing', '#custom-section'];

function harness({ width = 390, hash = '', bodyPresent = true, y = 1800,
  historySupported = true, legacyMedia = false, rootBehavior = ['', ''], bodyBehavior = ['', ''] } = {}) {
  let viewport = width;
  let clock = 0;
  let nextTimer = 0;
  let mode = 'auto';
  let styleWrites = 0;
  const timers = new Map();
  const calls = [];
  const historyWrites = [];
  const position = { x: 12, y, root: y, body: y };
  function events() {
    const listeners = new Map();
    return {
      addEventListener(name, callback) {
        if (!listeners.has(name)) listeners.set(name, []);
        listeners.get(name).push(callback);
      },
      fire(name, event = {}) {
        for (const callback of listeners.get(name) || []) callback(event);
      }
    };
  }
  function node(name, behavior) {
    const properties = new Map([['color', ['inherit', '']]]);
    if (behavior[0]) properties.set('scroll-behavior', [...behavior]);
    const style = {
      getPropertyValue(key) { return properties.get(key)?.[0] || ''; },
      getPropertyPriority(key) { return properties.get(key)?.[1] || ''; },
      setProperty(key, value, priority = '') { styleWrites++; properties.set(key, [value, priority]); },
      removeProperty(key) { styleWrites++; properties.delete(key); },
      snapshot() { return [...properties.entries()].map(([key, value]) => [key, [...value]]); }
    };
    return {
      style,
      get scrollTop() { return position[name]; },
      set scrollTop(value) {
        assert.equal(style.getPropertyValue('scroll-behavior'), 'auto');
        assert.equal(style.getPropertyPriority('scroll-behavior'), 'important');
        calls.push([name, value]);
        position[name] = value;
      }
    };
  }
  const html = node('root', rootBehavior);
  const body = node('body', bodyBehavior);
  const initialStyles = [html.style.snapshot(), body.style.snapshot()];
  const document = Object.assign(events(), { documentElement: html, body: bodyPresent ? body : null });
  const history = {};
  if (historySupported) Object.defineProperty(history, 'scrollRestoration', {
    get() { return mode; },
    set(value) { historyWrites.push(value); mode = value; }
  });
  const mediaEvents = events();
  const media = {
    get matches() { return viewport <= 760; },
    ...(legacyMedia ? { addListener(callback) { mediaEvents.addEventListener('change', callback); } }
      : { addEventListener: mediaEvents.addEventListener })
  };
  const window = Object.assign(events(), {
    history,
    location: { hash },
    matchMedia() { return media; },
    scrollTo(...args) {
      assert.deepEqual(args, [0, 0]);
      assert.equal(html.style.getPropertyValue('scroll-behavior'), 'auto');
      assert.equal(html.style.getPropertyPriority('scroll-behavior'), 'important');
      calls.push(['window', ...args]);
      [position.x, position.y] = args;
    },
    setTimeout(callback, delay) { const id = ++nextTimer; timers.set(id, { callback, at: clock + delay }); return id; },
    clearTimeout(id) { timers.delete(id); }
  });
  vm.runInNewContext(script, { window, document, history });
  return {
    window, document, history, calls, historyWrites, position, initialStyles,
    get timerCount() { return timers.size; },
    get styleWrites() { return styleWrites; },
    attachBody() { document.body = body; },
    restore(value) { Object.assign(position, { x: 12, y: value, root: value, body: value }); },
    resize(value) { viewport = value; mediaEvents.fire('change'); },
    advance(milliseconds) {
      const end = clock + milliseconds;
      while (true) {
        const next = [...timers.entries()].sort((a, b) => a[1].at - b[1].at)[0];
        if (!next || next[1].at > end) break;
        timers.delete(next[0]);
        clock = next[1].at;
        next[1].callback();
      }
      clock = end;
    },
    assertTop() {
      assert.equal(position.x, 0);
      assert.equal(position.y, 0);
      assert.equal(position.root, 0);
      if (document.body) assert.equal(position.body, 0);
    },
    assertStylesRestored() { assert.deepEqual([html.style.snapshot(), body.style.snapshot()], initialStyles); }
  };
}

for (const homepage of ['index.html', 'fi/index.html']) {
  test(`${homepage}: uses the shared controller in the document head`, () => {
    const page = readFileSync(resolve(root, homepage), 'utf8');
    assert.equal(page.split('{% include mobile-scroll-reset.html %}').length - 1, 1);
    assert.ok(page.indexOf('{% include mobile-scroll-reset.html %}') < page.indexOf('</head>'));
    assert.ok(!page.includes('Start mobile visits at the hero'));
  });

  for (const width of [320, 390, 430, 760]) {
    const label = `${homepage} ${width}px`;
    test(`${label}: fresh open and DOM ready reset all available scrolling elements`, () => {
      const h = harness({ width, bodyPresent: false });
      h.assertTop();
      assert.equal(h.history.scrollRestoration, 'manual');
      assert.deepEqual(h.calls, [['window', 0, 0], ['root', 0]]);
      h.attachBody();
      h.restore(2300);
      h.document.fire('DOMContentLoaded');
      h.assertTop();
      assert.deepEqual(h.calls.slice(-3), [['window', 0, 0], ['root', 0], ['body', 0]]);
      h.assertStylesRestored();
    });
    test(`${label}: reload and a reopened session counter restoration through load and delayed passes`, () => {
      for (const previousPosition of [1700, 4200]) {
        const h = harness({ width, y: previousPosition });
        h.assertTop();
        for (const event of ['load', 'pageshow']) {
          h.restore(previousPosition);
          h.window.fire(event);
          h.assertTop();
          assert.equal(h.timerCount, 2);
        }
        h.restore(previousPosition);
        h.advance(100);
        h.assertTop();
        h.restore(previousPosition);
        h.advance(250);
        h.assertTop();
        assert.equal(h.timerCount, 0);
        h.assertStylesRestored();
      }
    });
    test(`${label}: Back/BFCache pageshow retries even when load does not run again`, () => {
      const h = harness({ width });
      h.window.fire('load');
      h.restore(3100);
      h.window.fire('pagehide');
      assert.equal(h.timerCount, 0);
      h.advance(500);
      assert.equal(h.position.y, 3100);
      h.window.fire('pageshow', { persisted: true });
      h.assertTop();
      h.restore(3100);
      h.advance(100);
      h.assertTop();
      h.restore(3100);
      h.advance(250);
      h.assertTop();
    });
    test(`${label}: all explicit fragment URLs retain native scroll/restoration behaviour`, () => {
      for (const hash of fragments) {
        const h = harness({ width, hash });
        h.document.fire('DOMContentLoaded');
        h.window.fire('load');
        h.window.fire('pageshow', { persisted: true });
        h.advance(1000);
        assert.equal(h.position.y, 1800, hash);
        assert.deepEqual(h.calls, []);
        assert.deepEqual(h.historyWrites, []);
        assert.equal(h.styleWrites, 0);
        assert.equal(h.timerCount, 0);
      }
    });
    test(`${label}: a fragment opened while retries are pending is never reset`, () => {
      const h = harness({ width });
      h.window.fire('load');
      const count = h.calls.length;
      h.window.location.hash = '#portfolio';
      h.restore(2800);
      // A queued callback must recheck the hash even before hashchange is dispatched.
      h.advance(100);
      assert.equal(h.position.y, 2800);
      h.window.fire('hashchange');
      h.advance(1000);
      h.window.fire('pageshow');
      assert.equal(h.position.y, 2800);
      assert.equal(h.calls.length, count);
      assert.equal(h.history.scrollRestoration, 'auto');
      h.window.location.hash = '';
      h.window.fire('hashchange');
      h.assertTop();
      assert.equal(h.history.scrollRestoration, 'manual');
    });
  }
}

for (const width of [761, 1024, 1440]) {
  test(`${width}px desktop: no history, scrolling, style or delayed reset changes`, () => {
    const h = harness({ width });
    h.document.fire('DOMContentLoaded');
    h.window.fire('load');
    h.window.fire('pageshow', { persisted: true });
    h.advance(1000);
    assert.equal(h.position.y, 1800);
    assert.deepEqual(h.calls, []);
    assert.deepEqual(h.historyWrites, []);
    assert.equal(h.styleWrites, 0);
    assert.equal(h.timerCount, 0);
  });
}

test('leaving the mobile breakpoint cancels retries and restores the existing history mode', () => {
  for (const legacyMedia of [false, true]) {
    const h = harness({ width: 760, legacyMedia });
    h.window.fire('load');
    h.restore(2600);
    h.resize(761);
    h.advance(1000);
    assert.equal(h.position.y, 2600);
    assert.equal(h.history.scrollRestoration, 'auto');
    h.resize(760);
    assert.equal(h.position.y, 2600); // Resizing alone must not move the reader.
    assert.equal(h.history.scrollRestoration, 'manual');
  }
});

test('existing inline smooth-scrolling values and priorities are restored after every reset', () => {
  const h = harness({ rootBehavior: ['smooth', 'important'], bodyBehavior: ['smooth', ''] });
  h.assertTop();
  h.assertStylesRestored();
  h.window.fire('load');
  h.advance(350);
  h.assertStylesRestored();
});

test('browsers without the history restoration API still receive direct scroll resets', () => {
  const h = harness({ historySupported: false });
  h.assertTop();
  assert.ok(!('scrollRestoration' in h.history));
  h.restore(2000);
  h.window.fire('pageshow');
  h.assertTop();
});
