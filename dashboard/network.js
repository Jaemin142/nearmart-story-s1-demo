import {renderProcessNav} from './process-nav.js';
import {submissionMode,versionUrl} from './version-client.js';
const $ = selector => document.querySelector(selector);
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char =>
  ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const number = new Intl.NumberFormat('ko-KR',{maximumFractionDigits:0});
const fmt = value => value == null ? '미연결' : number.format(value);
const modes = {
  structure:'네트워크 구조', coverage:'권역 커버리지', demand:'처리능력·수요', risk:'병목·리스크'
};
const colors = {
  assigned:'#438b9a', blocked:'#b77d45', unassigned:'#536578', unavailable:'#243945',
  candidate:'#51c5e1', active:'#9b7aff', selected:'#5be4c1', risk:'#ee6879'
};
const state = { data:null, year:2032, mode:'structure', selected:null, zoom:1, focus:null, bounds:null, dongs:[], river:'', tourStep:null };
let tourTimer=null;
const annual = () => state.data?.result?.annual[state.year];
const selectedYear = () => Object.entries(state.data?.result?.annual ?? {}).filter(([,result]) => result);
const project = ([lon,lat]) => [(lon-126.75)*780,-(lat-37.72)*980];
const line = coords => coords.map((coord,i) => (i ? 'L' : 'M') + project(coord).map(v=>v.toFixed(2)).join(',')).join('');
const sourceNote = submissionMode ? 'C/C+ 저장 T2 · 일간 기대 건수' : '조건부 모델 추정 · 연간 기대 건수';

renderProcessNav($('.network-nav'));
$('#analysis-modes').innerHTML = Object.entries(modes).map(([key,label]) => '<button data-mode="' + key + '">' + label + '</button>').join('');

