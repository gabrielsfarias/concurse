const { CosmosClient } = require('@azure/cosmos')
const { ConnectionFailedError } = require('../errors/connectionFailed.js')

const cosmosClient = new CosmosClient({
  endpoint: process.env.CosmosDB_Endpoint,
  key: process.env.CosmosDB_Key,
  connectionPolicy: { requestTimeout: 90000, retryOptions: { maxRetryAttemptCount: 10 } }
})

let database
let container

async function initializeDatabase() {
  if (!container) {
    try {
      const dbResponse = await cosmosClient.databases.createIfNotExists({
        id: 'concursos',
        throughput: 1000
      })
      database = dbResponse.database

      const containerResponse = await database.containers.createIfNotExists({
        id: 'concursos',
        partitionKey: { paths: ['/concurso'] },
        uniqueKeyPolicy: { paths: ['/url'] }
      })

      container = containerResponse.container
    } catch (error) {
      throw new ConnectionFailedError()
    }
  }
  return container
}

exports.initializeDatabase = initializeDatabase
