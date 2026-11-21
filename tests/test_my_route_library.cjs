'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const library=require('../my-route-library.js');
const road={type:'normal',sections:[{type:'road',points:[[34.4,132.45],[34.41,132.46]],gpx:'<gpx></gpx>'}]};
test('my-route library requires a name, route geometry, and valid displacement',()=>{
 assert.throws(()=>library.normalize({vehicle:1,route:road}),/ルート名/);
 assert.throws(()=>library.normalize({name:'test',vehicle:10,route:road}),/排気量/);
 assert.throws(()=>library.normalize({name:'test',vehicle:1,route:{type:'normal',sections:[]}}),/経路計算/);
 assert.throws(()=>library.normalize({name:'test',vehicle:1,route:{type:'walk',sections:road.sections}}),/対応していない/);
});
test('my-route library preserves calculated road geometry and independent tuning',()=>{
 const x=library.normalize({name:' 125cc 海沿い ',vehicle:1,start:'34.400,132.45',goal:'34.410,132.46',via:['34.405,132.455'],tuning:{explore:65,width:-20,scenic:80},route:road});
 assert.equal(x.name,'125cc 海沿い');assert.equal(x.vehicle,1);
 assert.equal(x.route.sections[0].points.length,2);
 assert.equal(x.tuning.scenic,80);assert.deepEqual(x.via,['34.405,132.455']);
});
test('my-route library stores bridge reference types without silently turning them into roads',()=>{
 const shimanami={type:'shimanami',sections:[{type:'bridge',referenceOnly:true,points:[[34.1,133.0],[34.2,133.1]],gpx:null}]};
 const x=library.normalize({name:'しまなみ',vehicle:0,route:shimanami});
 assert.equal(x.route.sections[0].type,'bridge');assert.equal(x.route.sections[0].gpx,null);
});
test('my-route library rejects >12MB serialized routes and trims long names',()=>{
 assert.equal(library.cleanName('x'.repeat(80)).length,50);
 assert.throws(()=>library.normalize({name:'large',vehicle:1,route:{...road,mainGpx:'x'.repeat(13*1024*1024)}}),/12MB/);
});