function prepareGeometry(geo) {
  const bounds = [Infinity,Infinity,-Infinity,-Infinity];
  state.dongs = geo.features.map(({geometry,properties}) => {
    const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
    const local = [Infinity,Infinity,-Infinity,-Infinity];
    for (const polygon of polygons) for (const ring of polygon) for (const coord of ring) {
      const [x,y] = project(coord);
      for (const b of [local,bounds]) {
        b[0] = Math.min(b[0],x); b[1] = Math.min(b[1],y);
        b[2] = Math.max(b[2],x); b[3] = Math.max(b[3],y);
      }
    }
    return { code:properties.adm_cd2, label:properties.gu+' '+properties.dong, bounds:local,
      path:polygons.flatMap(polygon => polygon.map(ring => line(ring)+'Z')).join(''),
      center:[(local[0]+local[2])/2,(local[1]+local[3])/2] };
  });
  state.bounds = bounds;
  state.silhouette = state.dongs.map(dong => dong.path).join('');
}
function viewport() {
  if (!state.bounds) return;
  const [left,top,right,bottom] = state.bounds;
  const width = (right-left+30)/state.zoom, height = (bottom-top+18)/state.zoom;
  const [x,y] = state.focus ?? [(left+right)/2,(top+bottom)/2];
  $('#analysis-svg').setAttribute('viewBox',[x-width/2,y-height/2,width,height].join(' '));
}
const valueFor = row => state.mode === 'risk' ? row?.unprocessed : row?.request;
function scaleBands() {
  const values = Object.values(annual()?.dongs ?? {}).map(valueFor).filter(v=>v>0).sort((a,b)=>a-b);
  return [.33,.67].map(p=>values[Math.floor((values.length-1)*p)] ?? null);
}
function fill(row, bands) {
  if (!$('#layer-data').checked) return colors.unavailable;
  if (!row) return colors.unavailable;
  if (row.blocked) return colors.blocked;
  if (state.mode === 'structure') {
    if (!row.site) return colors.unassigned;
    const palette = ['#28546a','#2d6774','#45547b','#345a6b','#3d486b','#27626a'];
    return palette[[...row.site].reduce((sum,c)=>sum*31+c.charCodeAt(0),0)%palette.length];
  }
  if (state.mode === 'coverage') return row.site ? colors.assigned : colors.unassigned;
  const value = valueFor(row);
  if (value == null) return colors.unavailable;
  if (value === 0) return '#28404d';
  const idx = value <= bands[0] ? 0 : value <= bands[1] ? 1 : 2;
  return (state.mode === 'risk' ? ['#51374e','#805064','#bd6d79'] : ['#22485c','#2f7284','#54b8c9'])[idx];
}
function renderMap() {
  const result = annual(), bands = scaleBands(), svg = $('#analysis-svg');
  const selectedDong = state.dongs.find(d=>d.code===state.selected?.id);
  const selectedSite = state.selected?.kind === 'site' ? state.selected.id : result?.dongs[selectedDong?.code]?.site;
  const relationshipSite = selectedDong && selectedSite ? state.data?.sites.find(site=>site.id===selectedSite && site.mapped) : null;
  const lines = $('#layer-boundaries').checked;
  svg.innerHTML = state.dongs.map(dong => {
    const row = result?.dongs[dong.code];
    const chosen = selectedDong === dong;
    const linked = selectedSite && row?.site === selectedSite;
    const territorial = state.mode === 'structure' || state.mode === 'coverage';
    const emphasized = submissionMode && territorial && linked;
    return '<path data-dong="' + escapeHtml(dong.code) + '" fill-rule="evenodd" d="' + dong.path +
      '" class="'+(emphasized?'network-emphasis ':'')+(chosen&&territorial?'network-chosen':'')+
      '" fill="' + (territorial && (chosen || linked) && $('#layer-data').checked ? '#285951' : fill(row,bands)) +
      '" stroke="' + (chosen ? colors.selected : linked ? '#68b4a7' : lines ? '#547082' : 'none') +
      '" stroke-width="' + (chosen ? '1.8' : '.52') + '" vector-effect="non-scaling-stroke"><title>' +
      escapeHtml(dong.label) + '</title></path>';
  }).join('') + ($('#layer-river').checked && state.river ? '<defs><clipPath id="analysis-seoul-mask"><path d="' +
    state.silhouette + '"/></clipPath></defs><path d="' + state.river +
    '" clip-path="url(#analysis-seoul-mask)" fill="none" stroke="#77e5e9" opacity=".85" stroke-width="2.4" vector-effect="non-scaling-stroke" pointer-events="none"/>' : '') +
    (submissionMode && relationshipSite ? (()=>{const [x,y]=project([relationshipSite.lon,relationshipSite.lat]);return '<line class="network-assignment-line" x1="'+selectedDong.center[0]+'" y1="'+selectedDong.center[1]+'" x2="'+x+'" y2="'+y+'"><title>저장 배정 관계 · 실제 배송 경로 아님</title></line><circle class="network-site-pulse" cx="'+x+'" cy="'+y+'" r="5"/>';})() : '') +
    (state.data?.sites ?? []).filter(site => site.mapped && (result?.sites[site.id] ? $('#layer-sites').checked :
      $('#layer-candidates').checked && (!site.year || site.year <= state.year))).map(site => {
      const [x,y] = project([site.lon,site.lat]);
      const chosen = selectedSite === site.id, operating = result?.sites[site.id];
      return '<circle data-site="' + escapeHtml(site.id) + '" cx="' + x + '" cy="' + y + '" r="' +
        (chosen ? 3.6 : operating ? 2.45 : 1.25) + '" fill="' + (chosen ? colors.selected : operating ? colors.active : colors.candidate) +
        '" stroke="#d4eef2" stroke-width=".7" vector-effect="non-scaling-stroke"><title>' + escapeHtml(site.id+' · '+site.gu+' '+site.dong) + '</title></circle>';
    }).join('');
  viewport();
  $('#analysis-map-note').hidden=!relationshipSite || !submissionMode;
  renderFocusInset(selectedSite);
  const metric = state.mode === 'risk' ? (submissionMode?'동별 미완료 · 미연결':'연간 미처리 건수') : (submissionMode?'일간 수락 주문':'연간 접수 건수');
  const keys = state.mode === 'structure' ? [['#438b9a','거점별 배정 권역']] :
    state.mode === 'coverage' ? [[colors.assigned,'거점 배정'],[colors.unassigned,'미배정']] :
    bands[0] == null ? [] : [
      [state.mode === 'risk' ? '#51374e' : '#22485c','≤ '+fmt(bands[0])+'건'],
      [state.mode === 'risk' ? '#805064' : '#2f7284','≤ '+fmt(bands[1])+'건'],
      [state.mode === 'risk' ? '#bd6d79' : '#54b8c9','> '+fmt(bands[1])+'건']
    ];
  $('#analysis-legend').innerHTML = '<b>' + (['risk','demand'].includes(state.mode) ? metric : modes[state.mode]) + '</b>' +
    [...keys,[colors.active,'조건부 운영안'],[colors.candidate,'후보 거점'],[colors.blocked,'원천 입력 차단'],
      [colors.unavailable,'데이터 미연결']]
      .map(([color,label])=>'<span><i style="background:'+color+'"></i>'+label+'</span>').join('') +
    '<small>서울 경계 · SGIS / admdongkor</small>' +
    (state.river ? '<small>한강 · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap</a></small>' : '');
}

