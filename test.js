var NodeRSA = require('node-rsa');


var key = new NodeRSA({
    b: 368
});


key.generateKeyPair(368);

key.setOptions({'signingScheme': 'sha1'});

var text='key';

var b;
var a=key.sign(text,'base64','utf8');
 console.log('t1: ', a);

b=key.verify(text,a,'utf8','base64');
console.log('t2: ', b);









