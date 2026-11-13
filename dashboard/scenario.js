import {renderProcessNav} from './process-nav.js';
import {dataVersion,submissionMode,versionUrl} from './version-client.js';
const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const fmt = (value,digits=0) => value == null ? '미연결' : Number(value).toLocaleString('ko-KR',{maximumFractionDigits:digits});
const state = { catalog:null, dongs:[], sites:[], river:'', bounds:null, pair:null, serial:0, pane:'decision', stage:0,
  selected:null, condition:'clear_weekday', workspace:'compare', comparePair:null, studioPair:null, history:[] };
const names = {N1:'N1 집중형',N2_ORIGINAL:'N2 원설계',N2_IMPROVED:'N2 개선형',N3:'N3 확장형'};
const stressLabels = {NONE:'기준',W1:'W1 인건비·공급 충격',W2:'W2 경쟁 확대',RENEWAL_DENIAL:'자율 · 재계약 거절'};
const desConditions = {clear_weekday:'맑은 평일',clear_weekend:'맑은 주말',rain_weekday:'우천 평일'};
const formatName = item => names[item.network] ?? item.network;
const optionName = item => formatName(item)+' · '+item.market+' / '+item.ramp+' / '+(stressLabels[item.shock]??item.shock);
const fetchJson = async url => {
  const response = await fetch(url);
  if (response.status===401) { location.assign('/login'); throw new Error('login'); }
  if (!response.ok) throw new Error(url);
  return response.json();
};
renderProcessNav($('.scenario-nav'));

const stages = [
  ['데이터 검증','원천 해시 검산','S1_POLICY_20261110_01 · 원본 01번 등 → orders_policy_derived.csv. S6 독립 검산 source_and_prior_result_hashes.'],
  ['수요예측','가정 기반','S2_APPROVED_ANNUAL_20261111_01 · 달력·기상 가정 → assumption_based_demand_dong_year.csv (423동). 공식 연간량은 차단.'],
  ['네트워크 설계','조건부 배정','S345_CAPACITY_20261111_01 · 거점 계획·배정 → annual_dong_plan.csv → S6 annual_dong.csv.'],
  ['배차·묶음배송','범위 분리','S6 연간 근사에는 FIFO_15MIN_SINGLETON_75PCT_V1 적용. T3 묶음배송 근거는 S45_OPS_20261111_02 벤치마크로 별도 표시.'],
  ['SimPy','대표일만 연결','S345_CAPACITY_20261111_01 · 2032 지역 대표일 쌍대 DES → evidence_direct_des.csv. 연간 DES 외부 검증 차단.'],
  ['재무','조건부 검산','S6_INVESTMENT_COMPARE_20261112_01 · 연간 운영량/정책 → annual_finance.csv · 시나리오별 NPV. 실제 계약·정산 차단.'],
  ['What-if','저장 실행 연결','S6_INVESTMENT_COMPARE_20261112_01 · 기본 조건 → W1, W2, RENEWAL_DENIAL → scenario_summary.csv.'],
  ['최종안','확정 보류','S7_JOINT_OPT_20261112_01 제출 검토본의 T1·T2·T4와 별도 T3 연결. 선택한 S6 A/B의 공식 제출물로 사용하지 않습니다.']
];
function renderStages() {
  const rows=submissionMode?[
    ['데이터 검증','원본 해시·427동','C/C+ 스냅샷의 원본 파일 해시를 빌드 시 대조했습니다.'],
    ['수요예측','B84 / C 원형','수요 정의와 결과 범위가 달라 버전 간 효과 비교는 제한합니다.'],
    ['네트워크 설계','T1 · T2','P1은 2027~2031 운영, T2는 각 기준 연도 427동 배정과 미서비스를 기록합니다.'],
    ['배차·묶음배송','T3 · BM','저장된 BM 고정 표본 결과이며 전체 권역의 재생 경로는 미연결입니다.'],
    ['시뮬레이션','연간 운영 저장값','대표 연도·자원 실패와 미완료를 분리합니다.'],
    ['재무','2026~2046 현금흐름','500억 자금 한도와 2031 EBITDA 목표를 모두 충족하지 못했습니다.'],
    ['What-if','저장 결과·미실행 분리','C+는 LOW/BASE/HIGH·W1·W3 저장 현금흐름을 연결하고 W2는 경쟁 거점 입력만 표시합니다. 신규 실행은 미연결입니다.'],
    ['최종안','투자 미선정','C+ v1은 실험 비교본이며 투자 권장안이 아닙니다.']
  ]:stages;
  $('#lab-stages').innerHTML = rows.map(([title,status],i)=>'<button data-stage="'+i+'" aria-pressed="'+(state.stage===i)+'">'+title+'<small>'+status+'</small></button>').join('');
  $('#lab-stage-note').textContent = state.catalog ? rows[state.stage][2] : '실행 근거를 불러오는 중';
}
$('#lab-stages').onclick = event => {
  const button=event.target.closest('[data-stage]');
  if (button) {state.stage=Number(button.dataset.stage);renderStages();$('#lab-stages').children[state.stage].focus();}
};
renderStages();

