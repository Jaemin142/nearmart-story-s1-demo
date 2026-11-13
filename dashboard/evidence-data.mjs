import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const archive = new URL('../outputs/NearMart_사전준비/04_실험/',import.meta.url);
const review = new URL('../outputs/NearMart_최종검토/데이터_처리_로그/',import.meta.url);
const policy = 'S1_POLICY_20261110_01';
const intake = 'S1_20261110_04';
const spatial = 'S2_SPATIAL_FIXED_20261111_01';
const demand = 'S2_APPROVED_ANNUAL_20261111_01';
const foundation = 'S3_FOUNDATION_20261111_01';
const dispatch = 'S45_OPS_20261111_02';
const capacity = 'S345_CAPACITY_20261111_01';
const finance = 'S6_INVESTMENT_COMPARE_20261112_01';
const final = 'S7_JOINT_OPT_20261112_01';

const registry = {
  inventory:['review',intake,'data_inventory.csv'], issues:['review',intake,'data_issues_log.csv'],
  intakeNote:['review',intake,'validation_summary.md'], appendix:['review',intake,'travel_check_result.csv'],
  policyAudit:['review',policy,'independent_checks.csv'], policyNote:['review',policy,'policy_report.md'],
  policyDisposition:['review',policy,'defect_population_disposition.csv'], policyUnits:['review',policy,'unit_standardization_lineage.csv'],
  policyManifest:['desktop',policy,'manifest.json'], policyIssues:['desktop',policy,'site_and_unit_issues.csv'],
  spatialManifest:['archive',spatial,'manifest.json'], spatialAudit:['archive',spatial,'independent_validation.json'],
  spatialMetrics:['archive',spatial,'validation_metrics.csv'], spatialNote:['archive',spatial,'spatial_model_report.md'],
  demandManifest:['archive',demand,'run_manifest.json'], demandAudit:['archive',demand,'independent_validation.json'],
  demandNote:['archive',demand,'annual_demand_handoff.md'],
  foundationManifest:['archive',foundation,'manifest.json'], foundationAudit:['archive',foundation,'stage3_independent_validation.json'],
  foundationNote:['archive',foundation,'network_input_contract.md'],
  foundationBlocked:['archive',foundation,'uncovered_and_blocked_dong.csv'],
  dispatchManifest:['archive',dispatch,'manifest.json'], dispatchAudit:['archive',dispatch,'independent_validation.json'],
  dispatchNote:['archive',dispatch,'operations_report.md'], benchmarkAudit:['archive',dispatch,'bm_independent_validation.csv'],
  capacityManifest:['archive',capacity,'run_manifest.json'], capacityAudit:['archive',capacity,'independent_validation.json'],
  capacityNote:['archive',capacity,'annual_capacity_report.md'],
  financeManifest:['archive',finance,'run_manifest.json'], financeAudit:['archive',finance,'independent_validation.json'],
  financeContract:['archive',finance,'dashboard_data_contract_v1.md'], financeNote:['archive',finance,'투자대안_조건부_비교보고서.md'],
  directDes:['archive',finance,'dashboard_v1/evidence_direct_des.csv'], observed:['archive',finance,'dashboard_v1/evidence_observed.csv'],
  finalManifest:['archive',final,'run_manifest.json'], finalAudit:['archive',final,'independent_joint_audit.json'],
  finalContract:['archive',final,'dashboard_data_contract_v4.md']
};
const runDefinitions = [
  [policy,'입력 정책 파생본','policyManifest','policyAudit','policyNote',[], 'R2_APPROVED_v1 · 원본 보존 및 승인 수정'],
  [spatial,'파일럿 수요 모형','spatialManifest','spatialAudit','spatialNote',[policy], 'EXP_FAST / EXP_SLOW / HYP_SLOW'],
  [demand,'승인 가정 연간화','demandManifest','demandAudit','demandNote',[spatial], '승인 가정 423동 · 공식 연간 전망과 별도'],
  [foundation,'네트워크 입력·후보','foundationManifest','foundationAudit','foundationNote',[demand], '후보 및 배정 가능성 검사'],
  [dispatch,'벤치마크 배차·대표일 운영','dispatchManifest','dispatchAudit','dispatchNote',[policy], 'S3_DESIGN_20261111_01 네트워크 · 20회 대표일'],
  [capacity,'조건부 거점 용량·대표일 DES','capacityManifest','capacityAudit','capacityNote',[demand], '쌍대 지역 대표일 · 연간 검증 제한'],
  [finance,'조건부 운영·투자 비교','financeManifest','financeAudit','financeContract',[policy,spatial,demand,foundation,capacity], 'FIFO_15MIN_SINGLETON_75PCT_V1 · 48개 저장 실행'],
  [final,'공동 최적화 검토 패키지','finalManifest','finalAudit','finalContract',[], '별도 S7 결과 · S6 대시보드와 별도 출처']
];
const models = [
  {id:'demand',title:'수요예측 · 파일럿 외삽',run:spatial,kind:'MODEL_ESTIMATE',audit:'spatialAudit',files:['spatialMetrics','spatialNote'],
   input:'승인된 파일럿 주문·노출, 시간 및 공간 분할',output:'기준일 수요와 램프업 곡선별 모형',metrics:'WAPE, MAE, 조건부 과정구간 포착률',
   limit:'파일럿 구현·산술 검산입니다. 시간·공간 외삽 및 램프업 불확실성이 남고, 공간 포착률은 명목 90%에 미달했습니다.'},
  {id:'annual',title:'연간화 · 승인 가정',run:demand,kind:'ASSUMPTION_SCENARIO',audit:'demandAudit',files:['demandNote'],
   input:'파일럿 기준일량·승인 달력·기상·이벤트 가정',output:'423동 조건부 잠재량',metrics:'연간 합계·달력 및 가중 대사',
   limit:'공식 연간 전망 BLOCKED_ANNUAL/null. 조건부 잠재량과 실제 접수·매출은 모집단이 다릅니다.'},
  {id:'layout',title:'거점 설계 · 조건부 배정',run:foundation,kind:'MODEL_ESTIMATE',audit:'foundationAudit',files:['foundationNote','capacityNote'],
   input:'427동 명부, 후보 원장, OD 및 조건부 수요',output:'후보 적격 범위 및 조건부 배정 근거',metrics:'행정동·거점 키, 배정 및 범위 검산',
   limit:'배정은 거리·시간 기준 실현 서비스율이 아닙니다. 자원 하한 통과도 실제 배송 능력의 증명이 아닙니다.'},
  {id:'dispatch',title:'배차 · INSERTION 벤치마크',run:dispatch,kind:'MODEL_ESTIMATE',audit:'dispatchAudit',files:['benchmarkAudit','dispatchNote'],
   input:'공식 벤치마크 주문·부록 A·직고용 배차 정책',output:'T3 경로·배차 및 검증 로그',metrics:'벤치마크 주문 ID·시간·자원 검사',
   limit:'벤치마크 검증과 연간 FIFO 근사의 적용 범위를 구분합니다.'},
  {id:'simpy',title:'SimPy · 지역 대표일',run:capacity,kind:'MODEL_ESTIMATE',audit:'capacityAudit',files:['capacityNote','directDes'],
   input:'2032년 지역 설계·대표일·정책 및 반복 시드',output:'쌍대 완료·정시·일 비용·실패 시드',metrics:'대표일 조건별 20회 결과 및 독립 재검사',
   limit:'지역 대표일 실험이며 선택한 S6 연간 대안의 직접 검증은 차단입니다.'},
  {id:'finance',title:'재무 · 조건부 20년 대사',run:finance,kind:'ASSUMPTION_SCENARIO',audit:'financeAudit',files:['financeContract','financeNote'],
   input:'S6 연간 FIFO 운영량, 생애주기 사건, 비용 규칙',output:'원장·현금흐름·NPV·자금 제약',metrics:'960개 재무 연도 및 요약 독립 검산',
   limit:'실제 계약·인력·정산 및 연간 DES 외부 검증은 BLOCKED. 검산과 투자 타당성은 별도입니다.'}
];
const pipeline = [
  ['데이터 검증',policy,'연결 근거 있음','승인 파생 주문·정책을 후속 실행 입력 해시에 기록','policyNote','policyAudit'],
  ['수요예측',demand,'조건부 연결','승인 가정 연간 입력을 S6에서 사용. 공식 연간 전망 차단','demandNote','demandAudit'],
  ['네트워크 설계',foundation,'조건부 연결','후보·조건부 OD 및 후속 용량 계획을 S6 입력으로 사용','foundationNote','foundationAudit'],
  ['배차',dispatch,'범위 분리','T3 벤치마크와 S6 연간 FIFO 근사를 구분','dispatchNote','dispatchAudit'],
  ['SimPy',capacity,'대표일만 연결','지역 대표일 결과를 참고. 선택 연간 실행 직접 검증 차단','capacityNote','capacityAudit'],
  ['재무',finance,'조건부 연결','S6 연간 운영량·정책을 원장과 재무 요약에 연결','financeContract','financeAudit'],
  ['What-if',finance,'저장 실행 연결','W1·W2·재계약 거절 조건의 저장 결과. 신규 재계산 차단','financeNote','financeAudit'],
  ['최종안',final,'확정 보류','별도 검토 패키지. 공식 최종안 확정 또는 S6와의 자동 병합 미적용','finalContract','finalAudit']
];