function renderFocusInset(siteId) {
  const box=$('#network-focus-inset'),result=annual();
  const site=state.data?.sites.find(item=>item.id===siteId && item.mapped);
  const assigned=site ? state.dongs.filter(dong=>result?.dongs[dong.code]?.site===siteId) : [];
  if(!submissionMode || !assigned.length){box.hidden=true;return;}
  const point=project([site.lon,site.lat]);
  const bounds=[Math.min(point[0],...assigned.map(d=>d.bounds[0])),Math.min(point[1],...assigned.map(d=>d.bounds[1])),
    Math.max(point[0],...assigned.map(d=>d.bounds[2])),Math.max(point[1],...assigned.map(d=>d.bounds[3]))];
  const scale=Math.min(216/Math.max(1,bounds[2]-bounds[0]),130/Math.max(1,bounds[3]-bounds[1]));
  const tx=12+(216-(bounds[2]-bounds[0])*scale)/2-bounds[0]*scale;
  const ty=12+(130-(bounds[3]-bounds[1])*scale)/2-bounds[1]*scale;
  $('#network-focus-title').textContent=siteId+' · 저장 배정 '+assigned.length+'동';
  $('#network-focus-svg').innerHTML='<g transform="matrix('+scale+' 0 0 '+scale+' '+tx+' '+ty+')">'+
    assigned.map(dong=>'<path d="'+dong.path+'" fill="'+(state.selected?.id===dong.code?'#6be5bf':'#28776c')+
      '" stroke="#b8ffe5" stroke-width="1" vector-effect="non-scaling-stroke" fill-rule="evenodd"/>').join('')+
    '</g><circle cx="'+(point[0]*scale+tx)+'" cy="'+(point[1]*scale+ty)+
    '" r="5" fill="#9effdb" stroke="#fff" stroke-width="1.5"/>';
  $('#network-focus-caption').textContent=state.data.sourceLabel+' · '+state.year+' · T2 배정 관계 / 실제 배송 경로 아님';
  box.hidden=false;
}

function describe(result, selection) {
  const dong = selection?.kind === 'dong' ? state.dongs.find(item=>item.code===selection.id) : null;
  const district = result?.dongs[dong?.code];
  const siteId = dong ? district?.site : selection?.id;
  const candidate = state.data?.sites.find(site=>site.id===siteId);
  const site = result?.sites[siteId];
  const row = dong ? district : site;
  const counts = {assigned:0, unassigned:0, blocked:0, missing:0};
  for (const {code} of state.dongs) {
    const entry = result?.dongs[code];
    const key = !entry ? 'missing' : entry.blocked ? 'blocked' : entry.site ? 'assigned' : 'unassigned';
    counts[key]++;
  }
  return {dong,district,siteId,candidate,site,row,counts};
}