const project = ([lon,lat]) => [(lon-126.75)*780,-(lat-37.72)*980];
const line = coords => coords.map((point,i)=>(i?'L':'M')+project(point).map(x=>x.toFixed(2)).join(',')).join('');
function prepare(geo,river) {
  const bounds=[Infinity,Infinity,-Infinity,-Infinity];
  state.dongs=geo.features.map(({geometry,properties})=>{
    const polygons=geometry.type==='Polygon'?[geometry.coordinates]:geometry.coordinates;
    const rings=polygons.flat();
    for(const ring of rings) for(const point of ring) {
      const [x,y]=project(point);
      bounds[0]=Math.min(bounds[0],x); bounds[1]=Math.min(bounds[1],y);
      bounds[2]=Math.max(bounds[2],x); bounds[3]=Math.max(bounds[3],y);
    }
    return {code:properties.adm_cd2,label:properties.gu+' '+properties.dong,path:rings.map(r=>line(r)+'Z').join('')};
  });
  const [left,top,right,bottom]=bounds;
  state.bounds=[left-9,top-9,right-left+18,bottom-top+18].join(' ');
  state.river=(river?.features??[]).map(({geometry})=>line(geometry.coordinates)).join('');
}
function renderMaps() {
  if (!state.bounds) return;
  const pair=state.pair;
  for (const [i,key] of ['a','b'].entries()) {
    const svg=$('#lab-map-'+key), data=pair?.maps[i], item=pair?.items[i];
    $('#lab-title-'+key).textContent=item?formatName(item):'결과 미연결';
    $('#lab-id-'+key).textContent=item?.id??'';
    svg.setAttribute('viewBox',state.bounds);
    const hues=key==='a'?['#204550','#235762','#2b6570','#284458','#345f70','#22505d']:
      ['#353252','#493b64','#514571','#41425d','#3e385f','#57456c'];
    const fill = row => {
      if (!row || !$('#lab-territories').checked) return '#182d39';
      if (row.blocked) return '#825432';
      if (!row.site) return '#2a3947';
      const index=[...row.site].reduce((sum,char)=>sum*31+char.charCodeAt(0),0)%hues.length;
      return hues[index];
    };
    svg.innerHTML=state.dongs.map(({code,label,path})=>{
      const row=data?.assignments[code], chosen=state.selected===code;
      return '<path data-code="'+esc(code)+'" d="'+path+'" fill-rule="evenodd" fill="'+fill(row)+'" stroke="'+
        (chosen?'#5be4c1':'#44606e')+'" stroke-width="'+(chosen?'1.8':'.49')+
        '" vector-effect="non-scaling-stroke"><title>'+esc(label+' · '+(row?.blocked?'원천 입력 차단':row?.site??'미배정 / 미연결'))+'</title></path>';
    }).join('')+(state.river?'<defs><clipPath id="lab-mask-'+key+'"><path d="'+state.dongs.map(d=>d.path).join('')+
      '"/></clipPath></defs><path d="'+state.river+'" clip-path="url(#lab-mask-'+key+')" fill="none" stroke="#77d3d8" opacity=".77" stroke-width="1.4" vector-effect="non-scaling-stroke" pointer-events="none"/>':'')+
      ($('#lab-hubs').checked?state.sites.filter(site=>site.mapped && data?.hubs[site.id]).map(site=>{
        const [x,y]=project([site.lon,site.lat]), selected=state.selectedSite===site.id || (state.selected&&data.assignments[state.selected]?.site===site.id);
        return '<circle data-site="'+esc(site.id)+'" cx="'+x+'" cy="'+y+'" r="'+(selected?4.2:2.8)+'" fill="'+(selected?'#5be4c1':key==='a'?'#51c5e1':'#9b7aff')+
          '" stroke="#e7eff3" stroke-width=".7" vector-effect="non-scaling-stroke"><title>'+esc(site.id+' · '+site.gu+' '+site.dong)+'</title></circle>';
      }).join(''):'');
  }
  const source=submissionMode?'서울 427동 · T2 저장 배정 · 회색 미서비스 · 점 운영 거점 · 동별 완료 미연결 · 한강 ':
    '서울 427동 · SGIS / admdongkor · 갈색 원천 입력 차단 · 회색 미배정 · 점 조건부 운영 거점 · 한강 ';
  const attribution=state.river?'<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap</a>':'미연결';
  const chosen=state.dongs.find(d=>d.code===state.selected);
  const assignment = map => {
    const row=map?.assignments[chosen.code];
    return row?.blocked?'원천 입력 차단':row?.site??(row?'미배정':'미연결');
  };
  const site=state.sites.find(item=>item.id===state.selectedSite);
  const metrics=row=>row?.request==null?'미연결':submissionMode?
    '일간 수락 '+fmt(row.request)+'건 · 평균 배송 '+(row.deliveryMin==null?'미연결':fmt(row.deliveryMin,1)+'분')+' · 지연율 '+(row.lateRate==null?'미연결':fmt(row.lateRate*100,2)+'%'):
    '요청 '+fmt(row.request)+' · 완료 '+fmt(row.completed)+' · 미처리 '+fmt(row.unprocessed)+'건';
  const detail=chosen ? chosen.label+' · A '+assignment(pair?.maps[0])+' ('+metrics(pair?.maps[0]?.assignments[chosen.code])+
    ') / B '+assignment(pair?.maps[1])+' ('+metrics(pair?.maps[1]?.assignments[chosen.code])+')' :
    site ? site.id+' · '+site.gu+' '+site.dong+' · A '+metrics(pair?.maps[0]?.hubs[site.id])+' / B '+metrics(pair?.maps[1]?.hubs[site.id]) : '';
  $('#lab-map-footer').innerHTML=esc(source)+attribution+(detail?'<br><strong>'+esc(detail)+'</strong>':'');
}
const annualOf = item => item?.annual[state.pair?.year];
const sameFields = ['market','ramp','weather','shock','assumption'];
function comparison(pair) {
  if (!pair) return {ok:false,reason:'비교 자료 미연결'};
  const [a,b]=pair.items,[ma,mb]=pair.maps;
  if (a.id===b.id) return {ok:false,reason:'동일 시나리오 선택'};
  if (submissionMode && a.version!==b.version) return {ok:false,reason:'C/C+는 수요 정의와 운영 실험 조건이 달라 효과 비교가 불가합니다. 각 저장값을 병렬 조회합니다.'};
  if (!sameFields.every(key=>a[key]===b[key])) return {ok:false,reason:'시장·램프업·기상·충격·가정 중 비교 조건이 다릅니다.'};
  if (!ma||!mb) return {ok:false,reason:'행정동 모집단 검증 불가'};
  const eligible=map=>Object.entries(map.assignments).filter(([,row])=>!row.blocked).map(([code])=>code).sort().join(',');
  if (eligible(ma)!==eligible(mb)) return {ok:false,reason:'입력 적용 행정동 모집단 불일치'};
  return {ok:true,reason:'동일 연도·입력 범위·모형·충격 조건'};
}
const percent = row => row?.request>0 && row.ontime!=null ? 100*row.ontime/row.request : null;
const metricRows = [
  ['조건부 운영 거점',row=>row?.active_sites,0,'개'],[submissionMode?'일간 수락 주문':'연간 주문 요청',row=>row?.request,0,'건'],
  [submissionMode?'일간 배송 완료':'연간 완료',row=>row?.completed,0,'건'],['요청 대비 정시 완료',percent,2,'%'],
  [submissionMode?'일간 미완료':'연간 미처리 분류',row=>row?.unprocessed,0,'건'],['연간 총영업비용',row=>row?.operating_expenses==null?null:row.operating_expenses/1e8,1,'억'],
  ['20년 NPV',(_,item)=>item.npv_krw==null?null:item.npv_krw/1e8,1,'억']
];
const unit = (n,d,suffix) => n==null?'미연결':fmt(n,d)+suffix;
function table(headers,rows,cls='') {
  return '<table class="lab-table '+cls+'"><thead><tr>'+headers.map(h=>'<th scope="col">'+esc(h)+'</th>').join('')+
    '</tr></thead><tbody>'+rows.map(row=>'<tr>'+row.map((v,i)=>i?'<td>'+esc(v)+'</td>':'<th scope="row">'+esc(v)+'</th>').join('')+'</tr>').join('')+'</tbody></table>';
}
const flag = value=>value==null?'미검증':value?'충족':'미충족';
function constraintRows(map,row) {
  const hubs=Object.values(map?.hubs??{});
  const check = (a,b) => {
    const known=hubs.filter(h=>h[a]!=null&&h[b]!=null);
    if (!hubs.length||known.length!==hubs.length) return '미검증';
    const fail=known.filter(h=>h[a]-h[b]>1e-8).length;
    return fail?fail+'곳 초과':'모형 내 초과 0곳';
  };
  return [
    row?.late==null?'미검증':row.late>0?'지연 '+fmt(row.late)+'건':'지연 0건',
    '미검증',check('picker_roster','picker_legal_max'),check('peak_active_riders','rider_roster'),'미검증'
  ];
}
function renderPerformance() {
  if (!state.pair) {
    $('#lab-metrics').innerHTML='<h2>Impact Analysis</h2><p class="note">저장 결과 조회를 완료하면 지표가 표시됩니다.</p>';
    $('#lab-constraints').textContent='';
    return;
  }
  const {items,maps}=state.pair,[a,b]=items, rows=items.map(annualOf);
  const comp=comparison(state.pair);
  $('#lab-metrics').innerHTML='<h2>'+(state.workspace==='studio'?'영향 분석':'성과 비교')+' · '+state.pair.year+'년</h2>'+
    table(['모형 결과','A','B',comp.ok?'B−A':submissionMode?'비교 제한':'참고 B−A'],metricRows.map(([label,get,d,suffix])=>{
      const av=get(rows[0],a), bv=get(rows[1],b), delta=(!submissionMode||comp.ok)&&maps.every(Boolean)&&av!=null&&bv!=null?bv-av:null;
      return [label,unit(av,d,suffix),unit(bv,d,suffix),delta==null?'—':(delta>0?'+':'')+fmt(delta,d)+(suffix==='%'?'%p':suffix)];
    }))+'<p class="note">'+esc(comp.ok?comp.reason+' · 모형 결과 차이':
      '효과 비교 제한 · '+comp.reason+(submissionMode?'':' 참고 차이는 저장값의 산술 차이입니다.'))+' · <a href="/evidence?'+esc(new URLSearchParams({kind:'scenario',version:dataVersion,run:state.catalog.runId,
      id:a.id,other:b.id,year:state.pair.year}).toString())+'">A/B 근거 추적</a></p>';
  const limits=maps.map((map,i)=>constraintRows(map,rows[i]));
  $('#lab-constraints').innerHTML=submissionMode?'<h2>핵심 제약 검증</h2>'+table(['제약','A','B'],[
    ['저장 운영 지연율',...rows.map(row=>row?.late_rate==null?'미연결':fmt(row.late_rate*100,3)+'%')],
    ['연간 자원 검증',...rows.map(row=>row?.resource_pass==null?'미연결':flag(row.resource_pass))],
    ['대표 95% 검증',...rows.map(row=>row?.representative_pass==null?'미연결':flag(row.representative_pass))],
    ['BM 트립 5건·35kg', '별도 BM 표본', '별도 BM 표본'],
    ['동별 병목 원인','미연결','미연결']
  ])+'<p class="note">C/C+는 서로 다른 모형·수요 정의입니다. 지연율과 자원 검증은 선택 버전의 저장 운영 결과이며 T2 동별 결과가 아닙니다.</p>':
    '<h2>핵심 제약 검증</h2>'+table(['제약','A','B'],[
    '60분 · 완료 중 지연','트립 5건·35kg','피커 인원 상한','활성 라이더 / 모형 편성','Bike bay 점유'
  ].map((label,i)=>[label,limits[0][i],limits[1][i]]))+
    '<p class="note">정시 완료율 = 60분 이내 완료 ÷ 주문 요청. 미처리는 거절·취소·외부 처리 대기와 별도 상태입니다. 건수는 조건부 기대값입니다.</p>'+
    '<p class="note">인원 검사는 모형 편성 기준입니다. 실제 피커·라이더 수급과 트립 원장 검증은 미연결입니다.</p>';
}
const cards = (items, decision=false)=>'<div class="lab-notes'+(decision?' lab-decision-notes':'')+'">'+
  items.map(([title,body,style])=>'<article'+(style?' class="'+style+'"':'')+'><h3>'+esc(title)+'</h3><p>'+esc(body)+'</p></article>').join('')+'</div>';
