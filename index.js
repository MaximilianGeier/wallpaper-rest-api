require('dotenv').config()
const configuration = require('./config/configuration')

const fastify = require("fastify")
const app = fastify({
    bodyLimit: 12485760 // загрузка данных до 10MB
  })

// добавление плагинов
const fastifyMultipart = require('@fastify/multipart')
app.register(fastifyMultipart)

app.register(require('@fastify/jwt'), {
    secret: configuration.secretKey
})

// конфигурация БД mySQL
app.register(require('@fastify/mysql'), {
    promise: true,
    connectionString: process.env.MYSQL_CONNECTION
})

app.decorate("authenticate", async function (request, reply) {
    try {
        await request.jwtVerify()
    } catch (err) {
        reply.send(err)
    }
})

app.register(require("./api/wallpaper"), { prefix: "/wallpaper" });
app.register(require("./api/account"), { prefix: "/account" });

app.listen({ port: 3000}, (error, address) => {
    if(error){
        console.error(error);
        process.exit(1);
    }
    console.log(`Server listening on ${address}`);
})