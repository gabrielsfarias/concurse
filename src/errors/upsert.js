class UpsertError extends Error {
  constructor(message) {
    super(message)
    this.name = 'UpsertError'
  }
}

module.exports = { UpsertError }
