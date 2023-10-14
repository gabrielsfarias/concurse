const { app } = require('@azure/functions')
const { createCheerioRouter, CheerioCrawler, log } = require('crawlee')
const { organizers } = require('../constants/organizer.js')
const { ConnectionFailedError } = require('../errors/connectionFailed.js')
const { BASE_URL } = require('../constants/baseUrl.js')
const { upsertItem } = require('./upsertItem.js')
const { initializeDatabase } = require('./setupDatabaseAndContainer.js')

// process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0

let scraperFcc
let scrapedData
let container

app.timer('FCC', {
  runOnStartup: true,
  schedule: '0 11 * * * *',
  handler: async (myTimer, context) => {
    context.log('Timer function processed request.')

    try {
      if (!container) {
        container = await initializeDatabase() // Initialize the database if not already done
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
        log.info(`Arquivos: ${JSON.stringify(arquivos)}`)

        scrapedData = {
          concurso,
          arquivos
        }
        upsertItem(container, request, $, scrapedData) // Pass the data to upsertItem
      })

      scraperFcc = new CheerioCrawler({
        requestHandler: router,
        requestHandlerTimeoutSecs: 120,
        retryOnBlocked: true,
        maxRequestRetries: 5
      })

      await scraperFcc.run(startUrls)
    } catch (error) {
      log.error(error)
      throw new ConnectionFailedError()
    }
  }
})

module.exports = {
  scrapedData,
  getSCraper: function () {
    return scraperFcc
  }
}
