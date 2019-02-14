// import .env
require('dotenv').config()
var port = 80
if (process.env.PORT != undefined) {
    port = process.env.PORT
}
var urlport = 81
if (process.env.URLPORT != undefined) {
    urlport = process.env.URLPORT
}
var https = 'http://'
var ishttps = false
if (process.env.HTTPS == 'true') {
    https = 'https://'
    var ishttps = true
}
var redirdomain = 'localhost'
if (process.env.REDIRDOMAIN != undefined) {
    redirdomain = process.env.REDIRDOMAIN
}
var homedomain = 'localhost'
if (process.env.HOMEDOMAIN != undefined) {
    homedomain = process.env.HOMEDOMAIN
}

// randomid generation
const shortid = require('shortid');

// require express
var path = require('path')
var express = require('express')
var app = express()
var redir = express()
var expressWs = require('express-ws')(app);

// set the view engine to ejs
app.set('view engine', 'ejs');

const Keyv = require('keyv');
const idDB = new Keyv('sqlite://' + __dirname + '/RedirRDB.sqlite', {namespace : 'id'});
const domainDB = new Keyv('sqlite://' + __dirname + '/RedirRDB.sqlite', {namespace : 'domain'});
const adminDB = new Keyv('sqlite://' + __dirname + '/RedirRDB.sqlite', {namespace : 'admin'});

idDB.on('error', (err) => {console.log(err)});
domainDB.on('error', (err) => {console.log(err)});
adminDB.on('error', (err) => {console.log(err)});

// url regex
const urlRegex = /^(https?:\/\/(www\.)?)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,24}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)/

// set totalIDs if doesnt exist
adminDB.get('totalIDs')
    .then((totalIDs)=>{
        if(totalIDs == undefined){
            adminDB.set('totalIDs', 0)
        }
    })

// reply to index
var homeHandler = function (req, res) {
    res.render('pages/home', {domain : homedomain, ishttps})
}

/*
var dbHandler = function (req, res) {
    res.render('pages/db')
}
*/

// reply to websockets
var dbWsHandler = function (ws, req) {
    ws.on('message', function (msg) {
        msg = msg.trim()
        if(msg.length < 1){
            ws.send("err://1:emptystring")
            return
        }
        if(!msg.match(urlRegex)){
            ws.send("err://2:noturl")
            return
        }
        idDB.get(msg)
            .then((data) => {
                if (data == undefined) {
                    var newShortid = shortid.generate()
                    idDB.set(msg, newShortid)
                    domainDB.set(newShortid, msg)
                    adminDB.get('totalIDs')
                        .then((totalIDs)=>{
                            adminDB.set('totalIDs', totalIDs + 1)
                            adminDB.set(totalIDs + 1, newShortid)
                        })
                    url = https + redirdomain + '/' + newShortid;
                    ws.send(url)
                } else {
                    url = https + redirdomain + '/' + data;
                    ws.send(url)
                }
            })
            .catch((err) => {
                console.error(err)
            })
    });
}

var shortlinkHandler = function (req, res) {
    var linkID = req.params.linkID
    domainDB.get(linkID)
        .then((data) => {
            if (data != undefined) {
                if(data.startsWith("http://") || data.startsWith("https://")){
                    res.redirect(data);
                }else{
                    res.redirect("http://"+data)
                }
                
            } else {
                res.status(404)
                    .send("404 not found")
            }
        })
        .catch(() => {
            res.status(404)
                .send("404 not found")
        })
}

var redirectHome = function (req, res) {
    res.redirect(https + homedomain)
}

// ws handler
//app.ws('/db/', dbWsHandler)

// respond to info pages
//app.get('/db/', dbHandler)


// ws handler
app.ws('/', dbWsHandler)

// Home page
app.get('/', homeHandler)

// Redirect shortlinks
redir.get('/:linkID', shortlinkHandler)

// Redirect shortlink root to home
redir.get('/', redirectHome)

// Static
app.use('/assets', express.static(path.join(__dirname, 'assets')))

// start listening
app.listen(port, () => console.log(`RedirR.js Homepage listening on port ${port}!`))
redir.listen(urlport, () => console.log(`RedirR.js Redirector listening on port ${urlport}!`))