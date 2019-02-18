// import .env
require('dotenv').config()
var port = process.env.PORT || 80
var urlport = process.env.URLPORT || 81
var redirdomain = process.env.REDIRDOMAIN || 'localhost:' + urlport
var homedomain = process.env.HOMEDOMAIN || 'localhost'
var acceptAdminAllRegistration = process.env.ACCEPTADMINALLREGISTERATION || false

var https = 'http://'
var ishttps = false
if (process.env.HTTPS == 'true') {
    https = 'https://'
    var ishttps = true
}

// randomid generation
const shortid = require('shortid')

// bcrypt
const bcrypt = require('bcrypt');

// UID Generation
const UIDGenerator = require('uid-generator');
const uidgen = new UIDGenerator(); // Default is a 128-bit UID encoded in base58
 
// require express
var path = require('path')
var express = require('express')
var app = express()
var redir = express()
var expressWs = require('express-ws')(app)

// set the view engine to ejs
app.set('view engine', 'ejs')

const Keyv = require('keyv')
const idDB = new Keyv('sqlite://' + __dirname + '/RedirRDB.sqlite', {namespace: 'id'})
const domainDB = new Keyv('sqlite://' + __dirname + '/RedirRDB.sqlite', {namespace: 'domain'})
const adminDB = new Keyv('sqlite://' + __dirname + '/RedirRDB.sqlite', {namespace: 'admin'})
const adminCredsDB = new Keyv('sqlite://' + __dirname + '/RedirR-AdminDB.sqlite', {namespace: 'adminCreds'})
const adminTokensDB = new Keyv('sqlite://' + __dirname + '/RedirR-AdminDB.sqlite', {namespace: 'adminTokens'})

idDB.on('error', (err) => {console.error(err)})
domainDB.on('error', (err) => {console.error(err)})
adminDB.on('error', (err) => {console.error(err)})
adminCredsDB.on('error', (err) => {console.error(err)})
adminTokensDB.on('error', (err) => {console.error(err)})

// url regex
const urlRegex = /^(https?:\/\/(www\.)?)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,24}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)/

// set totalIDs if doesnt exist
adminDB.get('totalIDs')
    .then((totalIDs) => {
        if (totalIDs == undefined) {
            adminDB.set('totalIDs', 0)
        }
    })

// reply to index
var homeHandler = function (req, res) {
    res.render('pages/home', {
        domain: homedomain,
        ishttps
    })
}

// reply to admin
var adminHandler = function (req, res) {
    res.render('pages/admin', {
        domain: homedomain,
        ishttps
    })
}

// admin websockets handler
var adminWsHandler = function (ws, req) {
    ws.on('message', function (msg) {
        if(msg.startsWith("uuid://")){
            uuid = msg.split('://')
            uuid.shift()
            command = uuid[1]
            uuid = uuid[0]
            adminTokensDB.get(uuid)
                .then((user) => {
                    if(user == undefined){
                        ws.send("err://8:uuidInvalid")
                    }else{
                        switch(command){
                            case '1':
                            break
                            default:
                                ws.send("auth://valid")
                            break
                        }
                    }
                })
        }else{
            loginObj = JSON.parse(msg)
            if(loginObj.username == "" || loginObj.password == ""){
                if(loginObj.username == "" && loginObj.password == "" ){
                    ws.send("err://6:username&passwordEmpty")
                }else{
                    if(loginObj.username == ""){
                        ws.send("err://5:usernameEmpty")
                    }
                    else if(loginObj.password == ""){
                        ws.send("err://4:passwordEmpty")
                    }
                }
            }else{
                adminCredsDB.get(loginObj.username.toLowerCase())
                    .then((hash)=>{
                        if(hash != undefined){
                            bcrypt.compare(loginObj.password, hash, function(err, res) {
                                if(res == false){
                                    ws.send("err://3:incorrectlogin")
                                }else{
                                    uidgen.generate()
                                    .then(token => {
                                        adminTokensDB.set(token, loginObj.username.toLowerCase(), 1000*60*60*24)
                                        ws.send("token://" + token)
                                    });
                                    
                                }
                            });
                        }else{
                            ws.send("err://3:incorrectlogin")
                        }
                    })
            }
        }
    })
}

// reply to admin
var adminRegisterHandler = function (req, res) {
    res.render('pages/adminRegister', {
        domain: homedomain,
        ishttps
    })
}

// admin websockets handler
var adminRegisterWsHandler = function (ws, req) {
    ws.on('message', function (msg) {
        loginObj = JSON.parse(msg)
        if(loginObj.username == "" || loginObj.password == ""){
            if(loginObj.username == "" && loginObj.password == "" ){
                ws.send("err://6:username&passwordEmpty")
            }else{
                if(loginObj.username == ""){
                    ws.send("err://5:usernameEmpty")
                }
                else if(loginObj.password == ""){
                    ws.send("err://4:passwordEmpty")
                }
            }
        }else{
            if(acceptAdminAllRegistration !== false){
                adminCredsDB.get(loginObj.username.toLowerCase())
                    .then((hash)=>{
                        if(hash == undefined){
                            bcrypt.hash(loginObj.password, 12, function(err, hash) {
                                adminCredsDB.set(loginObj.username.toLowerCase(), hash)
                                ws.send("success")
                            });
                        }else[
                            ws.send('err://7:usernameinuse')
                        ]
                    })
            }else{
                ws.send('err://cannotregister')
            }
        }
    })
}

// reply to websockets
var dbWsHandler = function (ws, req) {
    ws.on('message', function (msg) {
        msg = msg.trim()
        if (msg.length < 1) {
            ws.send("err://1:emptystring")
            return
        }

        if (!msg.match(urlRegex)) {
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
                        .then((totalIDs) => {
                            adminDB.set('totalIDs', totalIDs + 1)
                            adminDB.set(totalIDs + 1, newShortid)
                        })
                    url = https + redirdomain + '/' + newShortid
                    ws.send(url)
                } else {
                    url = https + redirdomain + '/' + data
                    ws.send(url)
                }
            })
            .catch((err) => {
                console.error(err)
            })
    })
}

var shortlinkHandler = function (req, res) {
    var linkID = req.params.linkID
    domainDB.get(linkID)
        .then((data) => {
            if (data != undefined) {
                if (data.startsWith("http://") || data.startsWith("https://")) {
                    res.redirect(data)
                } else {
                    res.redirect("http://" + data)
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

// admin ws handler
app.ws('/admin/register/', adminRegisterWsHandler)
// respond to admin pages
app.get('/admin/register/', adminRegisterHandler)

// admin ws handler
app.ws('/admin/', adminWsHandler)
// respond to admin pages
app.get('/admin/', adminHandler)

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