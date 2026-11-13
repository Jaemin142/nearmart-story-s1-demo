const form = document.querySelector('.login-form');
const username = document.querySelector('#username');
const password = document.querySelector('#password');
const toggle = document.querySelector('#toggle-password');
const status = document.querySelector('#login-status');

function showError(input, message) {
  const error = document.querySelector('#' + input.id + '-error');
  input.setAttribute('aria-invalid', String(Boolean(message)));
  error.textContent = message;
  error.hidden = !message;
}
for (const input of [username,password]) input.addEventListener('input', () => {
  showError(input,'');
  status.hidden = true;
});
toggle.addEventListener('click', () => {
  const shown = password.type === 'password';
  password.type = shown ? 'text' : 'password';
  toggle.setAttribute('aria-label', shown ? '비밀번호 숨김' : '비밀번호 표시');
  toggle.setAttribute('aria-pressed',String(shown));
});
form.addEventListener('submit', async event => {
  event.preventDefault();
  status.hidden = true;
  showError(username,username.value.trim() ? '' : '아이디를 입력해 주세요.');
  showError(password,password.validity.valid ? '' : '비밀번호를 입력해 주세요.');
  const invalid = form.querySelector('[aria-invalid="true"]');
  if (invalid) {
    invalid.focus();
    return;
  }
  const button = form.querySelector('.login-submit');
  button.disabled = true;
  status.hidden = false;
  status.textContent = '로그인 중…';
  try {
    const response = await fetch('/login', {method:'POST',body:new URLSearchParams(new FormData(form))});
    if (response.ok) {
      location.assign(new URL(response.url, location.origin).pathname);
      return;
    }
    status.textContent = response.status === 401 ? '아이디 또는 비밀번호를 확인해 주세요.' : '로그인에 실패했습니다. 다시 시도해 주세요.';
  } catch {
    status.textContent = '서버에 연결할 수 없습니다.';
  } finally {
    button.disabled = false;
  }
});

