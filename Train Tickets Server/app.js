// Module dependencies
var express = require('express');
var connect = require('connect');
var bodyParser = require('body-parser')
var app = express();
var port = process.env.PORT || 8080;

// parse application/json
app.use(bodyParser.json())

// Routes
require('./routes/routes.js')(app);

app.listen(port);
console.log('The App runs on port ' + port);