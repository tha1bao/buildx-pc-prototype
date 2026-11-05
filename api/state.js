// Vercel Function: /api/state
const { handle } = require("../server/api");
module.exports = (req, res) => handle("state", req, res);
