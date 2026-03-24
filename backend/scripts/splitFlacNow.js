#!/usr/bin/env node

/**
 * Script para dividir archivos FLAC grandes existentes (no interactivo)
 * Uso: node scripts/splitFlacNow.js
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { FlacSplitService } from '../src/services/flacSplitService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.join(__dirname, '../uploads');
const flacSplitService = new FlacSplitService();

async function findLargeFlacFiles() {
    const files = [];

    async function walkDir(dir) {
        try {
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
        } catch (error) {
            console.error(`Error reading directory ${dir}:`, error.message);
        }
    }

    await walkDir(uploadDir);
    return files;
}

async function main() {
    console.log('\n FLAC Split Tool - Dividiendo archivos...\n');

    try {
        console.log(' Buscando archivos FLAC > 200MB...\n');
        const largeFiles = await findLargeFlacFiles();

        if (largeFiles.length === 0) {
            console.log('✓ No hay archivos FLAC > 200MB para dividir');
            return;
        }

        console.log(`✓ Encontrados ${largeFiles.length} archivo(s):\n`);
        largeFiles.forEach((file, i) => {
            console.log(`${i + 1}. ${file.relativePath}`);
            console.log(`   Tamaño: ${(file.size / 1024 / 1024).toFixed(2)}MB\n`);
        });

        for (let i = 0; i < largeFiles.length; i++) {
            const file = largeFiles[i];
            console.log(`\n[${i + 1}/${largeFiles.length}] Dividiendo: ${file.relativePath}`);
            console.log(`Tamaño: ${(file.size / 1024 / 1024).toFixed(2)}MB`);

            try {
                const baseFileName = path.basename(file.path).replace(/\.flac$/i, '');
                const outputDir = path.dirname(file.path);

                const chunks = await flacSplitService.splitFlac(file.path, outputDir, baseFileName);

                console.log(`\n Split completado: ${chunks.length} chunks:`);
                chunks.forEach((chunk, j) => {
                    console.log(`   ${j + 1}. ${chunk.name} (${(chunk.size / 1024 / 1024).toFixed(2)}MB)`);
                });
            } catch (error) {
                console.error(`\n Error dividiendo: ${error.message}\n`);
                process.exit(1);
            }
        }

        console.log('\n Proceso completado exitosamente\n');
    } catch (error) {
        console.error(' Error fatal:', error.message);
        process.exit(1);
    }
}

main();
