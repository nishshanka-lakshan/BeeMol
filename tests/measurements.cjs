const {calculate}=require('../assets/js/measurements.js');
const assert=require('node:assert/strict');
function close(points,expected){assert.ok(Math.abs(calculate(points).value-expected)<1e-8)}
close([[0,0,0],[3,4,0]],5);
close([[1,0,0],[0,0,0],[0,1,0]],90);
close([[1,0,0],[0,0,0],[-1,0,0]],180);
close([[1,0,0],[0,0,0],[0,1,0],[0,1,1]],-90);
close([[1,0,0],[0,0,0],[0,1,0],[0,1,-1]],90);
close([[1,0,0],[0,0,0],[0,1,0],[-1,1,0]],180);
assert.equal(calculate([[0,0,0],[0,0,0],[0,1,0]]),null);
assert.equal(calculate([[0,0,0],[1,0,0],[2,0,0],[2,1,0]]),null);
assert.equal(calculate([[NaN,0,0],[1,0,0]]),null);
console.log('Measurement geometry tests passed');
