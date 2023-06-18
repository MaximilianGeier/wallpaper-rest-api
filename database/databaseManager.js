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


const setLike = async (connection, userId, imageId) => {
    const result = {
        statusCode: 500,
        message: {message: "Проблемы на стороне сервера"}
    }
    console.log("начинаем запрос")
    await connection.query(
        "insert into user_images (user_id, image_id) values (?, ?)", [userId, imageId]
    ).then((queryResult) => {
        if(queryResult[0].length === 0){
            console.log('проблемы доступа к БД')
            result.statusCode = 400
            result.message.message = "проверьте корректность запроса"
        }
        else{
            const insertId = queryResult[0].insertId
            console.log('ответ из бд получен ', insertId)
            result.statusCode = 201
            result.message.message = "Успешно"
        }
    }).catch((error) => {
        result.statusCode = 500
        result.message.message = {message: "Проблемы на стороне сервера"}
    })
    console.log('результат: ', result)
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

module.exports = {
    setLike,
    deleteLike,
    getCurrentUserID,
}