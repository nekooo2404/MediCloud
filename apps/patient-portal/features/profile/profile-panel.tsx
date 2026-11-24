'use client';

import {useEffect, useId, useState, type CSSProperties, type FormEvent} from 'react';
import {MC_COLORS} from '@/lib/design-tokens';

interface ProfileData {
  user: {
    email: string | null;
    emailVerified: boolean;
    displayName: string;
  };
  profile: {
    patientId: string;
    medicalRecordCode: string;
    displayName: string;
    bloodType: string;
    allergies: string[];
    careTeamNotes: string;
  };
  guardians: Array<{
    id: string;
    guardianEmail: string;
    guardianName: string;
    scope: string;
    createdAt: string;
  }>;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const CONTROL_STYLE: CSSProperties = {
  padding: '10px 12px',
  borderRadius: '8px',
  border: `1px solid ${MC_COLORS.mintBorder}`,
  minHeight: '48px',
  fontSize: 'max(1rem, 1em)',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
};

const FIELD_ERROR_STYLE: CSSProperties = {
  margin: '2px 0 0',
  fontSize: '13px',
  color: MC_COLORS.dangerText,
  fontWeight: 500,
};

export function ProfilePanel({onUpdated}: {onUpdated?: () => void}) {
  const nameErrId = useId();
  const guardianEmailErrId = useId();
  const verifyTokenErrId = useId();
  const currentPassErrId = useId();
  const newPassErrId = useId();

  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusMsg, setStatusMsg] = useState('');

  const [displayName, setDisplayName] = useState('');
  const [bloodType, setBloodType] = useState('');
  const [allergiesText, setAllergiesText] = useState('');
  const [careTeamNotes, setCareTeamNotes] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  const [guardianEmail, setGuardianEmail] = useState('');
  const [relationship, setRelationship] = useState('Người thân');
  const [savingGuardian, setSavingGuardian] = useState(false);

  const [verifyToken, setVerifyToken] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [savingSecurity, setSavingSecurity] = useState(false);

  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const markTouched = (key: string) => setTouched((prev) => ({...prev, [key]: true}));

  const nameError =
    touched.displayName && displayName.trim().length < 2
      ? 'Họ và tên phải có ít nhất 2 ký tự.'
      : null;
  const guardianEmailError =
    touched.guardianEmail && !EMAIL_RE.test(guardianEmail.trim())
      ? 'Vui lòng nhập email người thân hợp lệ.'
      : null;
  const verifyTokenError =
    touched.verifyToken && !verifyToken.trim()
      ? 'Vui lòng nhập mã xác minh email.'
      : null;
  const currentPasswordError =
    touched.currentPassword && !currentPassword
      ? 'Vui lòng nhập mật khẩu hiện tại.'
      : null;
  const newPasswordError =
    touched.newPassword && newPassword.length < 12
      ? 'Mật khẩu mới phải có ít nhất 12 ký tự.'
      : null;

