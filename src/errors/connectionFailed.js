class ConnectionFailedError extends Error {
  constructor() {
    super('Failed to connect to the database')
    this.name = 'ConnectionFailedError'
  }
}

module.exports = { ConnectionFailedError }
