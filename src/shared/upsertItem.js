const { log } = require('crawlee')
const { RequestTimeoutError } = require('../errors/requestTimeout.js')
const { UpsertError } = require('../errors/upsert.js')

async function upsertItem(container, request, $, scrapedData, banca) {
  // log.info(
  //   `Container: ${container}, Request: ${request}, $: ${$}, ScrapedData: ${JSON.stringify(
  //     scrapedData
  //   )}, Banca: ${banca}`
  // )
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
        id: arquivos.id,
        banca,
        concurso,
        url: request.loadedUrl,
        arquivos
      }
      try {
        await container.items.upsert(item)
        log.info(`Upserting item: ${JSON.stringify(item)}`)
        return arquivos
      } catch (error) {}
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
    // An item with the same URL exists, merge the existing arquivos with the new ones
    const existingItem = existingItems[0] // Assuming only one document per URL

    // Create a map of arquivos by their unique IDs
    const arquivoMap = new Map(existingItem.arquivos.map((arquivo) => [arquivo.link, arquivo]))

    // Merge the existing arquivos with the new ones
    for (const arquivo of scrapedData.arquivos) {
      if (!arquivoMap.has(arquivo.url)) {
        // Only add the arquivo if it doesn't already exist
        arquivoMap.set(arquivo.link, arquivo) // This will add a new arquivo
      }
    }

    // Convert the map back to an array
    const mergedArquivos = Array.from(arquivoMap.values())

    if (JSON.stringify(existingItem.arquivos) !== JSON.stringify(mergedArquivos)) {
      // The arquivos have changed, perform the upsert
      try {
        const item = {
          id: existingItem.id, // Use the existing id
          banca,
          concurso: scrapedData.concurso,
          url: request.loadedUrl,
          arquivos: mergedArquivos
        }

        await container.items.upsert(item)
        log.info(`Upserting item: ${JSON.stringify(item)}`)
        return mergedArquivos // Return the updated data
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
      // The arquivos are the same, skip the upsert
      log.info(`Item with URL ${request.loadedUrl} already exists and data is the same, skipping`)
      return existingItem.arquivos // Return the existing data
    }
  }
}

module.exports = { upsertItem }
