/**
 * Crypto polyfill for Node 18
 *
 * Node 18 doesn't have global.crypto, but workbox-build needs it.
 * This script loads the crypto module and assigns it globally before
 * the build process starts.
 */

const { webcrypto } = require('node:crypto');

if (!global.crypto) {
  global.crypto = webcrypto;
}
