const fs = require('fs');
const path = require('path');

function searchFile(filePath) {
    if (!fs.existsSync(filePath)) {
        console.error('File not found:', filePath);
        return;
    }

    console.log(`\n=================== SEARCHING ${filePath} ===================`);
    const data = fs.readFileSync(filePath, 'utf8');
    console.log('Length:', data.length);

    const keys = new Set();
    data.replace(/"([a-zA-Z0-9_]+)"\s*:/g, (m, k) => {
        if (k.toLowerCase().includes('rev') || k.toLowerCase().includes('ver') || k.toLowerCase().includes('back')) {
            keys.add(k);
        }
    });
    console.log('Interesting keys (rev/ver/back):', Array.from(keys));

    // Search for occurrences of "REV" or "rev" or "revision"
    const terms = ['REV', 'rev', 'revision', 'revNo', 'version'];
    terms.forEach(term => {
        let pos = 0;
        let count = 0;
        while ((pos = data.indexOf(term, pos)) !== -1) {
            count++;
            const start = Math.max(0, pos - 40);
            const end = Math.min(data.length, pos + 40);
            console.log(`Match for "${term}" #${count}:`, data.substring(start, end).replace(/\n/g, ' '));
            pos += term.length;
            if (count >= 10) {
                console.log(`... truncated term "${term}" after 10 matches`);
                break;
            }
        }
    });
}

searchFile(path.join(__dirname, 'workorders_detailed_inspect.json'));
searchFile(path.join(__dirname, 'nested_subcollections_inspect.json'));
