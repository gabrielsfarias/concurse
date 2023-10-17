const { createHash } = require('node:crypto')

function getUniqueLinkId(banca, concurso, url) {
  const idString = `${banca}${concurso}${url}`
  return createHash('sha256').update(idString).digest('hex')
}

module.exports = { getUniqueLinkId }
