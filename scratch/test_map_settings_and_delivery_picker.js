const fs = require('fs');
const assert = require('assert');

console.log('--- RUNNING MAP SERVICE & DELIVERY PICKER TEST ---');

// 1. Mock minimal DOM and browser environment
const localStorageStore = {};
global.localStorage = {
  getItem: (k) => localStorageStore[k] || null,
  setItem: (k, v) => { localStorageStore[k] = String(v); },
  removeItem: (k) => { delete localStorageStore[k]; }
};

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
    this.type = 'text';
    this.dataset = {};
  }
  setAttribute(k, v) { this.attrs[k] = v; }
  getAttribute(k) { return this.attrs[k]; }
  appendChild() {}
  removeChild() {}
  remove() {}
  focus() {}
  scrollIntoView() {}
  querySelector(sel) {
    if (sel.includes('.radio-dot')) return new ElementMock('radio-dot');
    return null;
  }
  querySelectorAll() { return []; }
}

const elements = new Map();
function getOrCreate(id, tag = 'div') {
  if (!elements.has(id)) elements.set(id, new ElementMock(id, tag));
  return elements.get(id);
}

global.document = {
  documentElement: { scrollTop: 0 },
  body: new ElementMock('body', 'body'),
  head: { appendChild: () => {} },
  createElement: (tag) => new ElementMock('', tag),
  addEventListener: () => {},
  removeEventListener: () => {},
  getElementById: (id) => getOrCreate(id),
  querySelector: (sel) => {
    if (sel === '#modal-bottom-sheet') return getOrCreate('modal-bottom-sheet');
    if (sel === '#modal-overlay') return getOrCreate('modal-overlay');
    return null;
  },
  querySelectorAll: () => []
};

global.window = {
  scrollY: 0,
  innerWidth: 1024,
  addEventListener: () => {},
  scrollTo: () => {}
};
global.requestAnimationFrame = (fn) => fn();

// Load fluent icons & food data & db
const iconsJs = fs.readFileSync('js/fluent-icons.js', 'utf8');
eval(iconsJs.replace('const FluentIcons =', 'global.FluentIcons ='));

const foodDataJs = fs.readFileSync('js/food-data.js', 'utf8');
eval(foodDataJs.replace(/const\s+/g, 'var '));

// Load app.js
const appJs = fs.readFileSync('js/app.js', 'utf8');
eval(appJs.replace(/let currentView = 'home';/, 'var currentView = \'home\';').replace(/window\.addEventListener\([^)]+\);?/g, ''));
global.MapService = window.MapService;

// Load catalog-profile.js
const profileJs = fs.readFileSync('js/catalog-profile.js', 'utf8');
eval(profileJs);

// ── TEST 1: MapService Configuration ──
console.log('Testing MapService...');
assert(typeof MapService !== 'undefined', 'MapService must be defined');
const initialConfig = MapService.getConfig();
assert.strictEqual(initialConfig.provider, 'osm', 'Default map provider is OpenStreetMap');

MapService.saveConfig({ provider: 'google', googleApiKey: 'AIzaSyTest_12345' });
const updatedConfig = MapService.getConfig();
assert.strictEqual(updatedConfig.provider, 'google', 'Provider updated to google');
assert.strictEqual(updatedConfig.googleApiKey, 'AIzaSyTest_12345', 'Google API Key saved');
assert.strictEqual(MapService.isGoogleMapsActive(), true, 'isGoogleMapsActive returns true');

// Reset to OSM for next tests
MapService.saveConfig({ provider: 'osm' });
assert.strictEqual(MapService.isGoogleMapsActive(), false, 'isGoogleMapsActive returns false for OSM');
console.log('✅ 1. MapService storage, getter and setter work properly');

// ── TEST 2: Delivery Modal Map Picker Default Hidden & Toggle ──
console.log('Testing Delivery Modal map picker...');
const sheet = getOrCreate('modal-bottom-sheet');
const overlay = getOrCreate('modal-overlay');