function renderDecision() {
  const pair=state.pair, comp=comparison(pair);
  if (!pair) return '<p class="note">비교 자료를 불러오는 중입니다.</p>';
  if (submissionMode) {
    const [a,b]=pair.items;
    return cards([
      ['투자 판단 보류','C+ v1과 C는 모두 500억 자금 한도 미충족이며 2031 EBITDA가 적자입니다. 투자 권장안을 선정하지 않았습니다.','lab-verdict'],
      ['확인된 제약','500억 자금 한도 A '+flag(a.funding)+' / B '+flag(b.funding)+' · 2031 EBITDA 흑자 A '+flag(a.ebitdaTarget)+' / B '+flag(b.ebitdaTarget)+'.','lab-financial-constraints'],
      ['배정 지도','같은 축척으로 각 버전의 T2 배정을 표시합니다. 지도 선택 시 담당 거점과 일간 수락 주문, 평균 배송시간·지연율의 저장 범위를 확인합니다.'],
      ['효과 비교 제한',comp.reason],
      ['배차·운영','T3 BM 고정 표본과 연간 운영 저장값은 별도 범위입니다. 동별 완료·병목 원인 및 임의 경로 재생은 미연결입니다.'],
      ['원본 파일','C/C+ T1·T2·T3·T4와 재무 현금흐름의 스냅샷 해시를 검증 센터에서 확인합니다.']
    ],true);
  }
  const [a,b]=pair.items, [ma,mb]=pair.maps;
  const [ar,br]=pair.items.map(annualOf);
  const moved=ma&&mb?Object.keys(ma.assignments).filter(code=>{
    const x=ma.assignments[code],y=mb.assignments[code];
    return y&&!x.blocked&&!y.blocked&&x.site!==y.site;
  }).length:null;
  const output=comp.ok&&ar?.completed!=null&&br?.completed!=null ?
    '연간 완료 B−A '+fmt(br.completed-ar.completed)+'건. 비차단 동 중 담당 거점 변경 '+fmt(moved)+'동.' :
    '공통 조건 검사를 통과한 경우 차이를 표시합니다. '+comp.reason;
  const constraints='500억 자금 한도 A '+flag(a.funding)+' / B '+flag(b.funding)+
    '. 2031 EBITDA 흑자 목표 A '+flag(a.ebitdaTarget)+' / B '+flag(b.ebitdaTarget)+'.';
  const redesignPair=new Set([a.network,b.network]);
  const year=Number(pair.year);
  const checkpoint=[2027,2032,2037,2042].filter(value=>value<=year).at(-1);
  const transfers=state.catalog.transfers.filter(t=>Number(t.checkpoint)===checkpoint);
  const linkedRedesign=comp.ok&&a.shock==='NONE'&&redesignPair.has('N2_ORIGINAL')&&redesignPair.has('N2_IMPROVED')&&transfers.length;
  const redesignNote=linkedRedesign ? '저장된 N2 개선형은 부하 균형을 기준으로 '+transfers.length+'개 동의 담당 거점을 재배정했습니다.' :
    '배치와 운영 정책의 기여를 각각 분리한 비교는 미연결입니다.';
  const rejected=a.funding===false&&b.funding===false;
  const demand = requestTrace(pair);
  return cards([
    ['투자 판단 보류',rejected?'두 대안 모두 자금 한도 미충족으로 투자 권장안을 제시하지 않습니다. 자금한도 충족 경로와 서비스 제약을 우선 검토해야 합니다.':
      '권장 대안 미확정. 자금, 서비스, 자원 제약을 함께 검토해야 합니다.','lab-verdict'],
    ['확인된 제약',constraints,'lab-financial-constraints'],
    ['확인된 성과 차이',output],
    ['설계 변화 근거',redesignNote],
    ['요청량 차이의 근거',demand],
    ['비교 불가능한 항목','실제 계약·인력 수급·정산, 트립 제약과 연간 Bike bay 점유 실적은 미검증입니다.']
  ],true);
}
function requestTrace(pair) {
  const comp=comparison(pair);
  if (!comp.ok) return '설계 효과 해석 제한. '+comp.reason;
  const [a,b]=pair.maps;
  const rows=Object.keys(a.assignments).filter(code=>!a.assignments[code].blocked);
  const samePotential=rows.filter(code=>{
    const av=a.assignments[code].mature_potential,bv=b.assignments[code].mature_potential;
    return av!=null&&bv!=null&&Math.abs(av-bv)<1e-6;
  }).length;
  const response=rows.filter(code=>{
    const av=a.assignments[code].model_response_factor,bv=b.assignments[code].model_response_factor;
    return av!==bv;
  }).length;
  return '성숙 잠재량 일치 '+samePotential+'/'+rows.length+'동 · 서비스 응답계수 차이 '+response+
    '동. 배정·개점 램프·구색과 같은 해 배송시간·지연 반응이 요청량에 함께 반영됩니다. 개별 기여는 분리 검증되지 않았습니다.';
}
function renderRedesign() {
  if (submissionMode) return '<p class="lab-stage-trace">C/C+ T2 배정 결과는 버전별로 조회합니다. 설계 변경 단독 효과를 입증하는 같은 조건의 재실행은 미연결입니다.</p>'+
    '<p class="lab-evidence-note">배차 BM 고정 표본과 연간 운영 결과는 서로 다른 모집단입니다. 배치·배차·수요 정의가 함께 달라졌으므로 개선율을 산출하지 않습니다.</p>';
  const network=state.pair?.items.map(item=>item.network).find(id=>id.startsWith('N2')) ? 'N2' :
    state.pair?.items.find(item=>['N1','N3'].includes(item.network))?.network;
  const pool=state.catalog.des.filter(row=>row.network_id===network);
  const available=Object.keys(desConditions).filter(condition=>pool.some(row=>row.condition===condition));
  const condition=available.includes(state.condition)?state.condition:available[0];
  const rows=pool.filter(row=>row.condition===condition);
  const labels={ORIGINAL_EXISTING_OPERATIONS:'원설계 · 기존 운영',ORIGINAL_IMPROVED_OPERATIONS:'원설계 · 개선 운영',
    LOCAL_REDESIGN_IMPROVED_OPERATIONS:'지역 재설계 · 개선 운영'};
  const observed=rows.length?'<p class="lab-evidence-note">지역 2032 · '+esc(network)+' · '+esc(rows[0].source_run)+
    ' <select id="lab-des-condition" class="lab-small-select" aria-label="대표일 조건">'+available.map(c=>
      '<option value="'+c+'"'+(c===condition?' selected':'')+'>'+desConditions[c]+'</option>').join('')+'</select></p>'+
    table(['설계·배차 실험','반복','요청 평균','완료 평균','60분 내 완료 평균','일 비용 (2027 원)','실패 시드'],
      rows.map(row=>[labels[row.arm]??row.arm,row.replicates,fmt(row.requested_mean,2),fmt(row.completed_mean,2),fmt(row.ontime_mean,2),
        fmt(row.total_daily_cost_krw_2027),row.failing_seed_count+' / '+row.replicates]),'lab-evidence-table') :
    '<p class="lab-evidence-note">현재 선택과 연결할 수 있는 지역 대표일 근거 미연결.</p>';
  const paired=rows.find(r=>r.arm==='ORIGINAL_EXISTING_OPERATIONS');
  const after=rows.find(r=>r.arm==='LOCAL_REDESIGN_IMPROVED_OPERATIONS');
  const delta=paired&&after&&paired.requested_mean===after.requested_mean?'<p class="lab-evidence-note">같은 지역·대표일 내 재설계+배차 변경 전후 · 완료 '+
    fmt(Number(after.completed_mean)-Number(paired.completed_mean),2)+'건 · 일 비용 '+fmt(Number(after.total_daily_cost_krw_2027)-Number(paired.total_daily_cost_krw_2027))+'원 변화.</p>':'';
  return '<p class="lab-stage-trace">원설계 → 지역 대표일 SimPy → 원본 자원 실패 시드 확인 → 지역 운영·재설계 대조 → 같은 대표일 재검증. S6 연간 N2 개선형은 별도 부하 균형 설계와 FIFO 근사를 재무에 연결했습니다. 대표일 SimPy가 선택 연간안을 직접 검증했다는 연결은 차단입니다.</p>'+
    observed+delta+'<p class="lab-evidence-note">실패 시드는 원본 자원 검증 기준입니다. 연간 DES 외부 검증과 피크 전용 실험 연결은 미검증입니다. 출처 · evidence_direct_des.csv / redesign_transfers.csv / annual_finance.csv.</p>';
}
function renderStress() {
  if (!state.pair) return '<p class="note">재무 근거 미연결.</p>';
  if (submissionMode) {
    const items=state.pair.items;
    return '<p class="lab-evidence-note">2026년 말 T0 · 2027~2046 저장 현금흐름 · 할인율 12% · 500억 한도는 할인 전 누적 잔액 기준.</p>'+
      table(['버전','20년 NPV','최대 자금 소요','500억 한도','2031 EBITDA','흑자 목표'],items.map(item=>[
        formatName(item),unit(item.npv_krw/1e8,2,'억'),unit(item.peak_funding_krw/1e8,2,'억'),flag(item.funding),
        unit(item.ebitda_2031_krw/1e8,2,'억'),flag(item.ebitdaTarget)]),'lab-evidence-table')+
      '<p class="lab-evidence-note">C/C+ 사이의 차이를 정책 효과로 해석할 수 없습니다. 상세 연도별 현금은 재무 화면에서 각각 조회합니다.</p>'+
      table(['버전','저장 조건','NPV','자금 한도'],items.flatMap(item=>(state.catalog.stress[item.version]??[]).map(row=>[
        formatName(item),row.scenario,row.npv_krw==null?'미연결':unit(Number(row.npv_krw)/1e8,2,'억 원'),
        row.funding_pass==null?'미연결':flag(row.funding_pass==='True')])),'lab-evidence-table')+
      '<p class="lab-evidence-note">조건별 연간 현금흐름과 T2 공간 배정은 BASE 외 미연결입니다.</p>';
  }
  const items=state.pair.items;
  const selected=items.map((item,i)=>[(i?'B · ':'A · ')+formatName(item),unit(item.npv_krw==null?null:item.npv_krw/1e8,1,'억'),
    unit(item.peak_funding_krw==null?null:item.peak_funding_krw/1e8,1,'억'),flag(item.funding),
    unit(item.ebitda_2031_krw==null?null:item.ebitda_2031_krw/1e8,1,'억'),flag(item.ebitdaTarget)]);
  const paths=['NONE','W1','W2','RENEWAL_DENIAL'];
  const stress=paths.map(shock=>[stressLabels[shock],...items.map(item=>{
    const found=state.catalog.cases.find(candidate=>candidate.network===item.network && candidate.market===item.market &&
      candidate.ramp===item.ramp && candidate.weather===item.weather && candidate.shock===shock && candidate.assumption===item.assumption);
    return found ? unit(found.npv_krw==null?null:found.npv_krw/1e8,1,'억')+' · 자금 '+flag(found.funding) : '미연결';
  })]);
  return '<p class="lab-evidence-note">2027–2046 · 2026년 말 0시점 · 명목 원화 · 할인율 12% · 최대 자금소요는 할인 전 누적 현금 기준. <a href="/investment?'+esc(new URLSearchParams({run:state.catalog.runId,a:items[0].id,b:items[1].id,year:state.pair.year}).toString())+'">재무·투자 상세</a></p>'+
    '<div class="lab-stress-grid"><div>'+table(['선택 대안','20년 NPV','최대 자금소요','500억 한도','2031 EBITDA','흑자 목표'],selected,'lab-evidence-table')+
    '<p class="lab-evidence-note">저장 What-if는 각 선택안의 시장·램프업·기상 조건을 유지합니다. 표에는 원본 NPV와 자금 상태를 표시합니다.</p></div>'+
    '<div>'+table(['실행 조건','A 네트워크','B 네트워크'],stress,'lab-evidence-table')+'</div></div>'+
    '<p class="lab-evidence-note">W1: 2028년부터 지정 임금·위탁 기준 12% 충격. W2: 2030년부터 경쟁사 B 12개를 A와 합산. 자율: 10년 차 재계약 거절과 조건부 재배치.</p>';
}
function renderEvidence() {
  $('#lab-tabs').querySelectorAll('button').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.pane===state.pane)));
  $('#lab-evidence').innerHTML=!state.catalog?'<p class="note">검증 자료 미연결</p>':state.workspace==='studio'?renderExperiment():
    state.pane==='redesign'?renderRedesign():state.pane==='stress'?renderStress():renderDecision();
}
$('#lab-tabs').onclick=event=>{
  const pane=event.target.closest('[data-pane]')?.dataset.pane;
  if (pane) {state.pane=pane;renderEvidence();}
};
$('#lab-evidence').onchange=event=>{
  if(event.target.id==='lab-des-condition') {state.condition=event.target.value;renderEvidence();$('#lab-des-condition')?.focus();}
  if(event.target.id==='cplus-whatif-summary'){state.whatif=event.target.value;renderEvidence();$('#cplus-whatif-summary')?.focus();}
};
const chosenItems = () => ['a','b'].map(key=>state.catalog.cases.find(item=>item.id===$('#lab-'+key).value));
function syncYears(items) {
  const select=$('#lab-year'), previous=select.value||(submissionMode?'2031':'2032');
  const years=Object.keys(items[0].annual).filter(year=>Object.hasOwn(items[1].annual,year));
  select.replaceChildren(...years.map(year=>new Option(year+'년',year)));
  if(years.includes(previous)) select.value=previous;
  select.disabled=!years.length;
}
async function update() {
  const request=++state.serial, items=chosenItems(), year=$('#lab-year').value;
  $('#lab-conditions').innerHTML=items.map((item,i)=>'<p><strong>'+(i?'B':'A')+'</strong> '+
    esc(item.market+' · '+item.ramp+' · '+item.weather+' · '+item.shock)+'</p>').join('')+
    '<p>'+(submissionMode?'버전별 모형 · ':'공통 모형 · ')+esc(state.catalog.model)+'<br><span title="'+esc(state.catalog.financeRule)+'">'+(submissionMode?'재무 원본 · 비교 조건 확인 필요':'공통 재무 · 동일 회계 규칙')+'</span>'+
    '<br>'+(submissionMode?'T2 각 버전 427동 · 미서비스 포함':'조건부 모집단 · 423동 / 명부 427동')+'</p>';
  state.comparePair={items,maps:[null,null],year};
  if (state.workspace==='compare') refreshView();
  const maps=await readMaps(items,year);
  if (request!==state.serial) return;
  state.comparePair={items,maps,year};
  if (state.workspace==='compare') refreshView();
}
async function readMaps(items,year) {
  const results=await Promise.allSettled(items.map(item=>fetchJson('/api/scenario-map?'+new URLSearchParams({id:item.id,year,version:dataVersion}))));
  const codes=new Set(state.dongs.map(dong=>dong.code));
  return results.map((result,i)=>{
    const map=result.value;
    return map && map.id===items[i].id && map.year===year && Object.keys(map.assignments).every(code=>codes.has(code)) ? map : null;
  });
}
for (const key of ['a','b']) {
  $('#lab-'+key).onchange=()=>{syncYears(chosenItems());void update();};
  $('#lab-map-'+key).onclick=event=>{
    const code=event.target.closest('[data-code]')?.dataset.code;
    const site=event.target.closest('[data-site]')?.dataset.site;
    if(code||site) {state.selected=code??null;state.selectedSite=site??null;renderMaps();}
  };
}
$('#lab-year').onchange=update;
$('#lab-hubs').onchange=$('#lab-territories').onchange=renderMaps;
$('#lab-reset').onclick=()=>{state.selected=null;state.selectedSite=null;renderMaps();};
$('#lab-toggle').onclick=()=>{
  const open=$('#lab-tools').hidden;
  $('#lab-tools').hidden=!open;
  $('.lab-layout').classList.toggle('tools-hidden',!open);
  $('#lab-toggle').setAttribute('aria-expanded',String(open));
  $('#lab-toggle').textContent=open?'설정 접기':'설정 펼치기';
};
const studioVariables = [
  ['market','수요 시장','수요 입력 · 저장 LOW / BASE / HIGH'],
  ['ramp','램프업','수요 곡선 · 저장 EXP_FAST / EXP_SLOW / HYP_SLOW'],
  ['network','거점 구성','배정·운영 · 저장 N1 / N2 원설계 / N2 개선형 / N3'],
  ['shock','운영 충격','운영·재무 · 저장 기준 / W1 / W2 / 재계약 거절']
];
const studioControl = key => $('#studio-'+key);
const studioBase = () => state.catalog?.cases.find(item=>item.id===studioControl('base').value);
const labelValue = (key,value) => key==='network' ? names[value]??value : key==='shock' ? stressLabels[value]??value : value;
function setStudioInputs() {
  const base=studioBase();
  if(!base) return;
  for(const [key] of studioVariables) studioControl(key).value=base[key];
  const year=studioControl('year'), current=year.value||'2032';
  year.replaceChildren(...Object.keys(base.annual).map(y=>new Option(y+'년',y)));
  if(Object.hasOwn(base.annual,current)) year.value=current;
  previewStudio();
}
function studioMatch() {
  const base=studioBase(), year=studioControl('year').value;
  if (!base) return {base:null,match:null,year,changes:[]};
  const changes=studioVariables.filter(([key])=>studioControl(key).value!==base[key]);
  const match=state.catalog.cases.find(item=>item.assumption===base.assumption && item.weather===base.weather &&
    studioVariables.every(([key])=>item[key]===studioControl(key).value) && Object.hasOwn(item.annual,year));
  return {base,match,year,changes};
}
function previewStudio() {
  const {base,match,changes}=studioMatch();
  if(!base) return;
  for(const key of ['base','year',...studioVariables.map(([name])=>name)]) {
    studioControl(key).disabled=Boolean(state.studioBusy);
  }
  $('#studio-inputs').innerHTML=(changes.length?changes.map(([key,label])=>'<p>'+esc(label)+': '+
    esc(labelValue(key,base[key]))+' → '+esc(labelValue(key,studioControl(key).value))+'</p>').join('') :
    '<p>기준안과 같은 입력</p>')+'<p>고정 제약 · 60분, 5건/35kg, 자원 상한, 500억, 2031 EBITDA</p>';
  $('#studio-status').textContent=state.studioBusy?'원본 지도를 확인하는 중…':!match?(submissionMode?'선택 조건의 T2 지도·연간 운영 저장 결과 미연결. 재계산은 차단돼 있습니다.':'이 조합의 저장 결과가 없습니다. 재계산은 차단돼 있습니다.'):
    !changes.length?'변수를 하나 이상 바꾸세요.':'조회 가능 · 검증된 저장 실행. 신규 계산 없음.';
  $('#studio-run').disabled=state.studioBusy||!match||!changes.length;
  $('#studio-reset').disabled=Boolean(state.studioBusy);
}
function initStudio() {
  if(submissionMode){
    const pool=state.catalog.stress[dataVersion]??[];
    $('#lab-studio-controls').innerHTML='<h2>저장 What-if 조회</h2><p class="note">선택 버전의 재무 시나리오 요약입니다. 조건별 T2 지도와 연간 운영·현금흐름은 미연결입니다.</p>'+
      '<label class="lab-input">저장 조건<select id="cplus-whatif">'+pool.map(row=>'<option value="'+esc(row.scenario)+'">'+esc(row.scenario)+'</option>').join('')+'</select></label>'+
      '<p class="note">자유 입력 재계산은 지원하지 않습니다.</p>';
    state.whatif=pool[0]?.scenario??null;
    $('#cplus-whatif').onchange=event=>{state.whatif=event.target.value;renderEvidence();};
    return;
  }
  const base=studioControl('base');
  base.replaceChildren(...state.catalog.cases.map(item=>new Option(optionName(item),item.id)));
  base.value=$('#lab-a').value;
  for (const [key,label,scope] of studioVariables) {
    const select=studioControl(key);
    select.replaceChildren(...[...new Set(state.catalog.cases.map(item=>item[key]))].map(value=>new Option(labelValue(key,value),value)));
    select.title=scope;
    select.setAttribute('aria-label',label);
    select.onchange=previewStudio;
  }
  base.onchange=setStudioInputs;
  studioControl('year').onchange=previewStudio;
  setStudioInputs();
  try {
    const saved=JSON.parse(sessionStorage.getItem('nearmart-scenario-history')??'[]');
    if(Array.isArray(saved)) state.history=saved.filter(entry=>state.catalog.cases.some(item=>item.id===entry.base) &&
      state.catalog.cases.some(item=>item.id===entry.changed) && /^20[234][0-9]$/.test(entry.year)).slice(0,12);
  } catch {}
}
$('#studio-reset').onclick=setStudioInputs;
$('#studio-run').onclick=async()=>{
  const {base,match,year,changes}=studioMatch();
  if(state.studioBusy||!match||!changes.length) return;
  state.studioBusy=true;
  previewStudio();
  const items=[base,match], maps=await readMaps(items,year);
  state.studioBusy=false;
  previewStudio();
  if (!maps.every(Boolean)) {
    $('#studio-status').textContent='조회 실패 · 지도 또는 배정 결과의 원본 검증을 통과하지 못했습니다.';
    return;
  }
  state.studioPair={items,maps,year};
  state.history.unshift({base:base.id,changed:match.id,year,changes:changes.map(([key])=>key)});
  state.history=state.history.slice(0,12);
  try { sessionStorage.setItem('nearmart-scenario-history',JSON.stringify(state.history)); } catch {}
  $('#studio-status').textContent='조회 완료 · 기존 독립 검산 실행. 신규 계산 없음.';
  if(state.workspace==='studio') refreshView();
  if(state.workspace==='history') renderHistory();
};
function renderExperiment() {
  const pair=state.studioPair;
  if(submissionMode){
    const pool=state.catalog.stress[dataVersion]??[];
    const row=pool.find(item=>item.scenario===state.whatif);
    return '<div class="lab-experiment-head ambient ambient--studio"><div><h2>저장 What-if · '+esc(dataVersion==='c'?'C':'C+ v1')+'</h2><p class="lab-evidence-note">조건별 재무 요약만 연결 · 신규 계산 없음</p></div>'+
      '<label>저장 조건 <select id="cplus-whatif-summary">'+(state.catalog.stress[dataVersion]??[]).map(item=>
        '<option value="'+esc(item.scenario)+'"'+(item.scenario===state.whatif?' selected':'')+'>'+esc(item.scenario)+'</option>').join('')+'</select></label></div>'+cards([
      ['저장 조건',row?.scenario??'미연결'],
      ['20년 NPV',row?.npv_krw==null?'미연결':unit(Number(row.npv_krw)/1e8,2,'억 원')],
      ['최대 자금 소요',row?.peak_funding_krw==null?'미연결':unit(Number(row.peak_funding_krw)/1e8,2,'억 원')],
      ['500억 자금 한도',row?.funding_pass==null?'미연결':flag(row.funding_pass==='True')],
      ['2031 EBITDA',row?.ebitda_2031==null?'미연결':unit(Number(row.ebitda_2031)/1e8,2,'억 원')],
      ['적용 범위','저장 시나리오 요약 조회 · 조건별 T2 지도, 연간 운영·현금흐름 미연결 · 신규 계산 없음']
    ])+'<h3>저장 조건 목록</h3>'+table(['조건','20년 NPV','최대 자금','2031 EBITDA','500억 한도'],pool.map(item=>[
      item.scenario,item.npv_krw==null?'미연결':unit(Number(item.npv_krw)/1e8,2,'억'),
      item.peak_funding_krw==null?'미연결':unit(Number(item.peak_funding_krw)/1e8,2,'억'),
      item.ebitda_2031==null?'미연결':unit(Number(item.ebitda_2031)/1e8,2,'억'),
      item.funding_pass==null?'미연결':flag(item.funding_pass==='True')]),'lab-evidence-table')+
      '<p class="lab-evidence-note">조건별 값은 저장된 요약이며 공통 수요·운영 조건을 확인하지 않은 상태에서 개선 효과로 해석하지 않습니다.</p>';
  }
  if(!pair) return cards([
    ['실험 실행 범위','변경 변수에 해당하는 기존 저장 결과를 조회합니다. 신규 계산은 BLOCKED입니다.'],
    ['지원 변수','시장·램프업·거점 구성·운영 충격. 연도는 같은 저장 실행의 조회 범위입니다.'],
    ['고정·미지원','인력 수와 개별 거점은 저장 정책대로 유지됩니다. 임의 수치, 할인율, 자유 배치 변경은 미연결입니다.']
  ]);
  const [a,b]=pair.items, years=Object.keys(a.annual).filter(year=>Object.hasOwn(b.annual,year));
  const rows=years.map(year=>[year,fmt(a.annual[year].request),fmt(b.annual[year].request),
    fmt(a.annual[year].completed),fmt(b.annual[year].completed),fmt(a.annual[year].unprocessed),fmt(b.annual[year].unprocessed)]);
  return '<div class="lab-experiment-head ambient ambient--studio"><div><h2>실험 결과 · 저장값 조회</h2><p class="lab-evidence-note">'+esc(state.catalog.runId)+
    ' · '+esc(pair.year)+'년 · '+esc(a.id)+' → '+esc(b.id)+'</p></div><button id="studio-promote">A/B 비교에 추가</button></div>'+
    '<p class="lab-evidence-note">조건부 모델 결과 · 독립 검산 '+state.catalog.validation.PASS+'건 · 차단 '+state.catalog.validation.BLOCKED+
    '건. 연도별 값은 기대 건수입니다.</p>'+table(['연도','A 요청','B 요청','A 완료','B 완료','A 미처리','B 미처리'],rows,'lab-evidence-table lab-compact-table');
}
$('#lab-evidence').onclick=event=>{
  if(event.target.id!=='studio-promote'||!state.studioPair) return;
  const {items,year}=state.studioPair;
  $('#lab-a').value=items[0].id; $('#lab-b').value=items[1].id;
  syncYears(items); $('#lab-year').value=year;
  state.pane='decision';state.selected=null;state.selectedSite=null;
  openWorkspace('compare');
  void update();
};
function renderHistory() {
  if (!state.catalog) return;
  if (submissionMode) {
    $('#lab-history-content').innerHTML=cards([
      ['기본 분석',state.catalog.cases[0].id+' · '+state.catalog.runId],
      ['비교 분석',state.catalog.cases[1].id+' · 개별 원본 파일 조회'],
      ['검증과 한계','스냅샷 빌드 시 원본 해시 확인. C/C+ 수요 정의가 달라 효과 비교 제한. 공식 전망 BLOCKED_ANNUAL / null.']
    ])+'<details open><summary>연결된 원본 파일</summary><ul>'+state.catalog.paths.map(path=>'<li><code>'+esc(path)+'</code></li>').join('')+'</ul></details>';
    return;
  }
  const catalog=state.catalog;
  const outputPaths = entry => ['annual_dong.csv','annual_site.csv','annual_finance.csv'].flatMap(name=>[entry.base+'/'+name,entry.changed+'/'+name]);
  const current=state.comparePair?.maps.every(Boolean) ? {base:state.comparePair.items[0].id,
    changed:state.comparePair.items[1].id,year:state.comparePair.year,changes:[]} : null;
  const entries=[...(current?[current]:[]),...state.history];
  $('#lab-history-content').innerHTML=cards([
    ['실행 ID',catalog.runId],['모형 및 회계 가정',catalog.model+' · '+catalog.financeRule],
    ['재현 범위','실행 명세와 SHA-256 검산 원본을 읽습니다. S6 재실행 인터페이스는 이 화면에 연결되지 않았습니다.']
  ])+'<p class="lab-evidence-note">현재 A/B와 이 브라우저 탭의 성공한 Studio 조회 이력입니다. 각 행은 기존 저장 실행을 가리킵니다.</p>'+
    (entries.length?entries.map((entry,index)=>{
      const a=catalog.cases.find(item=>item.id===entry.base),b=catalog.cases.find(item=>item.id===entry.changed);
      const variables=studioVariables.filter(([key])=>a[key]!==b[key]).map(([key,label])=>label+' '+labelValue(key,a[key])+' → '+labelValue(key,b[key]));
      return '<details'+(index===0?' open':'')+'><summary>'+esc(entry.year+'년 · '+entry.base+' → '+entry.changed)+'</summary>'+
        '<p class="lab-evidence-note">공통 기상 '+esc(a.weather===b.weather?a.weather:a.weather+' / '+b.weather)+' · 가정 '+esc(a.assumption)+
        ' · '+esc(variables.join(' / ')||'변경 변수 없음')+'</p><ul>'+outputPaths(entry).map(path=>'<li><code>'+esc(path)+'</code></li>').join('')+'</ul></details>';
    }).join(''):'<p class="note">성공한 조회 이력이 없습니다.</p>')+
    '<details><summary>원본 입력·검산·산출 파일</summary><p class="lab-evidence-note">입력 참조 · S2 승인 가정 수요, S345 용량 계획, S1 관측 기반 파라미터. 해시 목록 · run_manifest.json / execution_manifest.json.</p>'+
    table(['검증 항목','상태'],catalog.checks.map(check=>[check.check,check.status]))+
    '<ul>'+catalog.paths.map(path=>'<li><code>'+esc(path)+'</code></li>').join('')+'</ul></details>';
}
function refreshView() {
  state.pair=state.workspace==='studio'?state.studioPair:state.comparePair;
  const pair=state.pair;
  $('#lab-map-status').textContent=pair ? (pair.maps.every(Boolean)?'동일 범위 · 동일 축척 · ':'지도 확인 중 또는 미연결 · ')+pair.year+'년' :
    '저장 결과 조회 대기';
  renderMaps();renderPerformance();renderEvidence();
}
function openWorkspace(workspace) {
  if(!state.catalog) return;
  state.workspace=workspace;
  const studio=workspace==='studio', history=workspace==='history';
  const cplusWhatif=studio&&submissionMode&&dataVersion==='cplus';
  $('#lab-workspaces').querySelectorAll('button').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.workspace===workspace)));
  $('#lab-heading').textContent=studio?'What-if Studio':history?'실험 이력·근거':'서울 배송 네트워크 시나리오 비교';
  $('#lab-subheading').textContent=cplusWhatif?'C+ v1 저장 시장·재무 조건, W2 입력과 신규 실행의 미연결 상태를 구분합니다.':
    studio?'변수를 선택하고 일치하는 저장 실행의 공간·운영·재무 영향을 확인합니다.':
    history?'원본 실행과 조회 조건, 검증 상태 및 산출 파일을 확인합니다.':'배치와 운영 성과의 차이를 원본 실행 및 제약 근거와 함께 검토합니다.';
  $('#lab-compare-controls').hidden=studio;
  $('#lab-studio-controls').hidden=!studio||cplusWhatif;
  $('#lab-tabs').hidden=studio;
  $('.lab-chain').hidden=cplusWhatif;
  $('#lab-whatif').hidden=!cplusWhatif;
  $('.lab-layout').hidden=history||(submissionMode&&studio);
  $('.lab-bottom').hidden=history||cplusWhatif;
  $('#lab-history').hidden=!history;
  $('.lab').classList.toggle('history-open',history);
  $('.lab').classList.toggle('submission-studio',submissionMode&&studio&&!cplusWhatif);
  $('.lab').classList.toggle('whatif-open',cplusWhatif);
  if(history) renderHistory();
  else if(!cplusWhatif) refreshView();
}
$('#lab-workspaces').onclick=event=>{
  const workspace=event.target.closest('[data-workspace]')?.dataset.workspace;
  if(workspace) openWorkspace(workspace);
};

