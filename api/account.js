const fs = require('fs')
const {authorizeSchema, registerSchema} = require('../schemas/schemas')

async function accountRoutes(app, options) {
    app.post('/authorize', { schema: authorizeSchema, attachValidation: true }, async (req, res) => {
        if (req.validationError) {
            const errorMessage = errorMapper[req.validationError.validation[0].message]
            if(errorMessage == null){
                res.status(400).send({ message: req.validationError.validation[0].message})
            }
            else{
                res.status(400).send({ message: errorMessage})                
            }
            return
        }
        const { username, passwordHash } = req.body;
      
        const connection = await app.mysql.getConnection()
        await connection.query(
            'SELECT * FROM users where username =? AND passwordHash =?', [username, passwordHash]
        ).then((result) => {
            if(result[0].length === 0){
                res.code(401).send({ message: 'Не верный логин или пароль'});
            }
            else{
                const token = app.jwt.sign({ "username": username })
                res.code(200).send({ token })
            }
        }).catch(res.code(500))
        connection.release()
    });

    app.post('/register', { schema: registerSchema, attachValidation: true }, async (req, res) => {
        if (req.validationError) {
            const errorMessage = errorMapper[req.validationError.validation[0].message]
            if(errorMessage == null){
                res.status(400).send({ message: req.validationError.validation[0].message})
            }
            else{
                res.status(400).send({ message: errorMessage})         
            }
            return
          }
        const { username, email, passwordHash } = req.body;
        if(username == null || username === ""){
            res.code(400).send({ message: "empty field 'username'"})
            return
        }
        if(email == null || email === ""){
            res.code(400).send({ message: "empty field 'email'"})
            return
        }
        if(passwordHash == null || passwordHash === ""){
            res.code(400).send({ message: "empty field 'password'"})
            return
        }
      
        const connection = await app.mysql.getConnection()
        await connection.query(
            'select count(*) as count from users where username=? OR email=?', [username, email]
        ).then((result) => {
            if(result[0][0].count > 0){
                res.status(401).send({ message: 'Пользователь с таким именем и/или почтой уже существует' });
                connection.release()
                return
            }
        }).catch(res.code(500))
        await connection.query(
            'insert into users (username, email, passwordHash) values(?, ?, ?);', [username, email, passwordHash]
        ).then((result) => {
            if(result[0].length === 0){
                res.code(401).send('Unauthorized');
            }
            else{
                const token = app.jwt.sign({ "username": username })
                res.code(200).send({ token })
                //res.status(201).send({ message: 'User registered successfully' });
            }
        }).catch(res.code(500))
        connection.release()
    });

    const errorMapper = {
        'must match format "email"': "Не верный формат почты",
        'must NOT have fewer than 3 characters': "Имя пользователя слишком короткое",
        'must NOT have more than 30 characters': "Имя содержит больше 30 символов",
        'must NOT have fewer than 4 characters': "Пароль слишком короткий"
    }
}

module.exports = accountRoutes
