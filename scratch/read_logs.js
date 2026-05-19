const fs = require('fs');
const logPath = "C:\\Users\\101485\\.gemini\\antigravity\\brain\\2b3dca6d-e8ea-49d8-9ff0-64bf22eeda6d\\.system_generated\\logs\\overview.txt";
const content = fs.readFileSync(logPath, 'utf8');
const lines = content.split('\n');
let output = "";

for (const line of lines) {
    if (!line.trim()) continue;
    try {
        const obj = JSON.parse(line);
        if (obj.step_index >= 2098) {
            output += `=== STEP ${obj.step_index} (${obj.source}) ===\n`;
            output += obj.content + "\n\n";
        }
    } catch (e) {
        // ignore
    }
}

fs.writeFileSync("d:\\Project_After Sale\\app\\scratch\\extracted_steps.txt", output, 'utf8');
console.log("Extracted successfully.");
