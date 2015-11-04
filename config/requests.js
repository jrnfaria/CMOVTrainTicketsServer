var request = require('request');

var fs = require("fs");
var opt = require("./../settings.json");
var file = "traintickets.db";
var exists = fs.existsSync(file);
var async = require("async");
var NodeRSA = require("node-rsa");
var uuid = require("node-uuid");

var key = new NodeRSA({
    b: 368
});

key.importKey(key.exportKey());

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
                    passTime.setMinutes(passTime.getMinutes() + route[j].passTime);

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

exports.buyTicket = function (id, departure, arrival, departuredate, username, callback) {
    var split = departuredate.split('/');
    if (split.length == 3) {
        departuredate = split[1] + '/' + split[0] + '/' + split[2];
    }

    var date = new Date(departuredate);
    async.series([
            dateExists.bind('date', departuredate).bind('station', departure),
            stationsExists.bind('departure', departure).bind('arrival', arrival).bind('date', date),
            checkCapacity.bind('departure', departure).bind('arrival', arrival).bind('departuredate', date),
            buyTicketAux.bind('id', id).bind('departure', departure).bind('arrival', arrival).bind('departuredate', date).bind('username', username),
        ],
        function (err, obj) { //This is the final callback
            if (err) {
                callback(null, {
                    response: err
                });
            } else {
                callback({response:obj[3]}, null);
            }
        });
}

var dateExists = function (date, station, callback) {
    var pDate = new Date(date);

    var now = new Date();
    if (isNaN(pDate)) {
        callback("Invalid date", null);
    } else if (pDate < now) {
        callback("Date already passed", null);
    } else {
        callback(null, null);
    }
}

var buyTicketAux = function (id, departure, arrival, departuredate, username, callback) {

    var date = new Date(departure);

    db.all("SELECT TIMETABLEID AS timetable,STATIONID,TIMETABLESTATION.PASSTIME AS passTime,STATION.NAME AS stationName FROM STATION,TIMETABLE,TIMETABLESTATION WHERE STATION.NAME=? AND STATION.ID=TIMETABLESTATION.STATIONID AND TIMETABLE.ID=TIMETABLESTATION.TIMETABLEID", [departure], function (err, rows) {
        var selected;
        selected = rows[0];
        for (var i = 0; i < rows.length; i++) {
            if (rows[i].passTime < selected) {
                selected = rows[i];
            }
        }
        db.all("SELECT TRAIN.NAME AS trainName FROM TRAIN,TRAINTIMETABLE WHERE TRAINTIMETABLE.TIMETABLEID=? AND TRAIN.ID=TRAINTIMETABLE.TRAINID", [selected.timetable], function (err, train) {

            var stmt = db.prepare("INSERT INTO TICKET (TICKETID,DEPARTURE,ARRIVAL,TRAIN,DEPARTUREDATE,USER) VALUES ($id, $departure, $arrival, $train, $departuredate, $username)");
            stmt.bind({
                $id: uuid.v4(),
                $departure: departure,
                $arrival: arrival,
                $train: train[0].trainName,
                $departuredate: departuredate,
                $username: username
            });
            stmt.run();
            stmt.finalize();

            callback(null, {
                'response': "OK"
            });
        });
    });
}

