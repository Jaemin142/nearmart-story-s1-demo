import {renderProcessNav} from './process-nav.js';
import {mountDispatchScene} from './dispatch-3d.js';

const route=location.pathname==='/report'?'/decision':location.pathname;
const sections={
 '/':'운영관제','/overview':'개요','/guide':'사용 가이드','/evidence':'데이터 검증',
 '/demand':'수요예측','/network':'네트워크','/dispatch':'배차 벤치마크',
 '/simulation':'시뮬레이션','/investment':'20년 재무','/scenario':'What-if','/decision':'최종 판단'
};
if(!Object.hasOwn(sections,route))throw Error('Unknown submission route');
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const n=value=>value==null||value===''||!Number.isFinite(Number(value))?null:Number(value);
const fmt=(value,digits=1)=>n(value)==null?'해당 없음':new Intl.NumberFormat('ko-KR',{maximumFractionDigits:digits,minimumFractionDigits:digits}).format(Number(value));
const eok=value=>n(value)==null?'해당 없음':fmt(Number(value)/1e8,2)+'억 원';
const pct=value=>n(value)==null?'해당 없음':fmt(Number(value)*100,2)+'%';
const yes=value=>value===true||value==='True'?'통과':value===false||value==='False'?'미충족':'미검증';
const yearValue=(rows,year,key='year')=>rows.find(row=>Number(row[key])===Number(year));
const link=(href,label)=>`<a class="submission-link" href="${esc(href)}${href.includes('?')?'&':'?'}preview=submission">${esc(label)} ↗</a>`;
const badge=(label,tone='muted')=>`<span class="submission-badge ${tone}">${esc(label)}</span>`;
const card=(label,value,detail='',tone='')=>`<article class="submission-card ${tone}"><span>${esc(label)}</span><strong>${esc(value)}</strong><small>${esc(detail)}</small></article>`;
const table=(heads,rows)=>`<div class="submission-table-scroll"><table><thead><tr>${heads.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map(cell=>`<td>${cell??''}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;

const existingMain=document.querySelector('.shell main');
const existingNav=document.querySelector('.shell .sidebar');
const nav=document.createElement('nav');nav.className='sidebar submission-nav';
existingNav?.after(nav);renderProcessNav(nav);
nav.querySelectorAll('a[href^="/"]').forEach(anchor=>{const url=new URL(anchor.href);url.searchParams.set('preview','submission');anchor.href=url.pathname+url.search;});
const main=document.createElement('main');main.className='submission-main';main.setAttribute('aria-label','제출 분석 대시보드');
existingMain?.after(main);document.body.classList.add('submission-active');
const controls=document.querySelector('.header-controls');
const headBadge=document.createElement('span');headBadge.className='submission-header-badge';headBadge.textContent='C+ v1 · 자금·운영 제약 미충족';
controls?.prepend(headBadge);

