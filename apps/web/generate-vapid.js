const webpush = require('web-push');
const fs = require('fs');

const vapidKeys = webpush.generateVAPIDKeys();

const content = `VAPID Keys Generated
====================

Public Key:
${vapidKeys.publicKey}

Private Key:
${vapidKeys.privateKey}

Length Check:
Public: ${vapidKeys.publicKey.length} characters
Private: ${vapidKeys.privateKey.length} characters
`;

console.log(content);
fs.writeFileSync('vapid-keys.txt', content);
console.log('\n✅ Keys saved to vapid-keys.txt');
