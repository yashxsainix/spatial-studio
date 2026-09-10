const EPS=1e-8;
export const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
export const degToRad=d=>d*Math.PI/180;
export const radToDeg=r=>r*180/Math.PI;
export function vec3(v){if(!Array.isArray(v)||v.length!==3)return null;const n=v.map(Number);return n.every(Number.isFinite)?n:null}
export function cameraPath(cameras=[]){return cameras.map(c=>vec3(c?.position)).filter(Boolean)}
export function median(values=[]){const a=values.filter(Number.isFinite).sort((x,y)=>x-y);if(!a.length)return null;const m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2}
export function distance3(a,b){return Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2])}
export function estimateNavigationScale(cameras=[]){const p=cameraPath(cameras),steps=[];for(let i=1;i<p.length;i++){const d=distance3(p[i],p[i-1]);if(d>EPS)steps.push(d)}const m=median(steps);return clamp((m||0.08)*12,0.12,3)}
export function flatForwardFromYaw(yawDeg){const y=degToRad(yawDeg);return[-Math.sin(y),0,-Math.cos(y)]}
export function flatRightFromYaw(yawDeg){const y=degToRad(yawDeg);return[Math.cos(y),0,-Math.sin(y)]}
export function closestPointOnSegmentXZ(point,a,b){const ax=a[0],az=a[2],bx=b[0],bz=b[2],px=point[0],pz=point[2],dx=bx-ax,dz=bz-az,den=dx*dx+dz*dz;const t=den>EPS?clamp(((px-ax)*dx+(pz-az)*dz)/den,0,1):0;const x=ax+dx*t,z=az+dz*t;return{point:[x,point[1],z],t,distance:Math.hypot(px-x,pz-z)}}
export function constrainToPathXZ(point,camerasOrPoints=[],radius=1){const path=Array.isArray(camerasOrPoints)&&camerasOrPoints.length&&Array.isArray(camerasOrPoints[0])?camerasOrPoints:cameraPath(camerasOrPoints);if(path.length<2||!Number.isFinite(radius)||radius<=0)return{point:[...point],constrained:false,distance:0,segment:-1};let best=null;for(let i=0;i<path.length-1;i++){const hit=closestPointOnSegmentXZ(point,path[i],path[i+1]);if(!best||hit.distance<best.distance)best={...hit,segment:i}}if(!best||best.distance<=radius)return{point:[...point],constrained:false,distance:best?.distance||0,segment:best?.segment??-1};const dx=point[0]-best.point[0],dz=point[2]-best.point[2],len=Math.hypot(dx,dz)||1;return{point:[best.point[0]+dx/len*radius,point[1],best.point[2]+dz/len*radius],constrained:true,distance:best.distance,segment:best.segment}}
export function suggestedWalkSettings(cameras=[]){const unit=estimateNavigationScale(cameras);return{unit,speed:unit*2.2,corridorRadius:unit*1.5,playerRadius:unit*.32,playerHalfHeight:unit*.72,wallWidth:unit*4,wallHeight:unit*5,wallDepth:Math.max(unit*.16,.025)}}
export function wallFromPose(position,yawDeg,unit=1){const f=flatForwardFromYaw(yawDeg),distance=unit*2.2;return{center:[position[0]+f[0]*distance,position[1],position[2]+f[2]*distance],size:[unit*4,unit*5,Math.max(unit*.16,.025)],yaw:yawDeg}}
