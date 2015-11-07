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
        var departure = req.body.departure;
        var arrival = req.body.arrival;
        var departuredate = req.body.departuredate;
        var username = req.body.username;

        requests.buyTicket(departure, arrival, departuredate, username, function (found,err) {
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
        var deviceid = req.body.deviceid; 

        requests.validateTicket(ticketid, deviceid, function (found, err) {
            res.json(createResponse(found, err));
        });
    });

    app.post('/validatetickets', function (req, res) {
        var tickets = req.body.tickets;

        requests.validateTickets(tickets, function (found, err) {
            res.json(createResponse(found, err));
        });
    });

    app.get('/users', function (req, res) {
        requests.users(function (found, err) {
            res.json(createResponse(found, err));
        });
    });

    app.get('/tickets', function (req, res) {

        var timetableId = req.query.timetableId;
        var date = req.query.departureDate;

        requests.tickets(timetableId, date,function (found, err) {
            res.json(createResponse(found, err));
        });
    });

    app.get('/statistics', function (req, res) { 
        requests.statistics(function (found, err) { 
            res.json(createResponse(found, err));
        });
    });

    app.get('/exittime', function (req, res) {
        var station1=req.query.station1;
        var station2=req.query.station2;

        requests.exitTime(station1,station2,function (found, err) {
            res.json(createResponse(found, err));
        });
    });

    app.get('/price', function (req, res) {
        var station1=req.query.station1;
        var station2=req.query.station2;

        requests.price(station1,station2,function (found, err) {
            res.json(createResponse(found, err));
        });
    });
};
 