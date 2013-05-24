

var fileToArray = require('./fileToArray');

fileToArray('../burnAlone/ignMapFGM100.csv',100,100, JSONtheString);

function JSONtheString(array) {

  console.log(JSON.stringify(array));

}