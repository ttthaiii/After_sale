const fs = require('fs');
const filepath = 'src/pages/Dashboard.tsx';
let txt = fs.readFileSync(filepath, 'utf8');

const cutoff = txt.lastIndexOf("act';\r\nimport { useNavigate }");
if (cutoff === -1) {
    const cutoff2 = txt.lastIndexOf("act';\nimport { useNavigate }");
    if (cutoff2 !== -1) {
        fs.writeFileSync(filepath, txt.substring(0, 43) + txt.substring(cutoff2), 'utf8');
        console.log('✅ Recovered original file successfully!');
    } else {
        console.log('Could not find cutoff point');
    }
} else {
    fs.writeFileSync(filepath, txt.substring(0, 43) + txt.substring(cutoff), 'utf8');
    console.log('✅ Recovered original file successfully!');
}
