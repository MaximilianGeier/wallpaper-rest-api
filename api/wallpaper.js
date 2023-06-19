const fs = require('fs')
const {setLike, deleteLike, getCurrentUserID, deleteImage} = require('../database/databaseManager')
const Vibrant = require('node-vibrant');

async function routes(app, options) {
    // получение метадаты (id, количество лайков картинки и лайкнул ли пользователь ее)
    app.post("/all", async(req, res) => {
        console.info("POST /all")
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
        console.info("current user id:  ", userId)
        console.info("current username:  ", username)

        const parts = req.parts()
        for await (const part of parts) {
          if (part.type !== 'file') {
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
            `${likedOnlyQueryStart} select images_data.id, images_data.main_color as mainColor, count(user_images.user_id) as likes, 
            IF(images_data.id in (select images_data.id from images_data LEFT JOIN user_images 
            ON images_data.id = user_images.image_id WHERE user_images.user_id=? group by images_data.id), 
            TRUE, FALSE) AS isLiked from images_data 
            LEFT JOIN user_images ON images_data.id = user_images.image_id WHERE true ${imageType} group by images_data.id ${orderBy} ${likedOnlyQueryEnd};`, [userId]
        ).then((result) => {
            if(result[0].length === 0){
                res.code(404)
            }
            else{
                res.code(200).send(result[0].map(({id, likes, mainColor, isLiked}) => {
                    let color = ''
                    if(mainColor != null){
                        color = mainColor
                    }
                    return {id, likes, mainColor: color, isLiked: isLiked == 1}
                }))
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
            console.info("GET /collection")
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
                `${likedOnlyQueryStart} select images_data.id, images_data.main_color, count(user_images.user_id) as likes, 
                IF(images_data.id in (select images_data.id from images_data LEFT JOIN user_images 
                ON images_data.id = user_images.image_id WHERE user_images.user_id=? group by images_data.id), 
                TRUE, FALSE) AS isLiked from images_data 
                LEFT JOIN user_images ON images_data.id = user_images.image_id 
                WHERE images_data.user_id=? ${imageType} group by images_data.id ${orderBy} ${likedOnlyQueryEnd};`, [userId, userId]
            ).then((result) => {
                res.code(200).send(result[0].map(({id, likes, mainColor, isLiked}) => {
                    let color = ''
                    if(mainColor != null){
                        color = mainColor
                    }
                    return {id, likes, mainColor: color, isLiked: isLiked == 1}
                }))
            }).catch(res.code(400))
            connection.release()
        }
    )

    // получение изображения по id
    app.get("/:id", async(req, res) => {
        console.info("GET /id", req.params.id)
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
            let mainColor = ''
            console.info('POST /image')
            let userId = null
            const username = getUsernameFromToken(req.headers.authorization)
            if(username == null){
                res.code(401).send({ message: 'Необходимо авторизоваться'});
                return
            }

            const data = await req.file()
            
            

            const buffer = await data.toBuffer()
            console.info(buffer.byteLength)
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
                    console.warn('не правильный запрос')
                }
                else{
                    console.info('gen id: ', result[0])
                    generationtypeID = result[0][0].id
                }
            }).catch(res.code(410))

            
            if(generationtypeID == null) {
                connection.release()
                res.code(411)
                return
            }

            await getMainColorFromBuffer(buffer).then((result) => mainColor = result)

            // делаем запись в БД
            await connection.query(
                "insert into images_data (user_id, image_type, hashcode, main_color, creationDate) values (?, ?, ?, ?, now());", [userId, generationtypeID, hashcode, mainColor]
            ).then((result) => {
                if(result[0].length === 0){
                    console.warn('проблемы доступа к БД')
                    res.code(404)
                }
                else{
                    insertId = result[0].insertId
                    console.info('ответ из бд получен ', insertId)
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
                    console.warn('проблемы доступа к БД')
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
            console.info("DELETE /image/id=", req.params.id)
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

            // удаляем картинку из БД
            await deleteImage(connection, userId, req.params.id).then(
                (result) => {
                    res.code(result.statusCode)
                    res.send(result.message)
                }
            ).catch(() => {
                res.code(400)
                res.send({ message: 'не удалось удалить' })
            })
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

            await setLike(connection, userId, req.params.id).then(
                (result) => {
                    res.code(result.statusCode)
                    res.send(result.message)
                }
            )
            connection.release()
            return
        }
    )

    // удаление лайка
    app.delete(
        '/:id/like', 
        {
            onRequest: [app.authenticate]
        },
        async function (req, res) {
            console.info(`DELETE /id=${req.params.id}/like`)
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

    const orderByMapper = {
        NONE: '',
        TIME_ASCENDING: 'order by images_data.creationDate asc',
        TIME: 'order by images_data.creationDate desc',
        LIKE: 'order by likes desc',
        LIKE_ASCENDING: 'order by likes asc',
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

    const getMainColorFromBuffer = async (buffer) => {
        const vibrant = new Vibrant(buffer);
        let mainColor = ''

        await vibrant.getPalette((err, palette) => {
            if (err) {
                console.warn(err);
                return;
            }
            mainColor = palette.Vibrant.getHex();
        });
        return mainColor
    }
}

module.exports = routes
