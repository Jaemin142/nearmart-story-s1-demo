import {navigation,stages,demoSteps,components,judgments,pageInfo} from './process-content.js';
import {renderProcessNav,startDemo,readSession,writeSession} from './process-nav.js';
import {mountDispatchScene} from './dispatch-3d.js';
import {dataVersion,submissionMode,versionUrl} from './version-client.js';
import {storyActive,loadStory} from './story-s1-adapter.js';

const $=selector=>document.querySelector(selector);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const path=location.pathname.slice(1);
const page=path==='report'?'decision':Object.hasOwn(pageInfo,path)?path:'overview';
if(page==='dispatch')document.body.classList.add('process-dispatch');
if(page==='demand')document.body.classList.add('process-demand');
if(page==='simulation')document.body.classList.add('process-simulation');
const params=new URLSearchParams(location.search);
const views={integration:['通','통합성','입력부터 최종안까지 연결'],components:['機','요소 기능','성과·제약·검증·계산시간'],judgment:['判','분석과 판단','진단·상충·위험·선택']};
let view=Object.hasOwn(views,params.get('view'))?params.get('view'):'integration';
let stage=0,section='method',dispatchView=params.get('dispatch')==='diagram'||dataVersion!=='cplus'?'diagram':'replay';
let submission=null,dispatchViewer=null,story=null;
const notesKey='nearmart-process-notes-v1';
const storedNotes=readSession(notesKey,{});
const notes=storedNotes&&typeof storedNotes==='object'&&!Array.isArray(storedNotes)?storedNotes:{};
const tag=(text='결과 연결 전')=>'<span class="process-tag warning">'+esc(text)+'</span>';
const link=(href,text)=>'<a class="process-link" href="'+esc(href)+'">'+esc(text)+' ↗</a>';
const empty=(title,detail)=>'<div class="process-empty"><strong>'+esc(title)+' · 미연결</strong><p>'+esc(detail)+'</p></div>';
renderProcessNav($('.process-nav'));
const [label,title,subtitle]=pageInfo[page];
document.title='NearMart | '+label;
$('#process-brand').textContent=label;
$('#process-title').textContent=title;
$('#process-subtitle').textContent=subtitle;
$('#process-eyebrow').textContent='NEARMART · '+label;
$('#demo-start').onclick=startDemo;
if(page==='dispatch')$('#demo-start').insertAdjacentHTML('beforebegin','<a class="process-preview-link" href="/dispatch-preview">C+ 3D 전체 화면 ↗</a>');
if(page==='demand'&&dataVersion==='cplus')$('#demo-start').insertAdjacentHTML('beforebegin','<a class="process-preview-link" href="/demand-view">C+ 수요 전체 화면 ↗</a>');
if(page==='simulation'&&dataVersion==='cplus')$('#demo-start').insertAdjacentHTML('beforebegin','<a class="process-preview-link" href="/simulation-view">C+ 시뮬레이션 전체 화면 ↗</a>');
$('#process-journey').innerHTML=demoSteps.map((s,i)=>'<li><a href="'+esc(s.href)+'" '+(new URL(s.href,location.origin).pathname===location.pathname?'aria-current="page"':'')+'><span>'+String(i+1).padStart(2,'0')+'</span><strong>'+esc(s.name)+'</strong></a></li>').join('');

