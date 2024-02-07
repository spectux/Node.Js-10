const express = require('express')
const path = require('path')
const {open} = require('sqlite')
const sqlite3 = require('sqlite3')
const {format} = require('date-fns')

const app = express()
app.use(express.json())
const dbPath = path.join(__dirname, 'todoApplication.db')

let db = null

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    })

    app.listen(3000, () => {
      console.log('Server Running at http://localhost:3000/')
    })
  } catch (e) {
    console.log(`DB Error: ${e.message}`)
    process.exit(1)
  }
}
initializeDBAndServer()

const convertDbObjectResponseObject = dbObject => {
  return {
    id: dbObject.id,
    todo: dbObject.todo,
    category: dbObject.category,
    priority: dbObject.priority,
    status: dbObject.status,
    dueDate: dbObject.due_date,
  }
}

// Middleware to replace spaces in URL with %20
const replaceSpacesMiddleware = (req, res, next) => {
  if (req.url.includes(' ')) {
    req.url = req.url.replace(/ /g, '%20')
  }
  next()
}

app.use(replaceSpacesMiddleware)

// GET All Todos based on various criteria
app.get('/todos/', async (request, response) => {
  const {status, priority, category, search_q} = request.query

  let getTodoQuery = `
      SELECT
        *
      FROM 
        todo`

  if (status || priority || category || search_q) {
    getTodoQuery += ' WHERE '
    const conditions = []
    if (status) conditions.push(`status = '${status}'`)
    if (priority) conditions.push(`priority = '${priority}'`)
    if (category) conditions.push(`category = '${category}'`)
    if (search_q) conditions.push(`todo LIKE '%${search_q}%'`)

    getTodoQuery += conditions.join(' AND ')
  }

  try {
    const todoArray = await db.all(getTodoQuery)
    response.send(
      todoArray.map(eachTodos => convertDbObjectResponseObject(eachTodos)),
    )
  } catch (error) {
    response.status(400).send('Invalid query parameters')
  }
})

// GET Todo by ID
app.get('/todos/:todoId/', async (request, response) => {
  const {todoId} = request.params
  const getTodoResponseQuery = `
      SELECT
        *
      FROM
        todo
      WHERE
        id = ${todoId};`
  try {
    const todoRestArray = await db.get(getTodoResponseQuery)
    if (todoRestArray) {
      response.send(todoRestArray)
    } else {
      response.status(404).send('Todo not found')
    }
  } catch (error) {
    response.status(400).send('Invalid request')
  }
})

// GET Todos for a specific date
app.get('/agenda/', async (request, response) => {
  const {date} = request.query
  try {
    const formattedDate = format(new Date(date), 'yyyy-MM-dd')
    const getQuery = `SELECT * FROM todo WHERE due_date = '${formattedDate}';`
    const result = await db.all(getQuery)
    response.send(result)
  } catch (error) {
    response.status(400).send('Invalid Due Date')
  }
})

// Validation middleware for status, priority, and category
const validateStatusPriorityCategory = (req, res, next) => {
  const {status, priority, category} = req.body
  const validStatus = ['TO DO', 'IN PROGRESS', 'DONE']
  const validPriority = ['HIGH', 'MEDIUM', 'LOW']
  const validCategory = ['WORK', 'HOME', 'LEARNING']

  if (status && !validStatus.includes(status)) {
    return res.status(400).send('Invalid Todo Status')
  }
  if (priority && !validPriority.includes(priority)) {
    return res.status(400).send('Invalid Todo Priority')
  }
  if (category && !validCategory.includes(category)) {
    return res.status(400).send('Invalid Todo Category')
  }
  next()
}

// POST Todos
app.post(
  '/todos/',
  validateStatusPriorityCategory,
  async (request, response) => {
    const {id, todo, priority, status, category, dueDate} = request.body
    const postQuery = `INSERT INTO todo (id, todo, priority, status, category, due_date)
  VALUES
  (${id}, '${todo}', '${priority}', '${status}', '${category}', '${dueDate}');`
    try {
      await db.run(postQuery)
      response.send('Todo Successfully Added')
    } catch (error) {
      response.status(400).send('Invalid Due Date')
    }
  },
)

// PUT Todos
app.put(
  '/todos/:todoId/',
  validateStatusPriorityCategory,
  async (request, response) => {
    const {todoId} = request.params
    const {id, todo, priority, status, category, dueDate} = request.body
    const updateFields = []

    if (id) updateFields.push(`id = '${id}'`)
    if (todo) updateFields.push(`todo = '${todo}'`)
    if (priority) updateFields.push(`priority = '${priority}'`)
    if (status) updateFields.push(`status = '${status}'`)
    if (category) updateFields.push(`category = '${category}'`)
    if (dueDate) updateFields.push(`due_date = '${dueDate}'`)

    const updateTodoquery = `
    UPDATE todo
    SET 
    ${updateFields.join(', ')}
    WHERE 
    id = ${todoId};`

    try {
      await db.run(updateTodoquery)
      response.send('Todo Updated')
    } catch (error) {
      response.status(400).send('Invalid update data')
    }
  },
)

// DELETE Todos
app.delete('/todos/:todoId/', async (request, response) => {
  const {todoId} = request.params
  const query = `DELETE FROM todo WHERE id = ${todoId};`
  await db.run(query)
  response.send('Todo Deleted')
})

module.exports = app
