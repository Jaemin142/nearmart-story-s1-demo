// Read-only display adapter. All numeric values come from immutable C/C+ snapshots.
const number = value => value == null || value === '' ? null : Number(value);
const finite = value => Number.isFinite(value) ? value : null;
const sum = values => values.reduce((total, value) => total + (number(value) ?? 0), 0);
const assignmentYears = [2027, 2031, 2036, 2041, 2046];
const caseId = version => version === 'c' ? 'C_BASE' : 'CPLUS_BASE';
const label = version => version === 'c' ? 'C · 비교본' : 'C+ v1 · 기본본';
const resultPath = (snapshot, name) => Object.keys(snapshot.source_hashes).find(path => path.endsWith('/' + name)) ?? null;

export function dashboardSnapshot(snapshot, base) {
  const plan = snapshot.network.plan;
  const operations = new Map(snapshot.simulation.operations.map(row => [Number(row.year), row]));
  const byYear = new Map(assignmentYears.map(year => [year, snapshot.network.assignment.filter(row => Number(row.year) === year)]));
  const sites = base.sites.map(site => ({...site, sourceStatus: site.id === 'P1' ? 'PILOT' : 'CANDIDATE'}));
  const annual = {};
  for (const year of assignmentYears) {
    const assignments = byYear.get(year);
    const operation = operations.get(year);
    const activeSites = plan.filter(row => Number(row.open_year) <= year && year <= Number(row.close_year));
    const acceptedDaily = sum(assignments.map(row => row.expected_orders_per_day));
    const dongs = Object.fromEntries(assignments.map(row => [row.adm_cd2, {
      site: row.site_id && row.site_id !== 'UNSERVED' ? row.site_id : null,
      blocked: false, inputStatus: row.site_id === 'UNSERVED' ? 'UNSERVED' : 'ASSIGNED',
      request: number(row.expected_orders_per_day), completed: null, unprocessed: null,
      deliveryMin: number(row.avg_delivery_min), lateRate: number(row.late_rate)
    }]));
    const operating = Object.fromEntries(activeSites.map(row => [row.site_id, {
      hubType: row.hub_type, instance: row.site_id, resource: 'C/C+ 연간 편성 미연결',
      picker: null, riders: null, assignedDongs: assignments.filter(item => item.site_id === row.site_id).length,
      request: sum(assignments.filter(item => item.site_id === row.site_id).map(item => item.expected_orders_per_day)),
      completed: operation ? number(operation.delivered_daily) : null,
      ontime: operation && number(operation.late_rate) != null ? 1 - Number(operation.late_rate) : null,
      unprocessed: operation ? number(operation.unfulfilled_daily) : null,
      share: operation && number(operation.delivered_daily) != null ? 1 : null, pickerFloorFailures: null
    }]));
    annual[year] = {
      model_requests: acceptedDaily,
      model_completed: operation ? number(operation.delivered_daily) : null,
      model_ontime_over_completed: operation && number(operation.late_rate) != null ? 1 - Number(operation.late_rate) : null,
      operating_expenses: null, ebitda: null, cash: null,
      active: activeSites.length, blockedDongs: null, sites: operating, dongs,
      sourceUnit: 'orders/day', assignmentConnected:true, operationConnected: number(operation?.delivered_daily) != null
    };
  }
  return {
    years: assignmentYears, geo: base.geo, rosterCount: base.rosterCount, sites,
    result: {
      runId: snapshot.case_id, scenario: snapshot.version, annual,
      validation: {PASS:0, FAIL:0, BLOCKED:0}, sources: Object.keys(snapshot.source_hashes),
      npv: snapshot.main.npv_krw, fundingPass: snapshot.main.funding_pass,
      model: snapshot.model + ' · T2 배정 427동 · T2 주문은 일간 기대량'
    },
    errors: [], geographySource: base.geographySource, candidateRun: base.candidateRun,
    sourceVersion: snapshot.id, sourceLabel: snapshot.version, sourceUnit: 'daily',
    sourceFiles: {assignment: resultPath(snapshot, 'T2_dong_assignment.csv'), operation: resultPath(snapshot, 'annual_operations_base.csv')},
    officialAnnual: null, officialStatus: 'BLOCKED_ANNUAL'
  };
}

function scenarioCase(snapshot) {
  const cashflow = new Map(snapshot.finance.cashflow.map(row => [Number(row.year), row]));
  const operation = new Map(snapshot.simulation.operations.map(row => [Number(row.year), row]));
  const annual = {};
  for (const year of assignmentYears) {
    const op = operation.get(year), cash = cashflow.get(year);
    annual[year] = {
      active_sites: snapshot.network.plan.filter(row => Number(row.open_year) <= year && year <= Number(row.close_year)).length,
      request: op ? number(op.daily) : null, completed: op ? number(op.delivered_daily) : null,
      ontime: op && number(op.delivered_daily) != null && number(op.late_rate) != null ? Number(op.delivered_daily) * (1 - Number(op.late_rate)) : null,
      unprocessed: op ? number(op.unfulfilled_daily) : null,
      operating_expenses: cash && cash.ebitda !== '' ? operatingExpense(cash) : null,
      late: op && number(op.delivered_daily) != null && number(op.late_rate) != null ? Number(op.delivered_daily) * Number(op.late_rate) : null,
      late_rate:op?number(op.late_rate):null,
      resource_pass:!op?.all_resource_pass?null:op.all_resource_pass==='True',
      representative_pass:!op?.representative_95_pass?null:op.representative_95_pass==='True',
      blocked_dongs: null, service: null
    };
  }
  return {
    id: caseId(snapshot.id), version: snapshot.id, network: label(snapshot.id),
    market: snapshot.id === 'cplus' ? 'B84' : 'C 원형', ramp:'저장 결과', weather:'BASE', shock:'NONE',
    assumption: snapshot.id, npv_krw: snapshot.main.npv_krw,
    peak_funding_krw: snapshot.main.peak_funding_krw, ebitda_2031_krw: snapshot.main.ebitda_2031,
    first_breach_year: number(snapshot.finance.scenarios.find(row => row.scenario === 'BASE')?.first_funding_breach),
    funding: snapshot.main.funding_pass, ebitdaTarget: snapshot.main.ebitda_2031 > 0, annual
  };
}

