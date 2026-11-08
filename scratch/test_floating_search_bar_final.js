const fs = require('fs');
const assert = require('assert');

console.log('--- RUNNING FLOATING SEARCH BAR VERIFICATION ---');

// 1. Check index.html
const html = fs.readFileSync('index.html', 'utf8');
assert(html.includes('id="floating-search-bar"'), 'floating-search-bar element exists in index.html');
assert(html.includes('id="floating-search-inner"'), 'floating-search-inner element exists in index.html');
console.log('✅ 1. index.html contains floating-search-bar markup');

// 2. Check css/style.css
const css = fs.readFileSync('css/style.css', 'utf8');
let depth = 0;
for (let char of css) {
  if (char === '{') depth++;
  else if (char === '}') depth--;
}
assert.strictEqual(depth, 0, 'CSS braces must be balanced');

assert(css.includes('.search-view-header {'), 'search-view-header rule exists');
assert(css.includes('background: transparent !important;'), 'search-view-header has transparent background');
assert(css.includes('box-shadow: none !important;'), 'search-view-header has no box-shadow');
assert(css.includes('border: none !important;'), 'search-view-header has no border');
assert(css.includes('.floating-search-bar {'), 'floating-search-bar rule exists');
assert(css.includes('.floating-search-bar.visible {'), 'floating-search-bar.visible rule exists');
assert(css.includes('calc(var(--sidebar-width, 270px) + 24px)'), 'Desktop offset for floating search bar exists');
console.log('✅ 2. css/style.css correctly styles flat in-page search header and floating pill search bar');

// 3. Check js/app.js syntax & logic
const appJs = fs.readFileSync('js/app.js', 'utf8');
assert(appJs.includes('function initFloatingSearchBar()'), 'initFloatingSearchBar exists');
assert(appJs.includes('function onFloatingSearchInputChange('), 'onFloatingSearchInputChange exists');
assert(appJs.includes('floatingSearchBar.classList.add(\'visible\');'), 'Toggles visible class');
assert(appJs.includes('floatingSearchBar.classList.remove(\'visible\');'), 'Removes visible class');
console.log('✅ 3. js/app.js contains floating search bar initialization and sync methods');

// 4. Lightweight mock DOM simulation
class ClassList {
  constructor() { this.classes = new Set(); }
  add(c) { this.classes.add(c); }
  remove(c) { this.classes.delete(c); }
  contains(c) { return this.classes.has(c); }
  toggle(c, force) {
    if (force !== undefined) {
      if (force) this.classes.add(c);
      else this.classes.delete(c);
    } else {
      if (this.classes.has(c)) this.classes.delete(c);
      else this.classes.add(c);
    }
  }
}

class ElementMock {
  constructor(id = '', tag = 'div') {
    this.id = id;
    this.tagName = tag.toUpperCase();
    this.classList = new ClassList();
    this.style = {};
    this.attrs = {};
    this.innerHTML = '';
    this.value = '';
    this.dataset = {};
  }
  setAttribute(k, v) { this.attrs[k] = v; }
  getAttribute(k) { return this.attrs[k]; }
  focus() {}
  setSelectionRange() {}
}

const elements = new Map();
function getOrCreate(id, tag = 'div') {
  if (!elements.has(id)) elements.set(id, new ElementMock(id, tag));
  return elements.get(id);
}

const floatingSearchBar = getOrCreate('floating-search-bar');
const floatingSearchInner = getOrCreate('floating-search-inner');
const inPageSearchHeaderMock = getOrCreate('in-page-search-header');

let inPageHeaderActive = true;

global.requestAnimationFrame = (fn) => fn();

global.window = {
  scrollY: 0,
  innerWidth: 1024,
  addEventListener: () => {},
  scrollTo: () => {}
};

global.document = {
  documentElement: { scrollTop: 0 },
  body: new ElementMock('body', 'body'),
  addEventListener: () => {},
  removeEventListener: () => {},
  getElementById: (id) => {
    if (elements.has(id)) return elements.get(id);
    const el = new ElementMock(id);
    elements.set(id, el);
    return el;
  },
  querySelector: (sel) => {
    if (sel === '.search-view-header') return inPageHeaderActive ? inPageSearchHeaderMock : null;
    if (sel === '.page-nav-header') return null;
    if (sel === '.dbm-bulk-bar.active') return null;
    if (sel === '.search-view-header .search-clear-btn') return getOrCreate('in-page-clear-btn');
    if (sel === '.bottom-nav') return getOrCreate('bottom-nav');
    return null;
  },
  querySelectorAll: () => []
};

// Load icons & food data
const iconsJs = fs.readFileSync('js/fluent-icons.js', 'utf8');
eval(iconsJs.replace('const FluentIcons =', 'global.FluentIcons ='));
const foodDataJs = fs.readFileSync('js/food-data.js', 'utf8');
eval(foodDataJs.replace(/const\s+/g, 'var '));
global.restaurants = typeof restaurants !== 'undefined' ? restaurants : [];
global.visualSuggestions = typeof visualSuggestions !== 'undefined' ? visualSuggestions : [];
global.foodCategories = typeof foodCategories !== 'undefined' ? foodCategories : [];
global.quickSearchCats = typeof quickSearchCats !== 'undefined' ? quickSearchCats : [];
global.quickOptions = typeof quickOptions !== 'undefined' ? quickOptions : [];
global.promoBanners = typeof promoBanners !== 'undefined' ? promoBanners : [];

// Evaluate app.js safely, making top-level state variables global
let sanitizedAppJs = appJs
  .replace(/let currentView = 'home';/, 'var currentView = \'home\';')
  .replace(/let searchQuery = '';/, 'var searchQuery = \'\';')
  .replace(/window\.addEventListener\([^)]+\);?/g, '');
eval(sanitizedAppJs);

// Test in search view at scrollY = 0
currentView = 'search';
searchQuery = '';
window.scrollY = 0;
inPageHeaderActive = true;
updateFloatingTopBar();

assert(!floatingSearchBar.classList.contains('visible'), 'Floating search bar is HIDDEN when scrollY <= 45');

// Test scrolling down to scrollY = 100
window.scrollY = 100;
updateFloatingTopBar();
assert(floatingSearchBar.classList.contains('visible'), 'Floating search bar is VISIBLE when scrollY > 45 in search view');

// Test typing in floating search bar
const inPageInput = getOrCreate('search-view-input');
const floatingInput = getOrCreate('floating-search-input');

onFloatingSearchInputChange('phở bò tái');
assert.strictEqual(searchQuery, 'phở bò tái', 'searchQuery updated to "phở bò tái"');
assert.strictEqual(inPageInput.value, 'phở bò tái', 'In-page input received synced value');

// Test typing in in-page search input
onSearchInputChange('bánh mì pate');
assert.strictEqual(searchQuery, 'bánh mì pate', 'searchQuery updated to "bánh mì pate"');
assert.strictEqual(floatingInput.value, 'bánh mì pate', 'Floating input received synced value');

// Test clearing search
clearSearch();
assert.strictEqual(searchQuery, '', 'searchQuery cleared to empty');
assert.strictEqual(floatingInput.value, '', 'Floating input cleared');
assert.strictEqual(inPageInput.value, '', 'In-page input cleared');

// Test switching back to home view
openHomeView();
inPageHeaderActive = false;
window.scrollY = 120;
updateFloatingTopBar();
assert(!floatingSearchBar.classList.contains('visible'), 'Floating search bar is HIDDEN in home view even when scrolled');

console.log('✅ 4. Scroll behavior, bidirectional input sync, and view switching tests passed successfully!');
console.log('🎉 ALL TESTS PASSED!');
