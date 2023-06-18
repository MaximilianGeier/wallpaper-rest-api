const fs = require('fs')

async function routes(app, options) {
    // получение метадаты (id, количество лайков картинки и лайкнул ли пользователь ее)
    app.post("/all", async(req, res) => {
        console.log("GET /all")
        let orderBy = null
        let imageType = null
        let userId = null
        let isLikedOnly = false
        let likedOnlyQueryStart = ''
        let likedOnlyQueryEnd = ''
        const username = getUsernameFromToken(req.headers.authorization)

        const connection = await app.mysql.getConnection()

        if(username == null){
            userId = -1
        }
        else{
            await getCurrentUserID(connection, username).then((result) => {
                userId = result
            })
            if( userId == null ){
                console.log("тут выходим")
                res.code(400)
                connection.release()
                return
            }
        }
        console.log("current user id:  ", userId)
        console.log("current username:  ", username)

        const parts = req.parts()
        for await (const part of parts) {
          if (part.type !== 'file') {
            console.log(part.fields)
            try{
                orderBy = orderByMapper[part.fields.orderBy.value]
                imageType = imageTypeMapper(part.fields.imageType.value)
                isLikedOnly = part.fields.isLikedOnly.value === 'true'
            }catch{}
          }
        }

        if(orderBy == null){
            orderBy = ''
        }
        if(imageType == null){
            imageType = ''
        }

        if(isLikedOnly == true){
            likedOnlyQueryStart = 'select * from ('
            likedOnlyQueryEnd = ')c where isLiked = true'
        }

        await connection.query(
            `${likedOnlyQueryStart} select images_data.id, count(user_images.user_id) as likes, 
            IF(images_data.id in (select images_data.id from images_data LEFT JOIN user_images 
            ON images_data.id = user_images.image_id WHERE user_images.user_id=? group by images_data.id), 
            TRUE, FALSE) AS isLiked from images_data 
            LEFT JOIN user_images ON images_data.id = user_images.image_id WHERE true ${imageType} group by images_data.id ${orderBy} ${likedOnlyQueryEnd};`, [userId]
        ).then((result) => {
            if(result[0].length === 0){
                console.log(result)
                res.code(404)
            }
            else{
                console.log(result)
                res.code(200).send(result[0].map(({id, likes, isLiked}) => ({id, likes, isLiked: isLiked == 1})))
            }
        }).catch(res.code(400))
        connection.release()
    })

    // получение метадаты созданных картинок (id и количество лайков картинки)
    app.post("/collection",
        {
            onRequest: [app.authenticate]
        },
        async(req, res) => {
            console.log("GET /collection")
            let orderBy = null
            let imageType = null
            let userId = null
            let isLikedOnly = false
            let likedOnlyQueryStart = ''
            let likedOnlyQueryEnd = ''
            const username = getUsernameFromToken(req.headers.authorization)

            const connection = await app.mysql.getConnection()

            if(username == null){
                connection.release()
                res.send(401).send({ message: 'Требуется авторизация' })
                return
            }
            else{
                await getCurrentUserID(connection, username).then((result) => {
                    userId = result
                })
                if( userId == null ){
                    connection.release()
                    res.code(404).send({ message: 'Проблемы с подтверждением пользователя. Попробуйте авторизоваться снова' })
                    return
                }
            }

            const parts = req.parts()
            for await (const part of parts) {
              if (part.type !== 'file') {
                console.log(part.fields)
                try{
                    orderBy = orderByMapper[part.fields.orderBy.value]
                    imageType = imageTypeMapper(part.fields.imageType.value)
                    isLikedOnly = part.fields.isLikedOnly.value === 'true'
                }catch{}
              }
            }

            if(orderBy == null){
                orderBy = ''
            }
            if(imageType == null){
                imageType = ''
            }

            if(isLikedOnly == true){
                likedOnlyQueryStart = 'select * from ('
                likedOnlyQueryEnd = ')c where isLiked = true'
            }

            console.log(req.headers)

            await connection.query(
                `${likedOnlyQueryStart} select images_data.id, count(user_images.user_id) as likes, 
                IF(images_data.id in (select images_data.id from images_data LEFT JOIN user_images 
                ON images_data.id = user_images.image_id WHERE user_images.user_id=? group by images_data.id), 
                TRUE, FALSE) AS isLiked from images_data 
                LEFT JOIN user_images ON images_data.id = user_images.image_id 
                WHERE images_data.user_id=? ${imageType} group by images_data.id ${orderBy} ${likedOnlyQueryEnd};`, [userId, userId]
            ).then((result) => {
                console.log("айдишник: ", userId)
                res.code(200).send(result[0].map(({id, likes, isLiked}) => ({id, likes, isLiked: isLiked == 1})))
            }).catch(res.code(400))
            connection.release()
        }
    )

    // получение изображения по id
    app.get("/:id", async(req, res) => {
        console.log("GET /id", req.params.id)
        filePath = `./images/${req.params.id}.png`
        if (!fs.existsSync(filePath)) {
            res.code(404).send('File not found')
            return
          }
          res.type('image/jpeg')
        
          res.send(fs.readFileSync(filePath))
    })

    // сохранение в галерею
    app.post(
        '/image', 
        {
            onRequest: [app.authenticate]
        },
        async function (req, res) {
            let insertId = null
            let generationtype = null
            let generationtypeID = null
            let hashcode = null
            console.log('POST /image')
            let userId = null
            const username = getUsernameFromToken(req.headers.authorization)
            if(username == null){
                res.code(401).send({ message: 'Необходимо авторизоваться'});
                return
            }

            const data = await req.file()
            
            

            const buffer = await data.toBuffer()
            console.log(buffer.byteLength)
            if(parseInt(data.fields.length.value, 10) !== buffer.byteLength){
                res.code(300)
                return
            }

            const connection = await app.mysql.getConnection()

            //получение user id
            await getCurrentUserID(connection, username).then((result) => {
                userId = result
            })
            if( userId == null ){
                connection.release()
                res.code(407)
                return
            }

            console.log('userId: ', userId)
            

            generationtype = data.fields.generationType.value
            hashcode = data.fields.hashCode.value

            if(generationtype == null || hashcode == null){
                connection.release()
                res.code(408)
                return
            }

            await connection.query(
                "SELECT id FROM image_types where image_type=?;", [generationtype]
            ).then((result) => {
                if(result[0].length === 0){
                    console.log('не правильный запрос')
                }
                else{
                    console.log('gen id: ', result[0])
                    generationtypeID = result[0][0].id
                }
            }).catch(res.code(410))

            
            if(generationtypeID == null) {
                connection.release()
                res.code(411)
                return
            }


            // делаем запись в БД
            await connection.query(
                "insert into images_data (user_id, image_type, hashcode, creationDate) values (?, ?, ?, now());", [userId, generationtypeID, hashcode]
            ).then((result) => {
                if(result[0].length === 0){
                    console.log('проблемы доступа к БД')
                    res.code(404)
                }
                else{
                    insertId = result[0].insertId
                    console.log('ответ из бд получен ', insertId)
                    const fileStream = fs.createWriteStream(`./images/${insertId}.png`);
                    fileStream.write(buffer);
                    fileStream.end();
                }
            }).catch(res.code(412))

            // делаем лайк в БД
            await connection.query(
                "insert into user_images (user_id, image_id) values (?, ?)", [userId, insertId]
            ).then((result) => {
                if(result[0].length === 0){
                    console.log('проблемы доступа к БД')
                    res.code(404)
                }
                else{
                    res.code(201).send({id: insertId})
                }
            }).catch(res.code(413))
            connection.release()
        }
    )

    // удаление изображения из галереи
    app.delete(
        '/image/:id', 
        {
            onRequest: [app.authenticate]
        },
        async function (req, res) {
            console.log("DELETE /image/id=", req.params.id)
            let userId = null
            const username = getUsernameFromToken(req.headers.authorization)
            if(username == null){
                res.code(401).send({ message: 'Необходимо авторизоваться'});
                return
            }

            const connection = await app.mysql.getConnection()

            //получение user id
            await getCurrentUserID(connection, username).then((result) => {
                userId = result
            })
            if( userId == null ){
                connection.release()
                res.code(400)
                return
            }

            // удаляем
            await connection.query(
                "DELETE FROM images_data WHERE user_id=? AND id=?;", [userId, req.params.id]
            ).then((result) => {
                if(result[0].affectedRows == 0){
                    console.log('удалено 0 строк')
                    connection.release()
                    res.code(400)
                    return
                }
                fs.unlink(`./images/${req.params.id}.png`,function(err){
                    if(err) return console.log(err);
                    console.log('file deleted successfully');
                });
                connection.release()
                res.code(200).send({ message: 'успешно'})
            }).catch(res.code(400))
            connection.release()
        }
    )

    // лайк
    app.post(
        '/:id/like',
        {
            onRequest: [app.authenticate]
        },
        async function (req, res) {
            let userId = null
            const username = getUsernameFromToken(req.headers.authorization)
            if(username == null){
                res.code(401).send({ message: 'Необходимо авторизоваться'});
                return
            }

            const connection = await app.mysql.getConnection()

            //получение user id
            await getCurrentUserID(connection, username).then((result) => {
                userId = result
            })
            if( userId == null ){
                connection.release()
                res.code(400)
                return
            }

            // делаем запись в БД
            await connection.query(
                "insert into user_images (user_id, image_id) values (?, ?)", [userId, req.params.id]
            ).then((result) => {
                if(result[0].length === 0){
                    console.log('проблемы доступа к БД')
                    res.code(404)
                }
                else{
                    const insertId = result[0].insertId
                    console.log('ответ из бд получен ', insertId)
                    res.code(201)
                }
            }).catch(res.code(400))
            connection.release()
        }
    )

    // удаление лайка
    app.delete(
        '/:id/like', 
        {
            onRequest: [app.authenticate]
        },
        async function (req, res) {
            console.log(`DELETE /id=${req.params.id}/like`)
            let userId = null
            const username = getUsernameFromToken(req.headers.authorization)
            if(username == null){
                res.code(401).send({ message: 'Необходимо авторизоваться'});
                return
            }

            const connection = await app.mysql.getConnection()

            //получение user id
            await getCurrentUserID(connection, username).then((result) => {
                userId = result
            })
            if( userId == null ){
                connection.release()
                res.code(400)
                return
            }

            // удаляем
            // await connection.query(
            //     "DELETE from user_images where user_id=? AND image_id=?;", [userId, req.params.id]
            // ).then((result) => {
            //     if(result[0].affectedRows == 0){
            //         console.log('удалено 0 строк')
            //         res.code(400)
            //         return
            //     }
            //     res.code(200).send({ message: 'успешно'})
            // }).catch(res.code(400))


            await deleteLike(connection, userId, req.params.id)
            .then((result) => {
                switch(result){
                    case 1:
                        res.code(200).send({ message: 'успешно'})
                        break
                    case 0:
                        res.code(400)
                        break
                    default:
                        res.code(500)
                }
            }).catch(res.code(500))
            connection.release()
            return
        }
    )

    const deleteLike = async (connection, userId, imageId) => {
        let deletedRowsCount = 0
        await connection.query(
            "DELETE from user_images where user_id=? AND image_id=?;", [userId, imageId]
        ).then((result) => {
            if(result[0].affectedRows == 0){
                console.log('удалено 0 строк')
                deletedRowsCount = 0
                return
            }
            deletedRowsCount = 1
        }).catch(deletedRowsCount = -1)
        return deletedRowsCount
    }


    


    const getUsernameFromToken = (auth) => {
        if(auth == null || auth.length == 0){
            return null
        }
        if(auth.split(' ')[1] == null){
            return
        }
        const token = auth.split(' ')[1]
        result = null

        app.jwt.verify(token, (err, decoded) => {
          if (err) {
            return null
          }
          result = decoded.username
        })
        return result
    }

    const getCurrentUserID = async (connection, username) => {
        let userId = null
        const [rows, fields] = await connection.query(
            "select id from users where username=? limit 1", [username])
        if(rows.length != 0){
            userId = rows[0].id
        }
        return userId
    }

    const orderByMapper = {
        NONE: '',
        TIME_ASCENDING: 'order by images_data.creationDate',
        TIME: 'order by images_data.creationDate desc',
        LIKE: 'order by likes',
        LIKE_ASCENDING: 'order by likes desc',
        undefined: ''
    }

    const imageTypeMapper = (type) => {
        let imageTypes = {
            ALL: '',
            GRADIENTS: "GRADIENTS",
            SHAPES: "SHAPES",
            NOISE: "NOISE",
            INTERFERENCE: "INTERFERENCE",
            FRACTALS: "FRACTALS",
            LANDSCAPES: "LANDSCAPES",
        }

        dataBaseImageType = imageTypes[type]
        if(dataBaseImageType == null || dataBaseImageType == ''){
            return ''
        }
        return ` AND images_data.image_type = (SELECT id from image_types where image_type = '${dataBaseImageType}' LIMIT 1)`
    }
}

module.exports = routes
