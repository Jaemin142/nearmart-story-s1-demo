import {navigation,demoSteps} from './process-content.js';
import {mountVersionControl} from './version-client.js';

const key='nearmart-process-demo-v1';
const actions={'/network':'map','/investment':'finance','/scenario':'compare','/evidence':'evidence','/decision':'reports'};
const paths={
 home:'m2 11 10-9 10 9M5 10v11h14V10',guide:'M4 3h16v18H4zM8 7h8M8 11h8M8 15h5',
 data:'M3 6a9 4 0 1 0 18 0A9 4 0 1 0 3 6Zm0 0v12a9 4 0 0 0 18 0V6M3 12a9 4 0 0 0 18 0',
 demand:'M3 20h18M4 16l5-5 4 3 7-9M16 5h4v4',network:'M7 10l10-5M7 14l10 5M7 12a3 3 0 1 0-6 0 3 3 0 0 0 6 0Zm15-8a3 3 0 1 0-6 0 3 3 0 0 0 6 0Zm0 16a3 3 0 1 0-6 0 3 3 0 0 0 6 0Z',
 dispatch:'M3 5h12v12H3zM15 9h4l3 5v3h-7M5 20h3M17 20h3',simulation:'m9 3 11 9L9 21V3ZM3 5v14',
 finance:'M3 20h18M5 17v-6h3v6m3 0V8h3v9m3 0V4h3v13',compare:'m2 7 10-5 10 5-10 5-10-5Zm0 5 10 5 10-5M2 17l10 5 10-5',
 decision:'M5 2h10l4 4v16H5V2Zm9 0v5h5M8 12l2 2 5-5',operations:'M2 4h20v14H2zM8 22h8M12 18v4M5 13l4-5 4 6 6-7'
};
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function readSession(name,fallback){try{return JSON.parse(sessionStorage.getItem(name))??fallback;}catch{return fallback;}}
export function writeSession(name,value){try{sessionStorage.setItem(name,JSON.stringify(value));return true;}catch{return false;}}
export function startDemo(){
 if(!writeSession(key,{step:0,expanded:false})){document.querySelector('#process-message').textContent='브라우저 저장이 제한되어 시연 가이드를 시작할 수 없습니다. 단계별 화면 링크를 이용하세요.';return;}
 location.assign(demoSteps[0].href);
}
export function renderProcessNav(element){
 mountVersionControl();
 if(!document.querySelector('link[data-process-nav]')){
  const css=document.createElement('link');css.rel='stylesheet';css.href='/process-nav.css';css.dataset.processNav='';document.head.append(css);
 }
 const active=location.pathname==='/report'?'/decision':location.pathname;
 element.classList.add('process-navigation');
 element.setAttribute('aria-label','문제풀이 단계');
 element.innerHTML=navigation.map(([label,href,glyph])=>'<a class="nav-item '+(href.split('?')[0]===active?'active':'')+'" href="'+href+'" title="'+label+'" '+
  (href.split('?')[0]===active?'aria-current="page" ':'')+(actions[href.split('?')[0]]?'data-action="'+actions[href.split('?')[0]]+'" ':'')+'><svg viewBox="0 0 24 24" aria-hidden="true"><path d="'+paths[glyph]+'"/></svg><span>'+label+'</span></a>').join('');
 renderTour();
}
function renderTour(){
 const tour=readSession(key,null);
 if(!tour||!Number.isInteger(tour.step)||tour.step<0||tour.step>=demoSteps.length)return;
 const step=demoSteps[tour.step];
 const box=document.createElement('aside');box.id='demo-guide';box.className='demo-guide';box.setAttribute('aria-label','진행 중인 시연 가이드');
 box.innerHTML='<div class="demo-guide-top"><button id="demo-expand" aria-expanded="'+Boolean(tour.expanded)+'" aria-controls="demo-guide-body"><span>시연 '+(tour.step+1)+' / '+demoSteps.length+'</span><strong>'+esc(step.name)+'</strong><b aria-hidden="true">'+(tour.expanded?'−':'+')+'</b></button><button id="demo-end" aria-label="시연 가이드 종료" title="시연 가이드 종료">×</button></div>'+
  '<div id="demo-guide-body" '+(tour.expanded?'':'hidden')+'><h2>'+esc(step.question)+'</h2><h3>화면에서 보여줄 것</h3><p>'+esc(step.look)+'</p><h3>설명할 한계</h3><p>'+esc(step.caution)+'</p><a href="'+step.href+'">이 단계 화면 열기 ↗</a></div>'+
  '<div class="demo-guide-actions"><button id="demo-prev" '+(tour.step===0?'disabled':'')+'>← 이전</button><a href="/guide">순서 보기</a><button id="demo-next">'+(tour.step===demoSteps.length-1?'시연 마치기':'다음 →')+'</button></div>';
 document.body.append(box);
 const end=()=>{try{sessionStorage.removeItem(key);}catch{}box.remove();};
 box.querySelector('#demo-end').onclick=end;
 box.querySelector('#demo-expand').onclick=()=>{
  tour.expanded=!tour.expanded;writeSession(key,tour);
  box.querySelector('#demo-guide-body').hidden=!tour.expanded;
  box.querySelector('#demo-expand').setAttribute('aria-expanded',String(tour.expanded));
  box.querySelector('#demo-expand b').textContent=tour.expanded?'−':'+';
 };
 function advance(amount){
  if(tour.step+amount===demoSteps.length){end();return;}
  const next=tour.step+amount;
  if(next<0)return;
  if(writeSession(key,{step:next,expanded:tour.expanded}))location.assign(demoSteps[next].href);
 }
 box.querySelector('#demo-prev').onclick=()=>advance(-1);
 box.querySelector('#demo-next').onclick=()=>advance(1);
}
