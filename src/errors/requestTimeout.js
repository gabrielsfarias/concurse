class RequestTimeoutError extends Error {
  constructor() {
    super('Request to the database timed out')
    this.name = 'RequestTimeoutError'
  }
}
// Export the class for use in other modules
module.exports = { RequestTimeoutError }