export function createEvidenceReader({experiments,csv,scenarioReader,geography}) {
  async function get(key) {
    const entry=registry[key];
    if(!Object.hasOwn(registry,key)||!entry) return null;
    const [area,run,name]=entry;
    const location=area==='desktop'?join(experiments,run,name):
      new URL(run+'/'+name,area==='archive'?archive:review);
    try {return {bytes:await readFile(location),name,run,area};}
    catch(error) {if(error.code==='ENOENT')return null;throw error;}
  }
  async function catalog(){
    const pairs=await Promise.all(Object.keys(registry).map(async key=>{
      try {return [key,await get(key)];}catch{return [key,null];}
    }));
    const loaded=Object.fromEntries(pairs);
    const json=key=>{try{return JSON.parse(loaded[key]?.bytes.toString().replace(/^\uFEFF/,''));}catch{return null;}};
    const rows=key=>{try{return loaded[key]?csv(loaded[key].bytes):[];}catch{return [];}};
    const files=Object.fromEntries(Object.entries(registry).map(([key,[area,run,name]])=>[key,{area,run,name,available:Boolean(loaded[key])}]));
    const audits={};
    for(const key of runDefinitions.map(item=>item[3])){
      const record=json(key);
      if(key==='policyAudit'){
        const checks=rows(key);
        if(checks.length)audits[key]={counts:{PASS:checks.filter(r=>r.passed==='True').length,FAIL:checks.filter(r=>r.passed==='False').length},checks:checks.map(r=>({check:r.check,status:r.passed==='True'?'PASS':r.passed==='False'?'FAIL':'NOT_CHECKED',detail:r.detail}))};
      }else if(record){
        const totals=record.counts??record.all??Object.fromEntries(['PASS','FAIL','BLOCKED','NOT_CHECKED'].filter(k=>typeof record[k]==='number').map(k=>[k,record[k]]));
        audits[key]={counts:Object.keys(totals).length?totals:typeof record.passed==='number'?{PASS:record.passed,FAIL:record.failures.length}:{},
          status:record.status??null,scope:record.scope??null,checks:Array.isArray(record.checks)?record.checks:[]};
      }
    }
    const runs=runDefinitions.map(([id,title,mkey,akey,nkey,,assumption])=>{
      const manifest=json(mkey);
      const inputs=manifest?.input_hashes??manifest?.input_file_hashes??manifest?.source_hashes??manifest?.source_file_sha256;
      const outputs=manifest?.output_hashes??manifest?.output_file_hashes;
      const parents=runDefinitions.map(item=>item[0]).filter(other=>other!==id &&
        Object.keys(inputs??{}).some(path=>path.split(/[\\/]/).includes(other)));
      return {id,title,assumption,manifest:mkey,audit:akey,note:nkey,parents,
        time:manifest?.created_at??manifest?.started??manifest?.started_at??null,status:manifest?.status??null,
        version:manifest?.record_output_version??manifest?.policy_version??null,
        inputs:Object.keys(inputs??{}).slice(0,12),outputs:Object.keys(outputs??{}).slice(0,12),
        inputCount:inputs?Object.keys(inputs).length:null,outputCount:outputs?Object.keys(outputs).length:null};
    });
    const geo=await geography().catch(()=>null);
    return {files,audits,runs,models,pipeline,gis:geo?{roster:geo.roster.size,features:geo.geo.features.length}:null,inventory:rows('inventory'),issues:rows('issues'),
      policyIssues:rows('policyIssues').filter(row=>Number(row.rows)>0),disposition:rows('policyDisposition'),
      blockedDongs:rows('foundationBlocked'),
      spatialMetrics:rows('spatialMetrics').filter(row=>row.evaluation==='heldout'),
      observed:rows('observed'),official:'BLOCKED_ANNUAL/null',linkedRun:finance};
  }
  async function trace({kind,run,year,id,dong,site,other}){
    if(run&&run!==finance)return null;
    const data=await scenarioReader.catalog();
    const item=data.cases.find(row=>row.id===id);
    if(!item||(!Object.hasOwn(item.annual,year)&&!(kind==='finance'&&year==='2026')))return null;
    const annual=item.annual[year];
    if(kind==='network'){
      const map=await scenarioReader.map(id,year);
      if(dong&&!Object.hasOwn(map.assignments,dong))return null;
      if(site&&!Object.hasOwn(map.hubs,site))return {id,year,run:finance,paths:map.paths,values:null};
      return {id,year,run:finance,paths:map.paths,values:dong?map.assignments[dong]:site?map.hubs[site]:
        {active_sites:annual.active_sites,blocked_dongs:annual.blocked_dongs}};
    }
    if(kind==='finance'){
      const f=await scenarioReader.finance(id);
      const row=f.years[year];
      return {id,year,run:finance,paths:f.paths,values:{...row?{revenue:row.revenue,operating_expenses:row.operating_expenses,
        cash:row.cash,cumulative_cash:row.cumulative_cash}:{cash:f.yearZero},npv_krw:item.npv_krw,peak_funding_krw:item.peak_funding_krw,ebitda_2031_krw:item.ebitda_2031_krw}};
    }
    if(kind==='operations'||kind==='scenario'){
      const compare=kind==='scenario'?data.cases.find(row=>row.id===other)?.annual[year]:null;
      return {id,year,run:finance,paths:['dashboard_v1/annual_network.csv','dashboard_v1/scenario_summary.csv'],values:annual,
        ...(compare?{other,otherValues:compare}:{})};
    }
    return null;
  }
  return {get,catalog,trace};
}
