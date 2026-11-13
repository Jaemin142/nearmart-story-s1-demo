import {renderProcessNav} from './process-nav.js';
import {dataVersion,submissionMode,versionUrl} from './version-client.js';
import {storyActive,loadStory,storyCase,storyFinance,storyId} from './story-s1-adapter.js';
const $ = selector => document.querySelector(selector);
const esc = value => String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const fmt = (value,digits=1) => value==null?'미연결':Number(value).toLocaleString('ko-KR',{maximumFractionDigits:digits});
const won = value => value==null?'미연결':fmt(value/1e8)+'억 원';
const signed = (a,b,display=won) => a==null||b==null?'—':(b>a?'+':'')+display(b-a);
const flag = value=>value==null?'미검증':value?'충족':'미충족';
const names = {N1:'N1 집중형',N2_ORIGINAL:'N2 원설계',N2_IMPROVED:'N2 개선형',N3:'N3 확장형'};
const shocks = {NONE:'무충격',W1:'W1 임금·공급',W2:'W2 경쟁 확대',RENEWAL_DENIAL:'재계약 거절'};
const baseId='N2_ORIGINAL__BASE__HYP_SLOW__NONE', compareId='N2_IMPROVED__BASE__HYP_SLOW__NONE';
const state={catalog:null,pair:null,story:null,year:'2032',chart:'cash',detail:'operating',site:'',serial:0,context:''};
const isStory=()=>state.pair?.items[0]?.id===storyId;
const label = item=>names[item.network]??item.network;
const description = item=>label(item)+' · '+item.market+' / '+item.ramp+' / '+(shocks[item.shock]??item.shock);
renderProcessNav($('.investment-nav'));
async function fetchJson(url){
 const response=await fetch(url);
 if(response.status===401){location.assign('/login');throw Error('session');}
 if(!response.ok) throw Error(url);
 return response.json();
}
const sum=(accounts,keys)=>accounts ? keys.reduce((total,key)=>total+(accounts[key]??0),0):null;
const accountNames={
 cogs:'매출원가',payment:'결제 수수료',packaging:'포장재',shrink:'재고 손실',ongoing_marketing:'상시 마케팅',
 customer_it:'고객·IT',late_coupon:'지연 쿠폰',external_quick:'외부 퀵',picker:'피커 인건비',employed_wage:'직고용 라이더 임금',
 employed_incentive:'직고용 배송 인센티브',employed_vehicle:'라이더 차량비',contract_pay:'위탁 라이더 지급',
 rent:'임대료',maintenance:'관리비',hub_staff:'고정 거점 인력',utilities:'공공요금',replenish:'보충 운송',
 hq:'본사비',launch_marketing:'개점 마케팅',restoration:'원상복구',goods_revenue:'상품 매출',delivery_fee:'배송비 매출',
 open_capex:'개점 설비 CAPEX',refresh_capex:'재투자 CAPEX',deposit_paid:'보증금 지급',deposit_recovered:'보증금 반환',
 inventory_increment:'재고 증가',inventory_release:'재고 감소',inventory_recovery:'종료 재고 회수'
};
const opGroups=[
 ['매출원가',['cogs']],['피커 인건비',['picker']],['라이더 임금·지급',['employed_wage','employed_incentive','contract_pay']],
 ['거점 운영',['rent','maintenance','hub_staff','utilities','restoration']],['배송·이동',['employed_vehicle','replenish','external_quick']],
 ['포장·지연 쿠폰',['packaging','late_coupon']],['기타·본사비',['payment','shrink','ongoing_marketing','customer_it','launch_marketing','hq']]
];
const laborPay=['picker','employed_wage','employed_incentive','contract_pay'];
const comparison=()=>{
 const p=state.pair;
 if(!p?.files.every(Boolean)) return {ok:false,note:'재무 자료 미연결 또는 검증 중'};
 if(p.items[0].id===p.items[1].id) return {ok:false,note:'동일 시나리오 선택'};
 const [a,b]=p.items;
 if(a.id===storyId||b.id===storyId)return {ok:false,note:'S1 설계와 C/C+ 저장 결과는 수요·거점·운영 조건이 달라 정책 효과 비교 불가 · 각 곡선 병렬 조회'};
 if(submissionMode&&a.version!==b.version)return {ok:false,note:'C/C+ 수요 정의와 운영 조건이 달라 효과 비교 불가 · 각 원본 현금흐름 병렬 조회'};
 const same=['market','ramp','weather','shock','assumption'].every(k=>a[k]===b[k]);
 const calendar=Object.keys(p.files[0].years).join()===Object.keys(p.files[1].years).join();
 return same&&calendar&&p.files[0].rule===p.files[1].rule ?
  {ok:true,note:'공통 기간·수요 입력·기상·충격·회계 규칙'} :
  {ok:false,note:'비교 제한 · 입력 가정, 충격 또는 회계 기간이 다릅니다. 차이는 표시하지 않습니다.'};
};
function table(headers,rows){
 return '<table class="inv-table"><thead><tr>'+headers.map(h=>'<th scope="col">'+esc(h)+'</th>').join('')+
  '</tr></thead><tbody>'+rows.map(row=>'<tr>'+row.map((v,i)=>i?'<td>'+esc(v)+'</td>':'<th scope="row">'+esc(v)+'</th>').join('')+'</tr>').join('')+'</tbody></table>';
}
function comparisonTable(rows,display=won){
 const ok=comparison().ok;
 return table(['항목','A · 분석 대안','B · 비교 대안','B−A'],rows.map(([title,a,b])=>
  [title,display(a),display(b),ok?signed(a,b,display):'—']));
}
const annualRows=()=>state.pair?.files.map(file=>file?.years[state.year])??[null,null];
function renderKPIs(){
 const [a]=state.pair?.items??[], [f]=state.pair?.files??[], [annual]=annualRows();
 const items=[
  ['20년 NPV · A',won(f?a.npv_krw:null),'2026년 말 0시점 · 할인율 12%'],
  [state.year+'년 총영업비용 · A',won(annual?.operating_expenses),isStory()?'S1 매출−EBITDA · 설계 추정':'손익 원장 · 매출원가 포함'],
  ['최대 자금 소요 · A',won(f?a.peak_funding_krw:null),'할인 전 누적 현금잔액 기준'],
  ['2031 EBITDA · A',won(f?a.ebitda_2031_krw:null),'전사 · 본사비 포함']
 ];
 $('#inv-kpis').innerHTML=items.map(([title,value,note])=>'<article class="panel inv-kpi"><small>'+esc(title)+
  '</small><strong>'+esc(value)+'</strong><span>'+esc(note)+'</span></article>').join('');
}
const color={mint:'#5be4c1',cyan:'#51c5e1',violet:'#9b7aff',amber:'#f1b25b',muted:'#6e8a9c'};
function renderChart(){
 const svg=$('#inv-svg');
 const [a,b]=state.pair?.files??[];
 const cap=(file,y,keys)=>file?.payment?sum(file.payment[y]??{},keys):null;
 const annual=(file,y,key)=>file?.years[y]?.[key]??null;
 let spec;
 if(state.chart==='operations') spec={
  title:'연간 수익·비용 구성',note:'매출, 총영업비용, EBITDA · A 기준',start:2027,
  series:[['매출 A',color.cyan,'bar',y=>annual(a,y,'revenue')],['총영업비용 A',color.violet,'bar',y=>annual(a,y,'operating_expenses')],
   ['EBITDA A',color.mint,'line',y=>annual(a,y,'ebitda')],['EBITDA B',color.amber,'line',y=>annual(b,y,'ebitda')]]
 };
 else if(state.chart==='investment') spec={
  title:'설비 투자 현금 지급',note:isStory()?'S1 사건별 설비 지급 원장 미연결 · 연간 순현금은 현금흐름 탭에서 확인':submissionMode?'C/C+ 사건별 설비 지급 원장 미연결 · 연간 순현금은 현금흐름 탭에서 확인':'개점 설비비는 개점 전년 말, 재투자 설비비는 해당 연도에 반영',start:2026,
  series:[['개점 설비 지급 A',color.cyan,'bar',y=>cap(a,y,['open_capex'])],['재투자 지급 A',color.violet,'bar',y=>cap(a,y,['refresh_capex'])],
   ['설비 지급 합계 B',color.mint,'line',y=>cap(b,y,['open_capex','refresh_capex'])]]
 };
 else spec={
  title:'20년 순현금흐름과 누적 잔액',note:'독립 금액축 · 자금 한도는 할인 전 누적 잔액 −500억 원 기준',start:2026,
  series:[['연간 순현금 A',color.cyan,'bar',y=>y===2026?a?.yearZero:annual(a,y,'cash')],
   ['연간 순현금 B',color.violet,'bar',y=>y===2026?b?.yearZero:annual(b,y,'cash')],
   ['누적 A',color.cyan,'line',y=>y===2026?a?.yearZero:annual(a,y,'cumulative_cash')],
   ['누적 B',color.violet,'line',y=>y===2026?b?.yearZero:annual(b,y,'cumulative_cash')],
   ['500억 한도선',color.amber,'line',()=>a?-a.fundingLimit:null]]
 };
 $('#inv-chart-title').textContent=spec.title; $('#inv-chart-note').textContent=spec.note;
 $('#inv-legend').innerHTML=spec.series.map(([name,c,type])=>{
  const key=name==='500억 한도선'?'limit':type;
  return '<span><i aria-hidden="true" class="inv-key-'+key+'" style="--key-color:'+c+'"></i>'+esc(name)+'</span>';
 }).join('');
 const years=Array.from({length:2047-spec.start},(_,i)=>spec.start+i);
 const series=spec.series.map(([name,c,type,value])=>({name,c,type,values:years.map(value)}));
 const values=series.flatMap(x=>x.values).filter(Number.isFinite);
 const split=state.chart==='cash';
 const height=split?360:300;
 svg.setAttribute('viewBox','0 0 1000 '+height);
 svg.setAttribute('preserveAspectRatio','xMidYMid meet');
 if(!values.length){svg.innerHTML='<text x="500" y="145" text-anchor="middle">'+(submissionMode&&state.chart==='investment'?'설비 지급 사건별 원장 미연결':'검증된 재무 자료 미연결')+'</text>';return;}
 const left=75,right=982,step=(right-left)/years.length;
 const x=i=>left+step*(i+.5);
 const selected=years.indexOf(Number(state.year));
 const panels=split?[
  {label:'연간 순현금 · 억 원',series:series.slice(0,2),top:32,bottom:145},
  {label:'할인 전 누적 잔액 · 억 원',series:series.slice(2),top:189,bottom:330}
 ]:[{label:null,series,top:20,bottom:262}];
 const ticksFor=(values,target)=>{
  const lo=Math.min(0,...values),hi=Math.max(0,...values),raw=((hi-lo)||1e8)/target;
  const unit=10**Math.floor(Math.log10(raw));
  const gap=([1,2,2.5,5,10].find(n=>n*unit>=raw)??10)*unit;
  const start=Math.floor(lo/gap)*gap,end=Math.ceil(hi/gap)*gap;
  const ticks=Array.from({length:Math.round((end-start)/gap)+1},(_,i)=>start+i*gap);
  return {ticks,ymin:start-gap*.1,ymax:end+gap*.1};
 };
 let body=panels.map(panel=>{
  const {top,bottom}=panel;
  const {ticks,ymin,ymax}=ticksFor(panel.series.flatMap(s=>s.values).filter(Number.isFinite),split?3:4);
  const y=v=>top+(ymax-v)/(ymax-ymin)*(bottom-top);
  let plot='<rect x="'+left+'" y="'+top+'" width="'+(right-left)+'" height="'+(bottom-top)+'" rx="6" fill="#0a1b26"/>';
  if(panel.label){
   const amounts=panel.series.slice(0,2).map((s,i)=>(i?'B ':'A ')+won(s.values[selected]));
   plot+='<text class="inv-plot-title" x="'+left+'" y="'+(top-10)+'">'+panel.label+'</text><text class="inv-plot-readout" x="'+right+'" y="'+(top-10)+
    '" text-anchor="end">'+esc(state.year+'년 선택 · '+amounts.join('　'))+'</text>';
  }
  if(selected>=0) plot+='<rect x="'+(x(selected)-step/2)+'" y="'+top+'" width="'+step+'" height="'+(bottom-top)+'" fill="#5be4c123" stroke="#5be4c161"/>';
  plot+=ticks.map(t=>'<path d="M'+left+' '+y(t)+'H'+right+'" stroke="'+(t===0?'#658492':'#29404a')+
   '"/><text x="65" y="'+(y(t)+4)+'" text-anchor="end">'+esc(fmt(t/1e8,1))+'</text>').join('');
  const bars=panel.series.filter(s=>s.type==='bar');
  bars.forEach((s,index)=>{
   const width=Math.min(16,step/(bars.length+1));
   plot+=s.values.map((v,i)=>v==null||v===0?'':'<rect x="'+(x(i)+(index-bars.length/2)*width)+'" y="'+Math.min(y(v),y(0))+
    '" width="'+Math.max(1,width-2)+'" height="'+Math.abs(y(v)-y(0))+'" rx="2" fill="'+s.c+'" opacity="'+(i===selected?1:.76)+'"/>').join('');
  });
  for(const s of panel.series.filter(s=>s.type==='line')){
   const points=s.values.map((v,i)=>v==null?null:[x(i),y(v)]);
   let path='', connected=false;
   for(const point of points){
    if(!point){connected=false;continue;}
    path+=(connected?'L':'M')+point.join(',');connected=true;
   }
   plot+='<path d="'+path+'" fill="none" stroke="'+s.c+'" stroke-width="2"'+(s.name==='500억 한도선'?' stroke-dasharray="5 4"':'')+'/>';
   if(points[selected]&&s.name!=='500억 한도선') plot+='<circle cx="'+points[selected][0]+'" cy="'+points[selected][1]+'" r="4" fill="'+s.c+'" stroke="#101f2a"/>';
  }
  return plot;
 }).join('');
 const top=panels[0].top,bottom=panels.at(-1).bottom;
 body+=years.map((year,i)=>(i%3===0||i===years.length-1||i===selected?
  '<text'+(i===selected?' class="inv-plot-selected"':'')+' x="'+x(i)+'" y="'+(bottom+20)+'" text-anchor="middle">'+year+'</text>':'')+
  '<rect data-year="'+year+'" tabindex="0" role="button" aria-label="'+year+'년 상세" x="'+(x(i)-step/2)+'" y="'+top+
  '" width="'+step+'" height="'+(bottom-top)+'" fill="transparent"><title>'+year+' · '+
  series.map(s=>s.name+' '+won(s.values[i])).join(' / ')+'</title></rect>').join('');
 svg.innerHTML=body;
}
function detailHeading(text,extra=''){
 return '<div class="inv-detail-title"><h2>'+esc(text)+'</h2>'+extra+'</div>';
}
function operating(){
 if(isStory()){
  const [ar,br]=annualRows();
  return detailHeading(state.year+'년 S1 저장 비용과 현금')+
   comparisonTable([['매출',ar?.revenue,br?.revenue],['총영업비용 · 매출−EBITDA',ar?.operating_expenses,br?.operating_expenses],
    ['EBITDA',ar?.ebitda,br?.ebitda],['연간 순현금',ar?.cash,br?.cash],['누적 현금',ar?.cumulative_cash,br?.cumulative_cash]])+
   '<p class="inv-note">S1 세부 저장 항목 · 라이더 비용 '+won(ar?.storyCosts?.rider)+' · 피커 비용 '+won(ar?.storyCosts?.picker)+
   ' · 거점 고정비 '+won(ar?.storyCosts?.hub)+' · 본사비 '+won(ar?.storyCosts?.hq)+
   '. 총영업비용은 annual_finance.csv의 매출−EBITDA로 표시하며, 나머지 비용 계정별 분해는 미연결입니다.</p>';
 }
 const rows=annualRows(), [a,b]=rows.map(row=>row?.accounts);
 const lineItems=opGroups.flatMap(([,keys])=>keys).filter(key=>Object.hasOwn(a??{},key)||Object.hasOwn(b??{},key));
 return detailHeading(state.year+'년 총영업비용 분해')+'<div class="inv-split"><div>'+
  comparisonTable(opGroups.map(([name,keys])=>[name,sum(a,keys),sum(b,keys)]))+'</div><div>'+
  comparisonTable([
    ['상품 매출',a?.goods_revenue,b?.goods_revenue],['배송비 매출',a?.delivery_fee,b?.delivery_fee],
    ['총영업비용',rows[0]?.operating_expenses,rows[1]?.operating_expenses],['EBITDA',rows[0]?.ebitda,rows[1]?.ebitda],
    ['감가상각',rows[0]?.depreciation,rows[1]?.depreciation],['법인세',rows[0]?.tax,rows[1]?.tax]
  ])+'<p class="inv-note">총영업비용은 매출원가를 포함합니다. 감가상각·세금·설비 지급은 별도 표시합니다.</p></div></div>'+
  '<details><summary>원장 계정별 원 단위 보기</summary>'+
  comparisonTable(lineItems.map(key=>[accountNames[key],a?.[key]??null,b?.[key]??null]),value=>value==null?'미연결':fmt(value,2)+'원')+'</details>';
}
function capital(){
 if(isStory()){
  const [a,b]=state.pair.files,[ar,br]=annualRows();
  return detailHeading(state.year+'년 S1 순현금과 누적 잔액')+
   comparisonTable([['선택 연도 순현금',state.year==='2026'?a?.yearZero:ar?.cash,state.year==='2026'?b?.yearZero:br?.cash],
    ['할인 전 누적 잔액',state.year==='2026'?a?.yearZero:ar?.cumulative_cash,state.year==='2026'?b?.yearZero:br?.cumulative_cash],
    ['선택 연도 EBITDA',ar?.ebitda,br?.ebitda]])+
   '<p class="inv-note">S1 annual_finance.csv 저장값입니다. 설비·보증금 지급의 사건별 내역은 미연결입니다.</p>';
 }
 if(submissionMode) {
  const [a,b]=state.pair.files,[ar,br]=annualRows();
  return detailHeading(state.year+'년 순현금 및 누적 잔액')+
    comparisonTable([
      ['선택 연도 순현금',state.year==='2026'?a?.yearZero:ar?.cash,state.year==='2026'?b?.yearZero:br?.cash],
      ['할인 전 누적 잔액',state.year==='2026'?a?.yearZero:ar?.cumulative_cash,state.year==='2026'?b?.yearZero:br?.cumulative_cash],
      ['선택 연도 EBITDA',ar?.ebitda,br?.ebitda],['선택 연도 법인세',ar?.tax,br?.tax]
    ])+'<p class="inv-note">연간 순현금과 누적 잔액은 annual_cashflow_base.csv 저장값입니다. 개점 설비·보증금 지급 사건별 계정은 이 스냅샷에 연결되지 않아 투자 현금 세부 내역은 미연결입니다.</p>';
 }
 const [a,b]=state.pair.files, [ar,br]=annualRows();
 const pay=key=>[a,b].map(file=>file?file.payment[state.year]?.[key]??0:null);
 const lines=['open_capex','refresh_capex','deposit_paid','deposit_recovered','inventory_increment','inventory_release','inventory_recovery'];
 const cash=(file,row)=>state.year==='2026'?file?.yearZero:row?.cash;
 const cumulative=(file,row)=>state.year==='2026'?file?.yearZero:row?.cumulative_cash;
 return detailHeading(state.year+'년 투자 지급 및 현금 대사')+'<div class="inv-split"><div>'+
  comparisonTable(lines.map(key=>[accountNames[key],...pay(key)]))+'</div><div>'+
  comparisonTable([
   ['2026년 말 초기 순현금',a?.yearZero,b?.yearZero],['선택 연도 EBITDA',ar?.ebitda,br?.ebitda],['선택 연도 법인세',ar?.tax,br?.tax],
   ['선택 연도 순현금',cash(a,ar),cash(b,br)],['할인 전 누적 잔액',cumulative(a,ar),cumulative(b,br)]
  ])+'<p class="inv-note">개점 설비·보증금은 개점 전년 말 지급으로 분류했습니다. 보증금과 재고는 운전자본입니다. 2026년 말 순현금에는 기존 파일럿 정산이 포함될 수 있습니다.</p></div></div>'+
  '<details><summary>다른 연도의 개점·설비 지급 및 원본 사건</summary>'+
  table(['연도','A 개점 설비','A 재투자','B 개점 설비','B 재투자'],Array.from({length:21},(_,i)=>2026+i).map(y=>
    [y,...[a,b].flatMap(file=>['open_capex','refresh_capex'].map(key=>won(file?file.payment[y]?.[key]??0:null)))]))+
  '<p class="inv-note">근거 · ledger.csv / site_events.csv / finance_result.json.</p></details>';
}
function labor(){
 if(isStory())return detailHeading(state.year+'년 S1 인력 관련 비용')+
  table(['저장 항목','S1 금액'],[['라이더 비용',won(annualRows()[0]?.storyCosts?.rider)],['피커 비용',won(annualRows()[0]?.storyCosts?.picker)]])+
  '<p class="inv-note">직고용·위탁 구분, 편성 인원, 유급 시간은 S1 annual_finance.csv에 없어 미연결입니다.</p>';
 if(submissionMode)return detailHeading(state.year+'년 인건비 산출 근거')+
  comparisonTable([['피커 비용',...annualRows().map(row=>row?.accounts?.picker??null)],
    ['직고용 라이더 임금',...annualRows().map(row=>row?.accounts?.employed_wage??null)],
    ['직고용 배송 인센티브',...annualRows().map(row=>row?.accounts?.employed_incentive??null)],
    ['위탁 라이더 지급',...annualRows().map(row=>row?.accounts?.contract_pay??null)]])+
  '<p class="inv-note">저장 현금흐름의 연간 비용 계정입니다. 인원·유급시간·개별 계약 단가는 미연결이며 BM 표본의 편성을 연간 값으로 대체하지 않습니다.</p>';
 const rows=annualRows();
 const options=[...new Set(rows.flatMap(row=>row?.staffing.map(item=>item.id)??[]))].sort();
 if(!options.includes(state.site))state.site='';
 const roster=rows.map(row=>row?.staffing.filter(site=>!state.site||site.id===state.site));
 const amounts=roster.map(items=>items==null||!items.length?null:items.reduce((out,site)=>{
  for(const key of ['picker_roster','rider_roster','picker_paid_hours','employed_paid_hours','employed_paid_orders','contract_base_value_krw_2027']) {
    out[key]=(out[key]??0)+site[key];
  }
  for(const key of [...laborPay,'employed_vehicle']) out[key]=(out[key]??0)+(site.accounts[key]??0);
  return out;
 },{}));
 const laborTotal=amounts.map(row=>sum(row,laborPay));
 const labels=[['picker_roster','피커 편성 합계'],['rider_roster','라이더 편성 합계'],['picker_paid_hours','피커 유급 시간'],
  ['employed_paid_hours','직고용 유급 시간'],['employed_paid_orders','직고용 인센티브 대상 건수']];
 const filter='<label>거점 <select id="inv-staff-site"><option value="">전체</option>'+options.map(id=>
  '<option'+(state.site===id?' selected':'')+'>'+esc(id)+'</option>').join('')+'</select></label>';
 const [a,b]=state.pair.items;
 const wageFactor=item=>item.shock==='W1'&&Number(state.year)>=2028?' · W1 ×1.12':'';
 return detailHeading(state.year+'년 인건비 산출 근거',filter)+'<div class="inv-split"><div>'+
  comparisonTable(labels.map(([key,name])=>[name,...amounts.map(row=>row?.[key]??null)]),value=>fmt(value,2))+
  '<p class="inv-note">편성 합계는 거점별 모형 슬롯 합입니다. 실제 추가 고용 인원은 미연결입니다. 유급시간은 저장 연간 집계입니다.</p></div><div>'+
  comparisonTable(laborPay.map(key=>[accountNames[key],...amounts.map(row=>row?.[key]??null)]).concat([
   ['모형 인건비 합계',...laborTotal],['차량비 · 별도',...amounts.map(row=>row?.employed_vehicle??null)]
  ]))+'<p class="inv-note">증분은 같은 조건의 두 원장 간 인건비 차이입니다. 개별 인력 증원의 단독 효과는 미연결입니다.</p></div></div>'+
  '<details><summary>단가·부대비·원본 산식</summary><p class="inv-note">피커 = 유급시간 × 10,700원 × 1.35 × 1.03^(연도−2027). 직고용 라이더 = 유급시간 × 13,500원 × 1.35 × 같은 상승계수. 1.35는 부대비 반영 계수입니다. 인센티브는 건당 600원, 차량비는 유급시간 × 550,000원 ÷ 174입니다. 위탁은 2027 요율 가중 원가 × 1.025^(연도−2027)입니다.</p>'+
  '<p class="inv-note">선택 연도 임금 계정 · A '+esc(shocks[a.shock]??a.shock)+esc(wageFactor(a))+' / B '+esc(shocks[b.shock]??b.shock)+esc(wageFactor(b))+
  '. W1은 2028년 이후 피커·직고용 임금·위탁 지급에만 추가 반영됩니다. 원본 · annual_site.csv, ledger.csv, conditional_finance_bridge.py::reprice_2027, run_investment_comparison.py::financials.</p></details>';
}
function evidence(){
 if(isStory())return detailHeading('Story v1 · S1 설계 추정')+
  '<p class="inv-note">S1 수익형 base 저장 재무를 A에 표시합니다. B의 C/C+ 원장과 수요·거점·운영 조건이 달라 효과 비교는 제한됩니다. 금액 원본 단위는 억 원이며 화면의 원 단위 내부 표현으로 한 번만 변환합니다.</p>'+
  '<p class="inv-note">base NPV +68.9억 원 · 최대 자금소요 190.3억 원 · 2031 EBITDA +54.5억 원. 시장 low NPV −236.6억 원 · 최대 자금소요 665.0억 원 · certainty_pass=False. 투자 확정이 아닙니다.</p>'+
  '<p class="inv-note">배송 완료·정시 DES 검증, 사건별 설비 지급, 세금, 직고용·위탁 인건비 분해는 미연결입니다. 공식 연간 전망 BLOCKED_ANNUAL / null.</p>'+
  '<details><summary>ZIP 원본</summary><ul>'+Object.values(state.story.paths).map(path=>'<li><code>'+esc(path)+'</code></li>').join('')+'</ul></details>';
 if(submissionMode)return detailHeading('C/C+ 원본 재무와 비교 제한')+
  '<p class="inv-note">C+ v1과 C의 annual_cashflow_base.csv를 각 버전 그대로 표시합니다. 2026년 말 T0, 2027~2046년, 명목 원화, 할인율 12%입니다. 수요 정의와 운영 조건이 달라 B−A를 단일 정책 효과로 해석할 수 없습니다.</p>'+
  '<p class="inv-note">자금 한도와 2031 EBITDA 모두 미충족이며 투자 권장안은 선정되지 않았습니다. 저장 What-if의 연간 현금흐름은 미연결입니다.</p>'+
  '<details><summary>스냅샷에 연결된 파일</summary><ul>'+state.pair.files.flatMap(file=>file?.paths??[]).filter(Boolean).map(path=>'<li><code>'+esc(path)+'</code></li>').join('')+'</ul></details>';
 const catalog=state.catalog, items=state.pair.items, files=state.pair.files;
 const pathRows=['NONE','W1','W2','RENEWAL_DENIAL'].map(shock=>[shocks[shock],...items.map(item=>{
  const alternative=catalog.cases.find(candidate=>candidate.network===item.network&&candidate.market===item.market&&candidate.ramp===item.ramp&&candidate.weather===item.weather&&candidate.assumption===item.assumption&&candidate.shock===shock);
  return alternative ? won(alternative.npv_krw)+' · 자금 '+flag(alternative.funding) : '미연결';
 })]);
 return detailHeading('저장 What-if 재무와 실행 근거')+table(['저장 조건','A 네트워크 NPV','B 네트워크 NPV'],pathRows)+
  '<p class="inv-note">원본 재무 실행이 있는 조합만 연결합니다. 임의 인력·할인율·비용 조정의 재무 영향은 미연결입니다.</p>'+
  '<details><summary>실행 명세·해시 검증 파일</summary><p class="inv-note">'+esc(catalog.runId)+' · 원문 부록 B / dashboard_data_contract_v1.md · 독립 검산 '+catalog.validation.PASS+
  '건, 차단 '+catalog.validation.BLOCKED+'건</p><ul>'+files.flatMap(file=>file?.paths??[]).map(path=>'<li><code>'+esc(path)+'</code></li>').join('')+'</ul></details>';
}
function renderDetail(){
 $('#inv-detail-tabs').querySelectorAll('button').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.detail===state.detail)));
 $('#inv-detail').innerHTML=!state.pair||!state.pair.files.some(Boolean)?'<p class="inv-note">재무 원본을 확인하는 중이거나 미연결입니다.</p>':
  ({operating,capital,labor,evidence})[state.detail]();
}
function renderDecision(){
 const pair=state.pair;
 if(!pair){$('#inv-decision').innerHTML='<p class="inv-note">자료를 불러오는 중입니다.</p>';return;}
 const [a,b]=pair.items,[af,bf]=pair.files,[ar,br]=annualRows(), comp=comparison();
 if(isStory()){
  const s=state.story.summary,low=state.story.low;
  $('#inv-decision').innerHTML='<section class="inv-gate"><h3>500억 원 자금 한도</h3><div class="inv-gate-statuses"><strong class="inv-met">S1 base 충족</strong><strong class="inv-warning">시장 low 미충족</strong></div><small>base '+won(a.peak_funding_krw)+' · low '+won(Number(low.peak_funding_eok)*1e8)+'</small></section>'+
   '<section class="inv-gate"><h3>2031 EBITDA 흑자 목표</h3><div class="inv-gate-statuses"><strong class="inv-met">S1 base 충족</strong></div><small>'+won(a.ebitda_2031_krw)+' · 설계 추정</small></section>'+
   '<section class="inv-insight"><h3>20년 NPV와 하방</h3><p>base '+won(a.npv_krw)+' · 시장 low '+won(Number(low.npv_eok)*1e8)+' · certainty_pass='+esc(s.certainty_pass)+'</p></section>'+
   '<section class="inv-insight"><h3>판단</h3><p>base에서 수익성 개선 가능성, 하방 자금 위험은 남음. 투자 확정 전 운영·DES·계약 검증이 필요합니다.</p></section>';return;
 }
 const gap=(item,file)=>file&&item.peak_funding_krw!=null?Math.max(0,item.peak_funding_krw-file.fundingLimit):null;
 const low=(item,file)=>file&&item.peak_funding_krw!=null?-item.peak_funding_krw:null;
 const candidates=Object.entries(ar?.accounts??{}).filter(([key])=>opGroups.some(([,keys])=>keys.includes(key))).sort((x,y)=>y[1]-x[1]);
 const leaders=candidates.slice(0,2).map(([key,value])=>accountNames[key]+' '+won(value)).join(' · ');
 const delta=comp.ok&&ar&&br?opGroups.map(([name,keys])=>[name,sum(br.accounts,keys)-sum(ar.accounts,keys)])
  .filter(([,change])=>change>0).sort((x,y)=>y[1]-x[1])[0]:null;
 const downside=state.catalog.cases.find(item=>item.network===a.network&&item.ramp===a.ramp&&item.market==='LOW'&&
  item.weather===a.weather&&item.assumption===a.assumption&&item.shock==='NONE');
 const storedLow=submissionMode?state.catalog.stress[a.version]?.find(row=>row.scenario==='LOW'):null;
 const downsideLabel=storedLow?'저장 LOW · '+won(Number(storedLow.npv_krw))+' / 자금 '+flag(storedLow.funding_pass==='True')+
  '. 조건별 연간 현금흐름과 지도는 미연결입니다.':downside?'저장 LOW · '+won(downside.npv_krw)+' / 자금 '+flag(downside.funding)+
  '. 수요 조건이 달라 통제된 비용 차이로 해석할 수 없습니다.':'동일 램프업의 저장 LOW 재무 미연결.';
 const hold=af&&bf&&a.funding===false&&b.funding===false ?
  '투자 판단 보류 · 두 대안 모두 자금 한도 미충족. 한도를 만족하는 대안과 실제 운영·계약 근거가 필요합니다.':
  '투자 판단 보류 · 저장 재무와 별도로 실제 운영·계약 및 하방 위험을 검토해야 합니다.';
 const gate=(title,values,body)=>'<section class="inv-gate"><h3>'+esc(title)+'</h3><div class="inv-gate-statuses">'+
  values.map((value,i)=>'<strong class="'+(value===false?'inv-warning':value===true?'inv-met':'inv-unverified')+'"><span>'+['A','B'][i]+'</span> '+flag(value)+'</strong>').join(' ')+
  '</div><small>'+esc(body)+'</small></section>';
 const insight=(title,body)=>'<section class="inv-insight"><h3>'+esc(title)+'</h3><p>'+esc(body)+'</p></section>';
 $('#inv-decision').innerHTML=gate('500억 원 자금 한도',[af?a.funding:null,bf?b.funding:null],
  '할인 전 누적 최저점 A '+won(low(a,af))+' / B '+won(low(b,bf))+' · 최초 초과 '+(af?.first??'—')+' / '+(bf?.first??'—'))+
  gate('2031 EBITDA 흑자 목표',[af?a.ebitdaTarget:null,bf?b.ebitdaTarget:null],
    'A '+won(af?a.ebitda_2031_krw:null)+' / B '+won(bf?b.ebitda_2031_krw:null)+' · 0원 초과 기준')+
  insight('한도 대비 추가 자금 소요','A '+won(gap(a,af))+' / B '+won(gap(b,bf))+'. 2026년 말 0시점부터 2046년 말까지 전사 누적 순현금의 최저점을 사용합니다.')+
  insight(state.year+'년 주요 비용',leaders?(leaders+(delta?' · B−A 증가 최대 '+delta[0]+' '+won(delta[1])+'.':'')+(submissionMode?' 저장 현금흐름 비용 계정 기준입니다.':' 원장 계정 기준입니다.')):'해당 연도 손익 원장 미연결.')+
  insight('비관 시나리오 · A',downsideLabel)+
  insight('투자 위험과 판단',hold)+
  insight('경제성 해석','NPV는 20년 할인 현금흐름입니다. 실제 계약·인력 수급·정산은 차단이며 IRR과 회수기간은 원본 미산출입니다.');
}
function render(){
 renderKPIs();renderChart();renderDetail();renderDecision();
 const p=state.pair;
 if(p) {
  const [a,b]=p.items;
  $('#inv-assumptions').innerHTML='<h3>비교 기준</h3><p>A · '+esc(description(a))+'</p><p>B · '+esc(description(b))+'</p>'+
   '<p>2027–2046 / 2026년 말 0시점 · 명목 원화 · 12%</p><p>'+esc(comparison().note)+'</p><p>'+(isStory()?'<small>Story v1 · S1 설계 추정 · 상세 근거 탭에서 ZIP 범위 확인</small>':'<a href="/evidence?'+
   esc(new URLSearchParams({kind:'finance',version:dataVersion,run:state.catalog.runId,id:a.id,year:state.year}).toString())+'">선택 재무 근거 추적</a>')+'</p>';
  $('#inv-back').href='/scenario?'+new URLSearchParams({version:dataVersion,run:state.catalog.runId,a:a.id,b:b.id,year:state.year==='2026'?'2027':state.year});
 }
}
function selectYear(year){
 if(![...$('#inv-year').options].some(option=>option.value===year))return;
 state.year=year;$('#inv-year').value=year;render();
}
$('#inv-year').onchange=event=>selectYear(event.target.value);
$('#inv-chart-tabs').onclick=event=>{
 const chart=event.target.closest('[data-chart]')?.dataset.chart;
 if(!chart)return;
 state.chart=chart;
 $('#inv-chart-tabs').querySelectorAll('button').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.chart===chart)));
 renderChart();
};
$('#inv-svg').onclick=event=>{if(event.target.dataset.year)selectYear(event.target.dataset.year);};
$('#inv-svg').onkeydown=event=>{
 if(event.target.dataset.year&&['Enter',' '].includes(event.key)){
  event.preventDefault();const year=event.target.dataset.year;selectYear(year);$('#inv-svg [data-year="'+year+'"]')?.focus();
 }
};
$('#inv-detail-tabs').onclick=event=>{
 const detail=event.target.closest('[data-detail]')?.dataset.detail;
 if(detail){state.detail=detail;renderDetail();}
};
$('#inv-detail').onchange=event=>{
 if(event.target.id==='inv-staff-site'){state.site=event.target.value;renderDetail();$('#inv-staff-site')?.focus();}
};
$('#inv-toggle').onclick=()=>{
 const closed=!$('#inv-controls').hidden;
 $('#inv-controls').hidden=closed;$('.inv-layout').classList.toggle('controls-closed',closed);
 $('#inv-toggle').textContent=closed?'조건 펼치기':'조건 접기';
 $('#inv-toggle').setAttribute('aria-expanded',String(!closed));
};
async function update(){
 const request=++state.serial;
 const items=['a','b'].map(key=>state.catalog.cases.find(item=>item.id===$('#inv-'+key).value));
 if(items.some(item=>!item))return;
 state.pair={items,files:[null,null]};
 $('#inv-status').textContent='선택 원장 해시와 자금 조건 대사 중…';render();
 const results=await Promise.allSettled(items.map(item=>item.id===storyId?Promise.resolve(storyFinance(state.story)):
  fetchJson('/api/investment?'+new URLSearchParams({id:item.id,version:dataVersion}))));
 if(request!==state.serial)return;
 const files=results.map((result,i)=>result.value?.id===items[i].id&&(submissionMode||result.value?.runId===state.catalog.runId)?result.value:null);
 state.pair={items,files};
 $('#inv-status').textContent=(files.every(Boolean)?(isStory()?'Story v1 · S1 설계 추정 · C/C+ 효과 비교 제한':submissionMode?'C/C+ 저장 현금흐름 · 효과 비교 제한':'조건부 결과 · 원장 대사 완료'):'일부 원장 미연결 · 대사 결과 확인 필요')+
  (state.context?' · '+state.context:'');
 render();
}
for(const key of ['a','b'])$('#inv-'+key).onchange=update;
async function load(){
 try{
  state.catalog=await fetchJson(versionUrl('/api/scenarios'));
  if(storyActive(dataVersion)){
   state.story=await loadStory();state.catalog.cases.unshift(storyCase(state.story));
   const option=document.querySelector('#data-version option[value="cplus"]');if(option)option.textContent='C+ 참조 · S1 표시';
  }
  const params=new URLSearchParams(location.search), run=params.get('run');
  if(run&&run!==state.catalog.runId)state.context='요청 실행 미연결 · 기본값 표시';
  const accept=!run||run===state.catalog.runId;
  for(const [key,fallback] of [['a',state.story?storyId:submissionMode?(dataVersion==='c'?'C_BASE':'CPLUS_BASE'):baseId],
    ['b',submissionMode?(dataVersion==='c'?'CPLUS_BASE':'C_BASE'):compareId]]){
   const select=$('#inv-'+key), requested=accept?params.get(key):null;
   select.replaceChildren(...state.catalog.cases.map(item=>new Option(description(item),item.id)));
   if(requested&&!state.catalog.cases.some(item=>item.id===requested))state.context='요청 대안 일부 미연결 · 기본값 표시';
   select.value=state.catalog.cases.some(item=>item.id===requested)?requested:fallback;
   if(!select.value)select.selectedIndex=0;
   select.disabled=false;
  }
  const years=Array.from({length:21},(_,i)=>String(2026+i));
  if(submissionMode)state.year='2031';
  if(accept&&years.includes(params.get('year')))state.year=params.get('year');
  $('#inv-year').replaceChildren(...years.map(year=>new Option(year+(year==='2026'?'년 말 · 0시점':'년'),year)));
  $('#inv-year').value=state.year;$('#inv-year').disabled=false;
  $('#inv-run').textContent=state.story?'story_v1 / S1':state.catalog.runId;
  await update();
 }catch{
  $('#inv-status').textContent='재무 실행 자료 미연결';$('#inv-run').textContent='미연결';
  render();
 }
}
render();load();