export function scenarioCatalog(current, other) {
  return {
    runId: current.case_id, cases: [scenarioCase(current), scenarioCase(other)],
    des: [], transfers: [], checks: [{check:'원본 스냅샷 해시',status:'빌드 시 확인'},
      {check:'C/C+ 수요 정의 동일성',status:'비교 불가'}, {check:'공식 연간 전망',status:'BLOCKED_ANNUAL / null'}],
    paths: [...Object.keys(current.source_hashes).map(path => current.id + '/' + path),
      ...Object.keys(other.source_hashes).map(path => other.id + '/' + path)],
    submissions: [], official:false, cashRule:'C/C+ 저장 현금흐름',
    model: current.model + ' / ' + other.model,
    financeRule:'C/C+ 개별 원본 · 2026 T0 · 할인율 12% · 동일 수요 정의 확인 전 효과 비교 제한',
    validation: {PASS:0,FAIL:0,BLOCKED:1}, submissionMode:true,
    stress:{[current.id]:current.finance.scenarios,[other.id]:other.finance.scenarios}
  };
}

export function scenarioMap(snapshot, id, year) {
  if (id !== caseId(snapshot.id) || !assignmentYears.includes(Number(year))) return null;
  const rows = snapshot.network.assignment.filter(row => Number(row.year) === Number(year));
  if (rows.length !== 427) return null;
  const assignments = Object.fromEntries(rows.map(row => [row.adm_cd2, {
    site: row.site_id === 'UNSERVED' ? null : row.site_id, blocked:false,
    request:number(row.expected_orders_per_day), completed:null, unprocessed:null,
    mature_potential:null, model_response_factor:null,
    deliveryMin:number(row.avg_delivery_min), lateRate:number(row.late_rate)
  }]));
  const hubs = Object.fromEntries(snapshot.network.plan.filter(row => Number(row.open_year) <= Number(year) && Number(year) <= Number(row.close_year))
    .map(row => [row.site_id, {request:sum(rows.filter(item => item.site_id === row.site_id).map(item => item.expected_orders_per_day)),
      completed:null, unprocessed:null, picker_roster:null, picker_legal_max:null, peak_active_riders:null, rider_roster:null}]));
  return {id,year:String(year),assignments,hubs,paths:[resultPath(snapshot,'T1_network_plan.csv'),resultPath(snapshot,'T2_dong_assignment.csv')]};
}

const expenseKeys = ['cogs','payment_fee','packaging','shrink','ongoing_marketing','it_cost','contract_pay','employed_wage',
  'employed_vehicle','employed_incentive','picker_cost','external_cost','coupon','rent','maintenance','fixed_staff',
  'utilities','replenishment','hq','launch_marketing','restoration'];
const accountNames = {payment_fee:'payment',it_cost:'customer_it',picker_cost:'picker',external_cost:'external_quick',
  coupon:'late_coupon',fixed_staff:'hub_staff',replenishment:'replenish'};
function operatingExpense(row) { return sum(expenseKeys.map(key => row[key])); }
export function financeSnapshot(snapshot, id) {
  if (id !== caseId(snapshot.id)) return null;
  const years = {};
  for (const row of snapshot.finance.cashflow) {
    if (Number(row.year) === 2026) continue;
    const accounts = {};
    for (const key of [...expenseKeys,'goods_revenue','delivery_fee_revenue']) {
      if (row[key] !== '') accounts[accountNames[key] ?? key] = number(row[key]);
    }
    const revenue = number(row.goods_revenue) != null && number(row.delivery_fee_revenue) != null ?
      Number(row.goods_revenue) + Number(row.delivery_fee_revenue) : null;
    years[row.year] = {
      revenue, operating_expenses: row.ebitda !== '' ? operatingExpense(row) : null,
      ebitda:number(row.ebitda), depreciation:number(row.depreciation), tax:number(row.tax),
      cash:number(row.net_cashflow), cumulative_cash:number(row.cumulative_cashflow),
      fulfillment_cost_krw:null, accounts, staffing:[]
    };
  }
  const yearZero = number(snapshot.finance.cashflow.find(row => Number(row.year) === 2026)?.net_cashflow);
  const low = Math.min(0, yearZero ?? 0, ...Object.values(years).map(row => row.cumulative_cash).filter(Number.isFinite));
  const peakYear = Number(Object.entries(years).find(([,row]) => row.cumulative_cash === low)?.[0]) || null;
  return {id,runId:snapshot.case_id,years,yearZero,payment:null,events:[],
    paths:[resultPath(snapshot,'annual_cashflow_base.csv'),resultPath(snapshot,'scenario_comparison.csv')],
    rule:'C_CPLUS_2026_T0_12PCT',discount:12,fundingLimit:50e9,peakYear,
    first:number(snapshot.finance.scenarios.find(row => row.scenario === 'BASE')?.first_funding_breach),
    submissionMode:true,sourceVersion:snapshot.id,peakFunding:finite(-low)};
}
