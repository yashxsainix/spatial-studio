import test from 'node:test';
import assert from 'node:assert/strict';
import {cameraPath,estimateNavigationScale,constrainToPathXZ,wallFromPose,suggestedWalkSettings} from '../public/navigation-core.mjs';

test('camera path filters invalid poses',()=>{
  const p=cameraPath([{position:[0,1,0]},{position:['bad',1,0]},{position:[1,1,0]}]);
  assert.deepEqual(p,[[0,1,0],[1,1,0]]);
});

test('navigation scale is finite and bounded',()=>{
  const cameras=Array.from({length:10},(_,i)=>({position:[i*.1,1,0]}));
  const scale=estimateNavigationScale(cameras),cfg=suggestedWalkSettings(cameras);
  assert.ok(scale>=.12&&scale<=3);
  assert.ok(cfg.speed>0&&cfg.corridorRadius>0&&cfg.playerRadius>0);
});

test('safe path clamps movement to captured corridor',()=>{
  const path=[[0,1,0],[10,1,0]];
  const hit=constrainToPathXZ([5,1,4],path,1);
  assert.equal(hit.constrained,true);
  assert.ok(Math.abs(hit.point[2]-1)<1e-8);
});

test('wall placement uses camera pose and positive dimensions',()=>{
  const wall=wallFromPose([0,1,0],0,1);
  assert.ok(wall.center[2]<0);
  assert.ok(wall.size.every(v=>v>0));
});
