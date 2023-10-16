const { CosmosClient } = require('@azure/cosmos')
const { ConnectionFailedError } = require('../errors/connectionFailed.js')
const { DATABASE } = require('../constants/database.js')

const cosmosClient = new CosmosClient({
  endpoint: process.env.CosmosDB_Endpoint,
  key: process.env.CosmosDB_Key,
  connectionPolicy: { requestTimeout: 120000, retryOptions: { maxRetryAttemptCount: 10 } }
})

let database
let container

async function initializeDatabase() {
  if (!container) {
    try {
      const dbResponse = await cosmosClient.databases.createIfNotExists({
        id: DATABASE.ID,
        throughput: 1000
      })
      database = dbResponse.database

      const containerResponse = await database.containers.createIfNotExists({
        id: DATABASE.CONTAINER_ID,
        partitionKey: { paths: DATABASE.PARTITION_KEY_PATHS },
        uniqueKeyPolicy: { paths: DATABASE.UNIQUE_KEY_PATHS }
      })

      container = containerResponse.container
    } catch (error) {
      // Log the error for debugging purposes
      console.error(`Error initializing database: ${error.message}`)
      throw new ConnectionFailedError()
    }
  }
  return container
}

module.exports = { initializeDatabase }
