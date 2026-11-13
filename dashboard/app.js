import {renderProcessNav} from './process-nav.js';
import {dataVersion,submissionMode,versionUrl} from './version-client.js';
import {storyActive,loadStory,storyDashboard} from './story-s1-adapter.js';
const $ = (selector) => document.querySelector(selector);
const icons = {
  box:'M12 2 3 7v10l9 5 9-5V7l-9-5Zm0 20V12m9-5-9 5-9-5m4-2 10 5',
  home:'m2 11 10-9 10 9M5 10v11h5v-7h4v7h5V10',
  network:'M8 11l8-5M8 13l8 5M8 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm14-8a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm0 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
  pin:'M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Zm-5 0a3 3 0 1 0-6 0 3 3 0 0 0 6 0Z',
  layers:'m2 7 10-5 10 5-10 5-10-5Zm0 5 10 5 10-5M2 17l10 5 10-5',
  bars:'M2 22h20M5 18v-6h3v6m3 0V8h3v10m3 0V3h3v15',
  data:'M3 6a9 4 0 1 0 18 0A9 4 0 1 0 3 6Zm0 0v12a9 4 0 0 0 18 0V6M3 12a9 4 0 0 0 18 0',
  doc:'M5 2h10l4 4v16H5V2Zm9 0v5h5M8 11h8m-8 4h8m-8 4h5',
  sliders:'M2 5h20M2 12h20M2 19h20M8 2v6m8 1v6m-6 1v6',
  truck:'M2 5h13v12H2V5Zm13 4h4l3 5v3h-7M8 18a2 2 0 1 0-4 0 2 2 0 0 0 4 0Zm12 0a2 2 0 1 0-4 0 2 2 0 0 0 4 0Z',
  clock:'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Zm0-16v6h5',
  bell:'M6 9a6 6 0 0 1 12 0v5l3 4H3l3-4V9Zm4 12h4',
  help:'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM9 8a3 3 0 1 1 4 3c-1 1-1 1-1 3m0 3h.01',
  target:'M12 2v5m0 10v5M2 12h5m10 0h5m-2 0a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z',
  warn:'m12 3 10 18H2L12 3Zm0 6v5m0 3h.01',
  info:'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Zm0-12v7m0-10h.01'
};
const icon = (name) => '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + icons[name] + '"/></svg>';
const clean = (value) => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const format = (value) => value == null ? '—' : new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 }).format(value);
const pct = (value) => value == null ? '—' : (value * 100).toFixed(1) + '%';
const count = (value) => value == null ? '—' : format(value) + ' 건';
const labels = {
  OBSERVED:'관측 데이터', MODEL_ESTIMATE:'모델 추정', ASSUMPTION_SCENARIO:'가정 기반', BLOCKED:'계산 불가',
  UNAVAILABLE:'미연결', DEMO:'디자인 시연용'
};
let years = [2027, 2032, 2037, 2042];
const state = { data:null, year:2032, scenario:'conditional', site:null, mapTab:'network' };
const isStory=()=>state.data?.sourceVersion==='story_s1';
const current = () => state.scenario === 'conditional' ? state.data?.result : null;
const annual = (year = state.year) => current()?.annual[year];
const unitNote = () => submissionMode ? '일간 기대 건수 · 저장 T2/운영 결과' : '연간 기대 건수';
const yearState = (year) => state.scenario === 'official' ? 'BLOCKED' : annual(year) ? 'ASSUMPTION_SCENARIO' : 'UNAVAILABLE';
const statusBadge = (status) => '<span class="badge ' + status.toLowerCase() + '" title="' + status + '">' + labels[status] + '</span>';
const mapCanvas = $('#map');
const ctx = mapCanvas.getContext('2d');
const view = { zoom:1, dx:0, dy:0, hits:[], geometry:[], districts:[] };

function chart(key, instance, siteId) {
  const values = years.map(year => siteId ? annual(year)?.sites[siteId]?.[isStory()?'request':'completed'] : annual(year)?.[key]);
  const valid = values.filter(value => value != null);
  if (!valid.length) return '<p class="empty">' + labels[yearState(state.year)] + '</p>';
  const min = Math.min(...valid) * .94, max = Math.max(...valid) * 1.04;
  const points = values.map((value, i) => value == null ? null : [12 + 276 * i / (years.length-1), 12 + 47 * (max - value) / (max - min || 1)]);
  const segments = points.reduce((groups, point) => {
    if (!point) groups.push([]);
    else groups.at(-1).push(point);
    return groups;
  }, [[]]).filter(segment => segment.length);
  const chartId = 'fill-' + instance + '-' + key;
  const lines = segments.map(segment => {
    const path = segment.map(point => point.join(',')).join(' ');
    return '<polygon points="' + segment[0][0] + ',66 ' + path + ' ' + segment.at(-1)[0] + ',66" fill="url(#' + chartId + ')" stroke="none"/><polyline class="line" points="' + path + '"/>';
  }).join('');
  return '<svg class="chart" viewBox="0 0 300 88" role="img" aria-label="' + years.join(', ') + '년 ' +
    (siteId ? '선택 거점' : '네트워크') + (isStory()?' 일간 기대 주문':' 모델 완료량') + '">' +
    '<defs><linearGradient id="' + chartId + '" x2="0%" y2="100%"><stop stop-color="#5BE4C1" stop-opacity=".31"/><stop offset="1" stop-color="#5BE4C1" stop-opacity=".02"/></linearGradient></defs>' +
    '<path class="axis" d="M10 66H291"/>' + lines + points.map((point, i) => {
      const x = 12 + 276 * i / (years.length-1);
      return (point ? '<circle cx="' + x + '" cy="' + point[1] + '" r="' + (years[i] === state.year ? 4 : 2.7) + '"><title>' + years[i] + '년 ' + count(values[i]) + '</title></circle>' : '') +
        '<text x="' + x + '" y="85" text-anchor="middle">’' + String(years[i]).slice(-2) + '</text>';
    }).join('') + '</svg>';
}

