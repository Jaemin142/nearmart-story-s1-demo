const params = new URLSearchParams(location.search);
const explicit = document.querySelector('meta[name="nearmart-legacy"]') ? 's6' :
  params.get('legacy') === 's6' ? 's6' : params.get('version');
const saved = (() => { try { return localStorage.getItem('nearmart-data-version'); } catch { return null; } })();
export const dataVersion = ['cplus', 'c', 's6'].includes(explicit) ? explicit :
  ['cplus', 'c'].includes(saved) ? saved : 'cplus';
if (explicit && dataVersion !== 's6') {
  try { localStorage.setItem('nearmart-data-version', dataVersion); } catch {}
}
export const submissionMode = dataVersion !== 's6';
export const versionUrl = path => path + (path.includes('?') ? '&' : '?') + 'version=' + dataVersion;
export function mountVersionControl() {
  if (document.querySelector('#data-version')) return;
  const host = document.querySelector('.header-controls');
  if (!host) return;
  const label = document.createElement('label');
  label.className = 'data-version-control';
  label.innerHTML = '<span>분석 데이터</span><select id="data-version" aria-label="분석 데이터 버전">' +
    '<option value="cplus">C+ v1 · 기본</option><option value="c">C · 비교</option><option value="s6" disabled>S6 · 로컬 전용</option></select>';
  host.prepend(label);
  label.querySelector('select').value = dataVersion;
  label.querySelector('select').onchange = event => {
    try { if (event.target.value === 's6') localStorage.removeItem('nearmart-data-version');
      else localStorage.setItem('nearmart-data-version', event.target.value); } catch {}
    const url = new URL(location.href);
    url.searchParams.delete('legacy');
    url.searchParams.delete('preview');
    url.searchParams.set('version', event.target.value);
    location.assign(url);
  };
  if (!document.querySelector('link[data-version-css]')) {
    const css = document.createElement('link');
    css.rel = 'stylesheet'; css.href = '/version-client.css'; css.dataset.versionCss = '';
    document.head.append(css);
  }
}
