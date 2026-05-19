const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'pages', 'AdminMasterData.tsx');
let content = fs.readFileSync(filePath, 'utf8');

const newBlock = `        if (activeTab === 'Staff') {
            const editingStaff = editingItem as Staff | null;
            let hashedPassword = editingStaff?.passwordHash || '';
            let plainPassword = editingStaff?.password || '';
            
            if (!editingStaff) {
                // For new staff: if custom password is provided, use it. Otherwise default to Employee ID (id).
                const targetPass = data.password || id;
                hashedPassword = bcrypt.hashSync(targetPass, 10);
                plainPassword = targetPass;
            } else if (data.password) {
                // For existing staff: if a new custom password is typed
                hashedPassword = bcrypt.hashSync(data.password, 10);
                plainPassword = data.password;
            }

            finalData = {
                employeeId: id,
                username: data.username || data.employeeId || id,
                password: plainPassword,
                passwordHash: hashedPassword,`;

if (content.includes('const editingStaff = editingItem as Staff | null;')) {
  // Let's do a robust regex replace!
  const regex = /if\s*\(activeTab\s*===\s*'Staff'\)\s*{\s*const\s*editingStaff\s*=\s*editingItem[\s\S]*?passwordHash:\s*hashedPassword,/;
  const match = content.match(regex);
  if (match) {
    console.log("Found match!");
    content = content.replace(match[0], newBlock);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log("Successfully restored custom password saving!");
  } else {
    console.log("Regex didn't match.");
  }
} else {
  console.log("Could not find block.");
}
