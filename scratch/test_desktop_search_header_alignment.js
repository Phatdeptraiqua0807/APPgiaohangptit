const fs = require('fs');
const assert = require('assert');

console.log('--- RUNNING DESKTOP SEARCH HEADER ALIGNMENT & COLOR TEST ---');

const css = fs.readFileSync('css/style.css', 'utf8');

// Find desktop media query
const desktopMediaMatch = css.match(/@media\s*\(\s*min-width\s*:\s*768px\s*\)\s*\{([\s\S]*)/);
assert(desktopMediaMatch, 'Desktop media query found');
const desktopCss = desktopMediaMatch[1];

// Find .search-view-header inside desktop
const headerMatch = desktopCss.match(/\.search-view-header\s*\{([^}]+)\}/);
assert(headerMatch, '.search-view-header rule found in desktop query');
const headerCss = headerMatch[1];

console.log('Desktop header CSS properties:\n', headerCss.trim());

// Assertions for alignment
assert(headerCss.includes('margin: 0 !important;'), 'Margin must be 0 !important (no margin-left skewing it to the right)');
assert(headerCss.includes('width: 100% !important;'), 'Width must be 100% !important');
assert(headerCss.includes('box-sizing: border-box !important;'), 'Box-sizing must be border-box !important');
assert(headerCss.includes('padding: 16px var(--safe-padding) 14px !important;'), 'Padding must use var(--safe-padding) aligning with surrounding sections');

// Assertions for background color
assert(headerCss.includes('background: var(--white) !important;'), 'Background must be var(--white) !important to match .app and sections');
assert(!headerCss.includes('background: transparent !important;'), 'Must not have transparent background showing gray-50 underneath');

// Assertions for flat natural appearance
assert(headerCss.includes('box-shadow: none !important;'), 'Must have box-shadow: none !important');
assert(headerCss.includes('border-radius: 0 !important;'), 'Must have border-radius: 0 !important');

console.log('✅ All desktop alignment & color checks passed!');

