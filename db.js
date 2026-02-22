const mysql = require('mysql2');

console.log('DB Config:', {
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  database: process.env.MYSQL_DB,
  port: process.env.MYSQL_PORT,
  password: process.env.MYSQL_PASSWORD ? '✅ exists' : '❌ missing'
});

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DB,
  port: process.env.MYSQL_PORT,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  ssl: { rejectUnauthorized: false }
});

pool.getConnection((err, connection) => {
  if (err) {
    console.log('Database connection failed ❌:', err.message);
  } else {
    console.log('Database connected successfully ✅');
    connection.release();
  }
});

module.exports = pool.promise();