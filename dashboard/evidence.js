import {renderProcessNav} from './process-nav.js';
const $=selector=>document.querySelector(selector);
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const fmt=value=>value==null?'미연결':typeof value==='number'?value.toLocaleString('ko-KR',{maximumFractionDigits:3}):String(value);
const tabs={overview:'데이터 개요',quality:'품질 점검',models:'모델 검증',runs:'실행 이력',results:'결과 추적'};
const headings={
 overview:['원본·결과 데이터셋','원본 적재 명세, 관측 자료, 가정 기반 산출물'],
 quality:['입력 품질과 처리 정책','원본 검사 단위입니다. 한 행이 여러 검사에 포함될 수 있습니다.'],
 models:['모델과 독립 검증','검산 결과는 해당 시험 범위에 적용됩니다.'],
 runs:['Run ID 실행 계보','실행 명세의 시점, 입출력 파일과 후속 참조를 읽습니다.'],
 results:['화면 지표의 결과 추적','운영관제, 네트워크, Scenario Lab, 재무의 표시값과 원본 키를 대조합니다.']
};
const params=new URLSearchParams(location.search);
const state={data:null,tab:params.has('kind')?'results':Object.hasOwn(tabs,params.get('tab'))?params.get('tab'):'overview',
 selected:null,request:0};
renderProcessNav($('.evidence-nav'));
async function get(url){
 const response=await fetch(url);
 if(response.status===401){location.assign('/login');throw Error('session');}
 if(!response.ok)throw Error(url);
 return response.json();
}
const tag=value=>'<span class="ev-tag '+esc(value.toLowerCase())+'">'+esc(value)+'</span>';
const tags=values=>'<div class="ev-state-line">'+values.map(tag).join('')+'</div>';
const block=(title,text)=>'<section class="ev-detail-block"><h4>'+esc(title)+'</h4><p>'+esc(text)+'</p></section>';
const list=(title,items)=>'<section class="ev-detail-block"><h4>'+esc(title)+'</h4>'+
 (items.length?'<ul>'+items.map(value=>'<li><code>'+esc(value)+'</code></li>').join('')+'</ul>':'<p>미연결</p>')+'</section>';