function render() {
  const data = state.data, result = current(), row = annual(), status = yearState(state.year);
  const tag = labels[status];
  $('#run span').textContent = result?.runId ?? '미연결';
  $('#status span').innerHTML = '<i class="dot ' + (row ? 'cyan' : 'amber') + '"></i>' + (row ? (isStory()?state.data.sourceLabel:submissionMode?'저장 결과 · '+state.data.sourceLabel:'조건부 · 독립 검산') : tag);
  $('#year').value = state.year;
  $('#scenario').value = state.scenario;
  const metricCards = isStory()?[
    ['box','일간 주문 기대량',count(row?.model_requests),'S1 T2 저장 배정 · 설계 추정'],
    ['layers','배정 행정동',row?format(row.assignedDongs)+' 동':'—','427동 명부 · 미서비스 별도'],
    ['pin','계획 운영 거점',row?row.active+' 개':'—','해당 연도 T1 계획 · 총 개설 31개'],
    ['target','총 개설 계획',state.data.result?'31 개':'—','후보 명부 '+data.sites.length+'개와 구분']
  ]:[
    ['box',submissionMode?'일간 수락 주문':'연간 접수량',count(row?.model_requests),submissionMode&&row?.assignmentConnected?'T2 저장 배정 · 일간 기대 건수':!submissionMode&&row?unitNote():'미연결'],
    ['truck',submissionMode?'일간 배송 완료':'연간 완료량',count(row?.model_completed),row?.operationConnected||!submissionMode&&row ? unitNote() : '미연결'],
    ['clock','완료 건 중 정시',pct(row?.model_ontime_over_completed),row?.operationConnected||!submissionMode&&row ? '저장 운영 결과 · 모델 추정' : '미연결'],
    ['pin','조건부 운영 거점',row ? row.active + ' 개' : '—',data?.sites.length ? '후보 명부 ' + data.sites.length + '개 · 운영과 구분' : '후보 미연결']
  ];
  $('#metrics').innerHTML = metricCards.map(([glyph,label,value,note]) =>
    '<article class="metric">' + icon(glyph) + '<label>' + label + '</label><strong>' + value + '</strong><small>' + note + '</small></article>').join('');
  $('#network-trend').innerHTML = '<h3>'+(isStory()?'일간 주문 기대량':submissionMode?'일간 배송 완료':'연간 완료 처리량')+'</h3><strong class="big-value">' + count(isStory()?row?.model_requests:row?.model_completed) +
    '</strong> <small class="violet">' + tag + '</small>' + chart(isStory()?'model_requests':'model_completed', 'left');
  $('#scope').innerHTML = [
    ['','전체 행정동 명부',data ? data.rosterCount + ' 동' : '미연결'],['cyan',submissionMode?'T2 배정 기록':'조건부 분석 범위',data?.result ? (submissionMode?'427 동 · 선택 연도':'423 동') : '미연결'],
    ['red','② 원본 연간 전망','계산 불가']
  ].map(([color,label,value]) => '<div class="scope-row"><i class="dot ' + color + '"></i><span>' + label + '</span><b>' + value + '</b></div>').join('') +
    '<p class="scope-note">'+(isStory()?'S1 T2는 427동을 기록하며 설계상 배정과 미서비스를 구분합니다. 배송 완료·정시 DES 성과는 미연결입니다.':submissionMode?'T2는 427동을 기록하며 실제 배정과 미서비스를 구분합니다. 연간 운영값은 검증된 연도에만 연결합니다.':'조건부 423동 결과는 427동 완전 합계에 사용할 수 없습니다. 결측·단위 문제의 적용 범위는 결과별로 다릅니다.')+'</p>';
  const alerts = [
    ['warn','공식 연간 전망 차단','② BLOCKED_ANNUAL / null'],
    ...(data?.errors ?? []).map(message => ['warn',message,'결과 파일 또는 검증 근거를 확인하세요.']),
    ['info',isStory()?'S1 base 개선 · 하방 위험 잔존':result?.fundingPass === false ? '500억 자금 한도 미충족' : '재무 근거',isStory()?'base 자금 190.3억 · 시장 low 665.0억 · 투자 미확정':result ? (submissionMode?'20년 저장 현금흐름 · 투자 미선정':'20년 실험 · 독립 검산 ' + result.validation.PASS + '건') : tag],
    ['info','지도 연결 상태',data?.sites.length ? data.sites.filter(site => site.mapped).length + '개 후보 좌표 연결 · 나머지는 목록에서 확인' : '거점 후보 미연결']
  ];
  const alertMarkup = ([glyph,title,note]) => '<div class="alert"><span class="alert-icon ' + glyph + '">' + icon(glyph) +
    '</span><div><strong>' + clean(title) + '</strong><small>' + clean(note) + '</small></div></div>';
  $('#alert-list').innerHTML = alerts.slice(0,2).map(alertMarkup).join('');
  $('#extra-alerts').innerHTML = alerts.slice(2).map(alertMarkup).join('');
  [...$('#years').children].forEach(button => {
    const year = Number(button.dataset.year);
    const step = yearState(year);
    button.dataset.state = step;
    button.setAttribute('aria-pressed', String(year === state.year));
    button.querySelector('span').textContent = step === 'ASSUMPTION_SCENARIO' ? (isStory()?'S1 저장 배정':submissionMode?'저장 배정·운영':'조건부 운영·재무') : labels[step];
    button.querySelector('small').textContent = annual(year) ? (isStory()?'계획 운영 ':'운영안 ') + annual(year).active + '개 · '+(submissionMode?'배송 경로 미연결':'경로 미연결') : '권역·경로 미연결';
  });
  const site = state.site;
  $('#site-badge').textContent = row?.sites[site?.id] ? (isStory()?'S1 계획 거점':'조건부 운영안') : site ? site.sourceStatus === 'PILOT' ? '파일럿 입력' : '거점 후보' : '미연결';
  $('#site-name').textContent = site ? site.gu + ' ' + site.dong + ' (' + site.id + ')' : '거점 후보 선택';
  $('#site-place').textContent = site ? (site.year ? site.year + '년부터 사용 가능 · ' : '') + (site.mapped ? '지도 좌표 연결' : '지도 좌표 미연결') : '지도 또는 후보 목록';
  $('#areas').disabled = !row;
  $('#map-areas').disabled = !row;
  $('#blocked-key').hidden = submissionMode || !row || !$('#areas').checked;
  if (!row) state.mapTab = 'network';
  renderMapTabs();
  renderDetail();
  paint();
}

