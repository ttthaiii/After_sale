const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'pages', 'AdminMasterData.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Target the staff save block in handleSave
const oldBlock = `        if (activeTab === 'Staff') {
            const editingStaff = editingItem as Staff | null;
            let hashedPassword = editingStaff?.passwordHash || '';
            
            // Check if password has been provided or changed
            if (data.password && data.password !== editingStaff?.password) {
                hashedPassword = bcrypt.hashSync(data.password, 10);
            } else if (!hashedPassword && data.password) {
                hashedPassword = bcrypt.hashSync(data.password, 10);
            }

            finalData = {
                employeeId: id,
                username: data.username || data.employeeId || id,
                password: data.password || editingStaff?.password || id,
                passwordHash: hashedPassword,`;

const newBlock = `        if (activeTab === 'Staff') {
            const editingStaff = editingItem as Staff | null;
            let hashedPassword = editingStaff?.passwordHash || '';
            
            if (!editingStaff) {
                // For new staff, default password is their Employee ID (id)
                hashedPassword = bcrypt.hashSync(id, 10);
            } else if (data.resetPasswordToId) {
                // If admin checked "Reset Password to Employee ID"
                hashedPassword = bcrypt.hashSync(id, 10);
            }

            finalData = {
                employeeId: id,
                username: data.username || data.employeeId || id,
                passwordHash: hashedPassword,`;

if (content.includes('const editingStaff = editingItem as Staff | null;')) {
  // Let's do a robust replacement
  const regex = /if\s*\(activeTab\s*===\s*'Staff'\)\s*{\s*const\s*editingStaff\s*=\s*editingItem[\s\S]*?passwordHash:\s*hashedPassword,/;
  const match = content.match(regex);
  if (match) {
    console.log("Found match!");
    content = content.replace(match[0], newBlock);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log("Successfully replaced handleSave logic!");
  } else {
    console.log("Regex didn't match. Trying simple replace.");
    content = content.replace(oldBlock, newBlock);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log("Simple replace completed!");
  }
} else {
  console.log("Could not find block.");
}