function diagnosis({dong,district,siteId,site,row,counts}, result, selected = false) {
  if (submissionMode) {
    const evidence = state.data?.sourceLabel+' · '+state.year+'년 · T2_dong_assignment.csv';
    const resultText = !result ? '이 연도의 배정 결과가 미연결입니다.' : selected ?
      (dong ? (district?.site ? dong.label+' → '+district.site+' · 수락 주문 '+fmt(district.request)+'건/일.' : dong.label+' · 미서비스 · 수락 주문 0건/일.') :
        siteId+' 담당 '+fmt(site?.assignedDongs)+'동 · 수락 주문 '+fmt(site?.request)+'건/일.') :
      '427동 중 배정 '+counts.assigned+'동 · 미서비스 '+counts.unassigned+'동 · 운영 거점 '+result.active+'곳.';
    return {resultText,
      interpretation:state.mode==='demand'?'색상은 T2 수락 주문 기대량의 차이를 표시합니다. 잠재 접수와 다릅니다.':
        state.mode==='risk'?'동별 미완료·병목 원인 자료는 T2에 없습니다. 지도에서 위험 순위를 확정할 수 없습니다.':
        '배정 관계와 미서비스를 보여줍니다. 배송 경로와 실제 서비스 가능성은 별도 검증이 필요합니다.',
      cause:'개별 미서비스 또는 배정의 원인과 자원별 병목은 이 파일에서 확인할 수 없습니다.',
      impact:'이 지도는 전체 427동의 배정 상태를 표시하며, 운영 수치는 저장 결과가 있는 연도에만 연결합니다.',
      next:'선택 동의 평균 배송시간·지연율을 확인하고 배차·대표일 검증과 대조합니다.',evidence};
  }
  const units = value => value == null ? '미연결' : fmt(value)+'건';
  const affected = site?.assignedDongs != null ? '배정 거점 '+siteId+'의 담당 '+fmt(site.assignedDongs)+'동.' : '';
  const failures = site?.pickerFloorFailures;
  const failureText = failures == null ? '선택 범위의 피커 하한 진단 미연결.' :
    failures > 0 ? '거점 '+siteId+'에서 피커 하한 미충족 '+fmt(failures)+'셀을 모델이 기록했습니다.' :
    '거점 '+siteId+'에서 피커 하한 미충족 셀은 0개입니다.';
  const evidence = result ? state.data.result.runId+' · '+state.year+'년 · 조건부 모델 추정' : '검증 결과 미연결';
  let resultText, interpretation, cause, impact, next;
  if (state.mode === 'structure') {
    resultText = selected ? (dong ? '담당 거점 '+(siteId ?? '미배정 / 미연결')+'.' :
      '담당 행정동 '+fmt(site?.assignedDongs)+', 거점 연간 접수 '+units(site?.request)+'.') :
      '배정 '+fmt(counts.assigned)+'동과 조건부 운영안 '+fmt(result?.active)+'개 거점의 구조를 비교합니다.';
    interpretation = '담당 동 수와 접수 수요는 배정 범위와 업무 집중을 보여줍니다.';
    cause = '배정 결과만으로 배정 선택의 원인과 배송 효율성은 확인할 수 없습니다.';
    impact = affected || '담당 범위 상위 거점에서 여러 행정동이 한 거점에 의존하는지 확인할 수 있습니다.';
    next = '대안 배치의 담당 동과 접수 수요를 동일 연도·가정에서 비교합니다.';
  } else if (state.mode === 'coverage') {
    resultText = selected && dong ? (district?.blocked ? '해당 동은 이 실행에서 원천 입력 차단입니다.' :
      district?.site ? '해당 동은 '+district.site+'에 배정됐습니다.' : district ? '해당 동의 담당 거점이 배정되지 않았습니다.' : '해당 동의 결과 미연결.') :
      selected ? '선택 거점 담당 '+fmt(site?.assignedDongs)+'동.' :
      '배정 '+counts.assigned+' · 미배정 '+counts.unassigned+' · 입력 차단 '+counts.blocked+' · 미연결 '+counts.missing+'동.';
    interpretation = '배정은 모델의 담당 관계를 뜻합니다. 거리·시간 기준 배송 가능 여부는 미연결입니다.';
    cause = district?.blocked ? '원본 상태는 원천 입력 차단입니다. 개별 결측 항목은 이 결과에서 확인할 수 없습니다.' :
      '배정·미배정의 개별 사유와 실제 서비스 가능성은 확인되지 않았습니다.';
    impact = affected || '서울 427동 명부에서 이 실행의 배정 및 원천 입력 상태를 구분합니다.';
    next = '입력 차단 사유와 배정 규칙을 확인하고, 서비스 가능성은 이동거리·시간 결과가 있을 때 평가합니다.';
  } else if (state.mode === 'demand') {
    resultText = selected ? '연간 접수 '+units(row?.request)+' · 완료 '+units(row?.completed)+'.' :
      '행정동 연간 접수 기대 건수의 공간 분포와 상위 동을 비교합니다.';
    interpretation = '접수 건수가 높은 곳은 수요가 집중된 곳입니다.';
    cause = '동일 기간의 검증된 처리능력 결과가 미연결이므로 용량 차이와 과부하 여부는 판정할 수 없습니다.';
    impact = affected || '상위 동의 담당 거점을 선택해 수요 집중이 어떤 배정 범위에 걸리는지 확인할 수 있습니다.';
    next = '연간 처리능력이나 같은 단위의 수요·용량 검증 결과가 확보되면 비교합니다.';
  } else {
    const tested = Object.values(result?.sites ?? {}).filter(s=>s.pickerFloorFailures != null);
    const flagged = tested.filter(s=>s.pickerFloorFailures>0).length;
    resultText = selected ? '연간 미처리 '+units(row?.unprocessed)+'.' : '미처리 기대 건수가 높은 행정동은 추가 점검 후보입니다.';
    interpretation = '미처리량은 영향의 크기를 보여줍니다. 검증된 병목 위치를 뜻하지 않습니다.';
    cause = '원인 미확정. '+(selected ? failureText : tested.length ? '피커 하한 미충족 진단 '+flagged+'/'+tested.length+'개 거점.' : '피커 하한 진단 미연결.')+
      ' 용량·이동 제약의 기여는 미연결입니다.';
    impact = affected || '행정동별 미처리량과 해당 동의 담당 거점을 함께 확인합니다.';
    next = '시간대별 인력·작업 대기·이동시간 근거를 대조한 뒤 가능한 원인과 비교 시나리오를 좁힙니다.';
  }
  if (!result) {
    resultText = '이 연도의 결과는 미연결입니다.';
    impact = '영향 범위 미연결.';
  } else if (district?.blocked) {
    resultText = '해당 동의 원천 입력이 이 실행에서 차단되었습니다.';
    impact = '선택 동의 영향은 계산 불가입니다.';
  }
  return {resultText,interpretation,cause,impact,next,evidence};
}