const detailRow = (glyph,label,value) => '<div class="detail-row">' + icon(glyph) + '<span>' + label + '</span><strong>' + value + '</strong></div>';
function renderDetail() {
  const row = annual(), site = state.site, status = yearState(state.year);
  const siteRow = row?.sites[site?.id];
  if(isStory()){
    const body='<div class="detail-summary"><div class="orbit" style="--share:'+((siteRow?.share??0)*100)+'%"><div><small>기대 주문 비중</small><strong>'+pct(siteRow?.share)+'</strong></div></div><div>'+
      detailRow('box','일간 기대 주문',count(siteRow?.request))+detailRow('layers','배정 행정동',siteRow?format(siteRow.assignedDongs)+' 동':'—')+
      detailRow('pin','계획 거점 유형',clean(siteRow?.hubType??'미운영'))+detailRow('truck','배송 완료','미연결')+
      detailRow('clock','정시 성과','DES 미검증')+'</div></div><p class="note">S1 T1/T2 설계 추정 · 후보 거점 '+(site?.id??'미선택')+' · 배송 경로 미연결</p>'+
      '<section class="chart-box"><h3>선택 거점 기대 주문 추이</h3><p class="note">저장 연도 T2의 일간 기대 건수</p>'+
      (siteRow?chart('model_requests','detail',site.id):'<p class="empty">거점별 배정 미연결</p>')+'</section>';
    $('#detail').innerHTML='<div class="detail-content">'+body+'</div>';return;
  }
  const siteNote = siteRow ? '유형 ' + clean(siteRow.hubType || '미연결') + ' · 가정 기반 · 피커 ' + format(siteRow.picker) + '명 · 라이더 ' + format(siteRow.riders) + '명' :
      site?.year > state.year ? '해당 연도 사용 가능 전' : row && site ? '해당 연도 조건부 운영안 미포함' : labels[status];
  const body = '<div class="detail-summary"><div class="orbit" style="--share:' + (siteRow?.share ?? 0) * 100 + '%"><div><small>완료 점유율</small><strong>' + pct(siteRow?.share) + '</strong></div></div><div>' +
      detailRow('truck',submissionMode?'일간 배송 완료':'연간 완료량',count(siteRow?.completed)) + detailRow('clock','완료 건 중 정시',pct(siteRow?.ontime)) + detailRow('layers','처리능력','미연결') +
      detailRow('warn',submissionMode?'일간 미완료':'연간 미처리',count(siteRow?.unprocessed)) + detailRow('warn','배송 병목 위치','미연결') + '</div></div><p class="note">' + siteNote + '</p>' +
      '<section class="chart-box"><h3>선택 거점 완료량 추이</h3><p class="note">'+(submissionMode?'저장 운영 결과 · 일간 기대 건수':'조건부 423동 범위 · 연간 처리량')+'</p>' + (siteRow ? chart('model_completed', 'detail', site.id) : '<p class="empty">거점별 추이 미연결</p>') +
      '</section>';
  $('#detail').innerHTML = '<div class="detail-content">' + body + '</div>';
}

