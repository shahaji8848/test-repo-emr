const sql = require("mssql");
require("dotenv").config();
const config = {
    user: process.env.DB_USER ,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_DATABASE,
    options: {
        encrypt: false,
        trustServerCertificate: true,
    },
};


let pool;

async function getConnection() {
  if (!pool) {
    try {
      pool = await sql.connect(config);
    } catch (err) {
      console.error("DB connection failed:", err);
      throw err;
    }
  }
  return pool;
}

module.exports = {
    sql,
    getConnection
};