function renderSummary() {
  const result = annual(), context = describe(result,null), {counts} = context;
  const detail = diagnosis(state.selected ? describe(result,state.selected) : context,result,Boolean(state.selected));
  let rows = [], title, note;
  if (state.mode === 'structure') {
    title = '거점별 담당 범위 상위 4곳';
    const ranked = Object.entries(result?.sites ?? {}).filter(([,site])=>site.assignedDongs != null)
      .sort((a,b)=>b[1].assignedDongs-a[1].assignedDongs);
    rows = ranked.slice(0,4).map(([id,site])=>{
      const rank = ranked.findIndex(([,other])=>other.assignedDongs===site.assignedDongs)+1;
      const tied = ranked.filter(([,other])=>other.assignedDongs===site.assignedDongs).length>1;
      return {label:id,value:site.assignedDongs,kind:'site',id,request:site.request,
        rank:(tied ? '공동 ' : '')+rank+'위'};
    });
    note = '순위 · 담당 행정동 수  /  청록 막대 · 표시 거점의 '+(submissionMode?'일간 수락 주문':'연간 접수량')+' 비교';
  } else if (state.mode === 'coverage') {
    title = '행정동 배정 상태';
    rows = [
      ['거점 배정',counts.assigned,colors.assigned],['미배정',counts.unassigned,colors.unassigned],
      ['원천 입력 차단',counts.blocked,colors.blocked],['미연결',counts.missing,colors.unavailable]
    ].map(([label,value,color])=>({label,value,color}));
    note = '단위 · 행정동 수';
  } else {
    const risk = state.mode === 'risk';
    title = risk ? (submissionMode?'행정동별 미완료 · 미연결':'행정동 미처리량 상위 4곳') : '행정동 '+(submissionMode?'일간 수락 주문':'연간 접수량')+' 상위 4곳';
    rows = state.dongs.map(dong=>({label:dong.label,value:valueFor(result?.dongs[dong.code]),kind:'dong',id:dong.code,
      color:risk ? colors.risk : colors.candidate})).filter(row=>row.value!=null && (!risk || row.value>0))
      .sort((a,b)=>b.value-a.value).slice(0,4);
    note = '단위 · '+(submissionMode?'일간':'연간')+' 기대 건수';
  }
  $('#analysis-chart-title').textContent = title;
  const max = Math.max(1,...rows.map(row=>row.value));
  const maxRequest = Math.max(1,...rows.map(row=>row.request ?? 0));
  $('#analysis-chart').innerHTML = (rows.length ? '<div class="analysis-bars">'+rows.map(row=>{
    const tag = row.kind ? 'button' : 'div';
    const attrs = row.kind ? ' data-rank-kind="'+row.kind+'" data-rank-id="'+escapeHtml(row.id)+
      '" aria-pressed="'+String(state.selected?.kind===row.kind && state.selected.id===row.id)+'"' : '';
    if (row.rank) return '<'+tag+' class="analysis-bar-item structure-rank"'+attrs+'><span class="structure-rank-heading"><b>'+
      escapeHtml(row.label)+'</b><span class="structure-rank-badge">'+escapeHtml(row.rank)+'</span><strong>'+fmt(row.value)+'동</strong></span>'+
      '<small>'+(submissionMode?'일간 수락':'연간 접수')+' <b>'+(row.request == null ? '미연결' : fmt(row.request)+'건')+'</b></small>'+
      (row.request == null ? '' : '<span class="analysis-track"><i style="width:'+100*row.request/maxRequest+'%"></i></span>')+'</'+tag+'>';
    return '<'+tag+' class="analysis-bar-item"'+attrs+'><span>'+escapeHtml(row.label)+'</span><strong>'+fmt(row.value)+
      '</strong><span class="analysis-track"><i style="width:'+100*row.value/max+'%;background:'+row.color+'"></i></span>'+
      (row.note ? '<small>'+escapeHtml(row.note)+'</small>' : '')+'</'+tag+'>';
  }).join('')+'</div>' : '<p class="note">'+(result ? '표시할 양수 결과 없음' : '미연결')+'</p>') + '<p class="note">'+note+'</p>';
  const scope = state.selected ? '선택 대상' : '전체 범위';
  $('#analysis-findings').innerHTML = [
    [scope+' · 결과',detail.resultText],['원인',detail.cause],['영향',detail.impact],['근거 상태',detail.evidence]
  ].map(([key,value])=>'<p><strong>'+escapeHtml(key)+'</strong>'+escapeHtml(value)+'</p>').join('');
}

