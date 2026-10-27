import React from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PASSWORD,
  environmentLabel,
  PASSWORD_SUFFIX,
  toAuthPassword,
  usernameToEmail,
  validateLoginInput,
  validateNewPassword,
} from '../src/services/authPassword';
import { friendlyAuthError } from '../src/services/remote/session';
import { ChangePasswordScreen, LoginScreen } from '../src/features/auth/LoginScreen';
import { App } from '../src/app/App';
import { createInitialState } from '../src/services/depotStore';

const noopAsync = async () => {};

describe('DEC-151 / DEC-153: quy tắc đăng nhập dùng chung', () => {
  it('tên đăng nhập → email nội bộ; mật khẩu luôn ghép đoạn cố định (khớp Edge Function)', () => {
    expect(usernameToEmail(' Tuan.LV ')).toBe('tuan.lv@matrandepot.local');
    expect(PASSWORD_SUFFIX).toBe('::matran');
    expect(toAuthPassword('a')).toBe('a::matran');
    expect(toAuthPassword('a').length).toBeGreaterThanOrEqual(6); // Supabase đòi ≥ 6
    expect(DEFAULT_PASSWORD).toBe('123456');
  });

  it('kiểm tra ô đăng nhập', () => {
    expect(validateLoginInput('', 'x')).toMatch(/TÊN ĐĂNG NHẬP/);
    expect(validateLoginInput('tu', 'x')).toMatch(/3–30 ký tự/);
    expect(validateLoginInput('tuan.lv', '')).toMatch(/MẬT KHẨU/);
    expect(validateLoginInput('tuan.lv', 'x')).toBeNull();
  });

  it('đổi mật khẩu: bao nhiêu ký tự cũng được, cấm 123456, khác mật khẩu cũ, nhập lại khớp (DEC-143)', () => {
    expect(validateNewPassword({ current: '', next: 'a', confirm: 'a' })).toMatch(/HIỆN TẠI/);
    expect(validateNewPassword({ current: '123456', next: '', confirm: '' })).toMatch(/MẬT KHẨU MỚI/);
    expect(validateNewPassword({ current: 'x', next: '123456', confirm: '123456' })).toMatch(/mặc định/);
    expect(validateNewPassword({ current: 'abc', next: 'abc', confirm: 'abc' })).toMatch(/khác mật khẩu hiện tại/);
    expect(validateNewPassword({ current: '123456', next: 'a', confirm: 'b' })).toMatch(/không khớp/);
    expect(validateNewPassword({ current: '123456', next: 'a', confirm: 'a' })).toBeNull();
  });

  it('lỗi Supabase → tiếng Việt; nhãn môi trường', () => {
    expect(friendlyAuthError('Invalid login credentials')).toBe('Sai tên đăng nhập hoặc mật khẩu.');
    expect(friendlyAuthError('Failed to fetch')).toMatch(/Không kết nối được/);
    expect(environmentLabel('production')).toBe('Chính thức');
    expect(environmentLabel('dev')).toMatch(/dev/);
    expect(environmentLabel(undefined)).toMatch(/local/);
  });
});

describe('Màn đăng nhập / đổi mật khẩu (giao diện)', () => {
  it('đăng nhập: tên đăng nhập, mật khẩu có nút hiện / ẩn, nhớ tên đăng nhập, quên mật khẩu, môi trường', () => {
    const html = renderToString(<LoginScreen onSignIn={noopAsync} env="dev" />);
    expect(html).toContain('data-testid="login-screen"');
    expect(html).toContain('Tên đăng nhập');
    expect(html).toContain('aria-label="Hiện mật khẩu"');
    expect(html).toContain('data-testid="remember-username"');
    expect(html).toContain('Quên mật khẩu? Liên hệ Admin');
    expect(html).toMatch(/data-testid="login-env"[^>]*>Bản thử \(dev\)/);
    expect(html).toContain('MATRAN<br/>DEPOT'); // nửa trái máy tính
  });

  it('đổi mật khẩu bắt buộc: có Đăng xuất, nhắc lần đầu; tự đổi: có Hủy', () => {
    const forced = renderToString(<ChangePasswordScreen forced fullName="Lê Văn Tuấn" username="tuan.lv" onSubmit={noopAsync} onSignOut={() => {}} />).replace(/<!-- -->/g, '');
    expect(forced).toContain('data-testid="change-password-screen"');
    expect(forced).toContain('Lần đăng nhập đầu tiên');
    expect(forced).toContain('Đăng xuất');
    expect(forced).toContain('không dùng 123456');
    const self = renderToString(<ChangePasswordScreen fullName="Lê Văn Tuấn" username="tuan.lv" onSubmit={noopAsync} onCancel={() => {}} />);
    expect(self).toContain('role="dialog"');
    expect(self).toContain('>Hủy<');
  });

  it('App chế độ database: hiện người dùng + Đăng xuất + dòng báo chưa lưu; ẩn ô chọn người dùng demo', () => {
    const html = renderToString(
      <App initialState={createInitialState()} remote={{ fullName: 'Lê Văn Tuấn', username: 'tuan.lv', onSignOut: () => {}, onChangePassword: () => {} }} />
    );
    expect(html).toContain('data-testid="session-user"');
    expect(html).toContain('data-testid="sign-out"');
    expect(html).toContain('data-testid="remote-notice"');
    expect(html).not.toContain('Nạp dữ liệu test');
    const demo = renderToString(<App initialState={createInitialState()} />);
    expect(demo).toContain('Nạp dữ liệu test');
    expect(demo).not.toContain('data-testid="sign-out"');
  });
});
