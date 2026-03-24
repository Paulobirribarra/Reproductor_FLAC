#!/usr/bin/env node

/**
 * Script para dividir archivos FLAC grandes existentes
 * Uso: node scripts/splitExistingFlac.js
 */

import { promises as fs } from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';
import { FlacSplitService } from '../src/services/flacSplitService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.join(__dirname, '../uploads');
const flacSplitService = new FlacSplitService();

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

function question(prompt) {
    return new Promise((resolve) => {
        rl.question(prompt, resolve);
    });
}

async function findLargeFlacFiles() {
    const files = [];

    async function walkDir(dir) {
        const items = await fs.readdir(dir, { withFileTypes: true });

        for (const item of items) {
            const fullPath = path.join(dir, item.name);

            if (item.isDirectory()) {
                await walkDir(fullPath);
            } else if (item.isFile() && item.name.toLowerCase().endsWith('.flac')) {
                const stats = await fs.stat(fullPath);
                if (FlacSplitService.shouldSplit(stats.size)) {
                    files.push({
                        path: fullPath,
                        relativePath: path.relative(uploadDir, fullPath),
                        size: stats.size,
                    });
                }
            }
        }
    }

    await walkDir(uploadDir);
    return files;
}

async function main() {
    console.log('🎵 FLAC Split Tool - Dividir archivos FLAC grandes\n');

    try {
        console.log(' Buscando archivos FLAC > 200MB...\n');
        const largeFiles = await findLargeFlacFiles();

        if (largeFiles.length === 0) {
            console.log('✓ No hay archivos FLAC > 200MB para dividir');
            rl.close();
            return;
        }

        console.log(`✓ Encontrados ${largeFiles.length} archivo(s):\n`);
        largeFiles.forEach((file, i) => {
            console.log(`${i + 1}. ${file.relativePath}`);
            console.log(`   Tamaño: ${(file.size / 1024 / 1024).toFixed(2)}MB\n`);
        });

        const answer = await question('¿Dividir todos? (s/n): ');

        if (answer.toLowerCase() !== 's') {
            console.log('\n Cancelado');
            rl.close();
            return;
        }

        for (let i = 0; i < largeFiles.length; i++) {
            const file = largeFiles[i];
            console.log(`\n[${i + 1}/${largeFiles.length}] Dividiendo: ${file.relativePath}`);

            try {
                const baseFileName = path.basename(file.path).replace(/\.flac$/i, '');
                const outputDir = path.dirname(file.path);

                const chunks = await flacSplitService.splitFlac(file.path, outputDir, baseFileName);

                console.log(` Split completado: ${chunks.length} chunks creados\n`);
            } catch (error) {
                console.error(` Error dividiendo: ${error.message}\n`);
            }
        }

        console.log('\n Proceso completado');
    } catch (error) {
        console.error(' Error:', error.message);
    }

    rl.close();
}

main();