function renderDetail() {
  const selection = state.selected, result = annual();
  if (!selection) return;
  const context = describe(result,selection);
  const {dong,district,candidate,site,siteId,row} = context;
  const detail = diagnosis(context,result,true);
  const title = dong?.label ?? [candidate?.gu,candidate?.dong,candidate?.id].filter(Boolean).join(' ');
  const label = submissionMode ? (dong && district ? state.data.sourceLabel+' · T2 · '+(district.site?'배정 동':'미서비스 동') :
    site ? state.data.sourceLabel+' · 운영 거점' : candidate ? '후보 명부 · 운영 거점과 구분' : '미연결') :
    district?.blocked ? '계산 불가 · 원천 입력 차단' :
    dong && district ? '가정 기반 · 모델 추정 · '+(district.site ? '배정 동' : '미배정 동') :
    site ? '가정 기반 · 모델 추정 · 조건부 운영안' : candidate ? '후보 명부 · 해당 연도 운영 결과 미연결' : '미연결';
  const fields = [
    ...(dong ? [['행정동 코드',dong.code],['담당 거점',district?.site ?? '미배정 / 미연결'],['원본 입력 상태',district?.inputStatus ?? '미연결'],
      [submissionMode?'동 일간 수락 주문':'동 연간 주문 요청',fmt(district?.request)],
      ...(submissionMode?[['평균 배송시간',district?.deliveryMin==null?'미연결':fmt(district.deliveryMin)+'분'],['지연율',district?.lateRate==null?'미연결':(100*district.lateRate).toFixed(2)+'%']]:
        [['동 연간 완료',fmt(district?.completed)],['동 연간 미처리 분류',fmt(district?.unprocessed)]])] :
      [['거점 유형',site?.hubType ?? '미연결'],['담당 행정동',fmt(site?.assignedDongs)],[submissionMode?'거점 일간 수락 주문':'거점 연간 주문 요청',fmt(site?.request)],
        [submissionMode?'거점 일간 배송 완료':'거점 연간 완료',fmt(site?.completed)],[submissionMode?'거점 일간 미완료':'거점 연간 미처리 분류',fmt(site?.unprocessed)]]),
    ...(['demand','risk'].includes(state.mode) ? [['연간 처리능력 · 용량 차이','미연결']] : []),
    ...(state.mode==='risk' ? [['피커 하한 미충족 셀',fmt(site?.pickerFloorFailures)],['최대 추정 피커 부족 (분/일)',fmt(site?.pickerDeficitMinutes)]] : [])
  ];
  const fieldsHtml = '<dl class="analysis-fields">'+fields.map(([k,v])=>
    '<div><dt>'+escapeHtml(k)+'</dt><dd>'+escapeHtml(v)+'</dd></div>').join('')+'</dl>';
  const notes = [
    ['분석 결과',detail.resultText],['해석',detail.interpretation],['확인되지 않은 원인',detail.cause],
    ['영향 범위',detail.impact],['추가 검토',detail.next]
  ];
  const overviewHtml=submissionMode?'<div class="network-selection-overview"><span>'+
    escapeHtml(dong ? district?.site?'저장 배정 · '+district.site+' 거점':'미서비스 · 담당 거점 없음' : site?'조건부 운영 거점 · '+siteId:'후보 거점 · 운영 결과 미연결')+
    '</span><strong>'+escapeHtml(dong ? dong.label : title)+'</strong><div class="network-selection-metrics">'+
    (dong ? [['일간 수락 주문',fmt(district?.request)+'건/일'],['평균 배송시간',district?.deliveryMin==null?'미연결':Number(district.deliveryMin).toFixed(1)+'분'],['지연율',district?.lateRate==null?'미연결':(100*district.lateRate).toFixed(1)+'%']] :
      [['담당 행정동',fmt(site?.assignedDongs)+'동'],['일간 수락 주문',fmt(site?.request)+'건/일']]).map(([key,value])=>
      '<div><small>'+escapeHtml(key)+'</small><b>'+escapeHtml(value)+'</b></div>').join('')+
    '</div></div>':'';
  $('#analysis-selection').textContent = title;
  const rawOpen = $('.analysis-raw')?.open ?? true;
  const compareOpen = $('.analysis-peers')?.open ?? false;
  const flowOpen = $('.analysis-flow')?.open ?? true;
  const flow = [
    ['주문 요청',row?.request],['거절',row?.reject],['취소',row?.cancel],['외부 처리 대기',row?.externalPending],
    ['완료',row?.completed],['미처리 분류',row?.unprocessed]
  ];
  const flowHtml = flow.every(([,value])=>value != null) ?
    '<dl class="analysis-fields">'+flow.map(([key,value])=>'<div><dt>'+key+'</dt><dd>'+
      value.toLocaleString('ko-KR',{minimumFractionDigits:2,maximumFractionDigits:2})+'</dd></div>').join('')+
    '</dl><p class="note">요청 = 완료 + 미처리 + 거절 + 취소 + 외부 처리 대기. 항목별 반올림으로 표시값 합계에 차이가 날 수 있습니다.</p>' :
    '<p class="note">'+(district?.blocked ? '계산 불가 · 원천 입력 차단' : '주문 상태별 결과 미연결')+'</p>';
  const peers = siteId ? state.dongs.filter(item=>result?.dongs[item.code]?.site===siteId)
    .sort((a,b)=>(result.dongs[b.code].request ?? -1)-(result.dongs[a.code].request ?? -1)) : [];
  const compareHtml = peers.length ? '<details class="analysis-peers"'+(compareOpen ? ' open' : '')+
    '><summary>'+escapeHtml(siteId)+' 담당 동 비교 · '+peers.length+'동</summary>'+
    '<p class="note">같은 연도 · '+(submissionMode?'일간 수락 주문 / 동별 미완료 미연결':'연간 주문 요청 / 미처리 분류')+' (건)</p><div class="analysis-peer-list">'+
    peers.map(item=>'<button data-peer="'+escapeHtml(item.code)+'" aria-pressed="'+String(dong===item)+'"><span>'+
      escapeHtml(item.label)+'</span><strong>'+fmt(result.dongs[item.code].request)+' / '+fmt(result.dongs[item.code].unprocessed)+'</strong></button>').join('')+
    '</div></details>' : '';
  $('#analysis-detail').innerHTML = '<h3>'+escapeHtml(title)+'</h3><p class="analysis-annotation">'+escapeHtml(label)+'</p>'+
    overviewHtml+
    '<div class="analysis-diagnosis">'+notes.map(([key,value])=>'<section><h4>'+escapeHtml(key)+'</h4><p>'+escapeHtml(value)+'</p></section>').join('')+
    '</div><details class="analysis-raw"'+(rawOpen ? ' open' : '')+'><summary>원본 지표 및 근거</summary>'+fieldsHtml+
    '<p class="note">'+escapeHtml(detail.evidence)+'</p><p class="note">'+(submissionMode?'T2_dong_assignment.csv · 동별 완료·미완료 미연결':'annual_dong.csv / annual_site.csv · 관측 지표 미연결')+'</p></details>'+
    '<details class="analysis-flow"'+(flowOpen ? ' open' : '')+'><summary>'+(submissionMode?'주문 상태 대사 · 미연결':'연간 주문 상태 대사 · 기대 건수')+'</summary>'+flowHtml+'</details>'+
    compareHtml+'<a class="analysis-evidence-link" href="/evidence?'+escapeHtml(new URLSearchParams({kind:'network',year:state.year,
      ...(state.data?.result ? {run:state.data.result.runId,id:state.data.result.scenario} : {}),
      [selection.kind==='dong'?'dong':'site']:selection.id}).toString())+'">이 결과의 근거 추적</a><br><a class="analysis-scenario-link" href="/scenario">Scenario Lab에서 대안 비교</a>';
}
function render() {
  $('#analysis-map-title').textContent = modes[state.mode];
  $('#analysis-modes').querySelectorAll('button').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.mode===state.mode)));
  renderMap();
  renderSummary();
  renderDetail();
  renderTour();
}
function renderTour(){
  const section=$('#network-tour');
  const count=state.dongs.filter(dong=>annual()?.dongs[dong.code]?.site==='P1').length;
  section.hidden=!submissionMode || !count;
  if(section.hidden)return;
  $('#network-tour-site-label').textContent='P1 배정 '+count+'동 강조';
  section.querySelectorAll('[data-tour-step]').forEach(button=>{
    if(Number(button.dataset.tourStep)===state.tourStep)button.setAttribute('aria-current','step');
    else button.removeAttribute('aria-current');
  });
  $('#network-tour-stop').hidden=state.tourStep==null;
  $('#network-tour-play').textContent=tourTimer?'Ⅱ 시연 일시정지':state.tourStep!=null&&state.tourStep<3?'▶ 시연 계속':'▶ 권역 탐색 시연';
  const selected=state.selected?.kind==='dong'?state.dongs.find(dong=>dong.code===state.selected.id)?.label:'';
  $('#network-tour-status').textContent=state.tourStep==null?'단계를 눌러 직접 탐색할 수도 있습니다.':[
    '서울 427동의 저장 배정 상태를 확인합니다.',
    'P1에 저장 배정된 '+count+'동을 강조합니다.',
    selected+'의 수치와 P1 배정 관계를 확인합니다.',
    state.data.sourceLabel+' · '+state.year+' · T2_dong_assignment.csv에서 근거를 추적합니다.'
  ][state.tourStep];
}
function pauseTour(){if(tourTimer){clearTimeout(tourTimer);tourTimer=null;}}
function tourStep(step){
  if(!state.data || !annual())return;
  const assigned=state.dongs.filter(dong=>annual().dongs[dong.code]?.site==='P1');
  if(!assigned.length)return;
  state.tourStep=step;
  state.mode='structure';
  $('#layer-data').checked=true;
  $('#layer-sites').checked=true;
  if(step===0){state.selected=null;state.focus=null;state.zoom=1;setDrawer(false);}
  else if(step===1){state.selected={kind:'site',id:'P1'};state.focus=null;state.zoom=1;setDrawer(true);}
  else {
    const dong=assigned.toSorted((a,b)=>(annual().dongs[b.code].request??0)-(annual().dongs[a.code].request??0))[0];
    state.selected={kind:'dong',id:dong.code};state.focus=dong.center;state.zoom=2.1;setDrawer(true);
  }
  render();
  if(step===3){
    const raw=$('.analysis-raw'),drawer=$('#analysis-drawer');
    if(raw){raw.open=true;raw.classList.add('network-evidence-focus');drawer.scrollTop=raw.offsetTop-drawer.offsetTop-55;}
  } else $('#analysis-drawer').scrollTop=0;
}
function playTour(step=0){
  tourStep(step);
  tourTimer=setTimeout(()=>{
    tourTimer=null;
    if(step<3)playTour(step+1);else renderTour();
  },step===0?1800:step===1?2700:step===2?3200:4200);
  renderTour();
}
$('#network-tour-play').onclick=()=>{
  if(tourTimer){pauseTour();renderTour();return;}
  playTour(state.tourStep==null||state.tourStep===3?0:state.tourStep);
};
$('#network-tour').onclick=event=>{
  const button=event.target.closest('[data-tour-step]');
  if(button){pauseTour();tourStep(Number(button.dataset.tourStep));button.focus();}
};
$('#network-tour-stop').onclick=()=>{
  pauseTour();state.tourStep=null;state.selected=null;state.focus=null;state.zoom=1;setDrawer(false);render();
};
function select(kind,id,locate=false) {
  pauseTour();state.tourStep=null;
  const item = kind === 'dong' ? state.dongs.find(d=>d.code===id) : state.data?.sites.find(site=>site.id===id);
  if (!item) return;
  state.selected = {kind,id};
  if (locate && (kind === 'dong' || item.mapped)) {
    state.focus = kind === 'dong' ? item.center : project([item.lon,item.lat]);
    state.zoom = 1.8;
  }
  setDrawer(true);
  render();
}
$('#analysis-modes').onclick = event => {
  const mode = event.target.closest('[data-mode]')?.dataset.mode;
  if (mode) { pauseTour();state.tourStep=null;state.mode=mode; render(); }
};
$('#analysis-year').onchange = event => { pauseTour();state.tourStep=null;state.year=Number(event.target.value); render(); };
$('#analysis-svg').onclick = event => {
  if (event.target.dataset.site) select('site',event.target.dataset.site);
  if (event.target.dataset.dong) select('dong',event.target.dataset.dong);
};
$('.analysis-tools').onchange = event => { if (event.target.type==='checkbox') renderMap(); };
function setDrawer(open) {
  $('#analysis-drawer').hidden = !open;
  $('.analysis-layout').classList.toggle('drawer-closed',!open);
  $('#analysis-reopen').hidden = open || !state.selected;
  $('#analysis-reopen').setAttribute('aria-expanded',String(open));
}
$('#analysis-close').onclick = () => { setDrawer(false); $('#analysis-reopen').focus(); };
$('#analysis-reopen').onclick = () => { setDrawer(true); $('#analysis-close').focus(); };
$('#analysis-chart').onclick = event => {
  const target = event.target.closest('[data-rank-id]');
  if (target) select(target.dataset.rankKind,target.dataset.rankId,true);
};
$('#analysis-detail').onclick = event => {
  const peer = event.target.closest('[data-peer]');
  if (peer) select('dong',peer.dataset.peer,true);
};
$('#analysis-toggle-tools').onclick = () => {
  const open = $('#analysis-tools').hidden;
  $('#analysis-tools').hidden=!open;
  $('.analysis-layout').classList.toggle('tools-closed',!open);
  $('#analysis-toggle-tools').setAttribute('aria-expanded',String(open));
  $('#analysis-toggle-tools').textContent=open ? '도구 접기' : '도구 펼치기';
};
$('#analysis-plus').onclick = () => { state.zoom=Math.min(5,state.zoom*1.25); viewport(); };
$('#analysis-minus').onclick = () => { state.zoom=Math.max(.7,state.zoom/1.25); viewport(); };
$('#analysis-reset').onclick = () => { state.zoom=1; state.focus=null; viewport(); };
const search = $('#analysis-search'), matches = $('#analysis-results');
search.oninput = () => {
  const q = search.value.trim().toLowerCase();
  matches.hidden=!q;
  if (!q) return;
  const items = [
    ...(state.data?.sites ?? []).filter(site=>[site.id,site.gu,site.dong].join(' ').toLowerCase().includes(q))
      .map(site=>['site',site.id,site.id+' · '+site.gu+' '+site.dong]),
    ...state.dongs.filter(dong=>(dong.label+' '+dong.code).includes(q)).map(dong=>['dong',dong.code,dong.label])
  ].slice(0,20);
  matches.innerHTML=items.map(([kind,id,label])=>'<button data-kind="'+kind+'" data-id="'+escapeHtml(id)+'">'+escapeHtml(label)+'</button>').join('') ||
    '<p class="empty">검색 결과 없음</p>';
};
matches.onclick = event => {
  const target=event.target.closest('[data-id]');
  if (target) { select(target.dataset.kind,target.dataset.id,true); matches.hidden=true; search.value=''; }
};
document.addEventListener('click',event=>{if (!event.target.closest('.analysis-search')) matches.hidden=true;});
search.onkeydown=event=>{if(event.key==='Escape')matches.hidden=true;};

