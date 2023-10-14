class UpsertError extends Error {
  constructor(error) {
    super(`Error upserting item to Cosmos DB: ${error}`)
    this.name = 'FailedRequest'
  }
}

module.exports = { UpsertError }