function evidence() {
  const result = current(), row = annual(), site = state.site, status = yearState(state.year);
  if(isStory()){
    const sources=result?.sources??[];
    openDialog('Story v1 · S1 설계 추정', '<p>선택 연도 '+state.year+'년 · T1 계획 '+(row?.active??'—')+'개 / 총 개설 계획 31개 / 후보 명부 '+state.data.sites.length+'개. T2는 427동 기록이며 배정과 미서비스를 구분합니다.</p>'+
      '<p>주문은 저장 설계의 일간 기대량입니다. 배송 완료·정시·실제 도로 경로는 미연결 또는 DES 미검증입니다. T3는 기존 C+ BM 재사용이며 S1 신규 배차 결과가 아닙니다. 공식 연간 전망은 BLOCKED_ANNUAL / null입니다.</p>'+
      '<p>재무 base NPV +68.9억 원, 자금 190.3억 원, 2031 EBITDA +54.5억 원. 시장 low는 NPV −236.6억 원, 자금 665.0억 원이며 certainty_pass=False입니다. 투자 확정이 아닙니다.</p>'+
      '<details class="source-files"><summary>ZIP 원본과 해시 범위</summary><p>'+clean(state.data.sourceLabel)+'</p><ul>'+sources.map(path=>'<li><code>'+clean(path)+'</code></li>').join('')+'</ul></details>');return;
  }
  const siteRow = row?.sites[site?.id];
  const fields = [
      ['데이터 상태',statusBadge(status)], ['원본 실행 ID',clean(result?.runId ?? '미연결')], ['시나리오 ID',clean(result?.scenario ?? '미연결')],
      ['모델 및 범위',clean(result?.model ?? (state.scenario === 'official' ? '② 공식 연간량 BLOCKED_ANNUAL / null' : '미연결'))],
      [submissionMode?'원본 해시':'독립 검산',result ? (submissionMode?Object.keys(state.data?.sourceFiles??{}).filter(key=>state.data.sourceFiles[key]).join(' · ')+' · 전체 해시 목록은 원본 파일 참조': 'PASS ' + result.validation.PASS + ' · FAIL ' + result.validation.FAIL + ' · BLOCKED ' + result.validation.BLOCKED) : '미연결'],
      ['결과 파일',result ? '<details class="source-files"><summary>원본 파일 ' + result.sources.length +
        '개 · 경로 보기</summary><ul>' + result.sources.map(path => '<li><code>' + clean(path) + '</code></li>').join('') +
        '</ul></details>' : '미연결'],
      ['조건부 적용 범위',row ? (submissionMode?'T2 427동 · 미서비스와 미연결 구분':'423동 · 이 실행의 원천 입력 차단 ' + row.blockedDongs + '동') : labels[status]],
      ['거점 모델 상태',siteRow ? clean(siteRow.instance + ' · ' + siteRow.resource) : '미연결'],
      ['경계 근거',clean(state.data?.geographySource ?? '미연결')],
      ['후보 근거',site ? clean(state.data.candidateRun + ' / candidate_quality_ledger.csv · ' + site.id + ' · ' + site.quality) : '후보 선택 시 확인']
    ];
  const trace = '/evidence?' + new URLSearchParams({kind:'operations',year:state.year,scenario:state.scenario,version:dataVersion,
    ...(result ? {run:result.runId,id:result.scenario} : {})});
  openDialog('데이터 현황', '<p><a href="' + clean(trace) + '">Evidence Center에서 이 지표 추적</a></p><dl class="evidence-list">' + fields.map(([key,value]) => '<div><dt>' + key + '</dt><dd>' + value + '</dd></div>').join('') + '</dl>');
}

function project(lon, lat) {
  return [lon * Math.cos(37.56 * Math.PI / 180), -lat];
}
async function prepareContext() {
  const read = async (url) => {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Map context unavailable');
    return (await response.json()).features;
  };
  const [adjacent, river] = await Promise.allSettled([
    read('/adjacent-boundaries.geojson'), read('/han-river.geojson')
  ]);
  const append = (path, coords, closed = false) => {
    coords.forEach(([lon,lat],i) => {
      const [x,y] = project(lon,lat);
      if (i) path.lineTo(x,y);
      else path.moveTo(x,y);
    });
    if (closed) path.closePath();
  };
  if (adjacent.status === 'fulfilled') {
    view.adjacent = new Path2D();
    for (const {geometry} of adjacent.value) {
      const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
      for (const polygon of polygons) for (const ring of polygon) append(view.adjacent,ring,true);
    }
  }
  if (river.status === 'fulfilled') {
    const line = river.value[0]?.geometry.coordinates ?? [];
    const middle = line.filter(([lon]) => lon >= 126.91 && lon <= 126.94);
    const anchor = middle[Math.floor(middle.length/2)];
    if (anchor) view.riverLabel = project(...anchor);
    view.river = new Path2D();
    for (const {geometry} of river.value) append(view.river,geometry.coordinates);
  }
  $('#context-source').hidden = !view.adjacent;
  document.querySelector('#river-source').hidden = !view.river;
  paint();
}
function prepareMap(geo) {
  const bounds = [Infinity,Infinity,-Infinity,-Infinity];
  const districtPoints = new Map();
  view.geometry = geo.features.map(feature => {
    const polygons = feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates;
    const path = new Path2D();
    const local = [Infinity,Infinity,-Infinity,-Infinity];
    for (const polygon of polygons) for (const ring of polygon) {
      ring.forEach(([lon,lat], i) => {
        const [x,y] = project(lon, lat);
        for (const box of [bounds,local]) {
          box[0] = Math.min(box[0], x); box[1] = Math.min(box[1], y);
          box[2] = Math.max(box[2], x); box[3] = Math.max(box[3], y);
        }
        if (i === 0) path.moveTo(x,y);
        else path.lineTo(x,y);
      });
      path.closePath();
    }
    const { gu, adm_cd2 } = feature.properties;
    const samples = districtPoints.get(gu) ?? [];
    samples.push([(local[0]+local[2])/2, (local[1]+local[3])/2]);
    districtPoints.set(gu, samples);
    return { path, gu, code:adm_cd2, name:feature.properties.dong, center:[(local[0]+local[2])/2,(local[1]+local[3])/2] };
  });
  view.bounds = bounds;
  view.silhouette = new Path2D();
  for (const {path} of view.geometry) view.silhouette.addPath(path);
  view.districts = [...districtPoints].map(([gu,points]) => [
    gu, ...[0,1].map(axis => points.reduce((sum, point) => sum + point[axis], 0) / points.length)
  ]);
}

