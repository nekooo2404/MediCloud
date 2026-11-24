'use client';

import {useEffect, useState, type FormEvent} from 'react';
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

export function ProfilePanel({onUpdated}: {onUpdated?: () => void}) {
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
            <form method="POST" onSubmit={handleSaveProfile} style={{display: 'grid', gap: '12px', maxWidth: '560px'}}>
              <div style={{display: 'grid', gap: '4px'}}>
                <label htmlFor="profile-name" style={{fontSize: '13px', fontWeight: 600}}>Họ và tên</label>
                <input
                  id="profile-name"
                  name="displayName"
                  type="text"
                  required
                  autoComplete="name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  style={{padding: '10px 12px', borderRadius: '8px', border: `1px solid ${MC_COLORS.mintBorder}`, minHeight: '44px'}}
                />
              </div>
              <div style={{display: 'grid', gap: '4px'}}>
                <label htmlFor="profile-blood" style={{fontSize: '13px', fontWeight: 600}}>Nhóm máu</label>
                <input
                  id="profile-blood"
                  name="bloodType"
                  type="text"
                  value={bloodType}
                  onChange={(e) => setBloodType(e.target.value)}
                  placeholder="Ví dụ: O+, A-, AB+"
                  style={{padding: '10px 12px', borderRadius: '8px', border: `1px solid ${MC_COLORS.mintBorder}`, minHeight: '44px'}}
                />
              </div>
              <div style={{display: 'grid', gap: '4px'}}>
                <label htmlFor="profile-allergies" style={{fontSize: '13px', fontWeight: 600}}>Tiền sử dị ứng (cách nhau bằng dấu phẩy)</label>
                <input
                  id="profile-allergies"
                  name="allergies"
                  type="text"
                  value={allergiesText}
                  onChange={(e) => setAllergiesText(e.target.value)}
                  placeholder="Ví dụ: Penicillin, Hải sản"
                  style={{padding: '10px 12px', borderRadius: '8px', border: `1px solid ${MC_COLORS.mintBorder}`, minHeight: '44px'}}
                />
              </div>
              <div style={{display: 'grid', gap: '4px'}}>
                <label htmlFor="profile-notes" style={{fontSize: '13px', fontWeight: 600}}>Ghi chú cho đội ngũ điều trị</label>
                <textarea
                  id="profile-notes"
                  name="careTeamNotes"
                  rows={3}
                  value={careTeamNotes}
                  onChange={(e) => setCareTeamNotes(e.target.value)}
                  style={{padding: '10px 12px', borderRadius: '8px', border: `1px solid ${MC_COLORS.mintBorder}`}}
                />
              </div>
              <button
                type="submit"
                disabled={savingProfile}
                style={{width: 'fit-content', padding: '10px 16px', borderRadius: '8px', border: 0, backgroundColor: MC_COLORS.brandInk, color: '#fff', fontWeight: 600, cursor: 'pointer'}}
              >
                {savingProfile ? 'Đang lưu…' : 'Lưu hồ sơ cá nhân'}
              </button>
            </form>
          </section>

          <section style={{backgroundColor: '#fff', border: `1px solid ${MC_COLORS.mintBorder}`, borderRadius: '14px', padding: '18px'}}>
            <h3 style={{margin: '0 0 10px', fontSize: '16px', color: MC_COLORS.textInk}}>Ủy quyền người thân (Guardian Delegation)</h3>
            <form method="POST" onSubmit={handleAddGuardian} style={{display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'flex-end', marginBottom: '14px'}}>
              <div style={{display: 'grid', gap: '4px', minWidth: '240px', flex: 1}}>
                <label htmlFor="guardian-email" style={{fontSize: '13px', fontWeight: 600}}>Email tài khoản người thân</label>
                <input
                  id="guardian-email"
                  name="guardianEmail"
                  type="email"
                  required
                  spellCheck={false}
                  autoCapitalize="none"
                  value={guardianEmail}
                  onChange={(e) => setGuardianEmail(e.target.value)}
                  placeholder="nguoithan@email.com"
                  style={{padding: '10px 12px', borderRadius: '8px', border: `1px solid ${MC_COLORS.mintBorder}`, minHeight: '44px'}}
                />
              </div>
              <div style={{display: 'grid', gap: '4px', minWidth: '160px'}}>
                <label htmlFor="guardian-rel" style={{fontSize: '13px', fontWeight: 600}}>Quan hệ</label>
                <input
                  id="guardian-rel"
                  name="relationship"
                  type="text"
                  value={relationship}
                  onChange={(e) => setRelationship(e.target.value)}
                  style={{padding: '10px 12px', borderRadius: '8px', border: `1px solid ${MC_COLORS.mintBorder}`, minHeight: '44px'}}
                />
              </div>
              <button
                type="submit"
                disabled={savingGuardian}
                style={{padding: '10px 16px', borderRadius: '8px', border: 0, backgroundColor: MC_COLORS.brandInk, color: '#fff', fontWeight: 600, minHeight: '44px', cursor: 'pointer'}}
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
                      style={{padding: '6px 10px', borderRadius: '6px', border: '1px solid #fecaca', backgroundColor: '#fef2f2', color: '#991b1b', fontSize: '12px', fontWeight: 600, cursor: 'pointer'}}
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
              <form method="POST" onSubmit={handleVerifyEmail} style={{display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'flex-end'}}>
                <div style={{display: 'grid', gap: '4px', minWidth: '240px', flex: 1}}>
                  <label htmlFor="verify-email-token" style={{fontSize: '13px', fontWeight: 600}}>Mã xác minh email</label>
                  <input
                    id="verify-email-token"
                    name="verifyToken"
                    type="text"
                    required
                    spellCheck={false}
                    value={verifyToken}
                    onChange={(e) => setVerifyToken(e.target.value)}
                    placeholder="Nhập mã xác minh nhận được khi đăng ký"
                    style={{padding: '10px 12px', borderRadius: '8px', border: `1px solid ${MC_COLORS.mintBorder}`, minHeight: '44px'}}
                  />
                </div>
                <button
                  type="submit"
                  disabled={savingSecurity}
                  style={{padding: '10px 16px', borderRadius: '8px', border: `1px solid ${MC_COLORS.brandInk}`, backgroundColor: '#fff', color: MC_COLORS.brandInk, fontWeight: 600, minHeight: '44px', cursor: 'pointer'}}
                >
                  Xác minh email
                </button>
              </form>
            )}

            <form method="POST" onSubmit={handleChangePassword} style={{display: 'grid', gap: '12px', maxWidth: '420px'}}>
              <div style={{display: 'grid', gap: '4px'}}>
                <label htmlFor="current-password" style={{fontSize: '13px', fontWeight: 600}}>Mật khẩu hiện tại</label>
                <input
                  id="current-password"
                  name="currentPassword"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  style={{padding: '10px 12px', borderRadius: '8px', border: `1px solid ${MC_COLORS.mintBorder}`, minHeight: '44px'}}
                />
              </div>
              <div style={{display: 'grid', gap: '4px'}}>
                <label htmlFor="change-new-password" style={{fontSize: '13px', fontWeight: 600}}>Mật khẩu mới (tối thiểu 12 ký tự)</label>
                <input
                  id="change-new-password"
                  name="newPassword"
                  type="password"
                  required
                  minLength={12}
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  style={{padding: '10px 12px', borderRadius: '8px', border: `1px solid ${MC_COLORS.mintBorder}`, minHeight: '44px'}}
                />
              </div>
              <button
                type="submit"
                disabled={savingSecurity}
                style={{width: 'fit-content', padding: '10px 16px', borderRadius: '8px', border: 0, backgroundColor: MC_COLORS.brandInk, color: '#fff', fontWeight: 600, cursor: 'pointer'}}
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
