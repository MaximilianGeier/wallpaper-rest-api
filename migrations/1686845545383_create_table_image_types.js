module.exports = {
    "up": "CREATE TABLE image_types (id INTEGER UNSIGNED PRIMARY KEY AUTO_INCREMENT, image_type varchar(50) not null unique key)",
    "down": "DROP TABLE image_types"
}