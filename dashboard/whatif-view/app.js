const $=s=>document.querySelector(s);
const data=await fetch('/whatif-view/data.json').then(r=>{if(!r.ok)throw new Error('자료 로드 실패');return r.json()});
const cmp=Object.fromEntries(data.comparison.map(r=>[r.scenario,r]));
const fmt=(n,d=1)=>n==null||!Number.isFinite(Number(n))?'—':new Intl.NumberFormat('ko-KR',{maximumFractionDigits:d,minimumFractionDigits:d}).format(Number(n));
const eok=n=>n==null?'—':`${fmt(Number(n)/1e8,1)}억`;
const signed=n=>`${Number(n)>=0?'+':''}${eok(n)}`;
let chartMode='net',year=2031,stress='w1',mapYear=2030;
const annual=[2027,2031,2036,2041,2046];
for(let y=2026;y<=2046;y++)$('#chart-year').add(new Option(y,y));$('#chart-year').value=year;
for(let y=2027;y<=2046;y++)$('#map-year').add(new Option(y,y));$('#map-year').value=mapYear;
$('#chart-year').onchange=e=>{year=Number(e.target.value);drawChart()};
$('#show-net').onclick=()=>setChart('net');$('#show-cum').onclick=()=>setChart('cum');
function setChart(mode){chartMode=mode;$('#show-net').classList.toggle('active',mode==='net');$('#show-cum').classList.toggle('active',mode==='cum');drawChart()}
const ns='http://www.w3.org/2000/svg';
function svgEl(tag,attrs={},parent){const el=document.createElementNS(ns,tag);for(const [k,v] of Object.entries(attrs))el.setAttribute(k,v);parent?.append(el);return el}
function drawChart(){
  const svg=$('#cash-chart');svg.replaceChildren();const W=1000,H=280,L=65,R=18,T=18,B=32,key=chartMode==='net'?'net_cashflow':'cumulative_cashflow';svg.setAttribute('viewBox',`0 0 ${W} ${H}`);
  const series=['low','base','high'],colors={low:'#69a6db',base:'#52e0bf',high:'#bd9df3'};
  const values=series.flatMap(s=>data.flows[s].map(r=>r[key]/1e8));const lo=Math.floor(Math.min(...values,0)/50)*50,hi=Math.ceil(Math.max(...values,0)/50)*50;const range=hi-lo||1;
  const x=y=>L+(y-2026)/20*(W-L-R),y=v=>T+(hi-v)/range*(H-T-B);
  for(let v=lo;v<=hi;v+=Math.max(50,Math.ceil(range/5/50)*50)){const yy=y(v);svgEl('line',{x1:L,x2:W-R,y1:yy,y2:yy,stroke:v===0?'#768f98':'#234450','stroke-width':v===0?1.5:1},svg);const t=svgEl('text',{x:L-10,y:yy+4,'text-anchor':'end',fill:'#8aaab5','font-size':11},svg);t.textContent=fmt(v,0)}
  for(const t of [2026,...annual]){const xx=x(t),label=svgEl('text',{x:xx,y:H-9,'text-anchor':'middle',fill:'#93b1bc','font-size':11},svg);label.textContent=t}
  const markerX=x(year);svgEl('line',{x1:markerX,x2:markerX,y1:T,y2:H-B,stroke:'#f5ffff',opacity:.4,'stroke-dasharray':'4 5'},svg);
  for(const s of series){const rows=data.flows[s],points=rows.map(r=>`${x(r.year)},${y(r[key]/1e8)}`).join(' ');svgEl('polyline',{points,fill:'none',stroke:colors[s],'stroke-width':s==='base'?3:2,opacity:s==='base'?1:.9,'stroke-linejoin':'round'},svg);const r=rows.find(r=>r.year===year);svgEl('circle',{cx:markerX,cy:y(r[key]/1e8),r:s==='base'?5:4,fill:colors[s],stroke:'#071923','stroke-width':2},svg)}
  const label=chartMode==='net'?'연간 순현금':'할인 전 누적 잔액';$('#chart-detail').innerHTML=`<div class="detail-year">${year}</div><small class="muted">${label} · 억 원</small>${series.map(s=>{const r=data.flows[s].find(r=>r.year===year);return `<div class="detail-row"><span style="color:${colors[s]}">${s.toUpperCase()}</span><strong>${eok(r[key])}</strong></div>`}).join('')}`;
  svg.onclick=event=>{const rect=svg.getBoundingClientRect(),px=(event.clientX-rect.left)/rect.width*W;year=Math.min(2046,Math.max(2026,Math.round(2026+(px-L)/(W-L-R)*20)));$('#chart-year').value=year;drawChart()};
}
function opFor(s,y=2031){return data.operations.find(r=>r.scenario===s&&r.year===y)}
function drawMatrix(){const names=[['low','LOW'],['BASE','BASE'],['high','HIGH']];$('#scenario-matrix').innerHTML=`<table class="matrix"><thead><tr><th>시장 조건</th><th>2027 지수</th><th>2031 지수</th><th>NPV</th><th>최대 자금소요 / 500억</th><th>2031 EBITDA</th><th>2031 일간 배송</th><th>2031 평균 / 지연</th><th>운영 검증</th></tr></thead><tbody>${names.map(([key,label])=>{const c=cmp[key],o=opFor(key.toLowerCase()),idx=y=>data.marketIndices.find(r=>r.year===y)?.[key.toLowerCase()];return `<tr><td><strong>${label}</strong><small>저장 결과 · 동일 P1</small></td><td>${fmt(idx(2027),3)}</td><td>${fmt(idx(2031),3)}</td><td class="negative">${eok(c.npv_krw)}</td><td class="negative">${eok(c.peak_funding_krw)} · 미충족</td><td class="negative">${eok(c.ebitda_2031)} · 미충족</td><td>${fmt(o?.delivered_daily,0)}건</td><td>${fmt(o?.mean_min,1)}분 / ${fmt(o?.late_rate*100,2)}%</td><td>${o?.all_resource_pass==='True'&&o?.representative_95_pass==='True'?'대표 검증 통과':'대표 검증 미충족'}</td></tr>`}).join('')}</tbody></table>`}
$('#select-w1').onclick=()=>setStress('w1');$('#select-w2').onclick=()=>setStress('w2');
function setStress(v){stress=v;$('#select-w1').classList.toggle('active',v==='w1');$('#select-w2').classList.toggle('active',v==='w2');drawStress()}
function drawStress(){
  const w1=stress==='w1',base=cmp.BASE,c=cmp.W1_labor_12pct;
  $('#stress-detail').innerHTML=w1?`<div class="stress-chain"><div class="step"><b>01 · 바뀐 입력</b><strong>2028년부터 12%</strong><p>피커·직고용 임금·계약 라이더 급여만 재무 계정에 반영</p></div><div class="step"><b>02 · 운영·재무</b><strong>${signed(Number(c.npv_krw)-Number(base.npv_krw))}</strong><p>NPV 변화 · 주문·배정·인력·트립은 BASE와 동일</p></div><div class="step"><b>03 · 제약 상태</b><strong>${eok(c.peak_funding_krw)}</strong><p>500억 초과 · 2031 EBITDA ${eok(c.ebitda_2031)}</p></div><div class="step"><b>04 · 판단</b><strong>투자 미선정</strong><p>요구 조건 일부만 연결 · 운영 검증 없음</p></div></div><div class="explain warn"><span class="badge limited">부분 연결</span> 피커·직고용 임금·계약 라이더 급여에만 12% 적용(현 P1의 계약 라이더 급여는 0). 직고용 차량·인센티브, 외부 위탁비, 수급 기준 수입은 미반영. 기존 인력·수요에 대한 재무 스트레스이며 신규 DES가 아닙니다.</div><p class="source">근거: src/finance.py shock 분기 · src/develop_finance.py · annual_cashflow_W1_labor_12pct.csv · scenario_comparison.csv</p>`:`<div class="stress-chain"><div class="step"><b>01 · 바뀐 입력</b><strong>B 거점 12곳</strong><p>competitor=B(what-if) · 2030년부터 기존 A와 병행</p></div><div class="step unavailable"><b>02 · 운영·재무</b><strong>미실행</strong><p>C+ v1의 W2 저장 운영·현금흐름 없음</p></div><div class="step unavailable"><b>03 · 제약 상태</b><strong>비교 불가</strong><p>자금·2031 EBITDA 재평가 불가</p></div><div class="step unavailable"><b>04 · 판단</b><strong>판단 보류</strong><p>입력 조건만 확인 가능</p></div></div><div class="explain warn"><span class="badge unrun">입력만 · 미실행</span> 오른쪽 지도는 경쟁사 위치 입력입니다. BASE의 성과를 W2 결과로 사용하지 않습니다. C 비교본 W2도 C+ 성과로 대체하지 않습니다.</div><p class="source">근거: data/09_competitor_hubs.csv · src/common.py competition() · C+ results에 W2 파일 없음</p>`;
}
$('#voluntary-select').onchange=drawVoluntary;
function drawVoluntary(){
  const key=$('#voluntary-select').value,a=cmp.BASE,b=cmp[key],base=data.flows.base,flow=data.flows[key];
  const same=base.every((r,i)=>Math.abs(r.net_cashflow-flow[i].net_cashflow)<1);
  const options={
    W3_discount_16pct:{title:'W3 · 할인율 16%',change:'12% → 16%',reason:'미래 현금흐름의 현재가치에 대한 할인율 민감도 확인',note:'할인율 변경은 미래 현금의 현재가치만 바꿉니다. NPV가 덜 음수가 된 것을 운영 성과 개선으로 해석하지 않습니다.',scope:'재무 할인만 변경 · 운영 결과 동일'},
    external_revenue_zero:{title:'외부 퀵 매출 0',change:'미확인 매출 제외',reason:'외부 퀵 배송의 매출 근거가 확정되지 않은 하방 조건',note:'외부 퀵 매출을 0으로 두고 비용은 유지한 재무 적립입니다. 배송 완료 가능성이나 운영 경로를 새로 검증한 결과가 아닙니다.',scope:'재무 하방 조건 · 운영 검증 미연결'},
    cancel_full_pick_cost:{title:'취소 피킹비 적립',change:'추가 피킹비',reason:'취소 주문에 투입될 수 있는 피킹비를 보수적으로 반영',note:'취소 주문 피킹비만 재무에 추가했습니다. 실제 추가 작업량과 인력·배차 영향은 DES로 검증되지 않았습니다.',scope:'재무 비용 적립 · 추가 작업량 미검증'}
  };
  const item=options[key];$('#voluntary-title').textContent=item.title;
  $('#w3-detail').innerHTML=`<div class="delta-grid"><div><small>바뀐 입력</small><strong>${item.change}</strong></div><div><small>NPV 변화</small><strong>${signed(Number(b.npv_krw)-Number(a.npv_krw))}</strong></div><div><small>최대 자금소요</small><strong>${eok(b.peak_funding_krw)}</strong></div></div><div class="explain"><strong>왜:</strong> ${item.reason}<br><strong>범위:</strong> ${item.scope}. 연간 순현금 ${same?'BASE와 동일':'BASE와 다름'}. ${item.note} 500억 한도와 2031 EBITDA 목표는 미충족이며 투자안은 미선정입니다.</div><p class="source">근거: annual_cashflow_base.csv · annual_cashflow_${key}.csv · scenario_comparison.csv · src/develop_finance.py</p>`;
}
const geo=data.geometry;
const coords=[];for(const f of geo){const rings=f.type==='Polygon'?f.coordinates:f.coordinates.flat(1);for(const ring of rings)for(const point of ring)coords.push(point)}
const lonMin=Math.min(...coords.map(p=>p[0])),lonMax=Math.max(...coords.map(p=>p[0])),latMin=Math.min(...coords.map(p=>p[1])),latMax=Math.max(...coords.map(p=>p[1]));
const X=lon=>35+(lon-lonMin)/(lonMax-lonMin)*730,Y=lat=>15+(latMax-lat)/(latMax-latMin)*260;
function pathFor(f){const polys=f.type==='Polygon'?[f.coordinates]:f.coordinates;return polys.map(poly=>poly.map(ring=>ring.map((p,i)=>`${i?'L':'M'}${X(p[0]).toFixed(1)} ${Y(p[1]).toFixed(1)}`).join('')+'Z').join('')).join('')}
$('#map-year').onchange=e=>{mapYear=Number(e.target.value);drawMap()};
function drawMap(){const svg=$('#hub-map');svg.replaceChildren();svg.setAttribute('viewBox','0 0 800 290');for(const f of geo)svgEl('path',{d:pathFor(f),fill:'#173647',stroke:'#2e5261','stroke-width':.38},svg);
  const active=data.hubs.filter(h=>h.open<=mapYear&&(h.close==null||h.close>mapYear));
  for(const h of active){const b=h.competitor.startsWith('B');const dot=svgEl('circle',{cx:X(h.lon),cy:Y(h.lat),r:b?4.3:2.8,fill:b?'#ffbc79':'#69a6db',stroke:b?'#ffe2b5':'#0b202e','stroke-width':b?1.2:.7,tabindex:0,role:'button','aria-label':`${h.id} ${h.gu} ${h.dong}`},svg);dot.onclick=()=>{$('#map-selected').textContent=`${h.id} · ${h.gu} ${h.dong} · ${b?'B(what-if) 입력':'기존 A'} · ${h.open}년 개장`};dot.onkeydown=e=>{if(e.key==='Enter')dot.onclick()}}
  svgEl('circle',{cx:X(data.p1.lon),cy:Y(data.p1.lat),r:6,fill:'#52e0bf',stroke:'#fff','stroke-width':1.5},svg);const text=svgEl('text',{x:X(data.p1.lon)+9,y:Y(data.p1.lat)-7,fill:'#d9fff5','font-size':12,'font-weight':'bold'},svg);text.textContent='P1';
  $('#map-count').textContent=`${mapYear}년 활성: A ${active.filter(h=>h.competitor==='A').length}곳 · B 입력 ${active.filter(h=>h.competitor.startsWith('B')).length}곳`;}
