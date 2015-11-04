var NodeRSA = require('node-rsa');


var key = new NodeRSA({
    b: 368
});

var key1 = new NodeRSA({
    b: 368
});

key1.importKey(key.exportKey());

key.generateKeyPair(368);

key.setOptions({'signingScheme': 'sha1'});

var text='key';


key.sign(text,'base64');
 
key.verify(text,'base64');


console.log('key: ', key);
console.log('--------------------------------------------------------------------------');
console.log('key1: ', key1);
console.log('--------------------------------------------------------------------------');
console.log(key.exportKey());



