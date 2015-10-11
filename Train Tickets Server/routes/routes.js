var requests = require('../config/requests');
var request = require('request');

module.exports = function(app)
{
    app.get('/', function(req, res)
    {
        res.end("Train Tickets Server");
    });

    app.post('/signup', function(req, res)
    {
        var name = req.body.name;
        var username = req.body.username;
        var password = req.body.password;
        var creditcardtype = req.body.creditcardtype;
        var creditcardnumber = req.body.creditcardnumber;
        var creditcardvalidity = req.body.creditcardvalidity;

        requests.signup(name, username, password, creditcardtype, creditcardnumber, creditcardvalidity, function(found)
        {
            res.json(found);
        });
    });

    app.post('/signin', function(req, res)
    {
        var username = req.body.username;
        var password = req.body.password;

        requests.signin(username, password, function(found)
        {
            res.json(found);
        });
    });

    app.post('/buyticket', function(req, res)
    {
        var id = req.body.id;
        var departure = req.body.departure;
        var arrival = req.body.arrival;
        var train = req.body.train;
        var departuredate = req.body.departuredate;
        var username = req.body.username;

        requests.buyticket(id, departure, arrival, train, departuredate, username, function(found)
        {
            res.json(found);
        });
    });

    app.post('/mytickets', function(req, res)
    {
        var username = req.body.username;

        requests.mytickets(username, function(found)
        {
            res.json(found);
        });
    });

    app.get('/users', function(req, res)
    {
        requests.users(function(found)
        {
            res.json(found);
        });
    });
};
