var request = require('request');

var fs = require("fs");
var opt = require("./../settings.json");
var file = "traintickets.db";
var exists = fs.existsSync(file);
var async = require("async");

var sqlite3 = require("sqlite3").verbose();
var db = new sqlite3.Database(file);

if (!exists) {
    console.log("Creating database file...");
    fs.openSync(file, "w");
    db.run("CREATE TABLE USER (NAME TEXT, USERNAME TEXT, PASSWORD TEXT)");
    db.run("CREATE TABLE CREDITCARD (TYPE TEXT, NUMBER INT, VALIDITY TEXT, USER REFERENCES USER(USERNAME))");
    db.run("CREATE TABLE TICKET(ID INTEGER, DEPARTURE TEXT, ARRIVAL TEXT, TRAIN TEXT, DEPARTUREDATE TEXT, USER REFERENCES USER(USERNAME))");
    console.log("Done!");
}

var userAlreadyExists = function (username) {
    db.all("SELECT * FROM USER WHERE USERNAME=?", [username], function (err, rows) {
        if (err) {
            return true;
        } else
            return !rows.length == 0;
    });
}

exports.signup = function (name, username, password, creditcardtype, creditcardnumber, creditcardvalidity, callback) {

    if (userAlreadyExists(username)) {
        var stmt = db.prepare("INSERT INTO USER VALUES ($name, $username, $password)");
        stmt.bind({
            $name: name,
            $username: username,
            $password: password
        });
        stmt.run();
        stmt.finalize();
        stmt = db.prepare("INSERT INTO CREDITCARD VALUES ($creditcardtype, $creditcardnumber, $creditcardvalidity, $username)");
        stmt.bind({
            $creditcardtype: creditcardtype,
            $creditcardnumber: creditcardnumber,
            $creditcardvalidity: creditcardvalidity,
            $username: username
        });
        stmt.run();
        stmt.finalize();

        callback({
            'response': "OK"
        }, null);
    } else {
        callback(null, {
            'response': "Username already exists"
        });
    }
}

exports.signin = function (username, password, callback) {
    this.users(function (users) {
        var found = 0;

        for (var i = 0; i < users.length; i++) {
            if (users[i].USERNAME == username && users[i].PASSWORD == password)
                found = 1;
        }

        if (found == 1)
            callback({
                'response': "OK"
            }, null);
        else
            callback({
                'response': "Wrong username or password"
            }, null);
    });
}

//get timetable
exports.timetable = function (callback) {
    async.parallel([
            timetableAux.bind('timetableId', 1),
            timetableAux.bind('timetableId', 2),
            timetableAux.bind('timetableId', 3),
            timetableAux.bind('timetableId', 4)
        ],
        function (err, obj) { //This is the final callback
            if (err) {
                callback(null, {
                    "response": err
                });
            } else {
                callback({
                    "response": obj
                }, null);
            }
        })

}

var timetableAux = function (timetableId, callback) {

    db.all("SELECT TIMETABLE.NAME AS route,STATION.NAME AS stationName,TIMETABLESTATION.PASSTIME AS passTime FROM TIMETABLE,STATION,TIMETABLESTATION WHERE TIMETABLE.ID=? AND TIMETABLESTATION.TIMETABLEID=TIMETABLE.ID AND TIMETABLESTATION.STATIONID=STATION.ID ORDER BY passTime", [timetableId], function (err, route) {
        // console.log(route);
        db.all("SELECT TRAIN.NAME AS trainName,TRAINTIMETABLE.STARTTIME AS startTime FROM TRAIN,TIMETABLE,TRAINTIMETABLE WHERE TIMETABLE.ID=? AND TRAINTIMETABLE.TIMETABLEID=TIMETABLE.ID AND TRAINTIMETABLE.TRAINID=TRAIN.ID ORDER BY datetime(startTime) ASC", [timetableId], function (err, trains) {
            var processedTrains = new Array();

            for (var i = 0; i < trains.length; i++) {
                var stations = {
                    'name': trains[i].trainName,
                    'stations': []
                };

                //get and convert time
                var split = trains[i].startTime.split(":");

                var startTime = new Date(0, 0, 0, split[0], split[1], 0, 0);

                for (var j = 0; j < route.length; j++) {

                    var passTime = new Date(startTime);
                    passTime.setMinutes(passTime.getMinutes() + route[j].passTime % 60);
                    passTime.setHours(parseInt(passTime.getHours()) + route[j].passTime / 60);

                    var station = {
                        'name': route[j].stationName,
                        'time': (passTime.getHours() + ":" + passTime.getMinutes())
                    };
                    stations.stations.push(station);
                }
                processedTrains.push(stations);
            }
            callback(null, {
                'route': route[0].route,
                'trains': processedTrains
            });
        });
    });
}

