// Vercel Function: /api/version
const { handle } = require("../server/api");
module.exports = (req, res) => handle("version", req, res);