  const loadProfile = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/bff/profile', {cache: 'no-store', credentials: 'same-origin'});
      const json = (await res.json()) as ProfileData & {error?: {message?: string}};
      if (!res.ok) {
        throw new Error(json.error?.message ?? 'Không thể tải hồ sơ cá nhân.');
      }
      setData(json);
      setDisplayName(json.profile.displayName);
      setBloodType(json.profile.bloodType);
      setAllergiesText(json.profile.allergies.join(', '));
      setCareTeamNotes(json.profile.careTeamNotes);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi tải hồ sơ.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadProfile();
  }, []);

  const handleSaveProfile = async (event: FormEvent) => {
    event.preventDefault();
    markTouched('displayName');
    if (displayName.trim().length < 2) return;
    setSavingProfile(true);
    setStatusMsg('');
    setError('');
    try {
      const res = await fetch('/api/bff/profile', {
        method: 'POST',
        headers: {'content-type': 'application/json'},
        credentials: 'same-origin',
        body: JSON.stringify({
          displayName: displayName.trim(),
          bloodType: bloodType.trim(),
          allergies: allergiesText
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
          careTeamNotes: careTeamNotes.trim(),
        }),
      });
      const json = (await res.json()) as {error?: {message?: string}};
      if (!res.ok) throw new Error(json.error?.message ?? 'Không thể lưu hồ sơ.');
      setStatusMsg('Đã cập nhật hồ sơ bệnh nhân thành công.');
      await loadProfile();
      onUpdated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể lưu hồ sơ.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleAddGuardian = async (event: FormEvent) => {
    event.preventDefault();
    markTouched('guardianEmail');
    if (!EMAIL_RE.test(guardianEmail.trim())) return;
    setSavingGuardian(true);
    setStatusMsg('');
    setError('');
    try {
      const res = await fetch('/api/bff/profile', {
        method: 'POST',
        headers: {'content-type': 'application/json'},
        credentials: 'same-origin',
        body: JSON.stringify({
          action: 'add_guardian',
          guardianEmail: guardianEmail.trim(),
          scope: `${relationship.trim() || 'Người thân'} · FULL_PORTAL`,
        }),
      });
      const json = (await res.json()) as {error?: {message?: string}};
      if (!res.ok) throw new Error(json.error?.message ?? 'Không thể thêm người thân.');
      setGuardianEmail('');
      setTouched((prev) => ({...prev, guardianEmail: false}));
      setStatusMsg('Đã thêm ủy quyền người thân thành công.');
      await loadProfile();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể thêm người thân.');
    } finally {
      setSavingGuardian(false);
    }
  };

  const handleRevokeGuardian = async (delegationId: string) => {
    setError('');
    setStatusMsg('');
    try {
      const res = await fetch('/api/bff/profile', {
        method: 'POST',
        headers: {'content-type': 'application/json'},
        credentials: 'same-origin',
        body: JSON.stringify({action: 'revoke_guardian', delegationId}),
      });
      if (!res.ok) throw new Error('Không thể thu hồi ủy quyền.');
      setStatusMsg('Đã thu hồi quyền người thân.');
      await loadProfile();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi thu hồi ủy quyền.');
    }
  };

  const handleVerifyEmail = async (event: FormEvent) => {
    event.preventDefault();
    markTouched('verifyToken');
    if (!verifyToken.trim()) return;
    setSavingSecurity(true);
    setError('');
    setStatusMsg('');
    try {
      const res = await fetch('/api/bff/session', {
        method: 'POST',
        headers: {'content-type': 'application/json'},
        credentials: 'same-origin',
        body: JSON.stringify({action: 'verify_email', token: verifyToken.trim()}),
      });
      const json = (await res.json()) as {error?: {message?: string}};
      if (!res.ok) throw new Error(json.error?.message ?? 'Mã xác minh không hợp lệ.');
      setVerifyToken('');
      setTouched((prev) => ({...prev, verifyToken: false}));
      setStatusMsg('Email của bạn đã được xác minh thành công.');
      await loadProfile();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi xác minh email.');
    } finally {
      setSavingSecurity(false);
    }
  };

  const handleChangePassword = async (event: FormEvent) => {
    event.preventDefault();
    markTouched('currentPassword');
    markTouched('newPassword');
    if (!currentPassword || newPassword.length < 12) return;
    setSavingSecurity(true);
    setError('');
    setStatusMsg('');
    try {
      const res = await fetch('/api/bff/session', {
        method: 'POST',
        headers: {'content-type': 'application/json'},
        credentials: 'same-origin',
        body: JSON.stringify({
          action: 'change_password',
          currentPassword,
          newPassword,
        }),
      });
      const json = (await res.json()) as {error?: {message?: string}};
      if (!res.ok) throw new Error(json.error?.message ?? 'Không thể đổi mật khẩu.');
      setCurrentPassword('');
      setNewPassword('');
      setTouched((prev) => ({...prev, currentPassword: false, newPassword: false}));
      setStatusMsg('Đổi mật khẩu thành công. Các phiên đăng nhập cũ khác đã được thu hồi.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể đổi mật khẩu.');
    } finally {
      setSavingSecurity(false);
    }
  };

  if (loading) {
    return (
      <section style={{backgroundColor: '#fff', border: `1px solid ${MC_COLORS.mintBorder}`, borderRadius: '14px', padding: '18px'}}>
        <progress className="loading-spinner" aria-label="Đang tải hồ sơ cá nhân" />
      </section>
    );
  }

  return (
    <div style={{display: 'grid', gap: '16px'}}>
      {statusMsg && (
        <div role="status" aria-live="polite" style={{padding: '12px 14px', borderRadius: '10px', backgroundColor: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0', fontSize: '14px'}}>
          {statusMsg}
        </div>
      )}
      {error && (
        <div role="alert" style={{padding: '12px 14px', borderRadius: '10px', backgroundColor: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca', fontSize: '14px'}}>
          {error}
        </div>
      )}

      {data && (
        <>
          <section style={{backgroundColor: '#fff', border: `1px solid ${MC_COLORS.mintBorder}`, borderRadius: '14px', padding: '18px'}}>
            <h3 style={{margin: '0 0 6px', fontSize: '16px', color: MC_COLORS.textInk}}>Hồ sơ y tế cá nhân</h3>
            <p style={{margin: '0 0 14px', fontSize: '13px', color: MC_COLORS.textSubtle}}>
              Mã hồ sơ: <strong>{data.profile.medicalRecordCode}</strong> · Email: <strong>{data.user.email ?? 'Chưa liên kết'}</strong>{' '}
              ({data.user.emailVerified ? 'Đã xác minh' : 'Chưa xác minh email'})
            </p>
            <form method="POST" onSubmit={handleSaveProfile} style={{display: 'grid', gap: '14px', maxWidth: '560px'}}>
              <div style={{display: 'grid', gap: '4px'}}>
                <label htmlFor="profile-name" style={{fontSize: '13px', fontWeight: 600}}>Họ và tên</label>
                <input
                  id="profile-name"
                  name="displayName"
                  className="mc-form-control"
                  type="text"
                  required
                  minLength={2}
                  autoComplete="name"
                  enterKeyHint="next"
                  aria-invalid={nameError ? 'true' : 'false'}
                  aria-describedby={nameError ? nameErrId : undefined}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  onBlur={() => markTouched('displayName')}
                  style={CONTROL_STYLE}
                />
                {nameError && <p id={nameErrId} style={FIELD_ERROR_STYLE}>{nameError}</p>}
              </div>
              <div style={{display: 'grid', gap: '4px'}}>
                <label htmlFor="profile-blood" style={{fontSize: '13px', fontWeight: 600}}>Nhóm máu</label>
                <input
                  id="profile-blood"
                  name="bloodType"
                  className="mc-form-control"
                  type="text"
                  enterKeyHint="next"
                  value={bloodType}
                  onChange={(e) => setBloodType(e.target.value)}
                  placeholder="Ví dụ: O+, A-, AB+"
                  style={CONTROL_STYLE}
                />
              </div>
              <div style={{display: 'grid', gap: '4px'}}>
                <label htmlFor="profile-allergies" style={{fontSize: '13px', fontWeight: 600}}>Tiền sử dị ứng (cách nhau bằng dấu phẩy)</label>
                <input
                  id="profile-allergies"
                  name="allergies"
                  className="mc-form-control"
                  type="text"
                  enterKeyHint="next"
                  value={allergiesText}
                  onChange={(e) => setAllergiesText(e.target.value)}
                  placeholder="Ví dụ: Penicillin, Hải sản"
                  style={CONTROL_STYLE}
                />
              </div>
              <div style={{display: 'grid', gap: '4px'}}>
                <label htmlFor="profile-notes" style={{fontSize: '13px', fontWeight: 600}}>Ghi chú cho đội ngũ điều trị</label>
                <textarea
                  id="profile-notes"
                  name="careTeamNotes"
                  className="mc-form-control"
                  rows={3}
                  enterKeyHint="done"
                  value={careTeamNotes}
                  onChange={(e) => setCareTeamNotes(e.target.value)}
                  style={CONTROL_STYLE}
                />
              </div>
              <button
                type="submit"
                disabled={savingProfile}
                style={{width: 'fit-content', minHeight: '48px', padding: '10px 18px', borderRadius: '8px', border: 0, backgroundColor: MC_COLORS.brandInk, color: '#fff', fontWeight: 600, cursor: 'pointer'}}
              >
                {savingProfile ? 'Đang lưu…' : 'Lưu hồ sơ cá nhân'}
              </button>
            </form>
          </section>

          <section style={{backgroundColor: '#fff', border: `1px solid ${MC_COLORS.mintBorder}`, borderRadius: '14px', padding: '18px'}}>
            <h3 style={{margin: '0 0 10px', fontSize: '16px', color: MC_COLORS.textInk}}>Ủy quyền người thân (Guardian Delegation)</h3>
            <form method="POST" onSubmit={handleAddGuardian} style={{display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'flex-start', marginBottom: '14px'}}>
              <div style={{display: 'grid', gap: '4px', minWidth: '240px', flex: 1}}>
                <label htmlFor="guardian-email" style={{fontSize: '13px', fontWeight: 600}}>Email tài khoản người thân</label>
                <input
                  id="guardian-email"
                  name="guardianEmail"
                  className="mc-form-control"
                  type="email"
                  required
                  spellCheck={false}
                  autoCapitalize="none"
                  autoComplete="email"
                  enterKeyHint="next"
                  aria-invalid={guardianEmailError ? 'true' : 'false'}
                  aria-describedby={guardianEmailError ? guardianEmailErrId : undefined}
                  value={guardianEmail}
                  onChange={(e) => setGuardianEmail(e.target.value)}
                  onBlur={() => markTouched('guardianEmail')}
                  placeholder="nguoithan@email.com"
                  style={CONTROL_STYLE}
                />
                {guardianEmailError && <p id={guardianEmailErrId} style={FIELD_ERROR_STYLE}>{guardianEmailError}</p>}
              </div>
              <div style={{display: 'grid', gap: '4px', minWidth: '160px'}}>
                <label htmlFor="guardian-rel" style={{fontSize: '13px', fontWeight: 600}}>Quan hệ</label>
                <input
                  id="guardian-rel"
                  name="relationship"
                  className="mc-form-control"
                  type="text"
                  enterKeyHint="done"
                  value={relationship}
                  onChange={(e) => setRelationship(e.target.value)}
                  style={CONTROL_STYLE}
                />
              </div>
              <button
                type="submit"
                disabled={savingGuardian}
                style={{marginTop: '22px', padding: '10px 16px', borderRadius: '8px', border: 0, backgroundColor: MC_COLORS.brandInk, color: '#fff', fontWeight: 600, minHeight: '48px', cursor: 'pointer'}}
              >
                {savingGuardian ? 'Đang thêm…' : 'Cấp quyền người thân'}
              </button>
            </form>
            {data.guardians.length === 0 ? (
              <p style={{margin: 0, fontSize: '13px', color: MC_COLORS.textSubtle}}>Chưa có người thân nào được ủy quyền.</p>
            ) : (
              <ul style={{listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '8px'}}>
                {data.guardians.map((g) => (
                  <li key={g.id} style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${MC_COLORS.mintBorder}`}}>
                    <div>
                      <strong style={{fontSize: '14px'}}>{g.guardianName}</strong>{' '}
                      <span style={{fontSize: '13px', color: MC_COLORS.textSubtle}}>({g.guardianEmail} · {g.scope})</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleRevokeGuardian(g.id)}
                      style={{minHeight: '40px', padding: '6px 12px', borderRadius: '6px', border: '1px solid #fecaca', backgroundColor: '#fef2f2', color: '#991b1b', fontSize: '12px', fontWeight: 600, cursor: 'pointer'}}
                    >
                      Thu hồi
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section style={{backgroundColor: '#fff', border: `1px solid ${MC_COLORS.mintBorder}`, borderRadius: '14px', padding: '18px', display: 'grid', gap: '16px'}}>
            <h3 style={{margin: 0, fontSize: '16px', color: MC_COLORS.textInk}}>Bảo mật tài khoản</h3>
            {!data.user.emailVerified && (
              <form method="POST" onSubmit={handleVerifyEmail} style={{display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'flex-start'}}>
                <div style={{display: 'grid', gap: '4px', minWidth: '240px', flex: 1}}>
                  <label htmlFor="verify-email-token" style={{fontSize: '13px', fontWeight: 600}}>Mã xác minh email</label>
                  <input
                    id="verify-email-token"
                    name="verifyToken"
                    className="mc-form-control"
                    type="text"
                    required
                    spellCheck={false}
                    autoCapitalize="none"
                    enterKeyHint="done"
                    aria-invalid={verifyTokenError ? 'true' : 'false'}
                    aria-describedby={verifyTokenError ? verifyTokenErrId : undefined}
                    value={verifyToken}
                    onChange={(e) => setVerifyToken(e.target.value)}
                    onBlur={() => markTouched('verifyToken')}
                    placeholder="Nhập mã xác minh nhận được khi đăng ký"
                    style={CONTROL_STYLE}
                  />
                  {verifyTokenError && <p id={verifyTokenErrId} style={FIELD_ERROR_STYLE}>{verifyTokenError}</p>}
                </div>
                <button
                  type="submit"
                  disabled={savingSecurity}
                  style={{marginTop: '22px', padding: '10px 16px', borderRadius: '8px', border: `1px solid ${MC_COLORS.brandInk}`, backgroundColor: '#fff', color: MC_COLORS.brandInk, fontWeight: 600, minHeight: '48px', cursor: 'pointer'}}
                >
                  Xác minh email
                </button>
              </form>
            )}

            <form method="POST" onSubmit={handleChangePassword} style={{display: 'grid', gap: '14px', maxWidth: '420px'}}>
              <div style={{display: 'grid', gap: '4px'}}>
                <label htmlFor="current-password" style={{fontSize: '13px', fontWeight: 600}}>Mật khẩu hiện tại</label>
                <input
                  id="current-password"
                  name="currentPassword"
                  className="mc-form-control"
                  type="password"
                  required
                  autoComplete="current-password"
                  enterKeyHint="next"
                  aria-invalid={currentPasswordError ? 'true' : 'false'}
                  aria-describedby={currentPasswordError ? currentPassErrId : undefined}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  onBlur={() => markTouched('currentPassword')}
                  style={CONTROL_STYLE}
                />
                {currentPasswordError && <p id={currentPassErrId} style={FIELD_ERROR_STYLE}>{currentPasswordError}</p>}
              </div>
              <div style={{display: 'grid', gap: '4px'}}>
                <label htmlFor="change-new-password" style={{fontSize: '13px', fontWeight: 600}}>Mật khẩu mới (tối thiểu 12 ký tự)</label>
                <input
                  id="change-new-password"
                  name="newPassword"
                  className="mc-form-control"
                  type="password"
                  required
                  minLength={12}
                  autoComplete="new-password"
                  enterKeyHint="done"
                  aria-invalid={newPasswordError ? 'true' : 'false'}
                  aria-describedby={newPasswordError ? newPassErrId : undefined}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  onBlur={() => markTouched('newPassword')}
                  style={CONTROL_STYLE}
                />
                {newPasswordError && <p id={newPassErrId} style={FIELD_ERROR_STYLE}>{newPasswordError}</p>}
              </div>
              <button
                type="submit"
                disabled={savingSecurity}
                style={{width: 'fit-content', minHeight: '48px', padding: '10px 18px', borderRadius: '8px', border: 0, backgroundColor: MC_COLORS.brandInk, color: '#fff', fontWeight: 600, cursor: 'pointer'}}
              >
                {savingSecurity ? 'Đang cập nhật…' : 'Đổi mật khẩu'}
              </button>
            </form>
          </section>
        </>
      )}
    </div>
  );
}