const files=keys=>'<section class="ev-detail-block"><h4>근거 파일 · 읽기 전용</h4><ul>'+keys.map(key=>{
 const item=state.data.files[key];
 return !item?'':item.available?'<li><a href="/api/evidence-file/'+encodeURIComponent(key)+'" download>'+esc(item.name)+'</a> · '+esc(item.area==='review'?'검토본 사본':item.area==='desktop'?'Work 원본 위치':'Work 보관본')+'</li>':
  '<li>'+esc(item.name)+' · UNAVAILABLE</li>';
}).join('')+'</ul></section>';
const auditFor=key=>state.data.audits[key];
function auditLabel(key){
 const audit=auditFor(key);
 if(!audit)return 'UNAVAILABLE';
 if(audit.counts.FAIL>0)return 'FAIL 기록';
 if(audit.counts.BLOCKED||audit.counts.NOT_CHECKED)return '부분 검증';
 if(audit.counts.PASS||audit.status==='PASS')return 'VALIDATED';
 return '미검증';
}
function auditDetail(key){
 const audit=auditFor(key);
 if(!audit)return block('독립 검증','원본 검증 기록 미연결');
 const counts=Object.entries(audit.counts).map(([k,v])=>k+' '+v).join(' · ');
 return block('독립 검증',counts||audit.status||'상태 미확인')+
  (audit.scope?block('원본 검증 범위',audit.scope):'')+
  (audit.checks.length?'<details class="ev-detail-block"><summary>검사 항목 펼치기 · '+audit.checks.length+'</summary><ul>'+
   audit.checks.map(row=>'<li>'+esc(row.check)+' · '+esc(row.status)+'</li>').join('')+'</ul></details>':'');
}
const derived=[
 ['scope','조건부 분석 범위','ASSUMPTION_SCENARIO','427동 명부에서 승인 가정 기반 423동을 사용한 S6 범위입니다. 해당 실행의 나머지 4동은 원천 입력 차단입니다. 다른 분석의 모집단으로 자동 적용하지 않습니다.',['demandNote','financeContract']],
 ['candidates','후보와 조건부 운영 거점','MODEL_ESTIMATE','후보 명부는 71개입니다. 운영 거점은 실행·시나리오·연도별 결과로 표시합니다. 71개를 실제 운영 거점 수로 해석하지 않습니다.',['foundationNote','financeContract']],
 ['observed','2026 파일럿 관측 근거','OBSERVED','관측 파일의 지표와 모집단을 보존합니다. 모델 추정 및 연간 실적과는 별도로 관리합니다.',['observed','policyNote']],
 ['annual-block','공식 연간 전망','BLOCKED','S2 공식 연간량은 BLOCKED_ANNUAL/null입니다. 승인 가정 시나리오는 별도 결과입니다.',['demandNote']],
 ['business','Business 독립 재계산','UNAVAILABLE','연결 가능한 독립 Business 결과가 확인되지 않았습니다. 기존 Work 실행에 병합하지 않았습니다.',[]]
];
const resultKinds={
 operations:['운영 관제 · 연간 운영 KPI','annual_network.csv · 연간 기대 건수','접수는 주문 요청, 완료는 모델 완료, 거점 수는 조건부 운영안입니다. 정시는 완료 건 중 60분 이내입니다.'],
 network:['네트워크 분석 · 배정과 주문 흐름','annual_dong.csv / annual_site.csv','동과 거점의 배정·요청·완료·미처리를 확인합니다. 미처리는 거절·취소·외부 처리 대기와 구분합니다.'],
 scenario:['Scenario Lab · A/B 비교','annual_network.csv / scenario_summary.csv','연도와 입력 가정이 맞아야 비교 효과를 해석할 수 있습니다. 조건이 다른 경우 참고 차이로 표시됩니다.'],
 finance:['Investment Intelligence · 재무 지표','annual_finance.csv / ledger.csv','현금은 명목 원, NPV는 2026년 말 0시점·연 12%입니다. 최대 자금 소요는 할인 전 누적 순현금흐름 최저점 기준입니다.']
};
const issueInfo={
 single_hh_ratio_range:['single_hh_ratio','수요 특성 입력','분수 범위 이탈. 미확인 단위를 자동 환산하지 않습니다.'],
 apt_hh_ratio_range:['apt_hh_ratio','수요 특성 및 건물 특성','분수 범위 이탈. 원인 확인 전 보류합니다.'],
 lat_seoul_bbox:['lat','거점 GIS·거리','범위 이상을 표시하고 지리 적용 범위를 별도로 점검합니다.'],
 unknown_dong_key:['adm_cd2','행정동·거점 조인','코드 근거 확인 전 공간 조인에 사용하지 않습니다.'],
 monthly_rent_krw_invalid:['monthly_rent_krw','거점 비용·재무','원본 임대료는 보류입니다. 조건부 임대 가정은 별도 실행 근거에서 확인합니다.'],
 area_pyeong:['area_value / area_unit','시설 규모·유형','파생본에서 1평=3.3058㎡를 적용하고 원본과 변환 계보를 보존합니다.'],
 physical_duplicate_candidate:['site_id / 위치','거점 후보 선택','물리적 중복 가능성. 원본 후보는 보존합니다.'],
 delivered_ts_missing_or_invalid:['delivered_ts','배송 시간·정시율','완료시각을 보정하거나 지연으로 간주하지 않습니다. 시간 분모와 상태를 분리합니다.'],
 weight_kg_invalid:['weight_kg','트립 중량 검증','결측·음수는 용량 검증 보류입니다. 수요 모집단의 제외와 별도입니다.'],
 coordinate_outside_declared_dong:['cust_lat / cust_lon / adm_cd2','이동 시간 및 GIS','선언 행정동과 좌표 불일치를 표시합니다. 원인 미확정 좌표를 자동 보정하지 않습니다.'],
 exact_duplicate_removed:['전체 행','파생 주문 모집단','원본을 보존하고 파생본에서 완전 동일 행의 첫 행을 유지했습니다.']
};
function entries(){
 const d=state.data;
 if(state.tab==='overview')return [
  ...derived.map(([id,title,kind,note,keys])=>({id,title,kind,note,keys,group:kind,meta:'범위 및 출처',type:'derived'})),
  ...d.inventory.map((r,i)=>({id:'dataset-'+i,title:r.file,meta:'테이블 '+r.table+' · '+fmt(+r.rows)+'행',group:'원본 적재',type:'dataset',row:r})),
  ...Object.entries(d.files).map(([key,item])=>({id:'file-'+key,title:item.name,meta:item.run,group:item.available?'파일 연결':'UNAVAILABLE',type:'file',key}))
 ];
 if(state.tab==='quality')return [
  ...d.issues.map((row,i)=>({id:'issue-'+i,title:issueInfo[row.rule_id]?.[0]??row.rule_id,meta:row.source_file,group:+row.affected_rows>0?'영향 있음':'이 검사 0건',type:'issue',row}))
   .sort((a,b)=>Number(b.row.affected_rows>0)-Number(a.row.affected_rows>0)),
  ...d.policyIssues.map((row,i)=>({id:'policy-'+i,title:row.issue,meta:'승인 정책 · 후보 및 단위',group:'영향 있음',type:'policy',row})),
  {id:'gis',title:'행정동 코드 ↔ 서울 경계',meta:'GIS 조인 · 적용 범위 구분',group:'정합성 검증',type:'gis'},
  ...[...new Set(d.blockedDongs.map(row=>row.adm_cd2))].map(code=>{
   const rows=d.blockedDongs.filter(row=>row.adm_cd2===code);
   return {id:'blocked-'+code,title:rows[0].dong,meta:rows[0].reason,group:'BLOCKED',type:'blocked',rows};
  })
 ];
 if(state.tab==='models')return d.models.map(model=>({id:model.id,title:model.title,meta:model.run,group:auditLabel(model.audit),type:'model',model}));
 if(state.tab==='runs')return d.runs.map(run=>({id:run.id,title:run.id,meta:run.title,group:auditLabel(run.audit),type:'run',run}));
 return Object.entries(resultKinds).map(([id,[title,source]])=>({id,title,meta:source,group:params.get('kind')===id&&params.get('scenario')==='official'?'BLOCKED':'조건부 추적',type:'result'}));
}
function chooseTab(tab){
 state.tab=tab;state.selected=null;state.request++;
 $('#ev-search').value='';$('#ev-filter').value='';
 render();
}
function render(){
 if(!state.data)return;
 $('#ev-tabs').innerHTML=Object.entries(tabs).map(([key,label])=>'<button data-tab="'+key+'" aria-pressed="'+(key===state.tab)+'">'+label+'</button>').join('');
 const [title,caption]=headings[state.tab];
 $('#ev-list-title').textContent=title;$('#ev-list-caption').textContent=caption;
 const all=entries(),filter=$('#ev-filter'),before=filter.value;
 const options=[...new Set(all.map(item=>item.group))];
 filter.replaceChildren(new Option('전체',''),...options.map(value=>new Option(value,value)));
 if(options.includes(before))filter.value=before;
 const q=$('#ev-search').value.trim().toLowerCase();
 const visible=all.filter(item=>(!filter.value||filter.value===item.group)&&(!q||
  [item.title,item.meta,item.row?.rule_id,item.id,item.note].join(' ').toLowerCase().includes(q)));
 $('#ev-list').innerHTML='<div class="ev-row ev-list-head"><span>항목</span><span>범위 · 원본</span><span>목록 상태</span></div>'+
  (visible.length?visible.map(item=>'<button class="ev-row" data-row="'+esc(item.id)+'" aria-pressed="'+(item.id===state.selected)+'"><strong>'+
   esc(item.title)+'</strong><span>'+esc(item.meta)+'</span>'+tag(item.group)+'</button>').join(''):'<p class="ev-empty">일치하는 항목이 없습니다.</p>');
 if(!state.selected&&visible.length) select(visible[0].id);
}
function detail(title,body,key=''){
 $('#ev-detail-key').textContent=key;
 $('#ev-detail').innerHTML='<h3>'+esc(title)+'</h3>'+body;
}
function runDetail(run){
 const follow=state.data.runs.filter(item=>item.parents.includes(run.id)).map(item=>item.id);
 return tags([run.id==='S7_JOINT_OPT_20261112_01'?'별도 Work 출처':'Work',auditLabel(run.audit)])+
  block('실행 시점·버전',(run.time??'실행 시각 미연결')+' · '+(run.version??'버전 필드 미연결'))+
  block('정책·가정',run.assumption)+block('명세 원본 상태',run.status??'원본 명세 상태 미연결')+
  list('입력 파일 '+(run.inputCount??'미연결')+'건 · 최대 12건 표시',run.inputs)+
  list('산출 파일 '+(run.outputCount??'미연결')+'건 · 최대 12건 표시',run.outputs)+
  list('입력 참조 실행',run.parents)+list('후속 참조 실행',follow)+
  auditDetail(run.audit)+files([run.manifest,run.audit,run.note]);
}
const valueNames={active_sites:'조건부 운영 거점 수',request:'연간 주문 요청',completed:'연간 완료',ontime:'60분 이내 완료',
 unprocessed:'연간 미처리 분류',late:'지연 완료',blocked_dongs:'원천 차단 동 수',site:'배정 거점',blocked:'원천 입력 차단',
 mature_potential:'성숙 잠재 수요',model_response_factor:'모형 응답계수',picker_roster:'피커 편성',rider_roster:'라이더 편성',
 operating_expenses:'총영업비용',revenue:'매출',cash:'순현금',cumulative_cash:'할인 전 누적 순현금',npv_krw:'20년 NPV',
 peak_funding_krw:'최대 자금 소요',ebitda_2031_krw:'2031 EBITDA'};
