// Vercel Function: /api/action
const { handle } = require("../server/api");
module.exports = (req, res) => handle("action", req, res);
