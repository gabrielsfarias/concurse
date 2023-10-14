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
  endpoint: process.env.CosmosDB_Endpoint,
  key: process.env.CosmosDB_Key,
  connectionPolicy: { requestTimeout: 8000 }
})

let database
let container
let crawlerFcc

app.timer('FCC', {
  runOnStartup: true,
  schedule: '0 */5 * * * *',
  handler: async (myTimer, context) => {
    context.log('Timer function processed request.')

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
      log.error(error)
      throw new ConnectionFailedError()
    }

    const startUrls = [
      `${BASE_URL.fcc}/concursoOutraSituacao.html`,
      `${BASE_URL.fcc}/concursoAndamento.html`
    ]

    const router = createCheerioRouter()
    router.addDefaultHandler(async ({ enqueueLinks, log, $ }) => {
      log.info('enqueueing new URLs')
      await enqueueLinks({
        globs: [`${BASE_URL.fcc}/concursos/**`],
        label: organizers.FCC
      })
    })

    router.addHandler(organizers.FCC, async ({ request, $, log }) => {
      const concurso = $('title').text().substring(6)
      const arquivos = $('.linkArquivo .campoLinkArquivo a[href]')
        .map((i, el) => {
          const link = $(el).attr('href')
          if (link.endsWith('.pdf')) {
            const urlSemIndexHtml = request.loadedUrl.replace('index.html', '')
            return { link: urlSemIndexHtml + link }
          }
          log.debug(link)
          return null
        })
        .get()
        .filter((item) => item !== null)
      log.info(`${concurso}`, { url: request.loadedUrl })

      // Check if an item with the same url already exists
      const querySpec = {
        query: 'SELECT * FROM c WHERE c.url = @url',
        parameters: [
          {
            name: '@url',
            value: request.loadedUrl
          }
        ]
      }

      const { resources: existingItems } = await container.items.query(querySpec).fetchAll()

      if (existingItems.length === 0) {
        // If no existing item with the same url, upsert the new item
        try {
          const item = {
            banca: organizers.FCC,
            concurso,
            url: request.loadedUrl,
            arquivos
          }
          await container.items.upsert(item)
          log.info(`Upserting item: ${JSON.stringify(item)}`)
        } catch (error) {
          if (error.name === 'TimeoutError') {
            throw new RequestTimeoutError()
          } else {
            throw new UpsertError()
          }
        }
      } else {
        log.info(`Item with url ${request.loadedUrl} already exists, skipping`)
      }
    })

    crawlerFcc = new CheerioCrawler({
      requestHandler: router,
      requestHandlerTimeoutSecs: 1000,
      retryOnBlocked: true,
      maxRequestRetries: 5
    })

    await crawlerFcc.run(startUrls)
  }
})

exports.getCrawler = async function () {
  return crawlerFcc
}
