const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

html = html.replace(/href="css\/style\.css\?v=[^"]*"/g, 'href="css/style.css?v=6.7"');
html = html.replace(/src="js\/app\.js\?v=[^"]*"/g, 'src="js/app.js?v=5.9"');

fs.writeFileSync('index.html', html, 'utf8');
console.log('Updated cache busters in index.html: style.css?v=6.7, app.js?v=5.9');