async function load() {
  try {
    const [catalog,base,river]=await Promise.all([fetchJson(versionUrl('/api/scenarios')),fetchJson(versionUrl('/api/dashboard')),fetchJson('/han-river.geojson').catch(()=>null)]);
    if(!catalog.cases.length) throw new Error('no scenarios');
    state.catalog=catalog;
    state.sites=base.sites;
    prepare(base.geo,river);
    $('#lab-run').textContent=catalog.runId;
    $('#lab-status').textContent=submissionMode?'C+ v1 / C 저장 결과 · 버전별 T2 427동 · 효과 비교 제한':
      '조건부 '+catalog.cases.length+'개 실행 · 독립 검산 '+catalog.validation.PASS+'건 · 차단 '+catalog.validation.BLOCKED+'건';
    $('#lab-files').innerHTML=['T1','T2','T3','T4'].map(prefix=>{
      const file=catalog.submissions.find(name=>name.startsWith(prefix+'_'));
      return file?'<a href="/api/submissions/'+encodeURIComponent(file)+'" download>'+prefix+'</a>':'<span>'+prefix+' 미연결</span>';
    }).join('');
    const defaults=submissionMode?(dataVersion==='c'?['C_BASE','CPLUS_BASE']:['CPLUS_BASE','C_BASE']):
      ['N2_ORIGINAL__BASE__HYP_SLOW__NONE','N2_IMPROVED__BASE__HYP_SLOW__NONE'];
    const params=new URLSearchParams(location.search);
    const compatible=params.get('run')===catalog.runId;
    for(const [i,key] of ['a','b'].entries()) {
      const select=$('#lab-'+key);
      select.replaceChildren(...catalog.cases.map(item=>new Option(optionName(item),item.id)));
      const requested=compatible&&catalog.cases.some(item=>item.id===params.get(key))?params.get(key):defaults[i];
      select.value=catalog.cases.find(item=>item.id===requested)?.id??catalog.cases[0].id;
      select.disabled=false;
    }
    syncYears(chosenItems());
    if (compatible&&[...$('#lab-year').options].some(option=>option.value===params.get('year'))) $('#lab-year').value=params.get('year');
    initStudio();
    renderStages();
    if (['decision','redesign','stress'].includes(params.get('pane'))) state.pane=params.get('pane');
    await update();
    if (['studio','history'].includes(params.get('workspace'))) openWorkspace(params.get('workspace'));
  } catch {
    $('#lab-status').textContent='실행 또는 지도 자료 미연결';
    $('#lab-map-status').textContent='자료를 확인할 수 없습니다.';
    renderEvidence();
  }
}
load();
