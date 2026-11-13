import {renderProcessNav} from './process-nav.js';
import {dataVersion,versionUrl} from './version-client.js';
const $=selector=>document.querySelector(selector);
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const fmt=value=>value==null||value===''?'미연결':Number(value).toLocaleString('ko-KR',{maximumFractionDigits:2});
const won=value=>value==null?'미연결':fmt(Number(value)/1e8)+'억 원';
const tabs={overview:'데이터 개요',quality:'품질 점검',models:'모델 검증',runs:'실행 이력',results:'결과 추적'};
const query=new URLSearchParams(location.search);
const state={snapshot:null,tab:query.has('kind')?'results':tabs[query.get('tab')]?query.get('tab'):'overview',selected:null};
renderProcessNav($('.evidence-nav'));
const block=(title,value)=>'<section class="ev-detail-block"><h4>'+esc(title)+'</h4><p>'+esc(value)+'</p></section>';
const list=(title,rows)=>'<section class="ev-detail-block"><h4>'+esc(title)+'</h4><ul>'+rows.map(row=>'<li>'+esc(row)+'</li>').join('')+'</ul></section>';
const source=(name)=>Object.keys(state.snapshot.source_hashes).find(path=>path.endsWith('/'+name))??'미연결';
const sourceBlock=(names)=>list('원본 파일 · 스냅샷 빌드 시 SHA-256 대조',names.map(name=>source(name)));
function rows(){
 const d=state.snapshot;
 if(state.tab==='overview')return [
  {id:'scope',title:'범위와 단위',meta:'427동 · T2 2,135행 · T3 3,675행',group:'범위',detail:()=>block('행정동 명부','427동. T2는 5개 기준 연도 × 427동이며 미서비스 동도 포함합니다.')+block('수요 정의',d.scope.demand)+block('공식 전망','BLOCKED_ANNUAL / null')},
  {id:'sources',title:'원본 파일과 해시',meta:Object.keys(d.source_hashes).length+'개 원본 경로',group:'출처',detail:()=>list('파일 · SHA-256',Object.entries(d.source_hashes).map(([path,hash])=>path+' · '+hash))},
  ...Object.keys(d.source_hashes).map((path,i)=>({id:'file-'+i,title:path.split('/').at(-1),meta:path,group:'원본 파일',detail:()=>block('파일 경로',path)+block('SHA-256',d.source_hashes[path])+block('연결 상태','읽기 전용 스냅샷에 포함 · 빌드 시 원본과 대조')}))
 ];
 if(state.tab==='quality')return [
  {id:'roster',title:'427동 명부와 T2 범위',meta:'5개 기준 연도 · 각 427동',group:'검증',detail:()=>block('행정동 범위',d.scope.roster+'동 명부 · T2 '+d.scope.t2_rows+'행')+sourceBlock(['T2_dong_assignment.csv','01_dong_master.csv'])},
  {id:'annual',title:'공식 연간 전망 차단',meta:'BLOCKED_ANNUAL / null',group:'차단',detail:()=>block('상태','공식 연간 전망 BLOCKED_ANNUAL / null. C/C+ 가정 기반 저장 결과와 구분합니다.')},
  {id:'validation',title:'입력 검증 요약',meta:d.data_validation?'C+ 검증 기록':'C 원형 별도 검증 요약 미연결',group:d.data_validation?'검증':'미연결',detail:()=>d.data_validation?
    list('저장 검증 필드',Object.entries(d.data_validation).map(([k,v])=>k+' · '+v))+sourceBlock(['data_validation.json']):block('상태','C 원형 스냅샷에는 C+의 data_validation.json 대응 필드가 없습니다. 값을 0으로 채우지 않습니다.')},
  {id:'failures',title:'운영·자원 제약',meta:'대표 검증과 실패 기록 구분',group:'미충족',detail:()=>block('투자·운영 판단',`자금 한도 ${d.main.funding_pass?'충족':'미충족'} · 운영 지원 ${d.main.operations_supported?'충족':'미충족'} · 투자 권장 ${d.main.investment_recommendation?'선정':'미선정'}`)+
    block('연결 범위',d.simulation.failures.length+'개 실패 점검 행 · '+d.simulation.cells.length+'개 셀 검증 행. 점검 행 전체를 실패 건수로 해석하지 않습니다.')+sourceBlock(['annual_operations_base.csv','operational_failure_register.csv','annual_cell_validation.csv'])}
 ];
 if(state.tab==='models')return [
  {id:'demand',title:'수요 모형과 정의',meta:d.model+' · 성숙 잠재 접수와 완료 대용치 분리',group:'모형',detail:()=>
    block('모형',d.model)+block('수요 범위',d.scope.demand)+block('계약',d.demand_definition?JSON.stringify(d.demand_definition):'C 원형 수요 정의 계약 미연결')+sourceBlock(['demand_definition.json','demand_dong_year.csv','joint_bootstrap_city_interval.csv'])},
  {id:'dispatch',title:'배차 BM 고정 표본',meta:'BM1·BM2·BM3 · 정책별 저장 결과',group:'모형',detail:()=>
    list('선택 정책',d.benchmark.selected.map(row=>row.instance+' · '+row.policy+' · 정시 '+(Number(row.ontime_rate)*100).toFixed(2)+'% · 비용 '+fmt(row.cost_per_order)+'원/건'))+
    block('범위','BM 고정 표본입니다. 서울 427동 전체 주문 경로 또는 연간 성과로 외삽하지 않습니다.')+sourceBlock(['T3_benchmark_dispatch.csv','benchmark_developed_selected.csv','benchmark_independent_kpi.csv'])},
  {id:'simulation',title:'저장 운영 검증',meta:d.simulation.operations.length+'개 연도 · 실패와 자원 제약 별도',group:'모형',detail:()=>
    list('연간 운영 저장값',d.simulation.operations.map(row=>row.year+' · 일간 수락 '+fmt(row.daily)+' · 배송 완료 '+fmt(row.delivered_daily)+' · 미완료 '+fmt(row.unfulfilled_daily)))+
    block('한계','대표 조건의 반복·실패 기록을 확인해야 하며 전체 시간대의 실제 운영을 검증한 값은 아닙니다.')+sourceBlock(['annual_operations_base.csv','operational_failure_register.csv'])}
 ];
 if(state.tab==='runs')return [
  {id:'run',title:d.case_id,meta:d.version+' · '+d.model,group:'저장 실행',detail:()=>block('실행 키',d.case_id)+block('모형',d.model)+block('정책',d.scope.plan)+block('상태','투자 미선정 · 자금·운영 제약 미충족')},
  {id:'t1',title:'T1 네트워크 계획',meta:source('T1_network_plan.csv'),group:'결과',detail:()=>list('운영 거점',d.network.plan.map(row=>row.site_id+' · '+row.hub_type+' · '+row.open_year+'~'+row.close_year+' 마지막 영업연도'))+sourceBlock(['T1_network_plan.csv'])},
  {id:'t2',title:'T2 행정동 배정',meta:'427동 × 5개 연도',group:'결과',detail:()=>block('범위',d.scope.t2_rows+'행 · 배정과 미서비스를 구분')+sourceBlock(['T2_dong_assignment.csv'])},
  {id:'t3',title:'T3 배차 벤치마크',meta:d.scope.t3_rows+'행',group:'결과',detail:()=>block('범위','BM 고정 주문 표본 · 다른 정책과 서울 전체 경로는 별도')+sourceBlock(['T3_benchmark_dispatch.csv'])},
  {id:'t4',title:'T4 제출 KPI',meta:'저장 값 · 제약 상태 함께 표시',group:'결과',detail:()=>list('T4 주요 필드',Object.entries(d.t4).map(([key,value])=>key+' · '+value))+sourceBlock(['T4_kpi_summary.csv'])}
 ];
 return [
  {id:'operations',title:'운영관제',meta:'T1·T2·연간 운영 저장값',group:'연결',detail:()=>
    block('연결','427동 T2 배정, 운영 거점 수, 2027~2031 저장 일간 배송 완료·정시율.')+block('미연결','동별 완료·실제 배송 경로·2036 이후 운영 성과.')+sourceBlock(['T1_network_plan.csv','T2_dong_assignment.csv','annual_operations_base.csv'])},
  {id:'network',title:'네트워크 분석',meta:'T2 배정 · 평균 배송시간 · 지연율',group:'부분 연결',detail:()=>
    block('연결','각 기준 연도 427동 배정/미서비스, 일간 수락 주문, 배정 동의 평균 배송시간·지연율.')+block('미연결','동별 완료·미완료, 원인별 병목, 시간대별 처리능력.')+sourceBlock(['T2_dong_assignment.csv'])},
  {id:'scenario',title:'Scenario Lab A/B',meta:'C+ / C T2 지도 · 비교 제한',group:'부분 연결',detail:()=>
    block('연결','각 버전의 T2 서울 지도와 저장된 재무·운영 요약.')+block('비교 불가','수요 정의·운영 조건이 달라 C/C+ 차이를 정책 효과로 해석하지 않습니다. 시나리오별 T2 지도는 BASE 외 미연결.')+sourceBlock(['T2_dong_assignment.csv','scenario_comparison.csv'])},
  {id:'finance',title:'20년 재무',meta:'2026~2046 저장 현금흐름',group:'부분 연결',detail:()=>
    block('연결','연간 순현금·할인 전 누적 잔액·연간 비용 계정·NPV·최대 자금·2031 EBITDA.')+
    block('미연결','개점 CAPEX 사건별 원장, 인원·유급시간, What-if 조건별 연간 현금흐름.')+
    block('판단','NPV '+won(d.main.npv_krw)+' · 최대 자금 '+won(d.main.peak_funding_krw)+' · 2031 EBITDA '+won(d.main.ebitda_2031)+' · 투자 미선정')+sourceBlock(['annual_cashflow_base.csv','scenario_comparison.csv'])},
  {id:'dispatch',title:'배차 3D 조작',meta:'BM 저장 정책·고정 표본',group:'부분 연결',detail:()=>
    block('연결','BM1~BM3 선택 정책, 대표 주문·구역 표본, 저장 성과.')+block('미연결','정책별 전체 주문 경로와 서울 임의 동의 배차 재생.')+sourceBlock(['benchmark_developed_selected.csv','benchmark_orders_detail.csv'])}
 ];
}
function render(){
 const all=rows();
 $('#ev-tabs').innerHTML=Object.entries(tabs).map(([id,name])=>'<button data-tab="'+id+'" aria-pressed="'+(id===state.tab)+'">'+name+'</button>').join('');
 $('#ev-list-title').textContent=tabs[state.tab];
 $('#ev-list-caption').textContent='C/C+ 저장 결과 · 연결 범위와 미연결 항목을 구분합니다.';
 const groups=[...new Set(all.map(row=>row.group))],filter=$('#ev-filter'),before=filter.value;
 filter.replaceChildren(new Option('전체',''),...groups.map(group=>new Option(group,group)));
 if(groups.includes(before))filter.value=before;
 const needle=$('#ev-search').value.trim().toLowerCase();
 const visible=all.filter(row=>(!filter.value||filter.value===row.group)&&(!needle||(row.title+' '+row.meta).toLowerCase().includes(needle)));
 $('#ev-list').innerHTML='<div class="ev-row ev-list-head"><span>항목</span><span>범위 · 원본</span><span>목록 상태</span></div>'+
  visible.map(row=>'<button class="ev-row" data-row="'+esc(row.id)+'" aria-pressed="'+(row.id===state.selected)+'"><strong>'+esc(row.title)+'</strong><span>'+esc(row.meta)+'</span><span class="ev-tag">'+esc(row.group)+'</span></button>').join('');
 if(!all.some(row=>row.id===state.selected))state.selected=visible[0]?.id??null;
 const selected=all.find(row=>row.id===state.selected);
 $('#ev-detail-key').textContent=selected?.id??'';
 $('#ev-detail').innerHTML=selected?'<h3>'+esc(selected.title)+'</h3>'+selected.detail():'<p class="ev-empty">항목을 선택하세요.</p>';
 $('#ev-list [data-row="'+CSS.escape(state.selected??'')+'"]')?.setAttribute('aria-pressed','true');
}
$('#ev-tabs').onclick=event=>{const tab=event.target.closest('[data-tab]')?.dataset.tab;if(tabs[tab]){state.tab=tab;state.selected=null;$('#ev-search').value='';$('#ev-filter').value='';render();}};
$('#ev-list').onclick=event=>{const id=event.target.closest('[data-row]')?.dataset.row;if(id){state.selected=id;render();}};
$('#ev-search').oninput=render;
$('#ev-filter').onchange=render;
$('#ev-toggle').onclick=()=>{const tools=$('#ev-tools');tools.hidden=!tools.hidden;$('#ev-toggle').textContent=tools.hidden?'탐색 펼치기':'탐색 접기';$('#ev-toggle').setAttribute('aria-expanded',String(!tools.hidden));};
async function load(){
 try{
  const response=await fetch(versionUrl('/api/submission'));
  if(!response.ok)throw Error('snapshot');
  state.snapshot=await response.json();
  $('#evidence-run').textContent=state.snapshot.case_id;
  $('#ev-status').textContent=state.snapshot.version+' · 원본 해시 '+Object.keys(state.snapshot.source_hashes).length+'개 · 투자 미선정';
  const sections=$('#ev-tools').querySelectorAll('.ev-side-section');
  if(sections[1])sections[1].innerHTML='<h3>공식 연간 전망</h3><p class="ev-warning">BLOCKED_ANNUAL / null</p><p>C/C+ 가정 기반 저장 결과와 구분합니다.</p>';
  const old=$('#ev-tools .ev-side-section:last-child');
  if(old)old.innerHTML='<h3>현재 버전</h3><p>'+esc(state.snapshot.version)+' · '+esc(state.snapshot.case_id)+'</p><p>기존 S6는 상단 데이터 선택에서 별도로 조회합니다.</p>';
  $('#ev-chain').innerHTML=['입력 검증','수요','T1·T2','T3 배차','운영 검증','20년 재무','판단'].map((step,i)=>'<button data-chain="'+i+'">'+step+'</button>').join('');
  $('#ev-chain').onclick=event=>{const i=Number(event.target.closest('[data-chain]')?.dataset.chain);if(Number.isInteger(i)){state.tab=['quality','models','runs','models','models','results','results'][i];state.selected=null;render();}};
  render();
 }catch{ $('#ev-status').textContent='C/C+ 스냅샷 미연결'; }
}
load();