function paint() {
  const { width, height } = mapCanvas.getBoundingClientRect();
  const dpr = devicePixelRatio || 1;
  const w = Math.round(width*dpr), h = Math.round(height*dpr);
  if (mapCanvas.width !== w || mapCanvas.height !== h) { mapCanvas.width = w; mapCanvas.height = h; }
  if (!width || !height) return;
  ctx.setTransform(dpr,0,0,dpr,0,0);
  const background = ctx.createRadialGradient(width*.48,height*.49,25,width*.48,height*.49,Math.max(width*.48,height*.72));
  background.addColorStop(0,'#193D49');
  background.addColorStop(.48,'#112733');
  background.addColorStop(1,'#08141e');
  ctx.fillStyle = background; ctx.fillRect(0,0,width,height);
  ctx.strokeStyle = '#7198A312'; ctx.lineWidth = 1; ctx.beginPath();
  for (let x = 0; x < width; x += 36) { ctx.moveTo(x,0); ctx.lineTo(x,height); }
  for (let y = 0; y < height; y += 36) { ctx.moveTo(0,y); ctx.lineTo(width,y); }
  ctx.stroke();
  view.hits = [];
  if (!view.bounds) return;
  const [left,top,right,bottom] = view.bounds;
  const topInset = 14;
  const rightInset = $('.legend').offsetWidth + 18;
  const inset = 12;
  const fitWidth = Math.max(1,width - inset - rightInset);
  const fitHeight = Math.max(1,height - topInset - inset);
  const scale = Math.min(fitWidth/(right-left),fitHeight/(bottom-top)) * view.zoom;
  const [focusX,focusY] = view.focus ?? [(left+right)/2,(top+bottom)/2];
  const ox = inset + fitWidth/2 + view.dx - focusX * scale;
  const oy = topInset + fitHeight/2 + view.dy - focusY * scale;
  const cityX = (left+right)/2 * scale + ox, cityY = (top+bottom)/2 * scale + oy;
  const occupied = [{x:cityX,y:cityY,w:65,h:25}];
  const active = (site) => Boolean(annual()?.sites[site.id]);
  const showCandidates = $('#markers').checked && state.mapTab === 'network';
  const district = $('#district').value;
  const selectedLayer = $('#selected-layer').checked;
  const isSelected = site => selectedLayer && state.site === site;
  const sites = state.data.sites.filter(site => site.mapped && (isSelected(site) || active(site) ||
    (showCandidates && (!district || site.gu === district) && (!site.year || site.year <= state.year))));
  for (const site of sites) {
    const [x,y] = project(site.lon,site.lat);
    const radius = isSelected(site) ? 15 : active(site) ? 7 : 4;
    occupied.push({x:x*scale+ox,y:y*scale+oy,w:radius,h:radius});
  }
  const showBoundary = $('#boundaries').checked;
  const row = annual(), showAreas = row && $('#areas').checked;
  if (showBoundary && view.adjacent) {
    ctx.save();
    ctx.translate(ox,oy); ctx.scale(scale,scale);
    const radius = Math.hypot(right-left,bottom-top)/2;
    const fade = ctx.createRadialGradient((left+right)/2,(top+bottom)/2,radius*.49,
      (left+right)/2,(top+bottom)/2,radius*1.21);
    fade.addColorStop(0,'#718d984b');
    fade.addColorStop(.64,'#718d9823');
    fade.addColorStop(1,'#6898a000');
    ctx.strokeStyle = fade;
    ctx.lineWidth = .85/scale;
    ctx.stroke(view.adjacent);
    ctx.restore();
  }
  if (showBoundary || showAreas) {
    const palette = ['#23364d','#23505a','#28465c','#333a55','#263b53','#24414b','#2c4158','#254b56'];
    ctx.save();
    ctx.translate(ox,oy); ctx.scale(scale,scale);
    // Paint the perimeter under the polygons so neighboring fills hide interior halos.
    if (showBoundary) {
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#647d9210';
      ctx.lineWidth = 8 / scale;
      ctx.stroke(view.silhouette);
      ctx.strokeStyle = '#7894a565';
      ctx.lineWidth = 2.6 / scale;
      ctx.stroke(view.silhouette);
    }
    for (const {path,gu,code} of view.geometry) {
      const assignment = showAreas ? row.dongs[code] : null;
      const group = assignment?.site ?? gu;
      const shade = [...group].reduce((sum,char) => sum * 31 + char.charCodeAt(0),0) % palette.length;
      const selected = (selectedLayer && state.site?.code === code) || view.dong === code;
      const selectedArea = selectedLayer && assignment?.site && assignment.site === state.site?.id;
      ctx.fillStyle = assignment?.blocked ? '#664333' : selected || selectedArea ? '#326863' :
        showAreas ? assignment?.site ? palette[shade] : '#182B38' : '#203746';
      ctx.fill(path,'evenodd');
      if (showBoundary) {
        ctx.strokeStyle = selected ? '#87EAD1' : '#496677';
        ctx.lineWidth = (selected ? 1.5 : .65)/scale; ctx.stroke(path);
      }
    }
    if (showBoundary && view.river) {
      ctx.save();
      ctx.clip(view.silhouette);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#46c8ce19';
      ctx.lineWidth = 8/scale;
      ctx.stroke(view.river);
      ctx.strokeStyle = '#77e5e9de';
      ctx.lineWidth = 3/scale;
      ctx.stroke(view.river);
      ctx.restore();
    }
    ctx.restore();
    if (showBoundary && view.riverLabel) {
      const [rx,ry] = view.riverLabel;
      const x = rx*scale+ox, y = ry*scale+oy;
      ctx.font = '700 13px Segoe UI, Malgun Gothic';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 4; ctx.strokeStyle = '#0a222c'; ctx.fillStyle = '#a4f0f2';
      ctx.strokeText('한강',x,y-9); ctx.fillText('한강',x,y-9);
      occupied.push({x,y:y-9,w:17,h:8});
    }
    ctx.font = '600 13px Segoe UI, Malgun Gothic'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 3; ctx.strokeStyle = '#131c2f'; ctx.fillStyle = '#e7eef9';
    for (const [gu,x,y] of view.districts) {
      const gx = x*scale+ox, gy = y*scale+oy, w = ctx.measureText(gu).width/2+3;
      const labelY = [0,-14,14,-25,25].map(offset => gy+offset).find(candidate =>
        gx-w >= inset && gx+w <= width-rightInset && candidate-8 >= topInset && candidate+8 <= height-inset &&
        occupied.every(box => Math.abs(box.x-gx) >= box.w+w || Math.abs(box.y-candidate) >= box.h+8));
      if (labelY === undefined) continue;
      occupied.push({x:gx,y:labelY,w,h:8});
      ctx.strokeText(gu,gx,labelY); ctx.fillText(gu,gx,labelY);
    }
    ctx.font = '700 24px Segoe UI, Malgun Gothic';
    ctx.strokeText('서울특별시',cityX,cityY);
    ctx.fillText('서울특별시',cityX,cityY);
    ctx.font = '13px Segoe UI'; ctx.fillStyle = '#a0b3ce'; ctx.fillText('Seoul',cityX,cityY+20);
  }
  sites.sort((a,b) => (Number(active(a)) + 2 * Number(isSelected(a))) - (Number(active(b)) + 2 * Number(isSelected(b))));
  for (const site of sites) {
    const selected = isSelected(site), operating = active(site);
    const [px,py] = project(site.lon,site.lat);
    const x = px*scale+ox, y = py*scale+oy, radius = selected ? 13 : operating ? 6 : 3.6;
    if (selected || operating) {
      ctx.beginPath(); ctx.arc(x,y,radius+3,0,Math.PI*2);
      ctx.fillStyle = '#08151ed6'; ctx.fill();
      ctx.strokeStyle = selected ? '#5BE4C196' : '#BCA7FF70';
      ctx.lineWidth = 1; ctx.stroke();
    }
    ctx.beginPath(); ctx.arc(x,y,radius,0,Math.PI*2);
    ctx.shadowBlur = selected ? 9 : 0; ctx.shadowColor = '#5BE4C1';
    ctx.fillStyle = selected ? '#5BE4C1' : operating ? '#8A75CF' : '#51C5E1'; ctx.fill(); ctx.shadowBlur = 0;
    ctx.lineWidth = selected ? 1.7 : 1; ctx.strokeStyle = selected || operating ? (selected ? '#D7FFF2' : '#C6B7FA') : '#A0E6F3'; ctx.stroke();
    if (selected) {
      ctx.beginPath(); ctx.moveTo(x,y-5);ctx.lineTo(x+5,y-2);ctx.lineTo(x+5,y+3);
      ctx.lineTo(x,y+6);ctx.lineTo(x-5,y+3);ctx.lineTo(x-5,y-2);ctx.closePath();ctx.stroke();
    }
    view.hits.push({site,x,y,radius});
  }
}

