module.exports = {
    "up": "insert into image_types (image_type) values ('GRADIENTS'), ('SHAPES'), ('NOISE'), ('FRACTALS'), ('LANDSCAPES'), ('INTERFERENCE');",
    "down": "DELETE FROM image_types"
}