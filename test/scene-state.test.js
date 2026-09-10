const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeState, normalizePortal, normalizeCollider, mergeSceneState } = require('../src/scene-state');

test('scene state sanitizes start pose and publish metadata', () => {
  const s = normalizeState('p1', { startPose:{position:[1,2,3],euler:[10,20,30]}, publish:{enabled:true,title:' Demo '} });
  assert.deepEqual(s.startPose.position,[1,2,3]);
  assert.equal(s.walk.floorY,2);
  assert.equal(s.walk.mode,'safe-path');
  assert.equal(s.publish.enabled,true);
  assert.equal(s.publish.title,'Demo');
});

test('portal validation blocks unsafe URLs and invalid coordinates', () => {
  assert.equal(normalizePortal({position:['x',2,3]}),null);
  const p = normalizePortal({position:[1,2,3],title:'Memory',url:'javascript:alert(1)'});
  assert.equal(p.url,'');
  assert.equal(p.title,'Memory');
});

test('collision guides validate geometry and keep safe values', () => {
  assert.equal(normalizeCollider({center:[0,1,2],size:[1,0,2]}),null);
  const c=normalizeCollider({id:'wall_123',label:' Shelf ',center:[1,2,3],size:[4,5,.2],yaw:90});
  assert.equal(c.label,'Shelf');
  assert.deepEqual(c.size,[4,5,.2]);
  assert.equal(c.yaw,90);
});

test('scene state merge preserves existing portals and colliders', () => {
  const s = normalizeState('p1',{portals:[{id:'portal_1',position:[0,1,2],title:'A'}],colliders:[{id:'wall_123',center:[0,1,0],size:[1,2,.1]}]});
  const n = mergeSceneState(s,{publish:{enabled:true},walk:{mode:'free'}});
  assert.equal(n.portals.length,1);
  assert.equal(n.colliders.length,1);
  assert.equal(n.walk.mode,'free');
  assert.equal(n.publish.enabled,true);
});
