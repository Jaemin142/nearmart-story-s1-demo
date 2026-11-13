const $=s=>document.querySelector(s);
const data=await fetch('/simulation-view/data.json').then(r=>{if(!r.ok)throw Error('저장 결과 화면 자료를 읽지 못했습니다');return r.json()});
const years=[2027,2028,2029,2030,2031];
const weatherName={clear:'맑음',rain:'우천',heavy_rain:'강한 비'};
const dayName={weekday:'평일',weekend:'주말'};
const scenarioName={base:'BASE',low:'LOW',high:'HIGH'};
const metrics={
  delivered:{title:'일간 배송 완료 기대량',field:'delivered_daily',unit:'건/일',source:'연간 운영 모형'},
  late:{title:'60분 초과율',field:'late_rate',unit:'%',source:'연간 운영 모형'},
  unfulfilled:{title:'일간 미완료 기대량',field:'unfulfilled_daily',unit:'건/일',source:'연간 운영 모형'},
  failed:{title:'대표 자원 실패 횟수',field:'resource_failed_runs',unit:'회 / 120회',source:'실패 점검 원장'}
};
const num=(v,d=1)=>Number(v).toLocaleString('ko-KR',{maximumFractionDigits:d,minimumFractionDigits:d});
const count=v=>Number(v).toLocaleString('ko-KR',{maximumFractionDigits:0});
const percent=v=>num(Number(v)*100,2)+'%';
const won=v=>num(Number(v)/1e8,1)+'억 원';
const pass=v=>v==='True'?'통과':v==='False'?'미충족':'미연결';
const truth=v=>v==='True';
const pairs=rows=>rows.map(([key,value,bad])=>`<dt>${key}</dt><dd${bad?' class="bad"':''}>${value}</dd>`).join('');
const state={scenario:'base',year:2031,metric:'delivered',weather:'clear',dayType:'weekday',replicate:'0',failureType:'resource'};
$('#year').replaceChildren(...years.map(year=>new Option(year+'년',String(year))));
for(const [id,key] of [['scenario','scenario'],['year','year'],['metric','metric'],['weather','weather'],['day-type','dayType']]){
  $("#"+id).value=String(state[key]);
  $("#"+id).onchange=e=>{state[key]=key==='year'?Number(e.target.value):e.target.value;state.replicate='0';render()};
}
$('#replicate').onchange=e=>{state.replicate=e.target.value;render()};
$('#failure-type').onchange=e=>{state.failureType=e.target.value;render()};
const current=(table)=>table.find(row=>row.scenario===state.scenario&&Number(row.year)===state.year);
const currentCells=()=>data.cells.filter(row=>row.scenario===state.scenario&&Number(row.year)===state.year);
const currentRuns=()=>data.runs.filter(row=>row.scenario===state.scenario&&Number(row.year)===state.year&&row.weather===state.weather&&row.day_type===state.dayType);
const isFailure=run=>state.failureType==='resource'?run.resource_pass==='False':state.failureType==='operational'?run.operational_pass==='False':Number(run.undispatched)>0;
const failureRuns=()=>data.runs.filter(run=>run.scenario===state.scenario&&Number(run.year)===state.year&&isFailure(run));
const sameRun=(a,b)=>a.weather===b.weather&&a.day_type===b.day_type&&a.replicate===b.replicate;
function selectRun(run){state.weather=run.weather;state.dayType=run.day_type;state.replicate=run.replicate;$('#weather').value=state.weather;$('#day-type').value=state.dayType;render()}
$('#find-failure').onclick=()=>{const rows=failureRuns();if(!rows.length)return;const selected=currentRuns().find(run=>run.replicate===state.replicate),index=rows.findIndex(run=>sameRun(run,selected));selectRun(rows[(index+1)%rows.length]);const host=$('.main'),target=$('#failure-explorer');host.scrollTop+=target.getBoundingClientRect().top-host.getBoundingClientRect().top-70};
const fmtMetric=(value,key)=>key==='late'?num(Number(value)*100,3)+'%':key==='delivered'?num(value,1)+' 건/일':key==='unfulfilled'?num(value,3)+' 건/일':count(value)+'회';
function renderChart(){
  const metric=metrics[state.metric],rows=years.map(year=>({year,op:data.operations.find(r=>r.scenario===state.scenario&&Number(r.year)===year),failure:data.failures.find(r=>r.scenario===state.scenario&&Number(r.year)===year)}));
  const values=rows.map(({op,failure})=>Number(state.metric==='failed'?failure.resource_failed_runs:op[metric.field])*(state.metric==='late'?100:1));
  const max=Math.max(...values,1e-6)*1.18,svg=$('#operations-chart');svg.replaceChildren();
  const ns='http://www.w3.org/2000/svg',make=(tag,attrs={})=>{const el=document.createElementNS(ns,tag);for(const [k,v] of Object.entries(attrs))el.setAttribute(k,v);return el};
  const addText=(x,y,text,fill,size=11,anchor='middle')=>{const el=make('text',{x,y,fill,'font-size':size,'text-anchor':anchor});el.textContent=text;svg.append(el)};
  for(let tick=0;tick<=3;tick++){const y=188-tick*48;svg.append(make('line',{x1:56,y1:y,x2:935,y2:y,stroke:'#31505b','stroke-width':1}));addText(46,y+4,state.metric==='late'?num(max*tick/3,2)+'%':num(max*tick/3,max<1?2:0),'#83a6af',10,'end')}
  rows.forEach(({year},i)=>{
    const x=114+i*172,height=values[i]/max*142,y=188-height,selected=year===state.year;
    const bar=make('rect',{x,y,width:82,height:Math.max(height,2),rx:6,fill:selected?'#71e8cb':'#267a83',stroke:selected?'#c2ffea':'#4aaab1','stroke-width':selected?2:1,'data-year':String(year),tabindex:0,'aria-label':year+'년 '+metric.title+' '+fmtMetric(state.metric==='late'?values[i]/100:values[i],state.metric)});
    const select=()=>{state.year=year;$('#year').value=String(year);state.replicate='0';render()};bar.addEventListener('click',select);bar.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();select()}});svg.append(bar);
    addText(x+41,Math.max(y-9,16),fmtMetric(state.metric==='late'?values[i]/100:values[i],state.metric).replace(' 건/일','').replace('회',''),'#dffcf3',11);
    addText(x+41,210,String(year),selected?'#a6ffdd':'#a7c1c8',11);
    const op=rows[i].op;if(op.all_resource_pass==='False'){svg.append(make('circle',{cx:x+41,cy:225,r:3.5,fill:'#efac78'}));}
  });
  $('#chart-title').textContent=metric.title+' · 2027–2031';
  $('#chart-subtitle').textContent=scenarioName[state.scenario]+' · B84/P1 · 각 연도의 저장 결과. 막대를 눌러 연도 근거를 확인하세요.';
  $('#chart-source').textContent=metric.source+' · '+metric.unit;
  $('#chart-note').textContent='주황 점: 해당 연도 자원 제약 미충족 · 연속 구간의 값은 생성하지 않음';
}
function renderCells(){
  const cells=currentCells(),metric=state.metric,grid=$('#cell-grid');grid.replaceChildren();
  for(const cell of cells){
    const b=document.createElement('button');b.type='button';b.className='cell'+(cell.weather===state.weather&&cell.day_type===state.dayType?' active':'')+(cell.resource_pass==='False'||Number(cell.undelivered)>0?' failed':'');
    const strong=metric==='late'?percent(cell.p05_ontime):metric==='unfulfilled'?count(cell.undelivered)+'건':metric==='failed'?pass(cell.resource_pass):percent(cell.mean_ontime);
    const label=metric==='late'?'저장 p05 정시율':metric==='unfulfilled'?'셀 저장 미완료':metric==='failed'?'자원 제약':'평균 정시율';
    b.innerHTML=`<span class="cell-top"><span>${weatherName[cell.weather]} · ${dayName[cell.day_type]}</span><em>${cell.weather===state.weather&&cell.day_type===state.dayType?'선택':'20회'}</em></span><strong>${strong}</strong><small>${label}</small>`;
    b.onclick=()=>{state.weather=cell.weather;state.dayType=cell.day_type;state.replicate='0';$('#weather').value=state.weather;$('#day-type').value=state.dayType;render()};grid.append(b);
  }
  $('#validation-foot').textContent='셀 집계는 대표일 DES의 저장 결과입니다. 연간 운영 기대값이나 실제 배송 관측으로 환산하지 않습니다.';
}
function renderTrace(){
  const op=current(data.operations),failure=current(data.failures),cash=current(data.cashflow),cell=currentCells().find(r=>r.weather===state.weather&&r.day_type===state.dayType);
  const runs=currentRuns();$('#replicate').replaceChildren(...runs.map(r=>new Option('반복 '+(Number(r.replicate)+1)+' / 20 · seed '+r.seed,r.replicate)));
  if(!runs.some(r=>r.replicate===state.replicate))state.replicate=runs[0].replicate;
  $('#replicate').value=state.replicate;
  const run=runs.find(r=>r.replicate===state.replicate);
  $('#hero-key').textContent=scenarioName[state.scenario]+' / '+state.year+' / '+weatherName[state.weather]+' '+dayName[state.dayType];
  $('#trace-title').textContent=state.year+' · '+weatherName[state.weather]+' '+dayName[state.dayType];
  $('#trace-subtitle').textContent=scenarioName[state.scenario]+' · B84/P1 · 저장 검증 실행 '+(Number(run.replicate)+1)+'/20';
  $('#kpi-daily').textContent=num(op.daily,1)+'건';$('#kpi-delivered').textContent=num(op.delivered_daily,1)+'건';$('#kpi-late').textContent=percent(op.late_rate);
  $('#kpi-failed').textContent=count(failure.resource_failed_runs)+'회';$('#kpi-failed-denom').textContent='대표 검증 '+count(failure.replications)+'회 중';
  const t2=data.assignments.filter(r=>Number(r.year)===state.year),assigned=t2.filter(r=>r.site_id==='P1').length;
  $('#input-detail').innerHTML=pairs([['거점',data.plan.site_id+' · '+data.plan.hub_type+'형'],['운영 기간',data.plan.open_year+'–'+data.plan.close_year],['배차 정책',op.policy_key],['T2 배정 범위',t2.length?assigned+' / '+t2.length+'동':'해당 연도 미연결']]);
  $('#annual-detail').innerHTML=pairs([['수락 기대량',num(op.daily,3)+'건/일'],['배송 완료',num(op.delivered_daily,3)+'건/일'],['미완료',num(op.unfulfilled_daily,3)+'건/일',Number(op.unfulfilled_daily)>0],['자원 상태',pass(op.all_resource_pass),!truth(op.all_resource_pass)],['대표 95% 상태',pass(op.representative_95_pass),!truth(op.representative_95_pass)]]);
  $('#run-detail').innerHTML=pairs([['실행 키',run.phase+' · '+run.seed],['주문 / 배송',count(run.n_orders)+' / '+count(run.n_delivered)+'건'],['미배차',count(run.undispatched)+'건',Number(run.undispatched)>0],['정시율',percent(run.ontime_rate)],['평균 배송',num(run.mean_min,1)+'분'],['자원 / 운영',pass(run.resource_pass)+' / '+pass(run.operational_pass),!truth(run.resource_pass)||!truth(run.operational_pass)]]);
  $('#failure-detail').innerHTML=pairs([['저장 반복',count(failure.replications)+'회'],['자원 실패',count(failure.resource_failed_runs)+'회',Number(failure.resource_failed_runs)>0],['미완료 표본 주문',count(failure.unfulfilled_sample_orders)+'건',Number(failure.unfulfilled_sample_orders)>0],['일간 미완료 기대값',num(failure.expected_unfulfilled_daily,3)+'건/일']]);
  $('#cash-value').textContent=won(cash.net_cashflow);$('#cash-source').textContent='annual_cashflow_'+state.scenario+'.csv · '+state.year+'년';
  $('#finance-link-limit').textContent=state.scenario==='base'?'20년 재무 화면은 C+와 C의 BASE 저장 결과를 별도 파일로 비교합니다.':'20년 재무 화면은 BASE C+/C 조회입니다. 현재 '+scenarioName[state.scenario]+' 현금흐름은 이 화면의 저장 파일 조회로 확인하세요.';
  $('#evidence-limit').textContent='선택 실행은 저장된 대표일 검증 결과입니다. '+(cell.resource_pass==='False'?'해당 셀 자원 제약 미충족. ':'해당 셀 자원 통과. ')+ '연간 운영과 재무는 별도 저장 모형·파일의 값이며 개별 실행의 인과 효과가 아닙니다.';
  $('#source-list').innerHTML=[state.scenario==='base'?'annual_operations_base.csv':'market_annual_operations.csv',state.scenario==='base'?'annual_validation_runs.csv':'market_validation_runs.csv',state.scenario==='base'?'annual_cell_validation.csv':'market_cell_validation.csv','operational_failure_register.csv','annual_cashflow_'+state.scenario+'.csv'].map(name=>'<code>'+name+'</code>').join('');
}
function renderRunChart(){
  const runs=currentRuns(),svg=$('#run-chart');svg.replaceChildren();
  const metric=state.metric,value=run=>metric==='delivered'?Number(run.n_delivered):metric==='late'?100*(1-Number(run.ontime_rate)):metric==='unfulfilled'?Number(run.undispatched):run.resource_pass==='False'?1:0;
  const values=runs.map(value),max=Math.max(...values,1),ns='http://www.w3.org/2000/svg';
  const make=(tag,attrs)=>{const el=document.createElementNS(ns,tag);for(const [key,val] of Object.entries(attrs))el.setAttribute(key,val);return el};
  svg.append(make('line',{x1:15,y1:56,x2:885,y2:56,stroke:'#33545e'}));
  runs.forEach((run,i)=>{
    const selected=run.replicate===state.replicate,amount=values[i],height=Math.max(2,amount/max*42),x=21+i*43;
    const failed=run.resource_pass==='False'||run.operational_pass==='False';
    const bar=make('rect',{x,y:56-height,width:27,height,rx:3,fill:selected?'#76efd0':failed?'#d89a6e':'#337f87',stroke:selected&&failed?'#f2aa72':'none','stroke-width':2,'data-replicate':run.replicate,tabindex:0,'aria-label':`반복 ${i+1} · ${metric==='late'?num(amount,2)+'%':metric==='failed'?amount+'회':count(amount)+'건'} · ${failed?'저장 제약 미충족':'저장 제약 통과'}`});
    const select=()=>{state.replicate=run.replicate;$('#replicate').value=state.replicate;render()};bar.addEventListener('click',select);bar.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();select()}});svg.append(bar);
  });
  const selected=runs.find(run=>run.replicate===state.replicate);
  const label=metric==='delivered'?'배송 건수':metric==='late'?'60분 초과율':metric==='unfulfilled'?'미배차 건수':'자원 실패 표시';
  $('#run-chart-title').textContent=weatherName[state.weather]+' · '+dayName[state.dayType]+' 저장 실행 20건';
  $('#run-chart-caption').textContent=label+' · 선택 seed '+selected.seed+' · 연간 값과 별도';
  $('#chart-note').textContent='선택 실행 seed '+selected.seed+' · 연간 막대는 실행 선택으로 바뀌지 않음 · 주황 점: 연도 자원 제약 미충족';
}
function renderFailureExplorer(){
  const rows=failureRuns(),selected=currentRuns().find(run=>run.replicate===state.replicate),active=rows.find(run=>sameRun(run,selected)),denominator=current(data.failures).replications;
  const typeName={resource:'자원 제약 미충족',operational:'운영 제약 미충족',undispatched:'미배차 발생'}[state.failureType];
  $('#failure-count').textContent=`${scenarioName[state.scenario]} ${state.year}년 · ${typeName} ${rows.length} / ${denominator}회`;
  $('#find-failure').disabled=rows.length===0;
  $('#find-failure').textContent=rows.length?'다음 실패 실행 보기 ↗':'해당 연도 기록 없음';
  $('#failure-summary').textContent=`${typeName} · ${rows.length} / ${denominator}회`;
  const list=$('#failure-list');list.replaceChildren();
  for(const run of rows){const button=document.createElement('button');button.type='button';button.className='failure-run'+(active&&sameRun(run,active)?' active':'');button.textContent=`${weatherName[run.weather]} · ${dayName[run.day_type]} / 반복 ${Number(run.replicate)+1} / seed ${run.seed}`;button.onclick=()=>selectRun(run);list.append(button)}
  const host=$('#failure-comparison');
  if(!rows.length){host.innerHTML='<p class="failure-empty">선택한 조건·연도에는 이 기준의 저장 실패 실행이 없습니다. 다른 연도나 조건을 선택해 확인하세요.</p>';return;}
  if(!active){host.innerHTML='<p class="failure-empty">위 기록을 선택하면 같은 날씨·요일의 자원·운영 통과 실행 한 건과 원본 필드를 나란히 볼 수 있습니다.</p>';return;}
  const passRun=data.runs.find(run=>run.scenario===state.scenario&&Number(run.year)===state.year&&run.weather===active.weather&&run.day_type===active.day_type&&run.resource_pass==='True'&&run.operational_pass==='True'&&Number(run.undispatched)===0);
  if(!passRun){host.innerHTML='<p class="failure-empty">같은 날씨·요일의 저장된 자원·운영 통과 실행이 없어 나란히 표시할 수 없습니다.</p>';return;}
  const fields=[
    ['저장 실행 키',run=>run.phase+' · '+run.seed],
    ['주문 표본',run=>count(run.n_orders)+'건'],
    ['배송 완료',run=>count(run.n_delivered)+'건'],
    ['미배차',run=>count(run.undispatched)+'건'],
    ['60분 정시율',run=>percent(run.ontime_rate)],
    ['외부 배차',run=>count(run.external_dispatched)+'건'],
    ['베이 최대 점유 / 상한',run=>count(run.max_bay_occupancy)+' / '+count(run.bike_bays)],
    ['라이더 / 피커 상한',run=>count(run.max_riders)+' / '+count(run.max_pickers)],
    ['자원 제약',run=>pass(run.resource_pass)],
    ['운영 제약',run=>pass(run.operational_pass)]
  ];
  const table=document.createElement('table');table.className='failure-compare';
  const thead=document.createElement('thead'),headRow=document.createElement('tr');
  for(const name of ['저장 필드',`선택 실패 실행 · ${active.seed}`,`같은 셀 첫 통과 실행 · ${passRun.seed}`]){const th=document.createElement('th');th.textContent=name;headRow.append(th)}thead.append(headRow);table.append(thead);
  const tbody=document.createElement('tbody');for(const [name,format] of fields){const tr=document.createElement('tr');for(const value of [name,format(active),format(passRun)]){const td=document.createElement('td');td.textContent=value;tr.append(td)}tbody.append(tr)}table.append(tbody);
  host.replaceChildren(table);
  const note=document.createElement('p');note.className='failure-caveat';note.textContent='두 실행은 날씨·요일·연도·시나리오가 같지만 주문 표본과 seed가 다릅니다. 차이는 실패 원인이나 정책 효과의 증거가 아닙니다.';host.append(note);
}
function render(){renderChart();renderCells();renderTrace();renderRunChart();renderFailureExplorer()}
render();
