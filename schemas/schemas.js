const authorizeSchema = {
    body: {
        type: 'object',
        properties: {
            username: { type: 'string', minLength: 3, maxLength: 30 },
            passwordHash: { type: 'string', minLength: 4 }
        },
        required: ['username', 'passwordHash']
    }
};

const registerSchema = {
    body: {
        type: 'object',
        properties: {
            username: { type: 'string', minLength: 3, maxLength: 30 },
            email: { type: 'string', format: 'email'},
            passwordHash: { type: 'string', minLength: 4 }
        },
        required: ['username', 'email', 'passwordHash']
    }
};

module.exports = {
    authorizeSchema,
    registerSchema
}