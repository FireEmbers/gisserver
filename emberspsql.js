#!/usr/bin/env node

var clcClient = require('./src/clcClient');

var express = require('express');
var app = express();

app.configure(function(){
  app.use(express.bodyParser());
});

app.post('/clcdata', function(req, res){

  var N = req.body.north;
  var S = req.body.south;
  var E = req.body.east;
  var W = req.body.west;
  var rows = req.body.r;
  var cols = req.body.c;


  clcClient( N, S, E, W, rows, cols, cp);

  function cp(err, data){
    if (err)
      console.log(err);

    res.send(data);
  }

});
console.log('emberspsql listening on port 8881...');
app.listen(8881);
