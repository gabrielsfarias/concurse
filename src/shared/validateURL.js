const url = require('node:url')
const dns = require('node:dns')

// Validate a URL
async function validateURL(inputURL) {
  try {
    const parsedURL = new url.URL(inputURL)

    // Ensure it's HTTP or HTTPS
    if (parsedURL.protocol !== 'http:' && parsedURL.protocol !== 'https:') {
      return false
    }

    // Validate the domain (e.g., domain should resolve to an IP address)
    try {
      const ipAddress = await lookupDomain(parsedURL.hostname)
      if (!ipAddress) {
        return false
      }
    } catch (error) {
      return false
    }

    // Ensure the path is not too long or doesn't contain restricted characters.
    if (parsedURL.pathname.length > 200 || /[\s\\<>]/.test(parsedURL.pathname)) {
      return false
    }

    return true
  } catch (error) {
    return false
  }
}

// Function to perform DNS lookup for domain validation
async function lookupDomain(hostname) {
  return new Promise((resolve, reject) => {
    dns.lookup(hostname, (err, address) => {
      if (err) {
        reject(err)
      } else {
        resolve(address)
      }
    })
  })
}

module.exports = { validateURL }
