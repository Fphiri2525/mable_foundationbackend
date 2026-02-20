const mysql = require('mysql2');

const db = mysql.createConnection({
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DB,
  port: process.env.MYSQL_PORT
});

db.connect((err) => {
  if (err) console.log('Database connection failed ❌:', err);
  else console.log('Database connected successfully ✅');
});

module.exports = db;