const fs = require('fs');
const assert = require('assert');

console.log('--- TEST MODAL OVERLAY STATIC BACKDROP ---');

// Mock DOM environment
const elements = {};
function createMockElement(id, tag = 'div', classes = []) {
  const classList = new Set(classes);
  const listeners = {};
  const el = {
    id,
    tagName: tag.toUpperCase(),
    offsetWidth: 100,
    classList: {
      add: (cls) => classList.add(cls),
      remove: (cls) => classList.delete(cls),
      contains: (cls) => classList.has(cls),
      get size() { return classList.size; }
    },
    innerHTML: '',
    children: [],
    querySelector: (sel) => {
      if (sel.includes('dish-modal-close-btn') || sel.includes('filter-sheet-close-btn') || sel.includes('close-btn')) {
        return createMockElement(id + '-btn', 'button', ['dish-modal-close-btn', 'filter-sheet-close-btn']);
      }
      return null;
    }
  };
  elements[id] = el;
  return el;
}

const mockOverlay = createMockElement('modal-overlay', 'div');
const mockSheet = createMockElement('modal-bottom-sheet', 'div');
const mockFilterOverlay = createMockElement('search-filter-overlay', 'div');
const mockFilterSheet = createMockElement('search-filter-bottom-sheet', 'div');

global.document = {
  getElementById: (id) => elements[id] || null
};

// Read functions from js/app.js
const appJs = fs.readFileSync('js/app.js', 'utf8');

// Extract functions
const fnRegex1 = /function closeModal\(\) \{[\s\S]*?\n\}/;
const fnRegex2 = /function closeModalOnBackdrop\(event\) \{[\s\S]*?\n\}/;
const fnRegex3 = /function closeSearchFilterModal\(\) \{[\s\S]*?\n\}/;
const fnRegex4 = /function closeSearchFilterModalOnBackdrop\(e\) \{[\s\S]*?\n\}/;

assert(fnRegex1.test(appJs), 'closeModal should exist in js/app.js');
assert(fnRegex2.test(appJs), 'closeModalOnBackdrop should exist in js/app.js');
assert(fnRegex3.test(appJs), 'closeSearchFilterModal should exist in js/app.js');
assert(fnRegex4.test(appJs), 'closeSearchFilterModalOnBackdrop should exist in js/app.js');

eval(appJs.match(fnRegex1)[0]);
eval(appJs.match(fnRegex2)[0]);
eval(appJs.match(fnRegex3)[0]);
eval(appJs.match(fnRegex4)[0]);

// Test 1: Open modal-overlay
mockOverlay.classList.add('active');
assert.strictEqual(mockOverlay.classList.contains('active'), true, 'Modal should be active');

// Test 2: Click on backdrop of modal-overlay (outside bottom-sheet)
const mockEvent1 = {
  target: mockOverlay,
  currentTarget: mockOverlay
};
closeModalOnBackdrop(mockEvent1);

// Assert modal-overlay is STILL active! (Did not exit)
assert.strictEqual(mockOverlay.classList.contains('active'), true, 'Modal overlay MUST stay active when clicking outside');
// Assert shake prompt animation class applied
assert.strictEqual(mockSheet.classList.contains('modal-shake-prompt'), true, 'modal-bottom-sheet must receive modal-shake-prompt');

console.log('✓ Test 1 Passed: modal-overlay remains active on backdrop click with shake feedback');

// Test 3: Explicit closeModal() call MUST dismiss the modal
closeModal();
assert.strictEqual(mockOverlay.classList.contains('active'), false, 'Explicit closeModal() must close the modal');
console.log('✓ Test 2 Passed: Explicit closeModal() successfully closes modal');

// Test 4: Search filter overlay backdrop click
mockFilterOverlay.classList.add('active');
assert.strictEqual(mockFilterOverlay.classList.contains('active'), true, 'Search filter should be active');

const mockEvent2 = {
  target: mockFilterOverlay,
  currentTarget: mockFilterOverlay
};
closeSearchFilterModalOnBackdrop(mockEvent2);

assert.strictEqual(mockFilterOverlay.classList.contains('active'), true, 'Search filter overlay MUST stay active when clicking outside');
assert.strictEqual(mockFilterSheet.classList.contains('modal-shake-prompt'), true, 'search-filter-bottom-sheet must receive modal-shake-prompt');
console.log('✓ Test 3 Passed: search-filter-overlay remains active on backdrop click with shake feedback');

// Test 5: Explicit closeSearchFilterModal()
closeSearchFilterModal();
assert.strictEqual(mockFilterOverlay.classList.contains('active'), false, 'Explicit closeSearchFilterModal() must close search filter');
console.log('✓ Test 4 Passed: Explicit closeSearchFilterModal() successfully closes modal');

// Test 6: CSS animation rules exist in css/style.css
const css = fs.readFileSync('css/style.css', 'utf8');
assert(css.includes('@keyframes modalShakePrompt'), 'css must define @keyframes modalShakePrompt');
assert(css.includes('.bottom-sheet.modal-shake-prompt'), 'css must define .bottom-sheet.modal-shake-prompt');
assert(css.includes('@keyframes closeBtnNudge'), 'css must define @keyframes closeBtnNudge');
assert(css.includes('.close-btn-nudge'), 'css must define .close-btn-nudge');
console.log('✓ Test 5 Passed: CSS keyframe animations and prompt classes exist and verified');

console.log('ALL TESTS PASSED SUCCESSFULLY! (5/5)');

