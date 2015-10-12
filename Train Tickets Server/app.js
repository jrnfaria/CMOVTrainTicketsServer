// Module dependencies
var express = require('express');
var connect = require('connect');
var bodyParser = require('body-parser');
var settings = require('./settings.json');
var app = express();
var port = process.env.PORT || settings.port;

// parse application/json
app.use(bodyParser.json())

// Routes
require('./routes/routes.js')(app);

app.listen(port);
console.log('App running on port ' + port);