function setDetailOpen(open) {
  const panel = $('#hub-panel');
  if (panel.hidden === !open) return;
  panel.hidden = !open;
  $('.workspace').classList.toggle('detail-collapsed', !open);
  const button = $('#toggle-detail');
  button.setAttribute('aria-expanded', String(open));
  button.textContent = open ? '거점 상세 접기' : '거점 상세 펼치기';
  paint();
}

function chooseYear(year) {
  if (!years.includes(year)) return;
  state.year = year;
  $('#announcement').textContent = year + '년 ' + labels[yearState(year)];
  render();
}
function selectSite(site, locate = false) {
  state.site = site;
  view.dong = null;
  if (locate && site.mapped) focusMap(project(site.lon,site.lat));
  setDetailOpen(true);
  $('#announcement').textContent = site.gu + ' ' + site.dong + ' ' + site.id + ' 선택';
  render();
}
function openDialog(title, body) {
  $('#dialog-title').textContent = title;
  $('#dialog-body').innerHTML = body;
  if (!$('#dialog').open) $('#dialog').showModal();
}
function searchSites() {
  openDialog('거점 후보 탐색','<input type="search" class="search" aria-label="거점 검색" placeholder="자치구, 행정동, 후보 ID"><div class="candidate-list"></div>');
  const search = $('.search'), list = $('.candidate-list');
  const update = () => {
    const value = search.value.trim().toLowerCase();
    const matches = (state.data?.sites ?? []).filter(site => [site.id,site.gu,site.dong].join(' ').toLowerCase().includes(value));
    list.innerHTML = matches.map(site => '<button data-site="' + clean(site.id) + '"><span><b>' + clean(site.id) + '</b> ' +
      clean(site.gu + ' ' + site.dong) + '</span><small>' + (site.mapped ? (site.year ?? '연도 미연결') : '지도 미연결') + '</small></button>').join('') ||
      '<p class="empty">' + (state.data?.sites.length ? '검색 결과 없음' : '거점 후보 미연결') + '</p>';
  };
  search.oninput = update;
  list.onclick = (event) => {
    const id = event.target.closest('[data-site]')?.dataset.site;
    const site = state.data?.sites.find(item => item.id === id);
    if (site) { $('#dialog').close(); selectSite(site,true); }
  };
  update(); search.focus();
}
function setToolsOpen(open) {
  $('#operations-tools').hidden = !open;
  $('.workspace').classList.toggle('tools-collapsed', !open);
  const button = $('#toggle-tools');
  button.setAttribute('aria-expanded', String(open));
  button.textContent = open ? '운영 도구 접기' : '운영 도구 펼치기';
  paint();
}
$('#toggle-tools').onclick = () => setToolsOpen($('#operations-tools').hidden);

