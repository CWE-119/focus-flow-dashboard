const crypto = require('node:crypto');
const fs = require('node:fs');

function localSecrets(databasePath) {
  function key() {
    const filename = `${databasePath}.integrations.key`;
    try { fs.writeFileSync(filename, crypto.randomBytes(32), { flag: 'wx', mode: 0o600 }); }
    catch (error) { if (error.code !== 'EEXIST') throw error; }
    const value = fs.readFileSync(filename);
    if (value.length !== 32) throw new Error('Local credential key is invalid.');
    return value;
  }
  return {
    encrypt(value) {
      const nonce = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv('aes-256-gcm', key(), nonce);
      const data = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
      return Buffer.concat([nonce, cipher.getAuthTag(), data]).toString('base64');
    },
    decrypt(value) {
      const data = Buffer.from(value, 'base64');
      const cipher = crypto.createDecipheriv('aes-256-gcm', key(), data.subarray(0, 12));
      cipher.setAuthTag(data.subarray(12, 28));
      return JSON.parse(Buffer.concat([cipher.update(data.subarray(28)), cipher.final()]).toString('utf8'));
    },
  };
}

module.exports = { localSecrets };
