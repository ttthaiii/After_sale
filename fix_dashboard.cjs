const fs = require('fs');
const filepath = 'src/pages/Dashboard.tsx';
let txt = fs.readFileSync(filepath, 'utf8');

// 1. Extract Critical Action section (lines 1750-1899)
const critStartMatch = txt.match(/\{\/\*\s*Work Order List \(Sync with Status Filter\).*\n\s*<div\s*id="critical-actions-section"/);
const critRealStart = critStartMatch ? critStartMatch.index : -1;
let critBlock = '';
if (critRealStart !== -1) {
    const critEndStr = '</div>\n\n                            {/* --- Project S-Curve Analysis --- */}';
    const critEnd = txt.indexOf(critEndStr) + 6;
    critBlock = txt.substring(critRealStart, critEnd);
    txt = txt.substring(0, critRealStart) + txt.substring(critEnd);
}

// 2. Extract Foreman Calendar section (lines 2237-2249)
const calStartMatch = txt.match(/\{isForeman && \(\s*<div\s*id="activity-calendar-section"/);
const calRealStart = calStartMatch ? calStartMatch.index : -1;
let calBlock = '';
if (calRealStart !== -1) {
    const calEndStr = '/>\n                        </div>\n                    )}';
    const calEndIndex = txt.indexOf(calEndStr, calRealStart);
    const calEnd = calEndIndex + calEndStr.length;
    calBlock = txt.substring(calRealStart, calEnd);
    txt = txt.substring(0, calRealStart) + txt.substring(calEnd);
}

// 3. Find the end of Foreman operations view (line 1488-1493)
const opsEndRegex = /ไม่มีนัดหมายงานใหม่เพิ่มในสัปดาห์หน้า<\/div>\s*\}\)\(\)\}\s*<\/div>\s*<\/div>\s*<\/div>\s*<\/div>\s*<\/>\s*\)\s*\) : \(\s*<>/;
const opsEndMatch = txt.match(opsEndRegex);
if (opsEndMatch) {
    const insertPos = opsEndMatch.index + opsEndMatch[0].indexOf('</>\n                )');
    txt = txt.substring(0, insertPos) + '\n' + critBlock + '\n' + calBlock + '\n' + txt.substring(insertPos);
}

// 4. Remove stray ) } at line 1561
txt = txt.replace('                    </div>\n                </>\n            )}\n\n                        {/* Charts Grid */}', '                    </div>\n\n                        {/* Charts Grid */}');

// 5. Remove the legacy Performance Summary Mode wrapper (lines 2050-2054)
const oldSumWrapperStr = '                        </div>\n                    </>\n                )\n            ) : (\n                /* --- Performance Summary Mode --- */\n                <div style={{ animation: \'fadeIn 0.5s ease-out\' }}>';
txt = txt.replace(oldSumWrapperStr, '                        </div>');

// 6. Fix closing tag at end
const endStr = '                </div>\n            )}\n            {/* --- Labor Detail Modal --- */}';
txt = txt.replace(endStr, '                </div>\n                </>\n            )}\n            {/* --- Labor Detail Modal --- */}');

fs.writeFileSync(filepath, txt, 'utf8');
console.log('✅ Fix Dashboard structure successfully!');
