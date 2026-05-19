const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'pages', 'AdminMasterData.tsx');
let content = fs.readFileSync(filePath, 'utf8');

if (content.includes('passwordHash: hashedPassword,')) {
  const oldStr = 'finalData = {\n                employeeId: id,\n                username: data.username || data.employeeId || id,\n                passwordHash: hashedPassword,';
  
  // Let's do a more robust regex replace!
  const regex = /(finalData\s*=\s*{\s*employeeId:\s*id,\s*username:\s*data\.username\s*\|\|\s*data\.employeeId\s*\|\|\s*id,\s*)(passwordHash:\s*hashedPassword,)/;
  
  const match = content.match(regex);
  if (match) {
    console.log("Found match!");
    const matchedStr = match[0];
    const newStr = match[1] + 'password: data.password || editingStaff?.password || id,\n                ' + match[2];
    content = content.replace(matchedStr, newStr);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log("Successfully added plain text password saving!");
  } else {
    console.log("Regex match not found. Trying simpler replace.");
    // Try simple string replace
    content = content.replace('passwordHash: hashedPassword,', 'password: data.password || editingStaff?.password || id,\n                passwordHash: hashedPassword,');
    fs.writeFileSync(filePath, content, 'utf8');
    console.log("Simple replace completed!");
  }
} else {
  console.log("Could not find passwordHash line.");
}