function stageSelector(){return '<div class="process-stages">'+stages.map((s,i)=>'<button data-stage="'+i+'" aria-pressed="'+(stage===i)+'"><b>'+String(i+1).padStart(2,'0')+'</b><strong>'+s.name+'</strong><small>'+s.output+'</small></button>').join('')+'</div>';}
function stageDetail(){
 const s=stages[stage];
 return '<section class="process-stage-detail" id="process-stage-detail"><span class="process-eyebrow">STEP '+String(stage+1).padStart(2,'0')+' · '+s.name+'</span><h3>'+s.question+'</h3><p>'+s.method+'</p><dl class="process-io"><div><dt>입력</dt><dd>'+s.input+'</dd></div><div><dt>출력</dt><dd>'+s.output+'</dd></div><div><dt>검증할 것</dt><dd>'+s.check+'</dd></div></dl><div class="process-detail-bottom"><span>다음 단계로 · '+s.next+'</span>'+link(s.href,s.name+' 열기')+'</div></section>';
}
function integration(){return '<span class="process-eyebrow">END-TO-END</span><h2>한 단계의 결과가 다음 단계의 입력이 됩니다.</h2><p class="process-lead">단계를 눌러 문제, 방법, 입력·출력과 검증 항목을 확인하세요. 화면 연결은 분석의 유효성 판정과 별도입니다.</p><div class="process-section-title"><h3>문제풀이의 8단계</h3><span class="process-tag">단계 선택 → 풀이 확인 → 실제 화면</span></div>'+stageSelector()+stageDetail()+'<div class="process-feedback"><article><strong>시뮬레이션 → 설계</strong><p>제약·미처리·실패의 근거를 바탕으로 거점·권역·정책 변경을 검토합니다. 변경 전후의 기여 분리는 별도 검증합니다.</p></article><article><strong>시뮬레이션 → 재무 → What-if</strong><p>운영 결과를 비용·현금 가정으로 연결하고, 수요·충격·재계약 조건이 판단에 미치는 영향을 확인합니다.</p></article></div>';}
function overview(){return '<span class="process-eyebrow">THE PROBLEM</span><h2>서울 배송망의 서비스와 자금 제약을 함께 풀기</h2><p class="process-lead">누가, 언제, 어떤 근거로 판단하는지를 중심에 둡니다. 지도와 지표는 문제 발견의 도구이고, 대안의 선택·보류는 검증 범위와 제약을 확인한 뒤 설명합니다.</p><div class="process-intents"><article><small>운영 담당 · 현황 확인</small><h3>어디부터 살펴볼 것인가</h3><p>거점과 권역을 선택해 수요·완료·미처리와 데이터 경고를 확인합니다.</p></article><article><small>분석 담당 · 대안 검토</small><h3>무엇을 바꾸어 비교할 것인가</h3><p>설계·배차·시뮬레이션을 연결하고 같은 조건의 차이를 해석합니다.</p></article><article><small>의사결정자 · 선택과 보류</small><h3>어떤 조건에서 판단할 것인가</h3><p>20년 자금, 서비스 제약, 하방·재계약 위험과 미검증 항목을 검토합니다.</p></article></div><div class="process-section-title"><h3>풀이 순서와 단계별 산출물</h3><span class="process-tag">순방향 연결 + 검증 환류</span></div>'+stageSelector()+stageDetail();}
function checkCards(rows){return '<div class="process-checks">'+rows.map(([name,question,evidence,href])=>'<article class="process-check">'+tag(submissionMode&&submission?'근거 일부 연결':'판정 자료 연결 전')+'<h3>'+esc(name)+'</h3><p>'+esc(question)+'</p><dl><dt>확인할 근거</dt><dd>'+esc(evidence)+'</dd></dl>'+link(href,'해당 화면·근거 확인')+'</article>').join('')+'</div>';}
function guide(){return '<span class="process-eyebrow">HOW TO DEMONSTRATE</span><h2>질문에 답하는 순서로 시연하기</h2><p class="process-lead">운영 과제를 소개한 뒤 8개 풀이 단계를 따르는, 총 '+demoSteps.length+'개 정거장입니다. 시연 시작을 누르면 실제 화면으로 이동하며 접이식 가이드에서 핵심 질문, 보여줄 요소와 설명할 한계를 확인할 수 있습니다. 각 화면에서도 왼쪽 단계 메뉴로 자유롭게 이동할 수 있습니다.</p><div class="process-intents"><article><small>01 · 먼저 질문</small><h3>운영 문제를 보여줍니다</h3><p>관제에서 어디가 문제인지 짚고, 데이터 검증과 수요의 출발점을 설명합니다.</p></article><article><small>02 · 방법과 검증</small><h3>대안이 만들어진 이유</h3><p>네트워크·배차·시뮬레이션의 입력과 출력, 제약 및 실패를 따라갑니다.</p></article><article><small>03 · 판단과 한계</small><h3>왜 선택하거나 보류하는가</h3><p>재무·What-if로 상충 관계와 위험을 보고 최종 판단의 조건을 설명합니다.</p></article></div><div class="process-section-title"><h3>화면을 읽는 기준</h3><span class="process-tag">상태는 서로 다른 축입니다</span></div>'+checkCards([
 ['관측 · 모델 추정 · 가정 기반','값은 어디에서 왔나요?','관측 실적과 모형 기대 건수, 가정 기반 시나리오를 구분합니다.','/evidence'],
 ['검증 · 미검증','무엇까지 확인했나요?','원본 해시·산술 검산과 실제 운영·외부 검증을 구분합니다.','/evidence?tab=models'],
 ['미연결 · 계산 불가','값이 비어 있는 이유는 무엇인가요?','미연결 값은 0이 아닙니다. 입력 차단과 근거 미연결도 구분합니다.','/evidence?tab=quality'],
 ['공통 조건 · 비교 제한','같은 조건의 효과를 비교하나요?','기간·모집단·가정·회계 규칙이 다르면 비교 제한을 먼저 읽습니다.','/scenario']
 ]);}