async function load() {
  try {
    const response=await fetch(versionUrl('/api/dashboard'));
    if (response.status===401) { location.assign('/login'); return; }
    if (!response.ok) throw new Error('dataset unavailable');
    state.data=await response.json();
    prepareGeometry(state.data.geo);
    const options=selectedYear();
    state.year=options.some(([y])=>Number(y)===(submissionMode?2031:2032)) ? (submissionMode?2031:2032) : Number(options[0]?.[0] ?? 2032);
    $('#analysis-year').replaceChildren(...(options.length ? options.map(([y])=>new Option(y,y)) : [new Option('미연결','')]));
    $('#analysis-year').value=options.length ? String(state.year) : '';
    $('#analysis-year').disabled=!options.length;
    $('#network-run').textContent=state.data.result?.runId ?? '미연결';
    if(submissionMode)$('#analysis-condition').textContent=state.data.sourceLabel+' · '+(state.data.sourceVersion==='c'?'C 원형':'B84')+' · P1 · T1/T2';
    $('#network-state').textContent=state.data.result ? (submissionMode?state.data.sourceLabel+' · T2 427동 · 일간 수락 주문 · 병목 원인 미연결':'가정 기반 · 모델 추정 · 독립 검산 · 관측 지표 미연결') : '분석 결과 미연결';
    render();
    const river=await fetch('/han-river.geojson');
    if (river.ok) {
      state.river=(await river.json()).features.map(({geometry})=>line(geometry.coordinates)).join('');
      renderMap();
    }
  } catch {
    if (!state.data) $('#network-state').textContent='서울 경계 또는 분석 파일 미연결';
  }
}
render();
load();