//a1       B1       T1
exports.buyTicket = function (id, departure, arrival, train, departuredate, username, callback) {

    //see if station exist and get id done
    //train
    //start date
    //create ticket


    async.series([
            trainExists.bind('train', train),
            stationsExists.bind('departure', departure).bind('arrival', arrival),
            checkCapacity.bind('departure', departure).bind('arrival', arrival).bind('departuredate', departuredate),
            buyTicketAux.bind('id', id).bind('departure', departure).bind('arrival', arrival).bind('train', train).bind('departuredate', departuredate).bind('username', username),
        ],
        function (err, obj) { //This is the final callback
            if (err) {
                callback(null, {
                    "response": err
                });
            } else {
                callback(obj[3], null);
            }
        });
}

var buyTicketAux = function (id, departure, arrival, train, departuredate, username, callback) {

    var stmt = db.prepare("INSERT INTO TICKET (TICKETID,DEPARTURE,ARRIVAL,TRAIN,DEPARTUREDATE,USER) VALUES ($id, $departure, $arrival, $train, $departuredate, $username)");
    stmt.bind({
        $id: id,
        $departure: departure,
        $arrival: arrival,
        $train: train,
        $departuredate: departuredate,
        $username: username
    });
    stmt.run();
    stmt.finalize();

    callback(null, {
        'response': "OK"
    });
}

var checkCapacity = function (departure, arrival, departuredate, callback) {
    //discovers timetable and stations and sees if capacity is good enought

    db.all("SELECT TIMETABLEID AS timetable,STATIONID,TIMETABLESTATION.PASSTIME AS passTime,STATION.NAME AS stationName FROM STATION,TIMETABLE,TIMETABLESTATION WHERE (STATION.NAME=? OR STATION.NAME=?) AND STATION.ID=TIMETABLESTATION.STATIONID AND TIMETABLE.ID=TIMETABLESTATION.TIMETABLEID", [departure, arrival], function (err, rows) {
        var timetableId = 0;
        var passTime = 500;
        var ended = false;
        var i;
        for (i = 0; i < rows.length; i++) {
            if (rows[i].stationName == departure && rows[i].passTime < passTime) {
                passTime = rows[i].passTime;
                timetableId = rows[i].timetable;
            }
        }

        var found = false;
        var combs = new Array();

        db.all("SELECT * FROM STATION,TIMETABLESTATION WHERE TIMETABLESTATION.TIMETABLEID=? AND TIMETABLESTATION.STATIONID=STATION.ID ORDER BY TIMETABLESTATION.PASSTIME", [timetableId], function (err, stations) {
            for (i = 0; i < stations.length; i++) {
                if (stations[i].NAME == departure) {
                    found = true;
                }
                if (found) {
                    for (j = 0; j < stations.length; j++) {
                        if (j > i)
                            combs.push({
                                'departure': stations[i].NAME,
                                'arrival': stations[j].NAME
                            });
                    }
                }
            }

            async.forEach(combs, function (comb, callback1) {
                db.all("SELECT * FROM TICKET WHERE DEPARTURE=? AND ARRIVAL=? AND DEPARTUREDATE=?", [comb.departure, comb.arrival, departuredate], function (err, rows) {
                    console.log(rows.length);
                    if (rows.length > opt.trainCapacity) {
                        callback1("Train over capacity");
                    } else {
                        callback1(null);
                    }
                });
            }, function (err) {
                console.log(err);
                if (err) callback(err, null);
                else
                    callback(null, null);
            });
        });
    });
}

var trainExists = function (train, callback) {
    db.all("SELECT * FROM TRAIN WHERE TRAIN.NAME=?", [train], function (err, rows) {
        if (rows.length == 0) {
            callback("Train doesn't exist", null);
        } else {
            callback(null, null);
        }
    });
}

var stationsExists = function (departure, arrival, callback) {
    db.all("SELECT * FROM STATION WHERE STATION.NAME=? OR STATION.NAME=?", [departure, arrival], function (err, rows) {
        if (rows.length != 2) {
            callback("One of the station doesn't exist", null);
        } else {
            callback(null, null);
        }
    });
}

exports.validateticket = function (ticketid, callback) {
    this.ticket(ticketid, function (tickets) {
        if (tickets.length == 1)
            callback({
                'response': "OK"
            }, null);
        else
            callback({
                'response': "Ticket not found"
            }, null);
    });
}

exports.users = function (callback) {
    db.all("SELECT * FROM USER", function (err, rows) {
        callback(rows, null);
    });
}

exports.mytickets = function (username, callback) {
    db.all("SELECT * FROM TICKET WHERE USER=?", [username], function (err, rows) {
        callback(rows, null);
    });
}

exports.ticket = function (ticketid, callback) {
    db.all("SELECT * FROM TICKET WHERE TICKETID=?", [ticketid], function (err, rows) {
        callback(rows, null);
    });
}
