module.exports = {
    "up": "CREATE TABLE user_images (user_id int UNSIGNED, FOREIGN KEY (user_id)  REFERENCES users (id) ON DELETE CASCADE, image_id int UNSIGNED, FOREIGN KEY (image_id)  REFERENCES images_data(id) ON DELETE CASCADE, PRIMARY KEY (user_id, image_id));",
    "down": "drop table user_images"
}