const fs = require('fs');
const path = require('path');

// Charger le template
const templatePath = path.join(__dirname, 'chatbot-navigation-standalone.html');
const template = fs.readFileSync(templatePath, 'utf-8');

// Charger les chunks
const chunksPath = path.join(__dirname, 'data', 'chunks-with-links.json');
const chunksData = fs.readFileSync(chunksPath, 'utf-8');

// Remplacer le placeholder
const output = template.replace(
    '/* CHUNKS_PLACEHOLDER */',
    `const chunksData = ${chunksData};`
);

// Écrire le fichier final
const outputPath = path.join(__dirname, 'chatbot-navigation-all-in-one.html');
fs.writeFileSync(outputPath, output, 'utf-8');

// Calculer la taille
const stats = fs.statSync(outputPath);
const sizeKB = (stats.size / 1024).toFixed(1);

console.log(`✅ Chatbot généré : chatbot-navigation-all-in-one.html (${sizeKB} Ko)`);

// Compter les chunks
const chunks = JSON.parse(chunksData).chunks;
console.log(`📊 ${chunks.length} chunks intégrés`);

// Compter les liens
let totalLinks = 0;
chunks.forEach(chunk => {
    if (chunk.related_links) {
        totalLinks += chunk.related_links.length;
    }
});
console.log(`🔗 ${totalLinks} liens de navigation`);