openDeliveryInfoModal();
assert(sheet.innerHTML.includes('id="delivery-map-picker-card"'), 'Map picker card exists in modal markup');
assert(sheet.innerHTML.includes('style="display: none;"'), 'Map picker card is HIDDEN by default');
assert(sheet.innerHTML.includes('id="delivery-toggle-map-btn"'), 'Toggle map button exists');
assert(sheet.innerHTML.includes('id="delivery-detect-gps-btn"'), 'Detect GPS button exists');

const mapCard = getOrCreate('delivery-map-picker-card');
mapCard.style.display = 'none';
const toggleBtn = getOrCreate('delivery-toggle-map-btn');

// Toggle open
toggleDeliveryMapPicker(true);
assert.strictEqual(mapCard.style.display, 'flex', 'Map picker card displays when toggled open');
assert(toggleBtn.classList.contains('active'), 'Toggle button becomes active');

// Toggle close
toggleDeliveryMapPicker(false);
assert.strictEqual(mapCard.style.display, 'none', 'Map picker card hides when toggled closed');
assert(!toggleBtn.classList.contains('active'), 'Toggle button is not active when closed');
console.log('✅ 2. Delivery modal map picker starts hidden and toggles correctly');

// ── TEST 3: GPS Location Detection & Geocoding Fallback ──
console.log('Testing GPS location detection...');
global.navigator = {
  geolocation: {
    getCurrentPosition: (success) => {
      // Mock PTIT GPS coords
      success({
        coords: {
          latitude: 20.9806,
          longitude: 105.7878,
          accuracy: 10
        }
      });
    }
  }
};

let receivedLoc = null;
detectCurrentLocation((loc) => {
  receivedLoc = loc;
});

assert(receivedLoc, 'Location callback was triggered');
assert.strictEqual(receivedLoc.latitude, 20.9806, 'Latitude matched');
assert.strictEqual(receivedLoc.longitude, 105.7878, 'Longitude matched');
assert(receivedLoc.address.includes('Học viện Công nghệ Bưu chính Viễn thông (PTIT)'), 'Identified PTIT campus accurately');

// Test autoDetectDeliveryAddress
const addrInput = getOrCreate('delivery-input-address');
autoDetectDeliveryAddress();
assert(addrInput.value.includes('PTIT'), 'Delivery input address updated with detected location');
console.log('✅ 3. Geolocation detection and PTIT smart recognition work properly');

// ── TEST 4: Profile View Map API Settings ──
console.log('Testing Profile View Map Settings markup & logic...');
assert(typeof renderProfileMapSettingsCard === 'function', 'renderProfileMapSettingsCard function exists');
const profileHtml = renderProfileMapSettingsCard();
assert(profileHtml.includes('id="profile-map-settings-card"'), 'Settings card rendered');
assert(profileHtml.includes('id="provider-card-osm"'), 'OpenStreetMap provider card rendered');
assert(profileHtml.includes('id="provider-card-google"'), 'Google Maps provider card rendered');
assert(profileHtml.includes('id="profile-google-api-key"'), 'Google API Key input rendered');
assert(profileHtml.includes('btn-test-api'), 'Test API connection button rendered');
assert(profileHtml.includes('btn-save-map-cfg'), 'Save settings button rendered');

// Test API Key visibility toggle
const keyInput = getOrCreate('profile-google-api-key');
keyInput.type = 'password';
toggleProfileApiKeyVisibility();
assert.strictEqual(keyInput.type, 'text', 'API Key visibility toggled to text');
toggleProfileApiKeyVisibility();
assert.strictEqual(keyInput.type, 'password', 'API Key visibility toggled back to password');

// Test save settings from Profile
const googleCard = getOrCreate('provider-card-google');
googleCard.classList.add('active');
keyInput.value = 'AIzaSyGoogleKeyValid_999';
saveProfileMapSettings();

const finalConfig = MapService.getConfig();
assert.strictEqual(finalConfig.provider, 'google', 'Provider saved as google');
assert.strictEqual(finalConfig.googleApiKey, 'AIzaSyGoogleKeyValid_999', 'Key saved');

console.log('✅ 4. Profile View Map API settings card and controls work properly');
console.log('🎉 ALL TESTS PASSED SUCCESSFULLY!');
