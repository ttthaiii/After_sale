import fs from 'fs';
import path from 'path';

const parentDir = 'd:\\Project_After Sale';

const files = fs.readdirSync(parentDir);

files.forEach(file => {
    const filePath = path.join(parentDir, file);
    const stat = fs.statSync(filePath);
    if (stat.isFile() && file.endsWith('.md')) {
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n');
        lines.forEach((line, idx) => {
            if (line.toLowerCase().includes('dc') || line.toLowerCase().includes('dailycontractors') || line.toLowerCase().includes('foreman')) {
                console.log(`${file}:${idx + 1}: ${line.trim()}`);
            }
        });
    }
});