const methods={
 demand:[['관측·모집단 확인','입력 품질과 파일럿 관측 범위를 확인하고 처리 정책을 분리합니다.'],['모형 효과와 오차','홀드아웃 오차·잔차와 후보 모형의 차이를 같은 평가 조건에서 확인합니다.'],['공간·시간 외삽 검토','지역별 오차와 관측 밖 구간의 불확실성을 별도로 검토합니다.'],['연간 가정 전달','램프업·달력·기상 등 가정과 차단 상태를 함께 설계 입력으로 넘깁니다.']],
 dispatch:[['비교 입력 고정','주문·거점·차량·인력·대표일 조건과 정책 버전을 맞춥니다.'],['정책과 효과 분리','원본 정책과 대안 정책의 완료·지연·비용을 같은 축으로 비교합니다.'],['제약을 별도 확인','60분, 트립 5건/35kg, 라이더·자원 상한의 위반 근거를 확인합니다.'],['실무 수용성 검토','입력 크기·실행 환경·소요시간을 함께 기록해 운용 가능성을 판단합니다.']],
 simulation:[['설계·정책 입력','거점·권역·배차·자원과 대표일 조건의 실행 키를 맞춥니다.'],['반복과 실패 확인','평균 성과만 보지 않고 반복 실행과 실패 시드, 자원 제약을 확인합니다.'],['예외 조건 검토','대량 주문·우천·피크 등 조건별 저장 근거와 미연결 항목을 구분합니다.'],['설계·재무 환류','설계 변경 근거와 비용·현금 연결을 추적하고 인과 분리의 한계를 밝힙니다.']]
};
const resultSlots={
 demand:[['모형 비교·홀드아웃','모형별 WAPE·MAE·평가 모집단·기간·버전과 불확실성'],['공간 수요·잔차','행정동별 관측·추정·잔차와 관측 밖 지역의 적용 제한']],
 dispatch:[['정책별 성과 비교','요청·완료·정시·지연·비용·공통 입력과 정책 버전'],['제약·계산시간','트립·중량·라이더 위반, 입력 크기·실행 환경·소요시간']],
 simulation:[['반복·실패·예외','대표일·반복 수·시드별 결과·실패 기록·예외 조건'],['설계·재무 환류','변경 전후 설계 키, 운영 결과와 비용·현금의 연결 근거']]
};
function dispatchContent(){const available=dataVersion==='cplus';return '<div class="dispatch-view-switch" aria-label="배차 3D 보기"><button data-dispatch-view="replay" aria-pressed="'+(dispatchView==='replay')+'" '+(available?'':'disabled title="C+ v1에서만 제공"')+'>저장 트립 3D 리플레이</button><button data-dispatch-view="diagram" aria-pressed="'+(dispatchView==='diagram')+'">기존 3D 도식</button><span>'+(available?'BM1 P1 · BM2 P2 · BM3 P1 · C+ 저장 결과':'선택 버전의 기존 저장 도식')+'</span></div>'+(available&&dispatchView==='replay'?'<iframe class="dispatch-replay-frame" src="/dispatch-preview?embed=1" title="C+ BM1 BM2 BM3 저장 배차 트립 3D 리플레이"></iframe>':dispatchScene())}
function demandContent(){return '<iframe class="demand-view-frame" src="/demand-view?embed=1" title="C+ v1 서울 수요 전망과 427개 행정동 저장 수요"></iframe>';}
function simulationContent(){return '<iframe class="simulation-view-frame" src="/simulation-view?embed=1" title="C+ v1 저장 운영 결과와 대표일 검증 실행"></iframe>';}
function methodPage(){
 const s=stages.find(s=>s.id===page);
 const source=page==='demand'?'/evidence?tab=models&item=demand':page==='dispatch'?'/evidence?tab=models&item=dispatch':'/scenario?pane=redesign';
 const sectionButtons=[['method','풀이 방법'],['results','결과·검증 항목'],['handoff','연결·한계']];
 if(page==='demand'&&section==='method'&&dataVersion==='cplus')return '<nav class="process-inline-tabs" aria-label="단계 상세">'+sectionButtons.map(([id,name])=>'<button data-section="'+id+'" aria-pressed="'+(section===id)+'">'+name+'</button>').join('')+'</nav><div id="process-method-content">'+demandContent()+'</div>';
 if(page==='simulation'&&section==='method'&&dataVersion==='cplus')return '<nav class="process-inline-tabs" aria-label="단계 상세">'+sectionButtons.map(([id,name])=>'<button data-section="'+id+'" aria-pressed="'+(section===id)+'">'+name+'</button>').join('')+'</nav><div id="process-method-content">'+simulationContent()+'</div>';
 if(page==='dispatch'&&section==='method'&&dispatchView==='replay'&&dataVersion==='cplus')return '<nav class="process-inline-tabs" aria-label="단계 상세">'+sectionButtons.map(([id,name])=>'<button data-section="'+id+'" aria-pressed="'+(section===id)+'">'+name+'</button>').join('')+'</nav>'+dispatchContent();
 let body='';
 if(section==='method')body=page==='dispatch'?dispatchContent():('<div class="process-methods">'+methods[page].map(([name,text],i)=>'<article><small>METHOD '+String(i+1).padStart(2,'0')+'</small><h3>'+name+'</h3><p>'+text+'</p></article>').join('')+'</div>'+(submissionMode&&submission?submissionResults(page):empty('이 단계의 결과 요약','결과값과 판정은 기존 실행·원본 근거를 연결한 뒤 표시합니다. 현재는 설명 구조를 먼저 구성했습니다.')));
 if(section==='results')body=submissionMode&&submission?submissionResults(page):resultSlots[page].map(([title,fields])=>empty(title,'연결할 항목: '+fields+'.')).join('')+'<p class="process-lead">같은 실행·모집단의 근거가 연결되면 이 영역에 비교와 검증 결과를 표시합니다. 데이터가 없는 상태에서 성과·위반·계산시간을 생성하지 않습니다.</p>';
 if(section==='handoff')body='<section class="process-stage-detail"><h3>다음 단계에 넘기는 것</h3><p>'+s.next+'</p><dl class="process-io"><div><dt>입력</dt><dd>'+s.input+'</dd></div><div><dt>출력</dt><dd>'+s.output+'</dd></div><div><dt>연결 확인</dt><dd>실행 ID · 파일 · 기간 · 모집단 · 가정 버전</dd></div></dl><div class="process-detail-bottom"><span>'+s.limit+'</span>'+link(source,'기존 저장 근거 확인')+'</div></section><div class="process-feedback"><article><strong>한 단계의 개선 ≠ 전체 개선</strong><p>설계·배차·운영 정책의 복합 변화는 항목별 인과 효과로 나누어 단정하지 않습니다.</p></article><article><strong>예외 처리도 검증 대상</strong><p>대량 주문·우천·피크의 기록이 없는 경우 해당 조건은 미연결로 남깁니다.</p></article></div>';
 return '<span class="process-eyebrow">'+s.name+' · SOLUTION APPROACH</span><h2>'+(submissionMode&&page==='dispatch'?'저장된 BM 배차 정책은 어떻게 움직였나?':s.question)+'</h2><p class="process-lead">'+s.method+'</p><div class="process-section-title"><span class="process-tag">'+(submissionMode?(submission?submission.version+' · 저장 결과 일부 연결':'저장 결과 불러오는 중'):'화면 구조 우선 · 신규 결과 연결 전')+'</span>'+link(source,'기존 저장 근거 확인')+'</div><nav class="process-inline-tabs" aria-label="단계 상세">'+sectionButtons.map(([id,name])=>'<button data-section="'+id+'" aria-pressed="'+(section===id)+'">'+name+'</button>').join('')+'</nav><div id="process-method-content">'+body+'</div>';
}
const n=value=>value==null||value===''?'미연결':Number(value).toLocaleString('ko-KR',{maximumFractionDigits:2});
const resultTable=(heads,rows)=>'<table class="process-data-table"><thead><tr>'+heads.map(x=>'<th>'+esc(x)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(row=>'<tr>'+row.map(x=>'<td>'+esc(x)+'</td>').join('')+'</tr>').join('')+'</tbody></table>';
function submissionResults(kind){
 const d=submission;
 if(kind==='demand')return '<div class="process-section-title"><h3>도시 수요 · 성숙 잠재량</h3><span class="process-tag">'+esc(d.version)+' · 모델 추정</span></div>'+
   '<p class="process-lead">'+esc(d.scope.demand)+' · 공식 연간 전망 BLOCKED_ANNUAL / null</p>'+
   resultTable(['연도','시나리오','성숙 잠재 접수/일','완료 수요 대용치/일'],d.demand.city.filter(row=>['base','BASE'].includes(row.scenario)&&[2027,2031,2036,2041,2046].includes(Number(row.year)))
    .map(row=>[row.year,row.scenario,n(row.mature_arrivals),n(row.mature_orders_mid)]))+
   '<p class="process-lead">행정동별 저장 수요 '+n(d.demand.map.length)+'행 · 홀드아웃 원본 잔차와 관측 밖 인과 효과는 이 화면에 미연결입니다.</p>';
 if(kind==='dispatch')return '<div class="process-section-title"><h3>BM 고정 표본 · 저장 정책</h3><span class="process-tag">T3 · '+n(d.scope.t3_rows)+'행</span></div>'+
   resultTable(['표본','정책','주문','배송','60분 정시','건당 비용'],d.benchmark.selected.map(row=>[row.instance,row.policy,row.n_orders,n(row.n_delivered),
      (100*Number(row.ontime_rate)).toFixed(2)+'%',n(row.cost_per_order)+'원']))+
   '<p class="process-lead">대표 트립의 3D 장면은 저장 T3 방문 순서를 직선 도식으로 재생합니다. 도로 경로·다른 정책의 동일 트립 결과와 임의 서울 동 배차는 미연결입니다.</p>';
 if(kind==='simulation'){
   const baseRows=d.id==='cplus'?d.simulation.failures.filter(row=>row.model===d.model&&row.scenario==='base'):[];
   const reps=baseRows.reduce((sum,row)=>sum+Number(row.replications||0),0);
   const failed=baseRows.reduce((sum,row)=>sum+Number(row.resource_failed_runs||0),0);
   const unfulfilled=baseRows.reduce((sum,row)=>sum+Number(row.unfulfilled_sample_orders||0),0);
   return '<div class="process-section-title"><h3>연간 운영 저장 결과</h3><span class="process-tag">'+esc(d.version)+' · 대표 검증</span></div>'+
   resultTable(['연도','일간 수락','일간 배송','일간 미완료','60분 정시','자원 통과'],d.simulation.operations.map(row=>[row.year,n(row.daily),n(row.delivered_daily),n(row.unfulfilled_daily),
      !row.late_rate?'미연결':(100*(1-Number(row.late_rate))).toFixed(2)+'%',!row.all_resource_pass?'미연결':row.all_resource_pass]))+
   (baseRows.length?'<details><summary>'+esc(d.model)+' BASE 대표 검증 · '+reps+'회 · 자원 실패 '+failed+'회 · 미완료 표본 주문 '+unfulfilled+'건</summary>'+
     resultTable(['연도','반복','자원 실패','미완료 표본 주문'],baseRows.map(row=>[row.year,row.replications,row.resource_failed_runs,row.unfulfilled_sample_orders]))+'</details>':
     '<p class="process-lead">선택 버전의 반복별 실패 원장 미연결.</p>')+
   '<p class="process-lead">표본 주문의 미완료 합계는 연간 실제 주문량이 아닙니다. 셀 검증 '+d.simulation.cells.length+'행은 별도 범위입니다.</p>';
 }
 return '';
}
function dispatchScene(){return `<div class="dispatch-demo" id="dispatch-demo">
 <div class="dispatch-context"><div><strong>한 번의 배차 결정</strong><span data-dispatch-scope>설명용 개념 장면 · 실제 BM 주문/경로 아님</span></div><div class="dispatch-focus"><span id="dispatch-source-controls"></span><label>보기 <select data-dispatch-mode aria-label="장면 보기 방식"><option value="compare">좌우 비교</option><option value="single">단일 장면</option></select></label><label data-dispatch-policy-wrap hidden>정책 <select data-dispatch-policy aria-label="단일 장면 정책"></select></label><label>관심 구역 <select data-dispatch-region aria-label="관심 구역 선택"></select></label><div data-dispatch-orders aria-label="관심 주문 선택"></div></div></div>
 <div class="dispatch-pair">
  <section class="dispatch-scene"><header><span class="dispatch-key cyan"></span><strong data-dispatch-policy-title>기준 정책 · BASELINE</strong><small data-dispatch-policy-desc>오래된 준비 주문부터 가까운 주문 묶기</small></header><div class="dispatch-canvas" data-dispatch-canvas><canvas aria-label="기준 정책의 회전 가능한 3D 개념 장면"></canvas><canvas class="dispatch-labels" aria-hidden="true"></canvas></div></section>
  <section class="dispatch-scene"><header><span class="dispatch-key violet"></span><strong data-dispatch-policy-title>개선 정책 · INSERTION</strong><small data-dispatch-policy-desc>후보 주문의 방문 순서 삽입 검토</small></header><div class="dispatch-canvas" data-dispatch-canvas><canvas aria-label="개선 정책의 회전 가능한 3D 개념 장면"></canvas><canvas class="dispatch-labels" aria-hidden="true"></canvas></div></section>
 </div>
 <div class="dispatch-controls"><button type="button" data-dispatch-play>▶ 재생</button><label class="dispatch-speed">속도 <select data-dispatch-speed aria-label="재생 속도"><option value="0.5">0.5×</option><option value="1" selected>1×</option><option value="2">2×</option></select></label><label>배차 단계 <input type="range" data-dispatch-progress min="0" max="100" value="100" aria-label="배차 단계 이동"></label><div class="dispatch-camera" aria-label="두 장면의 카메라"><button type="button" data-camera="left" aria-label="카메라 왼쪽 회전">↶</button><button type="button" data-camera="right" aria-label="카메라 오른쪽 회전">↷</button><button type="button" data-camera="in" aria-label="확대">＋</button><button type="button" data-camera="out" aria-label="축소">－</button><button type="button" data-camera="reset">시점 초기화</button></div></div>
 <p class="dispatch-unsupported" hidden>이 브라우저에서 WebGL을 사용할 수 없어 3D 장면을 표시하지 못했습니다.</p>
 <div class="dispatch-readout"><div><b>선택 범위</b><span data-dispatch-region-detail>전체 예시 구역</span></div><div><b>선택 주문</b><span data-dispatch-order-detail>주문 1</span></div><div><b>성과·제약</b><span>새 실행 결과 연결 전</span></div></div>
 <p class="dispatch-footnote">구역을 고르면 해당 주문이 강조되고, 방문 경로는 트립 전체를 유지합니다. 마우스로 장면을 끌면 두 카메라가 함께 회전합니다. 현재 점과 경로는 작동 원리 설명용입니다.</p>
 </div>`;}
function render(){
 $('#process-tabs').hidden=page!=='decision';
 if(page==='decision')$('#process-tabs').innerHTML=Object.entries(views).map(([id,[,name,desc]],i)=>'<button data-view="'+id+'" aria-pressed="'+(view===id)+'"><b>0'+(i+1)+'</b><span><strong>'+name+'</strong><small>'+desc+'</small></span></button>').join('');
 let body=page==='overview'?overview():page==='guide'?guide():page==='decision'?
  view==='integration'?integration():view==='components'?'<span class="process-eyebrow">FUNCTIONAL REVIEW</span><h2>성과와 제약, 검증과 계산시간을 함께 보기</h2><p class="process-lead">항목이 화면에 있다는 이유로 검증 통과를 표시하지 않습니다. 같은 조건의 근거와 검증 범위를 연결한 뒤 판정할 수 있습니다.</p>'+checkCards(components):
   '<span class="process-eyebrow">DECISION REVIEW</span><h2>선택 이유와 남은 위험을 함께 설명하기</h2><p class="process-lead">'+(story?'S1 base 개선과 시장 low의 하방 자금 위험을 함께 확인합니다. 투자 확정은 아닙니다.':submissionMode&&submission?'저장 C/C+ 결과의 성과·제약과 미검증 범위를 함께 확인합니다.':'현재 새 검토 화면에는 최종안 근거를 연결하지 않았습니다. 실제 대안의 성과와 제약은 기존 Scenario Lab·재무 화면에서 확인합니다.')+'</p>'+checkCards(judgments):methodPage();
 if(page==='decision'&&submissionMode&&(story||submission))body=decisionSummary()+body;
 if(page==='decision')body+='<section class="process-note"><label for="review-note">시연 메모 · 검토자의 설명</label><textarea id="review-note" maxlength="3000" placeholder="이 관점에서 설명할 내용과 추가 확인 조건을 정리하세요."></textarea><small id="review-note-status">이 브라우저 탭에서만 보관합니다. 공식 판정이나 원본 데이터에는 반영되지 않습니다.</small></section>';
 $('#process-work').innerHTML=body;
 if(page==='dispatch'&&section==='method'&&dispatchView==='diagram')mountDispatch();
 const note=$('#review-note');
 if(note){note.value=typeof notes[view]==='string'?notes[view]:'';note.oninput=()=>{notes[view]=note.value;$('#review-note-status').textContent=writeSession(notesKey,notes)?'이 탭에 시연 메모를 보관했습니다. 공식 판정이나 원본 데이터에는 반영되지 않습니다.':'브라우저 저장이 제한되어 이 메모를 보관하지 못했습니다.';};}
}
function decisionSummary(){
 if(story){
  const s=story.summary,l=story.low;
  return '<section class="process-decision-summary"><span class="process-eyebrow">Story v1 · S1 설계 추정</span><h2>base에서 수익성 개선 가능성, 하방 자금 위험은 남음</h2>'+
   '<p>base의 500억 자금 한도와 2031 EBITDA 흑자 목표는 설계 추정상 충족합니다. 시장 low에서는 자금 소요가 한도를 넘으며 certainty_pass=False입니다. 투자 확정 전 DES 운영과 계약 근거를 확인해야 합니다.</p>'+
   resultTable(['판단 지표','S1 base','시장 low'],[
    ['20년 NPV',n(s.npv_eok)+'억 원',n(l.npv_eok)+'억 원'],
    ['최대 자금 소요',n(s.peak_funding_eok)+'억 원',n(l.peak_funding_eok)+'억 원 · 500억 초과'],
    ['2031 EBITDA',n(s.ebitda_2031_eok)+'억 원',n(l.ebitda_2031_eok)+'억 원'],
    ['확실성 판정','certainty_pass=False','하방 위험 잔존']])+
   '<details><summary>원본·검증 범위 확인</summary><p>ZIP story_v1 / submission_S1/T1_network_plan.csv, T2_dong_assignment.csv, T4_kpi_summary.csv / 4_흑자확실성검증/annual_finance.csv, design_comparison.csv, robustness_S1_수익형.csv.</p><p>T2 427동 · 계획 개설 31곳 · 배송 완료·정시 DES 미검증. T3는 기존 C+ BM 재사용이며 S1 신규 배차 실행이 아닙니다. 공식 연간 전망 BLOCKED_ANNUAL / null.</p></details></section>';
 }
 const d=submission,m=d.main;
 return '<section class="process-decision-summary"><span class="process-eyebrow">'+esc(d.version)+' · 최종 판단</span><h2>투자안 미선정</h2><p>500억 자금 한도와 2031 EBITDA 흑자 목표가 모두 미충족입니다. 대표 운영 검증도 투자 실행을 뒷받침하지 못합니다.</p>'+resultTable(
   ['판단 지표','저장 결과','상태'],[
    ['20년 NPV',n(m.npv_krw/1e8)+'억 원','음수'],
    ['최대 자금 소요',n(m.peak_funding_krw/1e8)+'억 원','500억 한도 미충족'],
    ['2031 EBITDA',n(m.ebitda_2031/1e8)+'억 원','흑자 목표 미충족'],
    ['대표 운영 검증',m.operations_supported?'지원':'미지원','운영 제약 확인 필요']])+
   '<p>원본 · T4_kpi_summary.csv / annual_operations_base.csv / annual_cashflow_base.csv. C/C+ 차이는 수요 정의가 달라 정책 효과로 해석하지 않습니다.</p></section>';
}
$('#process-work').onclick=event=>{
 const target=event.target.closest('[data-stage],[data-section],[data-dispatch-view]');
 if(target?.hasAttribute('data-dispatch-view')){dispatchView=target.dataset.dispatchView;const url=new URL(location.href);url.searchParams.set('dispatch',dispatchView);history.replaceState(null,'',url);render();$('#process-work [data-dispatch-view="'+dispatchView+'"]').focus();return;}
 if(target?.hasAttribute('data-stage')){stage=Number(target.dataset.stage);render();$('#process-work [data-stage="'+stage+'"]').focus();}
 if(target?.hasAttribute('data-section')){section=target.dataset.section;render();$('#process-work [data-section="'+section+'"]').focus();}
};
$('#process-tabs').onclick=event=>{
 const next=event.target.closest('[data-view]')?.dataset.view;
 if(!Object.hasOwn(views,next))return;
 view=next;const url=new URL(location.href);url.searchParams.set('view',view);history.replaceState(null,'',url);render();$('#process-tabs [data-view="'+view+'"]').focus();
};
render();
function mountDispatch(){
 const root=$('#dispatch-demo');
 if(!submissionMode){dispatchViewer=mountDispatchScene(root);return;}
 if(!submission){root.querySelector('[data-dispatch-scope]').textContent='저장 T3 장면 불러오는 중';return;}
 const d=submission, scenes=d.benchmark.scenes, options=Object.keys(scenes);
 const start=options.find(key=>key.startsWith('BM1/'))??options[0];
 if(!start){root.querySelector('[data-dispatch-scope]').textContent='저장 T3 장면 미연결';return;}
 dispatchViewer=mountDispatchScene(root,scenes[start]);
 const controls=root.querySelector('#dispatch-source-controls');
 controls.innerHTML='<label>BM 표본 <select id="dispatch-bm" aria-label="BM 고정 표본"></select></label><label>저장 구역 <select id="dispatch-area" aria-label="저장 구역"></select></label>';
 const bm=controls.querySelector('#dispatch-bm'),area=controls.querySelector('#dispatch-area');
 const ids=[...new Set(options.map(key=>key.split('/')[0]))];
 bm.replaceChildren(...ids.map(id=>new Option(id,id)));
 bm.value=start.split('/')[0];
 function setAreas(preferred){
  const available=options.filter(key=>key.startsWith(bm.value+'/'));
  const names=new Map((d.benchmark.areas[bm.value]??[]).map(row=>[row.scene,row.name]));
  area.replaceChildren(...available.map(key=>new Option((names.get(key)??key.split('/')[1])+' · '+key.split('/')[1],key)));
  area.value=available.includes(preferred)?preferred:available[0];
  dispatchViewer.setData(scenes[area.value]);
  const result=d.benchmark.selected.find(row=>row.instance===bm.value);
  root.querySelector('.dispatch-readout div:last-child span').textContent=result?
    'BM 고정 표본 · 정시 '+(100*Number(result.ontime_rate)).toFixed(2)+'% · 건당 비용 '+n(result.cost_per_order)+'원':'성과 미연결';
 }
 bm.onchange=()=>setAreas();area.onchange=()=>setAreas(area.value);
 setAreas(start);
 root.querySelector('.dispatch-footnote').textContent='저장 T3 대표 트립의 주문 좌표와 방문 순서를 직선으로 도식화했습니다. 실제 도로 경로·미선택 정책의 동일 트립 방문 순서·임의 서울 동 배차는 미연결입니다. 회전·확대·재생·구역·주문 선택이 가능합니다.';
}
if(submissionMode){
 if(page==='decision'&&storyActive(dataVersion))loadStory().then(data=>{
  story=data;render();
  const chip=document.querySelector('.header-controls .chip');if(chip)chip.textContent='Story v1 · S1 설계 추정';
  const option=document.querySelector('#data-version option[value="cplus"]');if(option)option.textContent='C+ 참조 · S1 표시';
  const note=$('.process-journey-note');if(note)note.innerHTML='<strong>Story v1 · S1 설계 추정</strong><p>base 개선 가능성 · 시장 low 자금 위험 · 투자 미확정 · BLOCKED_ANNUAL / null</p>';
 }).catch(()=>{});
 fetch(versionUrl('/api/submission')).then(response=>{if(!response.ok)throw Error('snapshot');return response.json();})
  .then(data=>{submission=data;render();const chip=document.querySelector('.header-controls .chip');if(chip&&!story)chip.textContent=data.version+' · 저장 결과 일부 연결';
    if(page==='dispatch'){$('#process-title').textContent='저장 배차 정책과 대표 트립 살펴보기';$('#process-subtitle').textContent='BM 고정 표본의 방문 순서와 제약을 확인합니다. 같은 트립의 다른 정책 결과는 미연결입니다.';}
    const note=$('.process-journey-note');if(note&&!story)note.innerHTML='<strong>저장 근거와 한계를 함께 읽습니다.</strong><p>'+esc(data.version)+' · 투자 미선정 · 공식 연간 전망 차단.</p><a href="/evidence">데이터 현황·검증 센터 ↗</a>';})
  .catch(()=>{const chip=document.querySelector('.header-controls .chip');if(chip)chip.textContent='C/C+ 저장 결과 미연결';});
}
