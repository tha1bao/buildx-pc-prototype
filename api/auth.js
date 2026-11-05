// Vercel Function: /api/auth
const { handle } = require("../server/api");
module.exports = (req, res) => handle("auth", req, res);
