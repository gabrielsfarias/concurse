const { app } = require('@azure/functions')
const { createCheerioRouter, CheerioCrawler, log } = require('crawlee')
const { organizers } = require('../../constants/organizer.js')
const { BASE_URL } = require('../../constants/baseUrl.js')
const { ConnectionFailedError } = require('../../errors/connectionFailed.js')
const { upsertItem } = require('../../shared/upsertItem.js')
const { validateURL } = require('../../shared/validateURL.js')
const { initializeDatabase } = require('../../shared/setupDatabaseAndContainer.js')
const { getUniqueLinkId } = require('../../shared/uniqueId.js')
const { SocketHangUpError } = require('../../errors/socketHangup.js')

process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0
let scraperFgv
let scrapedData
let container

app.timer('FGV', {
  schedule: '* */1 * * *',
  runOnStartup: true,
  handler: async (myTimer, context) => {
    context.log('Timer function processed request.')

    try {
      if (!container) {
        container = await initializeDatabase() // Initialize the database if not already done
      }

      const startUrls = [`${BASE_URL.fgv}/concursos`]

      const router = createCheerioRouter()
      const banca = organizers.FGV

      router.addDefaultHandler(async ({ enqueueLinks, log }) => {
        log.info('enqueueing new URLs')
        await enqueueLinks({
          globs: [`${BASE_URL.fgv}/concursos/**`, `${BASE_URL.fgv}/sites/**`],
          label: organizers.FGV
        })
      })

      router.addHandler(banca, async ({ request, $, log }) => {
        const concurso = $('div > div div > h1').text().trim()
        const arquivos = $('.field__item > p a[href], tr td > a')
          .map((i, el) => {
            const publicationText = $(el).text().trim()
            let link = $(el).attr('href')
            if (link.startsWith('/')) {
              link = `${BASE_URL.fgv}${link}`
            }
            if ((link.endsWith('.pdf') || link.includes('/sites/')) && validateURL(link)) {
              const uniqueId = getUniqueLinkId(banca, concurso, link)
              log.info(`concurso: ${concurso}publicationText: ${publicationText}`)
              return { link, publicationText, uniqueId }
            }
            return null
          })
          .get()
          .filter((item) => item !== null)
        log.info(`${concurso}`, { url: request.loadedUrl })
        log.info(`Arquivos: ${JSON.stringify(arquivos)}`)

        scrapedData = {
          banca,
          concurso,
          arquivos: arquivos.map((arquivo) => ({
            id: arquivo.uniqueId,
            publicationText: arquivo.publicationText.trim(),
            link: arquivo.link
          }))
        }
        upsertItem(container, request, $, scrapedData, banca) // Pass the data to upsertItem
      })

      scraperFgv = new CheerioCrawler({
        additionalMimeTypes: ['application/pdf'],
        requestHandler: router,
        requestHandlerTimeoutSecs: 120,
        retryOnBlocked: true,
        maxRequestRetries: 5
      })

      await scraperFgv.run(startUrls)
    } catch (error) {
      if (error instanceof SocketHangUpError) throw new SocketHangUpError()
      log.error(`Error in timer function: ${error.message}`)

      throw new ConnectionFailedError(`Error in timer function: ${error.message}`)
    }
  }
})

module.exports = {
  scrapedData,
  getSCraper: function () {
    return scraperFgv
  }
}
