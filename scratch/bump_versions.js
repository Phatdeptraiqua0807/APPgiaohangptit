const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

html = html.replace(/href="css\/style\.css\?v=[^"]*"/g, 'href="css/style.css?v=6.8"');
html = html.replace(/src="js\/app\.js\?v=[^"]*"/g, 'src="js/app.js?v=6.0"');
html = html.replace(/src="js\/catalog-profile\.js\?v=[^"]*"/g, 'src="js/catalog-profile.js?v=4.3"');

fs.writeFileSync('index.html', html, 'utf8');
console.log('Bumped cache busters: style.css?v=6.8, app.js?v=6.0, catalog-profile.js?v=4.3');
