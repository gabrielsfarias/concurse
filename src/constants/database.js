module.exports.DATABASE = {
  ID: 'concursos',
  CONTAINER_ID: 'concursos',
  PARTITION_KEY_PATHS: ['/concurso'],
  UNIQUE_KEY_PATHS: ['/url']
}
