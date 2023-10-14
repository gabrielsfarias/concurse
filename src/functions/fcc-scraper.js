const { app } = require('@azure/functions')
const { createCheerioRouter, CheerioCrawler, log } = require('crawlee')
const { organizers } = require('../constants/organizer.js')
const { ConnectionFailedError } = require('../errors/connectionFailed.js')
const { initializeDatabase } = require('./setupDatabaseAndContainer.js')
const { upsertItem } = require('./upsertItem.js')
const { BASE_URL } = require('../constants/baseUrl.js')

process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0

let scraperFcc

app.timer('FCC', {
  runOnStartup: true,
  schedule: '0 */5 * * * *',
  handler: async (myTimer, context) => {
    context.log('Timer function processed request.')

    try {
      const container = await initializeDatabase()

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

        await upsertItem(container, request, $)
      })

      scraperFcc = new CheerioCrawler({
        requestHandler: router,
        requestHandlerTimeoutSecs: 90,
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

exports.getSCraper = function () {
  return scraperFcc
}
