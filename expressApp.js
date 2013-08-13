var clcClient = require('./src/clcClient');

var express = require('express');
var app = express();

app.configure(function(){
  app.use(express.bodyParser());
});

app.post('/postgisData', function(req, res){

  var N = req.body.north;
  var S = req.body.south;
  var E = req.body.east;
  var W = req.body.west;
  var rows = req.body.r;
  var cols = req.body.c;


  clcClient( N, S, E, W, rows, cols, cp);

  function cp(data){
    res.send(data);
  }

});

app.listen(8080);
