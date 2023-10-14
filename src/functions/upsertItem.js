const { log } = require('crawlee')
const { RequestTimeoutError } = require('../errors/requestTimeout.js')
const { UpsertError } = require('../errors/upsert.js')
const { organizers } = require('../constants/organizer.js')

async function upsertItem(container, request, $) {
  // Check if an item with the same URL already exists
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
    // If no existing item with the same URL, upsert the new item
    try {
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

      const item = {
        banca: organizers.FCC,
        concurso,
        url: request.loadedUrl,
        arquivos
      }
      await container.items.upsert(item)
      log.info(`Upserting item: ${JSON.stringify(item)}`)
      return arquivos
    } catch (error) {
      if (error.code === 408) {
        // Timeout error
        throw new RequestTimeoutError()
      } else {
        log.error(error)
        throw new UpsertError()
      }
    }
  } else {
    log.info(`Item with URL ${request.loadedUrl} already exists, skipping`)
  }
}

exports.upsertItem = upsertItem