function values(title,row){
 return row?'<section class="ev-detail-block"><h4>'+esc(title)+'</h4><ul>'+Object.entries(row).filter(([key])=>Object.hasOwn(valueNames,key))
  .map(([key,value])=>'<li>'+esc(valueNames[key])+' · '+esc(fmt(value))+'</li>').join('')+'</ul></section>':block(title,'UNAVAILABLE');
}
async function resultDetail(kind){
 const current=++state.request;
 const [title,source,definition]=resultKinds[kind];
 const incoming=params.get('kind')===kind;
 const traceParams=new URLSearchParams({kind,run:incoming?(params.get('run')??state.data.linkedRun):state.data.linkedRun,
  id:incoming?(params.get('id')??'N2_ORIGINAL__BASE__HYP_SLOW__NONE'):'N2_ORIGINAL__BASE__HYP_SLOW__NONE',
  year:incoming?(params.get('year')??'2032'):'2032'});
 for(const key of ['dong','site','other'])if(incoming&&params.has(key))traceParams.set(key,params.get(key));
 const basis=block('지표 정의',definition)+block('원본 계정·단위',source+' · '+(kind==='finance'?'명목 원 / 선택 연도 또는 시나리오 전체':'기대 건수 / 선택 연도'))+
  block('조회 조건',traceParams.get('run')+' · '+traceParams.get('year')+'년 · '+traceParams.get('id')+
   (traceParams.has('dong')?' · 동 '+traceParams.get('dong'):traceParams.has('site')?' · 거점 '+traceParams.get('site'):''));
 if(incoming&&params.get('scenario')==='official'){
  detail(title,tags(['BLOCKED'])+block('공식 전망','BLOCKED_ANNUAL/null')+basis+files(['demandNote']),kind);return;
 }
 detail(title,basis+'<p class="ev-note">원본 조회 중…</p>',kind);
 try{
  const result=await get('/api/evidence-trace?'+traceParams);
  if(current!==state.request)return;
  const blocked=Boolean(result.values?.blocked);
  detail(title,tags(['ASSUMPTION_SCENARIO',result.values?'VALIDATED':'UNAVAILABLE',blocked?'BLOCKED':'조건부 연결'])+
   basis+values('원본 조회 결과',result.values)+(result.otherValues?values('B · '+result.other,result.otherValues):'')+
   list('원본 파일 경로',result.paths)+block('검증 범위','저장 원본 해시 및 집계 대사 범위입니다. 실제 성과·사업 타당성은 미검증입니다.')+
   files(['financeManifest','financeAudit','financeContract']),kind);
 }catch{
  if(current===state.request)detail(title,tags(['UNAVAILABLE'])+basis+block('상태','요청한 실행·연도·선택 범위의 원본 결과를 연결할 수 없습니다.'),kind);
 }
}
function select(id){
 const item=entries().find(row=>row.id===id);
 if(!item)return;
 state.selected=id;state.request++;
 $('#ev-list').querySelectorAll('[data-row]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.row===id)));
 $('#ev-chain').querySelectorAll('button').forEach(button=>button.setAttribute('aria-pressed','false'));
 if(item.type==='result'){void resultDetail(id);return;}
 let body,key='';
 if(item.type==='derived'){
  body=tags([item.kind])+block('정의와 적용 범위',item.note)+(item.keys.length?files(item.keys):'');
  if(id==='observed')body+=list('관측 지표 표본',state.data.observed.slice(0,8).map(row=>row.metric+' · '+row.value+' '+row.unit+' · '+row.source_run));
 }else if(item.type==='dataset'){
  const r=item.row;
  const checks=state.data.issues.filter(issue=>issue.source_file===r.file);
  body=block('출처 및 행 수','NearMart_data.zip · 테이블 '+r.table+' · '+fmt(+r.rows)+'행')+
   list('원본 컬럼',r.columns.split('|'))+list('기록된 품질 검사',checks.map(issue=>issue.rule_id+' · '+issue.affected_rows+'행 · '+issue.action))+
   files(['inventory','issues']);
 }else if(item.type==='file'){
  const file=state.data.files[item.key];key=file.run;
  body=tags([file.available?'파일 연결':'UNAVAILABLE'])+block('보관 위치',file.area==='review'?'최종 검토 패키지 내 사본':file.area==='desktop'?'바탕화면 Work 원본 위치':'작업 폴더 Work 보관본')+
   files([item.key]);
 }else if(item.type==='issue'){
  const row=item.row,[field,impact,policy]=issueInfo[row.rule_id]??['개별 컬럼 미확인','연결 영향은 원본 로그 범위에서 확인',row.note||'원본 처리 로그의 조치만 연결했습니다.'];
  key='S1_20261110_04';
  body=tags([item.group])+block('원본 데이터셋 · 컬럼',row.source_file+' · '+field)+
   block('검사 코드 · 영향 행',row.rule_id+' · '+fmt(+row.affected_rows)+'행')+block('영향 계산',impact)+
   block('처리 정책',policy)+block('원본 조치',row.action+(row.note?' · '+row.note:''))+
   files(['issues','policyNote','policyDisposition',...(row.rule_id==='area_pyeong'?['policyUnits']:[])]);
 }else if(item.type==='policy'){
  const row=item.row;key='S1_POLICY_20261110_01';
  body=tags(['영향 있음'])+block('원본 정책 검사',row.issue+' · '+row.rows+'행')+block('원본 조치',row.action)+
   block('영향 범위','해당 원본 검사와 파생본에 한정됩니다. 후속 조건부 가정은 별도 실행 근거를 확인하세요.')+
   files(['policyIssues','policyNote','policyDisposition']);
 }else if(item.type==='blocked'){
  const first=item.rows[0];key='S3_FOUNDATION_20261111_01';
  body=tags(['BLOCKED'])+block('동과 원본 상태',first.dong+' · '+first.adm_cd2+' · '+first.status)+
   list('원본 reason 코드',[...new Set(item.rows.map(row=>row.reason))])+
   block('적용 범위','네트워크 기초 입력 원장의 '+item.rows[0].year+'–'+item.rows.at(-1).year+'년 기록. 다른 분석의 일괄 제외 근거로 사용하지 않습니다.')+
   block('입력 근거 실행',first.source_run_id)+files(['foundationBlocked','foundationNote']);
 }else if(item.type==='gis'){
  body=tags([state.data.gis?'VALIDATED':'UNAVAILABLE'])+block('조인 결과',state.data.gis?state.data.gis.roster+'동 / 경계 '+state.data.gis.features+'개 일치':'행정동 코드 대사 미연결')+block('조인 정의','01_dong_master.csv ↔ 02_dong_boundary.geojson. 화면의 10자리·8자리 코드와 동·자치구명을 확인합니다.')+
   block('검증 범위','명부의 코드 정합성은 운영 수요의 적용 여부와 별개입니다.')+files(['inventory','foundationNote']);
 }else if(item.type==='model'){
  const m=item.model;key=m.run;
  const run=state.data.runs.find(item=>item.id===m.run);
  body=tags([m.kind,auditLabel(m.audit)])+block('버전·가정',(run?.version??'원본 버전 필드 미연결')+' · '+(run?.assumption??'미연결'))+
   block('입력',m.input)+block('출력',m.output)+block('평가 지표',m.metrics)+auditDetail(m.audit)+block('적용 한계',m.limit)+
   (m.id==='demand'?list('저장 홀드아웃 결과',state.data.spatialMetrics.slice(0,12).map(r=>r.model_id+' · WAPE '+fmt(+r.wape*100)+'% · MAE '+fmt(+r.mae))):'')+
   files([m.audit,...m.files]);
 }else if(item.type==='run'){
  key=item.run.id;body=runDetail(item.run);
 }
 detail(item.title,body,key);
}
$('#ev-tabs').onclick=event=>{const tab=event.target.closest('[data-tab]')?.dataset.tab;if(tab)chooseTab(tab);};
$('#ev-list').onclick=event=>{const row=event.target.closest('[data-row]')?.dataset.row;if(row)select(row);};
$('#ev-search').oninput=render;
$('#ev-filter').onchange=render;
$('#ev-toggle').onclick=()=>{
 const closed=!$('#ev-tools').hidden;
 $('#ev-tools').hidden=closed;$('.ev-layout').classList.toggle('tools-closed',closed);
 $('#ev-toggle').setAttribute('aria-expanded',String(!closed));$('#ev-toggle').textContent=closed?'탐색 펼치기':'탐색 접기';
};
$('#ev-chain').onclick=event=>{
 const index=event.target.closest('[data-stage]')?.dataset.stage;
 if(index==null)return;
 const [name,run,status,note,file,audit]=state.data.pipeline[Number(index)];
 state.request++;
 $('#ev-chain').querySelectorAll('button').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.stage===index)));
 $('#ev-list').querySelectorAll('[data-row]').forEach(button=>button.setAttribute('aria-pressed','false'));
 const found=state.data.runs.find(item=>item.id===run);
 detail(name,tags([state.data.files[file]?.available?status:'UNAVAILABLE'])+block('후속 사용과 연결 범위',note)+
  (found?runDetail(found):auditDetail(audit))+files([file]),run);
};
async function load(){
 try{
  state.data=await get('/api/evidence');
  $('#evidence-run').textContent=state.data.linkedRun;
  const count=Object.values(state.data.files).filter(file=>file.available).length;
  $('#ev-status').textContent='근거 파일 '+count+'개 연결 · '+state.data.runs.length+'개 실행 참조';
  $('#ev-chain').innerHTML=state.data.pipeline.map(([name,,status,,file],i)=>'<button data-stage="'+i+'" aria-pressed="false">'+
   esc(name)+'<small>'+esc(state.data.files[file]?.available?status:'UNAVAILABLE')+'</small></button>').join('');
  if(state.tab==='results'&&Object.hasOwn(resultKinds,params.get('kind')))state.selected=params.get('kind');
  if(state.tab==='quality') {
   $('#ev-filter').append(new Option('영향 있음','영향 있음'));
   $('#ev-filter').value='영향 있음';
  }
  render();
  if(params.has('item')&&entries().some(item=>item.id===params.get('item')))select(params.get('item'));
  if(state.selected&&state.tab==='results')select(state.selected);
 }catch{
  $('#evidence-run').textContent='미연결';$('#ev-status').textContent='검증 근거 미연결';
  $('#ev-list').innerHTML='<p class="ev-empty">원본 근거를 연결할 수 없습니다.</p>';
 }
}
load();
