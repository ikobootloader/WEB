#!/usr/bin/env node

/**
 * Script de build complet du chatbot MDPH
 * Exécute toutes les étapes du workflow dans le bon ordre
 *
 * Usage: node build-all.js
 */

const { execSync } = require('child_process');
const path = require('path');

console.log('\n' + '='.repeat(80));
console.log('🚀 BUILD COMPLET DU CHATBOT MDPH');
console.log('='.repeat(80) + '\n');

const steps = [
    {
        name: 'Build HTML de base',
        script: 'build.js',
        description: 'Génération du fichier HTML avec les chunks JSON'
    },
    {
        name: 'Résolution contextuelle',
        script: 'scripts/enrich/add-contextual-resolution.js',
        description: 'Ajout du système de détection et résolution contextuelle'
    },
    {
        name: 'Corrections contextuelles',
        script: 'scripts/enrich/apply-all-contextual-fixes.js',
        description: 'Application de toutes les corrections automatiques'
    },
    {
        name: 'Écran de chargement',
        script: 'add-loading.js',
        description: 'Ajout de l\'écran de chargement avec animation'
    }
];

let stepNumber = 1;
const totalSteps = steps.length;
const startTime = Date.now();

for (const step of steps) {
    console.log(`\n[${ stepNumber }/${ totalSteps }] ${step.name}`);
    console.log(`📝 ${step.description}`);
    console.log('-'.repeat(80));

    try {
        const scriptPath = path.join(__dirname, step.script);

        // Exécuter le script et capturer la sortie
        const output = execSync(`node "${scriptPath}"`, {
            encoding: 'utf-8',
            cwd: __dirname
        });

        // Afficher la sortie du script
        if (output.trim()) {
            console.log(output.trim());
        }

        console.log(`✅ Étape ${stepNumber}/${totalSteps} terminée avec succès`);

    } catch (error) {
        console.error(`\n❌ ERREUR lors de l'étape ${stepNumber}/${totalSteps}: ${step.name}`);
        console.error(`Script: ${step.script}`);
        console.error(`Message: ${error.message}`);

        if (error.stdout) {
            console.error('\nSortie standard:');
            console.error(error.stdout.toString());
        }

        if (error.stderr) {
            console.error('\nSortie d\'erreur:');
            console.error(error.stderr.toString());
        }

        console.error('\n❌ BUILD INTERROMPU\n');
        process.exit(1);
    }

    stepNumber++;
}

const endTime = Date.now();
const duration = ((endTime - startTime) / 1000).toFixed(2);

console.log('\n' + '='.repeat(80));
console.log('✅ BUILD COMPLET TERMINÉ AVEC SUCCÈS');
console.log('='.repeat(80));
console.log(`\n⏱️  Durée totale: ${duration}s`);
console.log(`📦 Fichier final: chatbot-navigation-all-in-one.html`);
console.log(`\n💡 Le chatbot est prêt à être utilisé !`);
console.log('='.repeat(80) + '\n');