function focusMap(point) {
  Object.assign(view,{focus:point,zoom:2,dx:0,dy:0});
}
function searchDongs() {
  openDialog('행정동 검색','<input type="search" class="search" aria-label="행정동 또는 자치구 검색"><div class="candidate-list"></div>');
  const input = $('.search'), list = $('.candidate-list');
  const update = () => {
    const term = input.value.trim().toLowerCase();
    const matches = view.geometry.filter(({gu,name,code}) => [gu,name,code].join(' ').toLowerCase().includes(term));
    list.innerHTML = matches.map(({gu,name,code}) => '<button data-dong="' + clean(code) + '">' +
      clean(gu + ' ' + name) + '<small>' + clean(code) + '</small></button>').join('') ||
      '<p class="empty">' + (view.geometry.length ? '검색 결과 없음' : '행정동 경계 미연결') + '</p>';
  };
  input.oninput = update;
  list.onclick = event => {
    const code = event.target.closest('[data-dong]')?.dataset.dong;
    const dong = view.geometry.find(item => item.code === code);
    if (!dong) return;
    view.dong = code;
    focusMap(dong.center);
    $('#boundaries').checked = true;
    $('#dialog').close();
    $('#announcement').textContent = dong.gu + ' ' + dong.name + ' 지도 위치로 이동';
    paint();
  };
  update();
  input.focus();
}

function zoom(factor) {
  view.zoom = Math.max(.7, Math.min(4, view.zoom * factor));
  paint();
}
function renderMapTabs() {
  for (const name of ['network','areas']) {
    const button = $('#map-' + name), active = name === state.mapTab;
    button.classList.toggle('active',active);
    button.setAttribute('aria-current',active ? 'true' : 'false');
  }
}
$('#map-network').onclick = () => { state.mapTab = 'network'; renderMapTabs(); paint(); };
$('#map-areas').onclick = () => { state.mapTab = 'areas'; $('#areas').checked = true; render(); };
renderProcessNav($('.sidebar'));
document.querySelectorAll('[data-icon]').forEach(element => element.innerHTML = icon(element.dataset.icon));
  $('#year').innerHTML = years.map(year => '<option>' + year + '</option>').join('');
  $('#years').innerHTML = years.map(year => '<button class="year-stop" data-year="' + year + '"><strong>' + year + '</strong><span></span><small></small></button>').join('');