//discovers timetable and stations and checks if capacity is good enough
var checkCapacity = function (departure, arrival, departuredate, callback) {
    //first discovers timetable
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
                var passTime = 0

                for (var i = 0; i < stations.length; i++) {
                    if (stations[i].NAME == comb.departure) {
                        passTime = stations[i].PASSTIME;
                        break;
                    }
                }
                var pDate = new Date(departuredate);
                pDate.setMinutes(pDate.getMinutes() + passTime % 60);
                pDate.setHours(parseInt(pDate.getHours()) + passTime / 60);

                db.all("SELECT * FROM TICKET WHERE DEPARTURE=? AND ARRIVAL=? AND DEPARTUREDATE=?", [comb.departure, comb.arrival, pDate], function (err, rows) {
                    if (rows.length > opt.trainCapacity) {
                        callback1("Train over capacity");
                    } else {
                        callback1(null);
                    }
                });
            }, function (err) {
                if (err) {
                    callback(err, null);
                } else {
                    callback(null, null);
                }
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

var stationsExists = function (departure, arrival, date, callback) {
    db.all("SELECT STATION.NAME AS stationName,STARTTIME AS startTime,PASSTIME AS passTime FROM STATION,TIMETABLESTATION,TIMETABLE,TRAINTIMETABLE WHERE (STATION.NAME=? OR STATION.NAME=?) AND TIMETABLESTATION.STATIONID=STATION.ID AND TRAINTIMETABLE.TIMETABLEID =TIMETABLE.ID AND TIMETABLESTATION.TIMETABLEID=TIMETABLE.ID", [departure, arrival], function (err, stations) {

        if (departure == arrival) {
            callback("The departure and arrival station are the same", null);
        } else if (stations.length < 2) {
            callback("One of the stations doesn't exist", null);
        } else {
            var validDeparture = false,
                validArrival = false;
            var pDate = new Date(date);

            var split, time

            for (var i = 0; i < stations.length; i++) {
                if (departure == stations[i].stationName) {
                    split = stations[i].startTime.split(":");
                    time = new Date(0, 0, 0, split[0], split[1], 0, 0);
                    time.setMinutes(time.getMinutes() + stations[i].passTime % 60);
                    time.setHours(parseInt(time.getHours()) + stations[i].passTime / 60);


                    if (pDate.getHours() == time.getHours() && pDate.getMinutes() == time.getMinutes()) {
                        validDeparture = true;
                    }

                } else if (arrival == stations[i].stationName) {
                    validArrival = true;
                }
                if (validArrival && validDeparture) {
                    break;
                }
            }

            if (validArrival && validDeparture) {
                callback(null, null);
            } else {
                callback('Invalid station', null);
            }
        }
    });

}

exports.validateTickets = function (tickets, callback) {
    async.forEach(tickets, function (ticket, callback1) {
        console.log(ticket);

        module.exports.validateTicket(ticket.ticketId, ticket.deviceId, function (resp, err) {
            callback1(err, resp);
        });
    }, function (err) {
        if (err) {
            callback(err, null);
        } else {
            callback({response:'ok'}, null);
        }
    });
}

exports.validateTicket = function (ticketid, deviceid, callback) {
    exports.ticket(ticketid, function (tickets) {
        if (tickets.length == 1) {
            exports.validation(ticketid, function (validations) {
                if (validations.length == 0) {
                    var stmt = db.prepare("INSERT INTO VALIDATION (TICKETID, DEVICEID) VALUES ($ticketId, $deviceId)");
                    stmt.bind({
                        $ticketId: ticketid,
                        $deviceId: deviceid
                    });
                    stmt.run();
                    stmt.finalize();

                    callback({
                        response: "OK"
                    }, null);
                } else {
                    if (validations.length == 1) {
                        if (validations[0].DEVICEID == deviceid) {
                            callback({
                                response: "OK"
                            }, null);
                        } else {
                            callback({
                                response: "Ticket already validated with another device"
                            }, null);
                        }
                    }
                }
            });
        } else {
            callback({
                response: "Ticket not found"
            }, null);
        }
    });
}

exports.users = function (callback) {
    db.all("SELECT * FROM USER", function (err, rows) {
        callback({response:rows}, null);
    });
}

exports.mytickets = function (username, callback) {
    db.all("SELECT * FROM TICKET WHERE USER=?", [username], function (err, rows) {
        callback({response:rows}, null);
    });
}

exports.ticket = function (ticketid, callback) {
    db.all("SELECT * FROM TICKET WHERE TICKETID=?", [ticketid], function (err, rows) {
        callback({response:rows}, null);
    });
}

exports.tickets = function (timetableId, departureDate, callback) {

    var date = new Date(departureDate);

    if (isNaN(date)) {
        callback(null, 'Invalid date');
    } else {
        var combs = new Array();

        db.all("SELECT * FROM STATION,TIMETABLESTATION WHERE TIMETABLESTATION.TIMETABLEID=? AND TIMETABLESTATION.STATIONID=STATION.ID ORDER BY TIMETABLESTATION.PASSTIME", [timetableId], function (err, stations) {
            for (i = 0; i < stations.length; i++) {
                for (j = 0; j < stations.length; j++) {
                    if (j > i) {
                        var depDate = new Date(date);
                        depDate.setMinutes(date.getMinutes() + stations[i].PASSTIME);

                        combs.push({
                            'departure': stations[i].NAME,
                            'arrival': stations[j].NAME,
                            'date': depDate
                        });
                    }
                }
            }

            var res = new Array();
            async.forEach(combs, function (comb, callback1) {

                db.all("SELECT * FROM TICKET WHERE TICKETID NOT IN (SELECT TICKETID FROM VALIDATION) AND TICKET.DEPARTURE=? AND TICKET.ARRIVAL=? AND DEPARTUREDATE=?", [comb.departure, comb.arrival, date], function (err, rows) {

                    res = res.concat(rows);
                    callback1(null, rows);
                });

            }, function (err) {
                if (err) {
                    console.log('err');
                    callback(null, {response:err});
                } else {
                    callback({response:res}, null);
                }
            });
        });
    }
}

exports.validation = function (ticketid, callback) {
    db.all("SELECT * FROM VALIDATION WHERE TICKETID=?", [ticketid], function (err, rows) {
        callback({response:rows}, null);
    });
}

exports.statistics = function (callback) {

    async.parallel({
            noShow: noShow,
            mostUsedDepStation: mostUsedDepStation,
            mostUsedArrStation: mostUsedArrStation,
            mostUsedTrain: mostUsedTrain,
            numUsers: numUsers
        },
        function (err, obj) { //This is the final callback
            if (err) {
                callback(null, {
                    response: err
                });
            } else {
                callback({
                    response: obj
                }, null);
            }
        });
}

var noShow = function (callback) {
    var now = new Date();
    db.all("SELECT * FROM VALIDATION", function (err, validation) {
        db.all("SELECT * FROM TICKET WHERE DEPARTUREDATE<?", [now], function (err, ticket) {
            var number = 1 - (validation.length / ticket.length);

            callback(null, number);
        });
    });
}

var mostUsedDepStation = function (callback) {
    var now = new Date();
    db.all("SELECT DEPARTURE AS station,Count(*) AS count FROM TICKET GROUP BY DEPARTURE ORDER BY count desc", function (err, rows) {
        db.all("SELECT DEPARTURE,Count(*) AS count FROM TICKET", function (err, rows1) {

            for (var i = 0; i < rows.length; i++) {
                rows[i].prob = rows[i].count / rows1[0].count;
            }

            callback(null,
                rows
            );
        });
    });
}

var mostUsedArrStation = function (callback) {
    var now = new Date();
    db.all("SELECT ARRIVAL AS station,Count(*) AS count FROM TICKET GROUP BY ARRIVAL", function (err, rows) {
        db.all("SELECT ARRIVAL,Count(*) AS count FROM TICKET", function (err, rows1) {
            for (var i = 0; i < rows.length; i++) {
                rows[i].prob = rows[i].count / rows1[0].count;
            }
            callback(null,
                rows
            );
        });
    });
}

var mostUsedTrain = function (callback) {
    var now = new Date();
    db.all("SELECT TRAIN AS train,Count(*) AS count FROM TICKET GROUP BY DEPARTURE", function (err, rows) {
        db.all("SELECT Count(*) AS count FROM TICKET", function (err, rows1) {
            for (var i = 0; i < rows.length; i++) {
                rows[i].prob = rows[i].count / rows1[0].count;
            }
            callback(null,
                rows
            );
        });
    });
}

var numUsers = function (callback) {
    db.all("SELECT Count(*) AS count FROM USER", function (err, rows) {
        callback(null, rows[0].count);
    });
}


exports.exitTime = function (station1, station2, callback) {

    db.all("SELECT ID FROM STATION WHERE NAME=?  OR NAME=?", [station1, station2], function (err, stations) {
        console.log(stations);
        if (stations.length < 2) {
            callback(null, {response:"One of the stations doesn't exist"});
        } else {
            station1 = stations[0].ID;
            station2 = stations[1].ID;

            db.all("SELECT TIMETABLEID as timetableId,PASSTIME as passTime,STATIONID as stationId FROM  TIMETABLESTATION WHERE STATIONID=? AND TIMETABLEID IN(SELECT TIMETABLEID FROM TIMETABLESTATION WHERE STATIONID=?) ORDER BY TIMETABLEID,PASSTIME", [station1, station2], function (err, rows) {
                var timetableId = 0;
                var time;
                console.log(rows);
                if (rows[0].stationId == station1) {
                    timetableId = rows[0].timetableId;
                    time = rows[0].passTime;
                } else {
                    timetableId = rows[2].timetableId;
                    time = rows[2].passTime;
                }
                db.all("SELECT STARTTIME AS startTime FROM  TRAINTIMETABLE WHERE TIMETABLEID=? ORDER BY STARTTIME", [timetableId], function (err, rows1) {
                    var rsp = new Array();
                    var date = new Date();
                    var split;
                    for (var i = 0; i < rows1.length; i++) {
                        split = rows1[i].startTime.split(':');
                        date.setHours(split[0]);
                        date.setMinutes(split[1] + time);

                        rsp.push(date.getHours() + ':' + date.getMinutes());
                    }
                    callback({
                        response: rsp
                    }, null);
                });


            });
        }
    });
}

exports.price = function (station1, station2, callback) {

    db.all("SELECT ID FROM STATION WHERE NAME=?  OR NAME=?", [station1, station2], function (err, stations) {
        console.log(stations);
        if (stations.length < 2) {
            callback(null, {response:"One of the stations doesn't exist"});
        } else {
            station1 = stations[0].ID;
            station2 = stations[1].ID;

            db.all("SELECT TIMETABLEID as timetableId,PASSTIME as passTime,STATIONID as stationId FROM  TIMETABLESTATION WHERE STATIONID=? AND TIMETABLEID IN(SELECT TIMETABLEID FROM TIMETABLESTATION WHERE STATIONID=?) ORDER BY TIMETABLEID,PASSTIME", [station1, station2], function (err, rows) {
                console.log(rows);
                var timetableId = 0;

                if (rows[0].stationId == station1) {
                    timetableId = rows[0].timetableId;
                } else {
                    timetableId = rows[2].timetableId;
                }

                db.all("SELECT TIMETABLEID as timetableId,PASSTIME as passTime,STATIONID as stationId FROM  TIMETABLESTATION WHERE TIMETABLEID=? ORDER BY PASSTIME", [timetableId], function (err, rows1) {

                    var pos1, pos2;

                    console.log(rows1);
                    for (var i = 0; i < rows1.length; i++) {
                        if (rows1[i].stationId == station1) {
                            pos1 = i;
                        } else if (rows1[i].stationId == station2) {
                            pos2 = i;
                        }
                    }
                    var rsp = Math.abs(2.5 * (pos2 - pos1));
                    callback({
                        response: rsp
                    }, null);
                });
            });
        }
    });
}
