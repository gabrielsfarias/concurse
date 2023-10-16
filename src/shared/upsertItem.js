const { log } = require('crawlee')
const { RequestTimeoutError } = require('../errors/requestTimeout.js')
const { UpsertError } = require('../errors/upsert.js')
const { organizers } = require('../constants/organizer.js')

async function upsertItem(container, request, $, scrapedData) {
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
    // If no existing item with the same URL, upsert the new item using the passed scraped data
    try {
      const concurso = scrapedData.concurso
      const arquivos = scrapedData.arquivos

      const item = {
        id: arquivos[0].id, // Use the unique ID of the first file in the arquivos array
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
        throw new UpsertError('Error upserting item to Cosmos DB: ' + error.message)
      }
    }
  } else {
    // An item with the same URL exists, check if data is different before upserting
    const existingItem = existingItems[0] // Assuming only one document per URL

    if (JSON.stringify(existingItem.arquivos) !== JSON.stringify(scrapedData.arquivos)) {
      // Data is different, perform the upsert
      try {
        const item = {
          id: existingItem.id, // Use the existing id
          banca: organizers.FCC,
          concurso: scrapedData.concurso,
          url: request.loadedUrl,
          arquivos: scrapedData.arquivos
        }

        await container.items.upsert(item)
        log.info(`Upserting item: ${JSON.stringify(item)}`)
        return scrapedData.arquivos // Return the updated data
      } catch (error) {
        if (error.code === 408) {
          // Timeout error
          throw new RequestTimeoutError()
        } else {
          log.error(error)
          throw new UpsertError('Error upserting item to Cosmos DB: ' + error.message)
        }
      }
    } else {
      // Data is the same, skip the upsert
      log.info(`Item with URL ${request.loadedUrl} already exists and data is the same, skipping`)
      return existingItem.arquivos // Return the existing data
    }
  }
}

module.exports = { upsertItem }
