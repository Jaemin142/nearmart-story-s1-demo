// Presentation fixture only. No benchmark outcome or route is inferred here.
export const conceptDispatch = Object.freeze({
  source: 'CONCEPT',
  scope: '설명용 개념 장면 · 실제 BM 주문/경로 아님',
  hub: [-2.8, 0],
  orders: [[-0.8,-1.7],[1.6,1.9],[3.1,-1.3],[3.1,2.6],[-2.2,2.4]],
  regions: [{id:'all',label:'전체 예시 구역',orders:[0,1,2,3,4]},
    {id:'a',label:'예시 구역 A',orders:[0,1,2]},
    {id:'b',label:'예시 구역 B',orders:[3,4]}],
  policies: [
    {id:'baseline',label:'기준 정책 · BASELINE',description:'오래된 준비 주문부터 가까운 주문 묶기',stops:[0,2,1],color:[0.19,0.86,0.91]},
    {id:'insertion',label:'개선 정책 · INSERTION',description:'후보 주문의 방문 순서 삽입 검토',stops:[0,3,2,1,4],color:[0.72,0.49,0.99]}
  ]
});

const vertexSource=`attribute vec3 position; attribute vec3 color; uniform mat4 mvp; varying vec3 shade; void main(){gl_Position=mvp*vec4(position,1.0);shade=color;}`;
const fragmentSource=`precision mediump float; varying vec3 shade; void main(){gl_FragColor=vec4(shade,1.0);}`;
const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
const multiply=(a,b)=>{const o=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let k=0;k<4;k++)o[c*4+r]+=a[k*4+r]*b[c*4+k];return o;};
const perspective=(fov,aspect,near,far)=>{const f=1/Math.tan(fov/2),q=1/(near-far);return new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(far+near)*q,-1,0,0,2*far*near*q,0]);};
function view(eye,target){
 const sub=(a,b)=>a.map((v,i)=>v-b[i]);
 const norm=a=>{const n=Math.hypot(...a);return a.map(v=>v/n);};
 const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
 const z=norm(sub(eye,target)),x=norm(cross([0,1,0],z)),y=cross(z,x);
 return new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-x.reduce((v,n,i)=>v+n*eye[i],0),-y.reduce((v,n,i)=>v+n*eye[i],0),-z.reduce((v,n,i)=>v+n*eye[i],0),1]);
}
function shader(gl,type,source){const item=gl.createShader(type);gl.shaderSource(item,source);gl.compileShader(item);if(!gl.getShaderParameter(item,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(item));return item;}
function createRenderer(canvas){
 const gl=canvas.getContext('webgl',{antialias:true,alpha:false});
 if(!gl)return null;
 const program=gl.createProgram();gl.attachShader(program,shader(gl,gl.VERTEX_SHADER,vertexSource));gl.attachShader(program,shader(gl,gl.FRAGMENT_SHADER,fragmentSource));gl.linkProgram(program);
 if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
 gl.useProgram(program);gl.enable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);
 const buffer=gl.createBuffer(),pos=gl.getAttribLocation(program,'position'),color=gl.getAttribLocation(program,'color'),matrix=gl.getUniformLocation(program,'mvp');
 gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.enableVertexAttribArray(pos);gl.enableVertexAttribArray(color);gl.vertexAttribPointer(pos,3,gl.FLOAT,false,24,0);gl.vertexAttribPointer(color,3,gl.FLOAT,false,24,12);
 return {gl,buffer,matrix};
}
function mesh(){
 const data=[];
 function tri(a,b,c,color){for(const p of [a,b,c])data.push(...p,...color);}
 function box(cx,cy,cz,w,h,d,color){
  const x=cx-w/2,X=cx+w/2,y=cy-h/2,Y=cy+h/2,z=cz-d/2,Z=cz+d/2;
  const faces=[[[x,Y,z],[X,Y,z],[X,Y,Z],[x,Y,Z],1],[[x,y,Z],[X,y,Z],[X,Y,Z],[x,Y,Z],.7],[[X,y,z],[x,y,z],[x,Y,z],[X,Y,z],.47],[[x,y,z],[x,y,Z],[x,Y,Z],[x,Y,z],.58],[[X,y,Z],[X,y,z],[X,Y,z],[X,Y,Z],.62],[[x,y,z],[X,y,z],[X,y,Z],[x,y,Z],.4]];
  for(const [a,b,c,e,shade] of faces){const tint=color.map(v=>v*shade);tri(a,b,c,tint);tri(a,c,e,tint);}
 }
 function beam(a,b,y,width,color){const dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz)||1,nx=-dz/len*width/2,nz=dx/len*width/2;
  const p=[a[0]+nx,y,a[1]+nz],q=[b[0]+nx,y,b[1]+nz],r=[b[0]-nx,y,b[1]-nz],s=[a[0]-nx,y,a[1]-nz];tri(p,q,r,color);tri(p,r,s,color);
 }
 function disc(x,z,r,y,color){for(let i=0;i<18;i++){const a=i*Math.PI/9,b=(i+1)*Math.PI/9;tri([x,y,z],[x+Math.cos(a)*r,y,z+Math.sin(a)*r],[x+Math.cos(b)*r,y,z+Math.sin(b)*r],color);}}
 return {data,box,beam,disc};
}
const buildings=[[-4.3,-2.4,.65],[-3.7,1.3,.9],[-1.2,.3,.55],[-.1,2.5,.65],[.4,-2.5,.7],[1.1,-.1,1.1],[2.5,.4,.85],[4.2,1.3,.65],[4.1,-2.5,1],[-3.9,2.8,.55]];
function sceneGeometry(policy,progress,fixture,selected,visible){
 const m=mesh();m.box(0,-.25,0,10.2,.3,7.4,[.07,.15,.2]);
 for(let x=-4.5;x<=4.5;x+=1.5)m.beam([x,-3.5],[x,3.5],-.07,.025,[.12,.23,.28]);
 for(let z=-3;z<=3;z+=1.5)m.beam([-4.9,z],[4.9,z],-.07,.025,[.12,.23,.28]);
 for(const [x,z,h] of buildings)m.box(x,h/2,z,.62,h,.62,[.22,.34,.42]);
 const [hx,hz]=fixture.hub;m.box(hx,.28,hz,.76,.55,.76,[.2,.75,.61]);m.box(hx,.61,hz,.88,.08,.88,[.38,.95,.77]);
 fixture.orders.forEach(([x,z],i)=>{m.disc(x,z,i===selected?.25:.19,.075,i===selected?[.38,.95,.77]:visible.has(i)?[.58,.69,.76]:[.27,.34,.38]);m.disc(x,z,.27,.045,[.16,.35,.42]);});
 const route=[fixture.hub,...policy.stops.map(i=>fixture.orders[i])];
 for(let i=0;i<route.length-1;i++){
  const amount=clamp(progress*(route.length-1)-i,0,1);
  if(amount>0){const a=route[i],b=route[i+1],end=[a[0]+(b[0]-a[0])*amount,a[1]+(b[1]-a[1])*amount];m.beam(a,end,.105,.085,policy.color);m.disc(end[0],end[1],.12,.12,policy.color);}
 }
 return m.data;
}
function overlay(canvas,context,mvp,fixture,policy,progress,selected,visible){
 const w=canvas.clientWidth,h=canvas.clientHeight;
 context.clearRect(0,0,w,h);context.font='700 12px system-ui';context.textAlign='center';context.textBaseline='middle';
 function point(x,y,z){const v=[x,y,z,1],t=[0,0,0,0];for(let r=0;r<4;r++)for(let c=0;c<4;c++)t[r]+=mvp[c*4+r]*v[c];return [(t[0]/t[3]+1)*w/2,(1-t[1]/t[3])*h/2];}
 const hitPoints=fixture.orders.map(([x,z])=>{const [px,py]=point(x,.25,z);return [px,py-16];});
 fixture.orders.forEach((_,i)=>{const [px,py]=hitPoints[i];context.globalAlpha=visible.has(i)?1:.42;context.fillStyle='#091923';context.strokeStyle=i===selected?'#66e8c6':'#a7c5d0';context.lineWidth=i===selected?3:2;context.beginPath();context.arc(px,py,13,0,Math.PI*2);context.fill();context.stroke();context.fillStyle='#f0f7f8';context.fillText(String(i+1),px,py);context.globalAlpha=1;});
 const [hx,hz]=fixture.hub,[px,py]=point(hx,.8,hz);context.fillStyle='#6ce8c7';context.fillText('거점',px,py-14);
 const visited=Math.floor(progress*policy.stops.length);context.fillStyle='#b7cbd2';context.font='11px system-ui';context.fillText(`방문 순서 ${policy.stops.map(i=>i+1).join(' → ')} · 표시 ${visited}/${policy.stops.length}`,w/2,h-17);
 return hitPoints;
}
export function mountDispatchScene(root,fixture=conceptDispatch){
 if(!root)return;
 const panels=[...root.querySelectorAll('[data-dispatch-canvas]')];
 let renderers;
 try {renderers=panels.map(panel=>createRenderer(panel.querySelector('canvas')));} catch {renderers=null;}
 if(!renderers||renderers.some(item=>!item)){root.querySelector('.dispatch-unsupported').hidden=false;return;}
 const overlays=panels.map(panel=>panel.querySelector('.dispatch-labels'));
 const state={yaw:.55,height:.78,distance:10,progress:1,playing:false,last:0,speed:1,region:'all',selected:0,mode:fixture.policies?.length===1?'single':'compare',singlePolicy:0};
 root.classList.toggle('dispatch-single',state.mode==='single');
 const slider=root.querySelector('[data-dispatch-progress]'),play=root.querySelector('[data-dispatch-play]');
 const regionSelect=root.querySelector('[data-dispatch-region]'),orderList=root.querySelector('[data-dispatch-orders]');
 const regions=()=>fixture.regions?.length?fixture.regions:[{id:'all',label:'전체 주문',orders:fixture.orders.map((_,i)=>i)}];
 const activeRegion=()=>regions().find(region=>region.id===state.region)??regions()[0];
 const visible=()=>new Set(activeRegion().orders);
 function populate(){
  if(!Array.isArray(fixture.hub)||fixture.hub.length!==2||fixture.hub.some(n=>!Number.isFinite(n))||
     !Array.isArray(fixture.orders)||!Array.isArray(fixture.policies)||fixture.policies.length<1||fixture.policies.length>2||
     fixture.orders.some(point=>!Array.isArray(point)||point.length!==2||point.some(n=>!Number.isFinite(n)))||
     fixture.policies.some(policy=>!Array.isArray(policy.stops)||!Array.isArray(policy.color)||policy.stops.some(i=>!Number.isInteger(i)||i<0||i>=fixture.orders.length)))throw Error('Invalid dispatch scene data');
  regionSelect.replaceChildren(...regions().map(region=>new Option(region.label,region.id)));
  regionSelect.value=state.region;
  const modeSelect=root.querySelector('[data-dispatch-mode]'),policySelect=root.querySelector('[data-dispatch-policy]');
  modeSelect.querySelector('[value=compare]').disabled=fixture.policies.length<2;
  modeSelect.value=state.mode;
  policySelect.replaceChildren(...fixture.policies.map((policy,i)=>new Option(policy.label??policy.id,String(i))));
  policySelect.value=String(state.singlePolicy);
  root.querySelector('[data-dispatch-policy-wrap]').hidden=state.mode!=='single';
  root.querySelectorAll('[data-dispatch-policy-title]').forEach((node,i)=>node.textContent=fixture.policies[i]?.label??'');
  root.querySelectorAll('[data-dispatch-policy-desc]').forEach((node,i)=>node.textContent=fixture.policies[i]?.description??'');
  orderList.replaceChildren(...fixture.orders.map((_,i)=>{const button=document.createElement('button');button.type='button';button.textContent=String(i+1);button.setAttribute('aria-label','주문 '+(i+1)+' 선택');button.dataset.order=String(i);return button;}));
  root.querySelector('[data-dispatch-scope]').textContent=fixture.scope??'저장 실행 연결 전';
 }
 function updateSelection(){
  const region=activeRegion(),shown=visible();
  if(!shown.has(state.selected))state.selected=region.orders[0]??null;
  root.querySelector('[data-dispatch-region-detail]').textContent=region.label+' · 주문 '+shown.size+'건'+(fixture.source==='CONCEPT'?' (예시)':'');
  const detail=root.querySelector('[data-dispatch-order-detail]');
  if(state.selected==null)detail.textContent='선택 가능한 주문 없음';
  else if(state.mode==='single'){const order=fixture.policies[state.singlePolicy].stops.indexOf(state.selected);detail.textContent='주문 '+(state.selected+1)+' · '+(order<0?'현재 묶음 외':(order+1)+'번째 방문');}
  else {const [a,b]=fixture.policies.map(policy=>policy.stops.indexOf(state.selected));detail.textContent='주문 '+(state.selected+1)+' · 기준 '+(a<0?'현재 묶음 외':(a+1)+'번째')+' / 개선 '+(b<0?'현재 묶음 외':(b+1)+'번째');}
  orderList.querySelectorAll('[data-order]').forEach(button=>{const i=Number(button.dataset.order);button.disabled=!shown.has(i);button.dataset.inRegion=String(shown.has(i));button.setAttribute('aria-pressed',String(i===state.selected));});
 }
 populate();
 const hitPoints=[];
 const draw=()=>{
  updateSelection();
  const shown=visible();
  for(let i=0;i<2;i++){
   panels[i].parentElement.hidden=i>=fixture.policies.length||(state.mode==='single'&&i!==state.singlePolicy);
   if(panels[i].parentElement.hidden)continue;
   const {gl,buffer,matrix}=renderers[i],canvas=panels[i].querySelector('canvas'),label=overlays[i];
   const dpr=Math.min(window.devicePixelRatio||1,2),w=Math.round(canvas.clientWidth*dpr),h=Math.round(canvas.clientHeight*dpr);
   if(!w||!h)continue;
   if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;label.width=w;label.height=h;}
   gl.viewport(0,0,w,h);gl.clearColor(.035,.083,.115,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
   const eye=[Math.sin(state.yaw)*state.distance,state.height*state.distance,Math.cos(state.yaw)*state.distance];
   const mvp=multiply(perspective(Math.PI/4,w/h,.1,100),view(eye,[0,-.3,0]));
   const vertices=new Float32Array(sceneGeometry(fixture.policies[i],state.progress,fixture,state.selected,shown));
   gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,vertices,gl.DYNAMIC_DRAW);gl.uniformMatrix4fv(matrix,false,mvp);gl.drawArrays(gl.TRIANGLES,0,vertices.length/6);
   const context=label.getContext('2d');context.setTransform(dpr,0,0,dpr,0,0);hitPoints[i]=overlay(label,context,mvp,fixture,fixture.policies[i],state.progress,state.selected,shown);
  }
  slider.value=String(Math.round(state.progress*100));
 };
 const tick=now=>{if(!root.isConnected)return;if(state.playing){state.progress=Math.min(1,state.progress+(now-state.last)*state.speed/7000);if(state.progress>=1){state.playing=false;play.textContent='▶ 재생';}draw();}state.last=now;if(state.playing)requestAnimationFrame(tick);};
 play.onclick=()=>{if(state.progress>=1)state.progress=0;state.playing=!state.playing;play.textContent=state.playing?'Ⅱ 일시정지':'▶ 재생';state.last=performance.now();if(state.playing)requestAnimationFrame(tick);else draw();};
 slider.oninput=()=>{state.playing=false;play.textContent='▶ 재생';state.progress=Number(slider.value)/100;draw();};
 root.querySelector('[data-dispatch-speed]').onchange=event=>{state.speed=Number(event.target.value)||1;};
 root.querySelector('[data-dispatch-mode]').onchange=event=>{state.mode=event.target.value;root.querySelector('[data-dispatch-policy-wrap]').hidden=state.mode!=='single';root.classList.toggle('dispatch-single',state.mode==='single');draw();};
 root.querySelector('[data-dispatch-policy]').onchange=event=>{state.singlePolicy=Number(event.target.value);draw();};
 regionSelect.onchange=()=>{state.region=regionSelect.value;state.selected=activeRegion().orders[0]??null;draw();};
 orderList.onclick=event=>{const button=event.target.closest('[data-order]');if(!button||button.disabled)return;state.selected=Number(button.dataset.order);draw();};
 root.querySelectorAll('[data-camera]').forEach(button=>button.onclick=()=>{const action=button.dataset.camera;if(action==='left')state.yaw-=.18;if(action==='right')state.yaw+=.18;if(action==='in')state.distance=clamp(state.distance-1,8,18);if(action==='out')state.distance=clamp(state.distance+1,8,18);if(action==='reset'){state.yaw=.55;state.height=.78;state.distance=10;}draw();});
 panels.forEach((panel,panelIndex)=>{let drag=null,dragged=false;
  panel.addEventListener('pointerdown',event=>{drag={x:event.clientX,y:event.clientY,lastX:event.clientX,lastY:event.clientY};dragged=false;panel.setPointerCapture(event.pointerId);});
  panel.addEventListener('pointermove',event=>{if(!drag)return;if(Math.hypot(event.clientX-drag.x,event.clientY-drag.y)>4)dragged=true;if(dragged){state.yaw+=(event.clientX-drag.lastX)*.008;state.height=clamp(state.height+(event.clientY-drag.lastY)*.004,.25,1.45);draw();}drag.lastX=event.clientX;drag.lastY=event.clientY;});
  panel.addEventListener('pointerup',()=>drag=null);
  panel.addEventListener('click',event=>{if(dragged)return;const rect=panel.getBoundingClientRect(),x=event.clientX-rect.left,y=event.clientY-rect.top;let nearest=-1,distance=24;for(const i of visible()){const p=hitPoints[panelIndex]?.[i];if(!p)continue;const gap=Math.hypot(x-p[0],y-p[1]);if(gap<distance){nearest=i;distance=gap;}}if(nearest>=0){state.selected=nearest;draw();}});
  panel.addEventListener('wheel',event=>{event.preventDefault();state.distance=clamp(state.distance+Math.sign(event.deltaY),8,18);draw();},{passive:false});
 });
 new ResizeObserver(()=>{if(root.isConnected)draw();}).observe(root);
 draw();
 return {setData(next){fixture=next;state.playing=false;play.textContent='▶ 재생';state.progress=1;state.region=regions()[0]?.id??'all';state.selected=regions()[0]?.orders[0]??null;state.mode=next.policies?.length===1?'single':'compare';state.singlePolicy=0;root.classList.toggle('dispatch-single',state.mode==='single');populate();draw();}};
}
