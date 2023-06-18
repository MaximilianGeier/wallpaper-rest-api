module.exports = {
    "up": "CREATE TABLE users (id INTEGER UNSIGNED PRIMARY KEY AUTO_INCREMENT, username varchar(100) NOT NULL, email varchar(100) NOT NULL, emailConfirmed BOOLEAN default false, passwordHash TEXT not null);",
    "down": "DROP TABLE users"
}