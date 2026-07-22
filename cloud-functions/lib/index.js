"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.userSync = exports.syncDailyReport = void 0;
// Export HTTP Endpoint สำหรับการซิงค์ข้อมูล
var laborSync_1 = require("./laborSync");
Object.defineProperty(exports, "syncDailyReport", { enumerable: true, get: function () { return laborSync_1.syncDailyReport; } });
// One-way Firestore trigger: After Sale users -> Labor users
var userSync_1 = require("./userSync");
Object.defineProperty(exports, "userSync", { enumerable: true, get: function () { return userSync_1.userSync; } });
//# sourceMappingURL=index.js.map