const mysql = require('mysql2');

console.log('DB Config:', {
  host: process.env.MYSQLHOST,
  user: process.env.MYSQLUSER,
  database: process.env.MYSQLDATABASE,
  port: process.env.MYSQLPORT
});

const pool = mysql.createPool({
  host: process.env.MYSQLHOST,
  user: process.env.MYSQLUSER,
  password: process.env.MYSQLPASSWORD,
  database: process.env.MYSQLDATABASE,
  port: process.env.MYSQLPORT,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  ssl: { rejectUnauthorized: false }
});

// Test connection
pool.getConnection((err, connection) => {
  if (err) {
    console.log('Database connection failed ❌:', err.message);
  } else {
    console.log('Database connected successfully ✅');
    connection.release();
  }
});

module.exports = pool.promise();