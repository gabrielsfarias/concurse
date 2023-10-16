class SocketHangUpError extends Error {
  constructor() {
    super('Socket hang up error')
    this.name = 'SocketHangUpError'
  }
}

module.exports = { SocketHangUpError }