$('#year').onchange = (event) => chooseYear(Number(event.target.value));
$('#years').onclick = (event) => chooseYear(Number(event.target.closest('[data-year]')?.dataset.year));
$('#scenario').onchange = (event) => { state.scenario = event.target.value; render(); };
$('#toggle-detail').onclick = () => setDetailOpen($('#hub-panel').hidden);
document.body.addEventListener('click', (event) => {
  const action = event.target.closest('[data-action]')?.dataset.action;
  if (action === 'home') { setDetailOpen(true); chooseYear(submissionMode?2031:2032); }
  if (action === 'finance') location.assign('/investment');
  if (action === 'map') location.assign('/network');
  if (action === 'compare') location.assign('/scenario');
  if (action === 'dongs') searchDongs();
  if (action === 'reports') location.assign('/decision');
  if (action === 'evidence') location.assign('/evidence');
  if (action === 'sites') searchSites();
});
$('#run').onclick = $('#status').onclick = evidence;
const requestedPanel = new URLSearchParams(location.search).get('panel');
if (requestedPanel === 'finance') location.replace('/investment');
if (requestedPanel === 'evidence') location.replace('/evidence');
if (requestedPanel === 'compare') location.replace('/scenario');
if (requestedPanel === 'reports') location.replace('/decision');

$('#find-site').onclick = searchSites;
$('#alerts-button').onclick = () => { setToolsOpen(true); $('#alerts').focus(); };
$('#help').onclick = () => openDialog('데이터 상태 안내','<dl class="evidence-list">' + Object.entries(labels)
  .map(([key,value]) => '<div><dt>' + key + '</dt><dd>' + value + '</dd></div>').join('') + '</dl>');
$('#plus').onclick = () => zoom(1.25);
$('#minus').onclick = () => zoom(.8);
$('#reset').onclick = () => { Object.assign(view,{zoom:1,dx:0,dy:0,focus:null,dong:null}); paint(); };
$('#boundaries').onchange = $('#markers').onchange = $('#selected-layer').onchange = $('#district').onchange = paint;
$('#areas').onchange = render;
new ResizeObserver(paint).observe(mapCanvas);
let drag;
const position = (event) => {
  const rect = mapCanvas.getBoundingClientRect();
  return [event.clientX-rect.left,event.clientY-rect.top];
};
function hit(x,y) {
  return view.hits.reduce((best,item) => {
    const distance = Math.hypot(x-item.x,y-item.y);
    return distance <= item.radius+4 && distance <= (best?.distance ?? Infinity) ? {...item,distance} : best;
  },null);
}
mapCanvas.onpointerdown = (event) => {
  if (event.button !== 0) return;
  const [x,y] = position(event);
  drag = {x,y,dx:view.dx,dy:view.dy,moved:false};
  mapCanvas.setPointerCapture(event.pointerId);
};
mapCanvas.onpointermove = (event) => {
  const [x,y] = position(event), tooltip = $('#map-tooltip');
  if (drag) {
    if (Math.hypot(x-drag.x,y-drag.y) > 4) drag.moved = true;
    if (drag.moved) { view.dx = drag.dx+x-drag.x; view.dy = drag.dy+y-drag.y; paint(); }
    tooltip.hidden = true;
    return;
  }
  const marker = hit(x,y);
  mapCanvas.style.cursor = marker ? 'pointer' : '';
  tooltip.hidden = !marker;
  if (marker) {
    tooltip.textContent = marker.site.id + ' · ' + marker.site.dong;
    tooltip.style.left = Math.min(x+11,mapCanvas.clientWidth-145) + 'px';
    tooltip.style.top = Math.max(y-31,0) + 'px';
  }
};
mapCanvas.onpointerup = (event) => {
  if (drag && !drag.moved) {
    const marker = hit(...position(event));
    if (marker) selectSite(marker.site);
  }
  drag = null;
};
mapCanvas.onpointercancel = () => drag = null;
mapCanvas.onpointerleave = () => $('#map-tooltip').hidden = true;
mapCanvas.addEventListener('wheel', (event) => { event.preventDefault(); zoom(event.deltaY < 0 ? 1.15 : 1/1.15); }, {passive:false});

async function load() {
  try {
    const response = await fetch(versionUrl('/api/dashboard'));
    if (!response.ok) throw new Error('HTTP ' + response.status);
    state.data = await response.json();
    if(storyActive(dataVersion)){
      state.data=storyDashboard(state.data,await loadStory());
      const option=document.querySelector('#data-version option[value="cplus"]');
      if(option)option.textContent='C+ 참조 · S1 표시';
      const areaLabel=$('#areas')?.parentElement?.lastChild;if(areaLabel?.nodeType===Node.TEXT_NODE)areaLabel.textContent=' S1 설계 권역';
      const legend=document.querySelector('.legend .dot.scenario')?.parentElement;
      if(legend?.lastChild?.nodeType===Node.TEXT_NODE)legend.lastChild.textContent=' S1 계획 거점';
    }
    if (submissionMode) {
      years = state.data.years;
      state.year = 2031;
      $('#years').dataset.submission = 'true';
      $('#year').innerHTML = years.map(year => '<option>' + year + '</option>').join('');
      $('#years').innerHTML = years.map(year => '<button class="year-stop" data-year="' + year + '"><strong>' + year + '</strong><span></span><small></small></button>').join('');
    }
    prepareMap(state.data.geo);
    void prepareContext();
    for (const [gu] of view.districts) $('#district').append(new Option(gu,gu));
    $('#map-source').textContent = 'SGIS · 2026.10 · 427동';
    $('#map-error').hidden = true;
  } catch {
    state.data = null;
    view.bounds = null;
    $('#map-error').textContent = '서울 경계 또는 기준 명부를 불러올 수 없습니다.';
  }
  render();

}
load();