const variables={discount:{unit:'%',base:12,min:0,max:30,step:1,scope:'재무만 재계산',pipe:['원본 복사','재무','제약 검증','별도 결과 저장'],estimate:'예상 실행 시간: 미측정 · 엔진 미연결'},labor:{unit:'%',base:0,min:0,max:30,step:1,scope:'운영·재무 재검증 필요',pipe:['원본 복사','인력·수급 입력','배차·운영','재무','제약 검증'],estimate:'예상 실행 시간: 미측정 · 전체 재검증 경로 미구축'},competitor:{unit:'개 거점',base:0,min:0,max:12,step:1,scope:'수요 → 배정 → 운영 → 재무',pipe:['원본 복사','수요','배정','운영 DES','재무','제약 검증'],estimate:'예상 실행 시간: 미측정 · W2 파이프라인 미검증'},market:{unit:'지수 배율 %',base:100,min:70,max:130,step:1,scope:'수요 → 배정 → 운영 → 재무',pipe:['원본 복사','수요','배정','운영 DES','재무','제약 검증'],estimate:'예상 실행 시간: 미측정 · 연속 값 신규 실행 미검증'}};
$('#variable').onchange=()=>{const v=variables[$('#variable').value];$('#input-value').value=v.base;$('#input-value').min=v.min;$('#input-value').max=v.max;$('#input-value').step=v.step;drawVariable()};$('#input-value').oninput=drawVariable;
function drawVariable(){const v=variables[$('#variable').value],n=Number($('#input-value').value),valid=Number.isFinite(n)&&n>=v.min&&n<=v.max;$('#variable-info').textContent=`기준값 ${v.base}${v.unit} · 허용 범위 ${v.min}–${v.max}${v.unit} · 현재 ${valid?n+' '+v.unit:'범위 밖'} · ${v.scope} · ${v.estimate}`;$('#pipeline').innerHTML=v.pipe.map(p=>`<span>${p}</span>`).join('')}
$('#variable').onchange();drawChart();drawMatrix();drawStress();drawVoluntary();drawMap();
