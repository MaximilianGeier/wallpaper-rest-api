module.exports = {
    "up": "CREATE TABLE images_data (id INTEGER UNSIGNED PRIMARY KEY AUTO_INCREMENT, user_id int UNSIGNED, FOREIGN KEY (user_id)  REFERENCES users (id) , image_type int UNSIGNED, FOREIGN KEY (image_type) REFERENCES image_types (id), hashcode varchar(255) not null unique key, main_color varchar(255), creationDate datetime(6));",
    "down": "drop table images_data;"
}