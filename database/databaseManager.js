const fs = require('fs')

const deleteLike = async (connection, userId, imageId) => {
    let deletedRowsCount = 0
    await connection.query(
        "DELETE from user_images where user_id=? AND image_id=?;", [userId, imageId]
    ).then((result) => {
        if(result[0].affectedRows == 0){
            deletedRowsCount = 0
            return
        }
        deletedRowsCount = 1
    }).catch(deletedRowsCount = -1)
    return deletedRowsCount
}

const deleteImage = async (connection, userId, imageId) => {
    const result = {
        statusCode: 500,
        message: {message: "Проблемы на стороне сервера"}
    }
    await connection.query(
        "DELETE FROM images_data WHERE user_id=? AND id=?;", [userId, imageId]
    ).then((res) => {
        if(res[0].affectedRows == 0){
            connection.release()
            result.statusCode = 400
            result.message.message = "проверьте корректность запроса"
            fs.unlink(`./images/${imageId}.png`,function(err){
                if(err) {
                    result.statusCode = 500
                    result.message.message = "Проблемы на стороне сервера"
                }

            });
        }
        fs.unlink(`./images/${imageId}.png`,function(err){
            if(err) {
                result.statusCode = 500
                result.message.message = "Проблемы на стороне сервера 1"
            }
        });
        result.statusCode = 201
        result.message.message = "Успешно"
    }).catch((err) => {
        result.statusCode = 500
        result.message.message = {message: "Проблемы на стороне сервера ????"}
    })
    return result
}


const setLike = async (connection, userId, imageId) => {
    const result = {
        statusCode: 500,
        message: {message: "Проблемы на стороне сервера"}
    }
    await connection.query(
        "insert into user_images (user_id, image_id) values (?, ?)", [userId, imageId]
    ).then((queryResult) => {
        if(queryResult[0].length === 0){
            console.warn('проблемы доступа к БД')
            result.statusCode = 400
            result.message.message = "проверьте корректность запроса"
        }
        else{
            const insertId = queryResult[0].insertId
            console.info('ответ из бд получен ', insertId)
            result.statusCode = 201
            result.message.message = "Успешно"
        }
    }).catch((error) => {
        result.statusCode = 500
        result.message.message = {message: "Проблемы на стороне сервера"}
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

const postGallery = async (connection, userId, isLikedOnly, orderBy, imageType) => {
    let likedOnlyQueryStart = ''
    let likedOnlyQueryEnd = ''
    if(isLikedOnly == true){
        likedOnlyQueryStart = 'select * from ('
        likedOnlyQueryEnd = ')c where isLiked = true'
    }

    orderBy = orderByMapper[orderBy]
    imageType = imageTypeMapper(imageType)

    if(orderBy == null){
        orderBy = ''
    }
    if(imageType == null){
        imageType = ''
    }

    return await connection.query(
        `${likedOnlyQueryStart} select images_data.id, images_data.main_color as mainColor, count(user_images.user_id) as likes, 
        IF(images_data.id in (select images_data.id from images_data LEFT JOIN user_images 
        ON images_data.id = user_images.image_id WHERE user_images.user_id=? group by images_data.id), 
        TRUE, FALSE) AS isLiked from images_data 
        LEFT JOIN user_images ON images_data.id = user_images.image_id WHERE true ${imageType} group by images_data.id ${orderBy} ${likedOnlyQueryEnd};`, [userId]
    ).then((result) => {
        if(result[0].length === 0){
            return [];
        }
        else{
            console.log(result[0])
            return result[0].map(({id, likes, mainColor, isLiked}) => {
                let color = ''
                if(mainColor != null){
                    color = mainColor
                }
                return {id, likes, mainColor: color, isLiked: isLiked == 1}
            })
        }
    }).catch()
}

const postCollection = async (connection, userId, isLikedOnly, orderBy, imageType) => {
    let likedOnlyQueryStart = ''
    let likedOnlyQueryEnd = ''
    if(isLikedOnly == true){
        likedOnlyQueryStart = 'select * from ('
        likedOnlyQueryEnd = ')c where isLiked = true'
    }

    orderBy = orderByMapper[orderBy]
    imageType = imageTypeMapper(imageType)

    if(orderBy == null){
        orderBy = ''
    }
    if(imageType == null){
        imageType = ''
    }

    return await connection.query(
        `${likedOnlyQueryStart} select images_data.id, images_data.main_color as mainColor, count(user_images.user_id) as likes, 
        IF(images_data.id in (select images_data.id from images_data LEFT JOIN user_images 
        ON images_data.id = user_images.image_id WHERE user_images.user_id=? group by images_data.id), 
        TRUE, FALSE) AS isLiked from images_data 
        LEFT JOIN user_images ON images_data.id = user_images.image_id 
        WHERE images_data.user_id=? ${imageType} group by images_data.id ${orderBy} ${likedOnlyQueryEnd};`, [userId, userId]
    ).then((result) => {
        return result[0].map(({id, likes, mainColor, isLiked}) => {
            let color = ''
            if(mainColor != null){
                color = mainColor
            }
            return {id, likes, mainColor: color, isLiked: isLiked == 1}
        })
    }).catch()
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

module.exports = {
    setLike,
    deleteLike,
    getCurrentUserID,
    deleteImage,
    postCollection,
    postGallery
}