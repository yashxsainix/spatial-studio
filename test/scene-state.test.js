const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeState, normalizePortal, mergeSceneState } = require('../src/scene-state');

test('scene state sanitizes start pose and publish metadata', () => {
  const s = normalizeState('p1', { startPose:{position:[1,2,3],euler:[10,20,30]}, publish:{enabled:true,title:' Demo '} });
  assert.deepEqual(s.startPose.position,[1,2,3]);
  assert.equal(s.walk.floorY,2);
  assert.equal(s.publish.enabled,true);
  assert.equal(s.publish.title,'Demo');
});

test('portal validation blocks unsafe URLs and invalid coordinates', () => {
  assert.equal(normalizePortal({position:['x',2,3]}),null);
  const p = normalizePortal({position:[1,2,3],title:'Memory',url:'javascript:alert(1)'});
  assert.equal(p.url,'');
  assert.equal(p.title,'Memory');
});

test('scene state merge preserves existing portals', () => {
  const s = normalizeState('p1',{portals:[{id:'portal_1',position:[0,1,2],title:'A'}]});
  const n = mergeSceneState(s,{publish:{enabled:true}});
  assert.equal(n.portals.length,1);
  assert.equal(n.publish.enabled,true);
});
