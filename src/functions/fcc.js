const { CosmosClient } = require('@azure/cosmos')
const { app } = require('@azure/functions')
const { CheerioCrawler, createCheerioRouter, log } = require('crawlee')
const { BASE_URL } = require('../constants/baseUrl.js')
const { organizers } = require('../constants/organizer.js')
const { ConnectionFailedError } = require('../errors/connectionFailed.js')
const { RequestTimeoutError } = require('../errors/requestTimeout.js')
const { UpsertError } = require('../errors/upsert.js')

process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0
const cosmosClient = new CosmosClient({
  endpoint: 'https://localhost:8081/',
  key: 'C2y6yDjf5/R+ob0N8A7Cgv30VRDJIWEHLM+4QDU5DE2nQ9nDuVTqobD4b8mGGyPMbIZnqyMsEcaGQy67XIw/Jw=='
})

const fccCrawler = new CheerioCrawler({
  async requestHandler({ request, $, enqueueLinks, log }) {
    const title = $('title').text()
    log.info(`Title of ${request.loadedUrl} is '${title}'`)

    // Save results to CosmosDB
    const { database } = await cosmosClient.databases.createIfNotExists({
      id: 'cosmicworks',
      throughput: 400
    })

    const { container } = await database.containers.createIfNotExists({
      id: 'products',
      partitionKey: {
        paths: ['/id']
      }
    })

    const item = {
      id: '68719518371',
      name: title
    }

    await container.items.upsert(item)

    // Extract links from the current page
    // and add them to the crawling queue.
    await enqueueLinks()
  },
  maxRequestsPerCrawl: 50
})

export const timer = app.timer('FCC', {
  runOnStartup: true,
  schedule: '0 */2 * * * *',
  handler: async (myTimer, context) => {
    await fccCrawler.run(['https://example.com'])
    context.log('Timer function processed request.')
  }
})
exports.getCrawler = async function () {
  return crawlerFcc
}
