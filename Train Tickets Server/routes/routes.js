var requests = require('../config/requests');
var request = require('request');

module.exports = function (app) {
    var createResponse = function (rsp, err) {
        if (err) {
            return {
                status: "error",
                body: err
            };
        } else if (rsp) {
            return {
                status: "ok",
                body: rsp
            };
        }
    }

    app.get('/', function (req, res) {
        res.end("Train Tickets Server");
    });

    app.post('/signup', function (req, res) {
        var name = req.body.name;
        var username = req.body.username;
        var password = req.body.password;
        var creditCardType = req.body.creditcardtype;
        var creditCardNumber = req.body.creditcardnumber;
        var creditCardValidity = req.body.creditcardvalidity;

        requests.signup(name, username, password, creditCardType, creditCardNumber, creditCardValidity, function (found, err) {
            res.send(createResponse(found, err));
        });
    });

    app.post('/signin', function (req, res) {
        var username = req.body.username;
        var password = req.body.password;

        requests.signin(username, password, function (found,err) {
            res.send(createResponse(found, err));
        });
    });

    app.get('/timetable', function (req, res) {

        requests.timetable(function (found,err) {
            res.send(createResponse(found, err));
        });
    });

    app.post('/buyticket', function (req, res) {
        var id = req.body.id;
        var departure = req.body.departure;
        var arrival = req.body.arrival;
        var train = req.body.train;
        var departuredate = req.body.departuredate;
        var username = req.body.username;

        requests.buyticket(id, departure, arrival, train, departuredate, username, function (found,err) {
            res.json(createResponse(found, err));
        });
    });

    app.post('/mytickets', function (req, res) {
        var username = req.body.username;

        requests.mytickets(username, function (found, err) {
            res.json(createResponse(found, err));
        });
    });

    app.post('/validateticket', function (req, res) {
        var ticketid = req.body.ticketid;

        requests.validateticket(ticketid, function (found, err) {
            res.json(createResponse(found, err));
        });
    });

    app.get('/users', function (req, res) {
        requests.users(function (found, err) {
            res.json(createResponse(found, err));
        });
    });
};
