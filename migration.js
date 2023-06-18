var mysql = require('mysql');
var migration = require('mysql-migrations');
require('dotenv').config()

var connection = mysql.createPool({
  connectionLimit : 10,
  host     : process.env.MYSQL_HOST,
  user     : process.env.MYSQL_USER,
  password : process.env.MYSQL_PASSWORD,
  database : process.env.MYSQL_DATABASE,
});

migration.init(connection, __dirname + '/migrations');