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

let scraperFcc
let scrapedData
let container

app.timer('FCC', {
  schedule: '0 12 * * *',
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
      const banca = organizers.FCC

      router.addDefaultHandler(async ({ enqueueLinks, log }) => {
        log.info('enqueueing new URLs')
        await enqueueLinks({
          globs: [`${BASE_URL.fcc}/concursos/**`],
          label: organizers.FCC
        })
      })
      router.addHandler(banca, async ({ request, $, log }) => {
        const concurso = $('title').text().substring(6)
        const arquivos = $('.linkArquivo .campoLinkArquivo a[href]')
          .map((i, el) => {
            const publicationText = $(el).text().trim()
            const link = $(el).attr('href')
            if (link.endsWith('.pdf') && validateURL(link)) {
              const urlSemIndexHtml = request.loadedUrl.replace('index.html', '')
              log.info(`Banca: ${banca}, Concurso: ${concurso}, Link: ${link}`)
              const uniqueId = getUniqueLinkId(banca, concurso, link)
              return { link: urlSemIndexHtml + link, publicationText, uniqueId }
            }
            log.debug(link)
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

      scraperFcc = new CheerioCrawler({
        requestHandler: router,
        requestHandlerTimeoutSecs: 120,
        retryOnBlocked: true,
        maxRequestRetries: 5
      })

      await scraperFcc.run(startUrls)
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
    return scraperFcc
  }
}
