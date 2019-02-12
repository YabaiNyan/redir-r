// import .env
require('dotenv').config()
var port = 80
if (process.env.PORT != undefined) {
    port = process.env.PORT
}

// require express
var path = require('path')
var express = require('express')
var app = express()
var expressWs = require('express-ws')(app);

// set the view engine to ejs
app.set('view engine', 'ejs');

const Keyv = require('keyv');
const db = new Keyv('sqlite://' + __dirname + '/database.sqlite');

db.on('error', (err)=>{
    console.log(err)
});

var homeHandler = function(req, res){
    res.render('pages/home')
}

var dbHandler = function(req, res){
    res.render('pages/db')
}

var dbWsHandler = function(ws, req){
    ws.on('message', function(msg) {
        console.log(msg);
    });
}  

// ws handler
app.ws('/db/', dbWsHandler)

// respond to info pages
app.get('/db/', dbHandler)

// Home page
app.get('/', homeHandler)

// Static
app.use('/assets', express.static(path.join(__dirname, 'assets')))

// start listening
app.listen(port, () => console.log(`RedirR.js listening on port ${port}!`))