const cache={};let geo=null,geoShapes=null;
const params=new URLSearchParams(location.search);
let version=params.get('version')==='c'?'c':params.get('version')==='cplus'?'cplus':(()=>{try{return localStorage.getItem('nearmart-submission-version')==='c'?'c':'cplus';}catch{return 'cplus';}})();
let year=route==='/demand'?2027:2027,bm='BM1',area='',scenario='BASE',selectedDong='';
async function getData(id){
 if(cache[id])return cache[id];
 const response=await fetch('/api/submission?version='+id,{cache:'no-store'});
 if(!response.ok)throw Error('데이터 스냅샷을 읽지 못했습니다. HTTP '+response.status);
 return cache[id]=await response.json();
}
async function getGeo(){
 if(geo)return geo;
 const response=await fetch('/api/submission-geo',{cache:'no-store'});
 if(!response.ok)throw Error('서울 행정동 경계를 읽지 못했습니다.');
 geo=await response.json();return geo;
}
function shell(data){
 const isPlus=data.id==='cplus';
 const title=sections[route];
 return `<section class="submission-hero ambient ambient--hero"><div><span class="submission-kicker">NEARMART · 제출 분석 · ${esc(title)}</span><h1>${esc(title)}</h1><p>${isPlus?'C+ v1 · 제출 주 분석 결과 · 자금·운영 제약 미충족':'C · 기존 분석 비교 기준 · 500억 자금 한도 미충족'}</p></div><div class="submission-switch"><label for="submission-version">분석 버전</label><select id="submission-version" aria-label="분석 버전"><option value="cplus" ${isPlus?'selected':''}>C+ v1 · 제출 주 분석</option><option value="c" ${!isPlus?'selected':''}>C · 기존 분석</option></select><small>전환 시 모든 단계가 같은 버전으로 바뀝니다.</small></div></section>
 <section class="submission-alert" role="status"><strong>${isPlus?'투자 미선정 · 최대 자금소요 500억 초과 · 대표 운영 검증 일부 미충족':'기존 분석 비교 기준 · 최대 자금소요 500억 초과'}</strong><span>계산·원장 검산과 사업 적격성은 별도입니다. 공식 연간 전망은 BLOCKED_ANNUAL / null입니다.</span></section>
 <div id="submission-content"></div><footer class="submission-footer"><span>출처: ${isPlus?'C_plus_20261113/results':'comparison_audit_20261113/C/01_ASTRA/NearMart_blind/results'} · T1–T4와 같은 버전의 원장만 사용 · 저장 결과 조회</span><a href="${route}">원래 화면 열기 ↗</a></footer>`;
}
function compareRow(c,cp,field,format){return `<tr><th>${esc(field)}</th><td>${esc(format(c))}</td><td>${esc(format(cp))}</td></tr>`;}
async function comparison(){
 const [c,cp]=await Promise.all([getData('c'),getData('cplus')]);
 return `<div class="submission-table-scroll"><table><thead><tr><th>같은 종류의 지표</th><th>C · 기존 분석</th><th>C+ v1 · 제출 분석</th></tr></thead><tbody>
 ${compareRow(c.main.npv_krw,cp.main.npv_krw,'NPV',eok)}
 ${compareRow(c.main.peak_funding_krw,cp.main.peak_funding_krw,'최대 자금소요',eok)}
 ${compareRow(c.main.ebitda_2031,cp.main.ebitda_2031,'2031 EBITDA',eok)}
 ${['BM1','BM2','BM3'].map(name=>compareRow(c.benchmark.selected.find(r=>r.instance===name)?.ontime_rate,cp.benchmark.selected.find(r=>r.instance===name)?.ontime_rate,name+' 정시율',pct)).join('')}
 </tbody></table></div><p class="submission-note">버전 간 차이는 수요 정의·운영 정책·연도별 재검증이 함께 달라진 결과입니다. 개별 정책의 인과 효과로 해석하지 않습니다.</p>`;
}
function kpis(data){
 const d=data.main;
 return `<div class="submission-cards">${card('주력 분석안',data.case_id,data.model)}${card('20년 NPV',eok(d.npv_krw),'조건부 재무 결과')}${card('최대 자금소요',eok(d.peak_funding_krw),'500억 한도 미충족','danger')}${card('2031 EBITDA',eok(d.ebitda_2031),'흑자 목표 미충족','danger')}</div>`;
}
async function overview(data){
 const flow=[['데이터 검증','/evidence','입력·결측·단위와 계산 검산'],['수요예측','/demand','완료 수요 대용치와 외삽'],['네트워크','/network','P1 계획과 427동 배정'],['배차 벤치마크','/dispatch','BM1–3 저장 정책·제약'],['시뮬레이션','/simulation','반복 결과·실패 기록'],['20년 재무','/investment','2026 t=0~2046 현금 원장'],['What-if','/scenario','저장된 수요·비용 충격'],['최종 판단','/decision','자금·운영 미충족과 남은 가정']];
 return `${kpis(data)}<section class="submission-panel"><h2>문제풀이 과정과 연결된 결과</h2><p>각 단계의 결과와 상태를 같은 분석 버전에서 확인합니다. C+는 제출 분석으로 채택했지만 투자 적격안은 아닙니다.</p><div class="submission-flow">${flow.map(([name,url,desc],i)=>`<a href="${url}?preview=submission"><b>${String(i+1).padStart(2,'0')}</b><strong>${name}</strong><small>${desc}</small></a>`).join('')}</div></section><section class="submission-panel"><h2>C에서 C+ v1로 무엇이 달라졌나</h2>${await comparison()}</section>`;
}
function guide(data){
 const rows=[['관제','/','오늘의 질문과 자금·운영 상태'],['검증','/evidence','원본 범위, T2·T3 행수, 해시'],['수요','/demand','성숙 수요와 도시 구간'],['네트워크','/network','P1 계획, 연도별 동 배정'],['배차','/dispatch','BM별 성과와 실제 저장 트립 3D'],['시뮬레이션','/simulation','연도·날씨 실패와 미처리'],['재무','/investment','FCF·누적잔액의 별도 축'],['What-if','/scenario','저장된 시나리오만 선택'],['판단','/decision','투자 미선정과 남은 검증']];
 return `<section class="submission-panel"><h2>질문 → 근거 → 판단 순서로 시연</h2><p>현재 선택은 ${esc(data.version)}입니다. 메뉴를 이동해도 분석 버전이 유지됩니다.</p>${table(['순서','화면','보여줄 근거'],rows.map(([name,url,desc],i)=>[String(i+1).padStart(2,'0'),link(url,name),esc(desc)]))}</section><section class="submission-panel"><h2>시연 중 분리해서 말할 상태</h2><div class="submission-cards">${card('계산·원장','C+ 21/21 검산','사업 적격 판정과 별도')}${card('배차','BM별 자원 검사','BM3 100%는 BM3 표본 결과')}${card('대표 운영','일부 미충족','P1 폭우 미처리 표본')}${card('장기 외삽','가정 기반','두 파일럿 권역에서 확대')}</div></section>`;
}
function evidence(data){
 const plus=data.id==='cplus';
 const counts=data.data_validation;
 const sources=Object.entries(data.source_hashes).sort((a,b)=>a[0].localeCompare(b[0]));
 return `<div class="submission-cards">${card('서울 행정동','427동','명부·경계')}${card('T2 배정',fmt(data.scope.t2_rows,0)+'행','5개 보고연도 × 427동')}${card('T3 배차',fmt(data.scope.t3_rows,0)+'건','BM1–BM3 주문')}${card('계산 검산',plus?'21 / 21 통과':'별도 기준 확인','투자·운영 합격과 별도')}</div>
 <section class="submission-panel"><h2>데이터와 검증 범위</h2><div class="submission-cards">${card('원본 주문',counts?fmt(counts.raw_orders,0)+'건':'C 기준 파일 확인','정제 전')}${card('완료 수요 대용',data.demand_definition?fmt(data.demand_definition.completed,0)+'건':'C 정의','접수·취소와 별개')}${card('계산·원장',plus?yes(data.simulation.verification?.passed===21):'검증 범위 별도','결과 파일 정합')}${card('투자 상태','미선정','500억 자금 한도 초과','danger')}</div><p class="submission-note">${plus?'접수 79,278건 · 취소 1,561건 · 완료 77,717건. 취소의 미래 전이는 가정입니다.':'C의 완료 수요 대용치와 C+의 접수·취소 분리는 같은 정의가 아닙니다.'}</p></section>
 <section class="submission-panel"><h2>이 화면에 사용한 원본 파일과 SHA-256</h2><p>스냅샷 생성 시 원본 파일의 바이트 해시를 기록했습니다. 데이터 원본은 수정하지 않았습니다.</p>${table(['파일','SHA-256'],sources.map(([file,hash])=>[esc(file),`<code>${esc(hash)}</code>`]))}</section>`;
}
function selectedYear(data,mode){
 const years=mode==='network'?[...new Set(data.network.assignment.map(r=>Number(r.year)))].sort((a,b)=>a-b):[2027,2032,2037,2042,2046];
 if(!years.includes(year))year=years[0];
 return `<label class="submission-select">분석 연도 <select id="submission-year">${years.map(y=>`<option value="${y}" ${year===y?'selected':''}>${y}</option>`).join('')}</select></label>`;
}
function geoParts(geometry){return geometry.type==='Polygon'?geometry.coordinates:geometry.coordinates.flatMap(p=>p);}
function prepareGeo(){
 if(geoShapes)return geoShapes;
 const points=geo.features.flatMap(f=>geoParts(f.geometry).flat());
 const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
 const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
 const scale=Math.min(790/(maxX-minX),545/(maxY-minY));
 const convert=([x,y])=>[50+(x-minX)*scale,590-(y-minY)*scale];
 geoShapes=geo.features.map(f=>({code:f.properties.adm_cd2,name:f.properties.dong,gu:f.properties.gu,
  d:geoParts(f.geometry).map(poly=>poly.map((point,i)=>{const [x,y]=convert(point);return `${i?'L':'M'}${x.toFixed(1)},${y.toFixed(1)}`;}).join('')+'Z').join('')}));
 return geoShapes;
}
function mapView(data,mode){
 const rows=mode==='demand'?data.demand.map.filter(r=>Number(r.year)===year):data.network.assignment.filter(r=>Number(r.year)===year);
 const byCode=new Map(rows.map(r=>[r.adm_cd2,r]));
 const values=rows.map(r=>mode==='demand'?n(r.mature_orders_mid):r.site_id==='UNSERVED'?null:n(r.expected_orders_per_day)).filter(v=>v!=null&&v>0).sort((a,b)=>a-b);
 const q=(p)=>values[Math.min(values.length-1,Math.floor(values.length*p))]??0;
 const q1=q(.33),q2=q(.67);
 const paths=prepareGeo().map(shape=>{
  const row=byCode.get(shape.code),value=mode==='demand'?n(row?.mature_orders_mid):row?.site_id==='UNSERVED'?null:n(row?.expected_orders_per_day);
  const level=value==null||value===0?0:value<=q1?1:value<=q2?2:3;
  return `<path d="${shape.d}" class="submission-dong level-${level} ${selectedDong===shape.code?'selected':''}" data-dong="${shape.code}"><title>${esc(shape.gu+' '+shape.name)}</title></path>`;
 }).join('');
 const row=byCode.get(selectedDong),place=prepareGeo().find(s=>s.code===selectedDong);
 const detail=row&&place?mode==='demand'?`<h3>${esc(place.gu+' '+place.name)}</h3><p>성숙 완료 수요 대용치 <strong>${fmt(row.mature_orders_mid,2)}건/일</strong></p><p>성숙 잠재 접수 ${n(row.mature_arrivals)==null?'C에서 분리되지 않음':fmt(row.mature_arrivals,2)+'건/일'}</p><p>공간 외삽 clip ${row.spatial_clipped===''?'자료 없음':row.spatial_clipped}</p>`:
  `<h3>${esc(place.gu+' '+place.name)}</h3><p>배정 <strong>${esc(row.site_id)}</strong></p><p>계획상 접수 ${fmt(row.expected_orders_per_day,2)}건/일</p><p>평균 배송 ${n(row.avg_delivery_min)==null?'해당 없음':fmt(row.avg_delivery_min,1)+'분'}</p><p>완료 기준 지연 ${n(row.late_rate)==null?'해당 없음':pct(row.late_rate)}</p>`:
  '<h3>행정동 선택</h3><p>지도에서 동을 선택하면 해당 버전·연도의 원본 값을 확인할 수 있습니다.</p>';
 return `<div class="submission-map-grid"><div class="submission-map"><svg viewBox="0 0 900 640" role="img" aria-label="서울 427개 행정동 지도">${paths}</svg><div class="submission-legend"><span>값 없음·0</span><i class="level-1"></i>낮음 <i class="level-2"></i>중간 <i class="level-3"></i>높음</div></div><aside class="submission-map-detail">${detail}<p class="submission-note">표시 단계는 선택 연도 양수 값의 33%·67% 순위 구간입니다. 실제 성능 기준이 아닙니다.</p></aside></div>`;
}
function demandView(data){
 const city=yearValue(data.demand.city.filter(r=>r.scenario==='base'),year);
 const interval=yearValue(data.demand.interval,year);
 const models=data.demand.temporal.filter(r=>r.phase==='test');
 return `<section class="submission-panel"><div class="submission-panel-head"><div><h2>성숙 수요와 도시 합계</h2><p>거점·배송시간·지연·접수 상한을 적용하기 전의 조건부 수요입니다.</p></div>${selectedYear(data,'demand')}</div><div class="submission-cards">${card('성숙 잠재 접수',n(city?.mature_arrivals)==null?'C에서 미분리':fmt(city.mature_arrivals,0)+'건/일','취소 전')}${card('성숙 완료 수요 대용',fmt(city?.mature_orders_mid,0)+'건/일','취소 반영, 최종 처리량 아님')}${card('도시 bootstrap 구간',interval?`${fmt(interval.p05,0)}–${fmt(interval.p95,0)}`:'C에서 미연결',interval?'고정 램프업 조건부 · 건/일':'동별 구간을 합산하지 않음')}${card('선택 수요 모형',data.model,'재무와 독립된 검증 기준')}</div>${mapView(data,'demand')}</section>
 <section class="submission-panel"><h2>수요모형 검증</h2>${models.length?table(['모형','테스트 WAPE','편향','선택 근거'],models.map(r=>[esc(r.model),pct(r.wape),pct(r.bias),esc(r.model===data.model?'선택 모형':'대조 모형')])):table(['형태','평가 기간','WAPE'],data.demand.temporal.slice(0,10).map(r=>[esc(r.shape),esc(r.cut_day),pct(r.wape)]))}<p class="submission-note">LOW/BASE/HIGH 시장 시나리오와 bootstrap 분위수는 다른 축입니다. 구간은 보장된 90% 신뢰구간이 아닙니다. 공식 연간 전망은 BLOCKED_ANNUAL / null입니다.</p></section>`;
}
function networkView(data){
 const rows=data.network.assignment.filter(r=>Number(r.year)===year),assigned=rows.filter(r=>r.site_id!=='UNSERVED');
 const plan=data.network.plan.map(r=>`${r.site_id} ${r.open_year}–${r.close_year} 마지막 영업연도`).join(', ');
 return `<section class="submission-panel"><div class="submission-panel-head"><div><h2>거점 계획과 행정동 배정</h2><p>${esc(plan)}. P2는 초기 계획에서 제외됐으며, P1 폐점 후에도 본사비가 2046년까지 이어집니다.</p></div>${selectedYear(data,'network')}</div><div class="submission-cards">${card('계획 운영 거점',year<=2031?'P1 · 1개':'0개','71개 후보와 구분')}${card('배정 행정동',fmt(assigned.length,0)+' / 427동','계획상 배정')}${card('미서비스 행정동',fmt(rows.length-assigned.length,0)+'동','UNSERVED는 실제 미서비스 계획')}${card('배정 접수 합계',fmt(assigned.reduce((s,r)=>s+Number(r.expected_orders_per_day),0),1)+'건/일','T2 계획상 접수량')}</div>${mapView(data,'network')}</section><section class="submission-panel"><h2>T1 → T2 → 운영</h2><p>배정된 동만 P1 운영 모형에 전달됩니다. 지도의 배송시간과 지연율 빈칸은 미서비스 동에서 해당 없음입니다. 서비스 가능 거리·도로 경로를 새로 추정하지 않았습니다.</p>${link('/simulation','시뮬레이션 검증으로 이동')}</section>`;
}
function dispatchMarkup(){return `<section class="submission-panel"><div class="submission-panel-head"><div><h2>저장된 배차 트립 · 3D 방문 순서</h2><p>실제 T3 주문·방문 순서와 주문 좌표를 사용한 직선 도식입니다. 도로 GPS 경로가 아닙니다.</p></div><div class="submission-selects"><label>BM 실험 <select id="submission-bm"><option>BM1</option><option>BM2</option><option>BM3</option></select></label><label>행정동 <select id="submission-area"></select></label></div></div><div id="submission-dispatch-kpis"></div><div class="dispatch-demo submission-dispatch" id="submission-dispatch"><div class="dispatch-context"><div><strong>선택 동을 포함하는 저장 트립</strong><span data-dispatch-scope></span></div><div class="dispatch-focus"><label>보기 <select data-dispatch-mode><option value="compare">좌우 비교</option><option value="single">단일 장면</option></select></label><label data-dispatch-policy-wrap hidden>정책 <select data-dispatch-policy></select></label><label>트립 범위 <select data-dispatch-region></select></label><div data-dispatch-orders></div></div></div><div class="dispatch-pair"><section class="dispatch-scene"><header><span class="dispatch-key cyan"></span><strong data-dispatch-policy-title></strong><small data-dispatch-policy-desc></small></header><div class="dispatch-canvas" data-dispatch-canvas><canvas aria-label="실제 저장 트립의 3D 방문 순서"></canvas><canvas class="dispatch-labels" aria-hidden="true"></canvas></div></section><section class="dispatch-scene"><header><span class="dispatch-key violet"></span><strong data-dispatch-policy-title></strong><small data-dispatch-policy-desc></small></header><div class="dispatch-canvas" data-dispatch-canvas><canvas></canvas><canvas class="dispatch-labels"></canvas></div></section></div><div class="dispatch-controls"><button data-dispatch-play>▶ 재생</button><label class="dispatch-speed">속도 <select data-dispatch-speed><option value="0.5">0.5×</option><option value="1" selected>1×</option><option value="2">2×</option></select></label><label>방문 순서 <input type="range" data-dispatch-progress min="0" max="100" value="100"></label><div class="dispatch-camera"><button data-camera="left">↶</button><button data-camera="right">↷</button><button data-camera="in">＋</button><button data-camera="out">－</button><button data-camera="reset">시점 초기화</button></div></div><p class="dispatch-unsupported" hidden>WebGL 미지원</p><div class="dispatch-readout"><div><b>선택 범위</b><span data-dispatch-region-detail></span></div><div><b>선택 주문</b><span data-dispatch-order-detail></span></div><div><b>성과·제약</b><span>BM 전체 KPI는 위 카드 기준</span></div></div><p class="dispatch-footnote">한 동을 선택하면 그 동 주문을 포함하는 저장 트립 하나를 보여줍니다. 연결선은 좌표 사이의 직선 도식이며 도로 주행 경로·차량 이동 애니메이션이 아닙니다. 정책 A/B의 주문별 쌍 비교와 계산시간은 원본 파일에 없습니다.</p></div></section>`;}
function selectedBenchmark(data){
 const row=data.benchmark.selected.find(r=>r.instance===bm);
 if(!row)return '';
 const cost=data.id==='cplus'?row.cost_per_delivered_order:row.cost_per_order;
 return `<div class="submission-cards">${card(bm+' 주문',fmt(row.n_orders,0)+'건','해당 BM 입력')}${card('완료 중 정시율',pct(row.ontime_rate),'서울 전체 연간 정시율 아님')}${card('전달 건당 비용',fmt(cost,0)+'원','2027년 단가 기준')}${card('배차·자원 검사',data.id==='cplus'?yes(row.resource_pass)+' / '+yes(row.operational_pass):'기존 C 정책','대표일 95%는 팀 기준')}</div>`;
}
async function dispatchView(data){
 const bmRows=['BM1','BM2','BM3'].map(id=>{const r=data.benchmark.selected.find(x=>x.instance===id);return [esc(id),esc(r.policy),fmt(r.n_orders,0),pct(r.ontime_rate),fmt(r.mean_min??r.mean_delivery_min,1)+'분',fmt(r.cost_per_delivered_order??r.cost_per_order,0)+'원',data.id==='cplus'?esc(yes(r.resource_pass)):'검증 범위 별도'];});
 return `${dispatchMarkup()}<section class="submission-panel"><h2>BM1–BM3 선택 정책 성과</h2>${table(['BM','저장 정책','주문','완료 중 정시','평균 시간','전달 건당 비용','자원 검사'],bmRows)}<p class="submission-note">BM3의 100%는 해당 고정 BM 표본의 결과입니다. C+는 위탁 미사용 셀에서 contract_hourly가 해당 없음입니다. bike_bays는 거점 동시 대기·상차 인원 상한이며 전체 재직 인원 상한이 아닙니다.</p></section><section class="submission-panel"><h2>탈락 정책과 제약</h2>${table(['BM','정책','정시율','비용/전달 건','자원','운영'],data.benchmark.policies.filter(r=>r.instance===bm).slice(0,18).map(r=>[esc(r.instance),esc(r.policy),pct(r.ontime_rate),fmt(r.cost_per_delivered_order??r.cost_per_order,0)+'원',esc(yes(r.resource_pass)),esc(yes(r.operational_pass))]))}<p class="submission-note">정책별 계산시간은 결과팩에 없어 표시하지 않습니다. 선택 정책의 결과를 미래 연간 운영 성과로 곧바로 이전하지 않습니다.</p></section>`;
}
function simulationView(data){
 const rows=data.simulation.operations.filter(r=>(r.model==='B84'||data.id==='c')&&(!r.scenario||r.scenario==='base')&&r.site_id==='P1');
 const fails=data.simulation.failures.filter(r=>r.model==='B84'&&r.scenario==='base'&&r.site_id==='P1');
 const totalFail=fails.reduce((s,r)=>s+Number(r.resource_failed_runs),0),totalOrders=fails.reduce((s,r)=>s+Number(r.unfulfilled_sample_orders),0);
 return `<div class="submission-cards">${card('운영 검증',data.id==='cplus'?'P1 600회 중 6회 자원 실패':'C 기준 검증 범위 별도',data.id==='cplus'?'2027–2031 · 연도별 120회':'C 결과와 직접 합산 불가','danger')}${card('실패 표본 미처리',data.id==='cplus'?fmt(totalOrders,0)+'건':'미연결','표본 합계 · 연간 실제값 아님')}${card('연도별 조건',data.id==='cplus'?'6셀 × 20회':'C 저장 범위','날씨·요일 대표 실험')}${card('계산 검산',data.id==='cplus'?'21/21 통과':'별도 확인','운영 적격과 별도')}</div><section class="submission-panel"><h2>P1 연도별 운영 · 접수, 전달, 미처리</h2>${table(['연도','계획 접수/일','전달/일','미처리/일','완료 중 정시','대표 셀 p05 최소','자원 조건'],rows.map(r=>[esc(r.year),fmt(r.daily,2),n(r.delivered_daily)==null?'C 미분리':fmt(r.delivered_daily,2),n(r.unfulfilled_daily)==null?'C 미분리':fmt(r.unfulfilled_daily,3),pct(1-Number(r.late_rate)),n(r.min_cell_p05_ontime)==null?'C 미연결':pct(r.min_cell_p05_ontime),esc(yes(r.all_resource_pass))]))}<p class="submission-note">정시율은 완료된 일반 배송 주문 기준이고, 접수 대비 전달률·미처리량과 별개입니다. 비용 필드는 2027년 기준 단가로 계산된 일평균 금액입니다.</p></section>${data.id==='cplus'?`<section class="submission-panel"><h2>주력 B84 · P1 · BASE 실패 원장</h2>${table(['연도','반복','자원 실패','표본 미처리','연간 추정 미처리/일'],fails.map(r=>[esc(r.year),esc(r.replications),esc(r.resource_failed_runs),esc(r.unfulfilled_sample_orders),fmt(r.expected_unfulfilled_daily,3)]))}<p class="submission-note">2027–2031 최종 검증 600회 중 폭우 표본 6회의 미처리 합계 126건입니다. 다른 모형·시장 시나리오 실패를 주력안에 합산하지 않았습니다. 연간 추정은 별도 열에 표시했습니다.</p></section>`:''}`;
}
function chart(rows,key,title){
 const vals=rows.map(r=>Number(r[key])/1e8),min=Math.min(0,...vals),max=Math.max(0,...vals),span=Math.max(1,max-min);
 const x=i=>47+i*29,y=v=>20+(max-v)/span*180,zero=y(0);
 const path=vals.map((v,i)=>`${i?'L':'M'}${x(i)},${y(v)}`).join(' ');
 return `<div class="submission-chart"><h3>${esc(title)} <small>단위: 억 원 · 독립 금액축</small></h3><svg viewBox="0 0 670 250" role="img" aria-label="${esc(title)} 2026년부터 2046년까지"><line x1="40" x2="650" y1="${zero}" y2="${zero}" class="zero"/><path d="${path}" class="series"/>${vals.map((v,i)=>`<circle cx="${x(i)}" cy="${y(v)}" r="2.8"><title>${rows[i].year}: ${fmt(v,2)}억</title></circle>`).join('')}<text x="5" y="25">${fmt(max,0)}</text><text x="5" y="200">${fmt(min,0)}</text><text x="40" y="235">2026</text><text x="597" y="235">2046</text></svg></div>`;
}
function financeView(data){
 const rows=data.finance.cashflow;
 const y2031=yearValue(rows,2031);
 return `${kpis(data)}<section class="submission-panel"><h2>20년 재무 원장 · 2026 초기 시점 t=0</h2><div class="submission-charts">${chart(rows,'net_cashflow','연간 순현금흐름 FCF')}${chart(rows,'cumulative_cashflow','할인 전 누적 현금잔액')}</div><p class="submission-note">금액 필드는 명목 원을 억 원으로 환산했습니다. FCF는 net_cashflow, 누적 잔액은 cumulative_cashflow입니다. 두 그래프는 별도 금액축입니다.</p></section><section class="submission-panel"><h2>연도별 핵심 값</h2>${table(['연도','전달 주문','접수 주문','미처리 주문','EBITDA','FCF','누적 현금'],rows.map(r=>[esc(r.year),n(r.orders)==null?'t=0':fmt(r.orders,0),n(r.accepted_orders)==null?'미분리':fmt(r.accepted_orders,0),n(r.unfulfilled_orders)==null?'미분리':fmt(r.unfulfilled_orders,0),n(r.ebitda)==null?'해당 없음':eok(r.ebitda),eok(r.net_cashflow),eok(r.cumulative_cashflow)]))}<p class="submission-note">2031 EBITDA ${eok(y2031?.ebitda)}. P1의 마지막 영업연도는 2031년이며, 2032년부터 주문이 없어도 본사비가 남습니다. 500억 한도와 2031 흑자 목표를 각각 미충족합니다.</p></section>`;
}
function scenarioLabel(id){return {BASE:'기준 P1',base:'기준 P1',low:'LOW 수요',high:'HIGH 수요',W1_labor_12pct:'W1 인건비 +12%',W3_discount_16pct:'W3 할인율 16%',external_revenue_zero:'외부퀵 매출 미인식',cancel_full_pick_cost:'취소 피킹 비용 준비금',W2_new_competitor:'W2 경쟁 충격',W4_lease_denial2037:'W4 재계약 거절'}[id]??id;}
function scenarioView(data){
 const rows=data.finance.scenarios;
 if(!rows.some(r=>r.scenario===scenario))scenario=rows[0]?.scenario??'BASE';
 const selected=rows.find(r=>r.scenario===scenario);
 return `<section class="submission-panel"><div class="submission-panel-head"><div><h2>저장 시나리오 조회</h2><p>지원되는 계산 결과만 선택합니다. 화면 조작으로 새 시뮬레이션을 만들지 않습니다.</p></div><label class="submission-select">저장 결과 <select id="submission-scenario">${rows.map(r=>`<option value="${esc(r.scenario)}" ${r.scenario===scenario?'selected':''}>${esc(scenarioLabel(r.scenario))}</option>`).join('')}</select></label></div><div class="submission-cards">${card('선택 결과',scenarioLabel(scenario),selected?.definition??'고정 계획')}${card('NPV',eok(selected?.npv_krw),'같은 버전 원장')}${card('최대 자금소요',eok(selected?.peak_funding_krw),'500억 한도 초과','danger')}${card('2031 EBITDA',n(selected?.ebitda_2031)==null?'해당 파일 미연결':eok(selected.ebitda_2031),'시나리오별 필드 범위')}</div>${table(['저장 시나리오','NPV','최대 자금소요','자금 한도','설명'],rows.map(r=>[esc(scenarioLabel(r.scenario)),eok(r.npv_krw),eok(r.peak_funding_krw),esc(yes(r.funding_pass)),esc(r.definition??(r.plan_fixed==='True'?'P1 계획 고정':'조건 확인'))]))}<p class="submission-note">LOW/HIGH는 같은 P1 정책에서 수요를 바꾸고 DES를 재실행했습니다. W1·W3·외부퀵·취소 비용은 각각 정의가 다른 저장 스트레스입니다. 임의 조합 보간은 하지 않습니다.</p></section>`;
}
async function decisionView(data){
 const plus=data.id==='cplus';
 return `${kpis(data)}<section class="submission-panel"><h2>최종 판단 · 검토한 범위의 분석 결과</h2><div class="submission-decision"><strong>투자 미선정</strong><p>최대 자금소요가 500억 원을 넘고 2031 EBITDA가 음수입니다. ${plus?'주력 P1의 대표 운영 검증에서도 폭우 표본 미처리가 남았습니다.':'C는 비교 기준이며 C+와 수요·정책이 함께 달라 단일 변경 효과가 아닙니다.'} 전체 최적해 또는 원문 전체 불가능성을 증명한 결과로 표시하지 않습니다.</p></div><div class="submission-status-grid">${card('① 계산·원장',plus?'21/21 검산 통과':'원본 근거 확인','계산 정합성')}${card('② BM 자원·배차',plus?'BM1–3 자원 검사 통과':'C 기준 BM 결과','미래 일반화 별도')}${card('③ 대표일·연도 DES',plus?'일부 미충족':'C 검증 범위 제한','P1 폭우 표본')}${card('④ 장기·공간 외삽','가정 기반','13주·두 파일럿 권역')}${card('⑤ 500억 자금','미충족',eok(data.main.peak_funding_krw),'danger')}</div></section><section class="submission-panel"><h2>C와 C+를 나란히 검토</h2>${await comparison()}</section><section class="submission-panel"><h2>남은 검증</h2><ul class="submission-list"><li>13주 파일럿으로 추정한 성숙 수요와 두 권역에서 서울로의 공간 외삽</li><li>미래 계절·날씨 빈도, 과거 완료 비율의 미래 취소 전이</li><li>외부퀵 완료시간, BM 입력을 보고 선택한 근무 정책의 미래 일반화</li><li>추가 BM3 비용 정책 실험은 이 결과팩에 포함되지 않음</li></ul></section>`;
}
function operations(data){
 const op=data.simulation.operations.find(r=>r.site_id==='P1'&&r.year==='2027'&&(r.model==='B84'||data.id==='c'));
 return `${kpis(data)}<section class="submission-panel"><h2>2027 운영 출발점</h2><div class="submission-cards">${card('계획 운영 거점','P1 · 1개','71개 후보와 구분')}${card('P1 계획 접수',op?fmt(op.daily,1)+'건/일':'해당 없음','C/C+ 같은 버전 운영 원장')}${card('427동 배정',fmt(data.network.assignment.filter(r=>r.year==='2027'&&r.site_id!=='UNSERVED').length,0)+'동','UNSERVED 별도')}${card('투자 상태','미선정','자금·운영 제약 확인','danger')}</div><div class="submission-actions">${link('/network','네트워크 지도')}${link('/simulation','운영 검증')}${link('/investment','20년 현금')}</div></section>`;
}
async function content(data){
 switch(route){
  case '/':return operations(data);
  case '/overview':return overview(data);
  case '/guide':return guide(data);
  case '/evidence':return evidence(data);
  case '/demand':return demandView(data);
  case '/network':return networkView(data);
  case '/dispatch':return dispatchView(data);
  case '/simulation':return simulationView(data);
  case '/investment':return financeView(data);
  case '/scenario':return scenarioView(data);
  case '/decision':return decisionView(data);
 }
}
let sceneControl=null;
function setupDispatch(data){
 const select=main.querySelector('#submission-bm');if(!select)return;
 select.value=bm;
 const areaSelect=main.querySelector('#submission-area');
 const setArea=()=>{
  const areas=data.benchmark.areas[bm]??[];
  areaSelect.innerHTML=areas.map(r=>`<option value="${esc(r.adm_cd2)}">${esc(r.name)} · ${esc(r.adm_cd2)}</option>`).join('');
  if(!areas.some(r=>r.adm_cd2===area))area=areas[0]?.adm_cd2??'';
  areaSelect.value=area;
  main.querySelector('#submission-dispatch-kpis').innerHTML=selectedBenchmark(data);
  const scene=data.benchmark.scenes[`${bm}/${area}`];
  if(scene){if(sceneControl?.setData)sceneControl.setData(scene);else sceneControl=mountDispatchScene(main.querySelector('#submission-dispatch'),scene);}
 };
 select.onchange=()=>{bm=select.value;area='';setArea();};
 areaSelect.onchange=()=>{area=areaSelect.value;setArea();};
 setArea();
}
async function render(){
 try{
  const data=await getData(version);
  if(route==='/demand'||route==='/network')await getGeo();
  headBadge.textContent=version==='cplus'?'C+ v1 · 자금·운영 제약 미충족':'C · 기존 분석 비교 기준';
  main.innerHTML=shell(data);
  main.querySelector('#submission-content').innerHTML=await content(data);
  const versionSelect=main.querySelector('#submission-version');
  versionSelect.onchange=()=>{version=versionSelect.value;try{localStorage.setItem('nearmart-submission-version',version);}catch{}selectedDong='';sceneControl=null;render();};
  const yearSelect=main.querySelector('#submission-year');
  if(yearSelect)yearSelect.onchange=()=>{year=Number(yearSelect.value);selectedDong='';render();};
  const map=main.querySelector('.submission-map');
  if(map)map.onclick=event=>{const target=event.target.closest('[data-dong]');if(target){selectedDong=target.dataset.dong;render();}};
  const scenarioSelect=main.querySelector('#submission-scenario');
  if(scenarioSelect)scenarioSelect.onchange=()=>{scenario=scenarioSelect.value;render();};
  if(route==='/dispatch')setupDispatch(data);
 }catch(error){console.error(error);main.innerHTML=`<section class="submission-panel"><h1>제출 분석을 불러오지 못했습니다</h1><p>${esc(error.message)}</p></section>`;}
}
render();
