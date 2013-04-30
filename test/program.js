var test = require('tape');
var program = require('../src/program');

test('program', function (t) {
  t.ok(program instanceof Function, "is a function");
  t.ok(program.name === "Run", "named Run");
  t.ok(program.length === 1, "takes one argument");
  t.end();
});
