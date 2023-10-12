import { app } from '@azure/functions'

app.timer('fcc', {
  schedule: '0 */10 * * * *',
  handler: (myTimer, context) => {
    context.log('Timer function processed request.')
  }
})
