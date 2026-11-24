'use client';

import {useEffect, useState, type FormEvent} from 'react';
import {MC_COLORS} from '@/lib/design-tokens';

interface AdminOverviewData {
  departments: Array<{id: string; code: string; name: string}>;
  practitioners: Array<{
    id: string;
    displayName: string;
    specialty: string;
    roomLabel: string;
    degreeTitle: string;
    departmentName: string;
  }>;
  staffMembers: Array<{
    membershipId: string;
    userId: string;
    email: string;
    displayName: string;
    role: string;
    status: string;
  }>;
}

export function AdminPanel({onUpdated}: {onUpdated?: () => void}) {
  const [data, setData] = useState<AdminOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusMsg, setStatusMsg] = useState('');

  const [deptName, setDeptName] = useState('');
  const [staffName, setStaffName] = useState('');
  const [staffEmail, setStaffEmail] = useState('');
  const [staffPassword, setStaffPassword] = useState('');
  const [staffRole, setStaffRole] = useState<'PHYSICIAN' | 'RECEPTIONIST' | 'NURSE' | 'AUDITOR'>('PHYSICIAN');
  const [specialty, setSpecialty] = useState('Nội tổng quát');
  const [roomLabel, setRoomLabel] = useState('Phòng khám 201');
  const [departmentId, setDepartmentId] = useState('');

  const [slotPractitionerId, setSlotPractitionerId] = useState('');
  const [slotDate, setSlotDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [slotCapacity, setSlotCapacity] = useState('4');

  const loadAdmin = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/bff/admin', {cache: 'no-store', credentials: 'same-origin'});
      const json = (await res.json()) as AdminOverviewData & {error?: {message?: string}};
      if (!res.ok) throw new Error(json.error?.message ?? 'Không thể tải dữ liệu quản trị.');
      setData(json);
      if (!departmentId && json.departments[0]) setDepartmentId(json.departments[0].id);
      if (!slotPractitionerId && json.practitioners[0]) setSlotPractitionerId(json.practitioners[0].id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi tải dữ liệu quản trị.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAdmin();
  }, []);

  const handleCreateDept = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setStatusMsg('');
    try {
      const res = await fetch('/api/bff/admin', {
        method: 'POST',
        headers: {'content-type': 'application/json'},
        credentials: 'same-origin',
        body: JSON.stringify({action: 'create_department', departmentName: deptName.trim()}),
      });
      const json = (await res.json()) as {error?: {message?: string}};
      if (!res.ok) throw new Error(json.error?.message ?? 'Không thể tạo khoa/phòng.');
      setDeptName('');
      setStatusMsg('Đã thêm khoa/phòng mới.');
      await loadAdmin();
      onUpdated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi tạo khoa/phòng.');
    }
  };

  const handleProvisionStaff = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setStatusMsg('');
    try {
      const res = await fetch('/api/bff/admin', {
        method: 'POST',
        headers: {'content-type': 'application/json'},
        credentials: 'same-origin',
        body: JSON.stringify({
          action: 'provision_staff',
          fullName: staffName.trim(),
          email: staffEmail.trim(),
          password: staffPassword,
          role: staffRole,
          departmentId: departmentId || undefined,
          specialty: specialty.trim(),
          roomLabel: roomLabel.trim(),
        }),
      });
      const json = (await res.json()) as {error?: {message?: string}};
      if (!res.ok) throw new Error(json.error?.message ?? 'Không thể cấp tài khoản nhân viên.');
      setStaffName('');
      setStaffEmail('');
      setStaffPassword('');
      setStatusMsg('Đã cấp tài khoản nhân viên y tế thành công.');
      await loadAdmin();
      onUpdated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi cấp tài khoản.');
    }
  };

  const handlePublishSlots = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setStatusMsg('');
    try {
      const res = await fetch('/api/bff/admin', {
        method: 'POST',
        headers: {'content-type': 'application/json'},
        credentials: 'same-origin',
        body: JSON.stringify({
          action: 'publish_slots',
          practitionerId: slotPractitionerId,
          date: slotDate,
          startHour: 8,
          endHour: 17,
          capacity: Number(slotCapacity || 4),
        }),
      });
      const json = (await res.json()) as {error?: {message?: string}};
      if (!res.ok) throw new Error(json.error?.message ?? 'Không thể mở khung giờ khám.');
      setStatusMsg(`Đã mở khung giờ khám ngày ${slotDate} (08:00–17:00).`);
      onUpdated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi mở khung giờ.');
    }
  };

  if (loading) {
    return (
      <section style={{backgroundColor: '#fff', border: `1px solid ${MC_COLORS.mintBorder}`, borderRadius: '14px', padding: '18px'}}>
        <progress className="loading-spinner" aria-label="Đang tải quản trị cơ sở" />
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
            <h3 style={{margin: '0 0 10px', fontSize: '16px', color: MC_COLORS.textInk}}>Quản lý Khoa / Phòng khám</h3>
            <form method="POST" onSubmit={handleCreateDept} style={{display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'flex-end', marginBottom: '12px'}}>
              <div style={{display: 'grid', gap: '4px', minWidth: '240px', flex: 1}}>
                <label htmlFor="admin-dept-name" style={{fontSize: '13px', fontWeight: 600}}>Tên khoa / phòng mới</label>
                <input
                  id="admin-dept-name"
                  name="departmentName"
                  type="text"
                  required
                  value={deptName}
                  onChange={(e) => setDeptName(e.target.value)}
                  placeholder="Ví dụ: Khoa Tim mạch"
                  style={{padding: '10px 12px', borderRadius: '8px', border: `1px solid ${MC_COLORS.mintBorder}`, minHeight: '44px'}}
                />
              </div>
              <button type="submit" style={{padding: '10px 16px', borderRadius: '8px', border: 0, backgroundColor: MC_COLORS.brandInk, color: '#fff', fontWeight: 600, minHeight: '44px', cursor: 'pointer'}}>
                Thêm khoa/phòng
              </button>
            </form>
            <p style={{margin: 0, fontSize: '13px', color: MC_COLORS.textSubtle}}>
              Hiện có {data.departments.length} khoa/phòng: {data.departments.map((d) => d.name).join(', ') || 'Chưa có'}
            </p>
          </section>

          <section style={{backgroundColor: '#fff', border: `1px solid ${MC_COLORS.mintBorder}`, borderRadius: '14px', padding: '18px'}}>
            <h3 style={{margin: '0 0 10px', fontSize: '16px', color: MC_COLORS.textInk}}>Cấp tài khoản Bác sĩ & Nhân viên y tế</h3>
            <form method="POST" onSubmit={handleProvisionStaff} style={{display: 'grid', gap: '12px', maxWidth: '580px'}}>
              <div style={{display: 'grid', gap: '4px'}}>
                <label htmlFor="staff-fullname" style={{fontSize: '13px', fontWeight: 600}}>Họ và tên</label>
                <input id="staff-fullname" name="fullName" type="text" required autoComplete="name" value={staffName} onChange={(e) => setStaffName(e.target.value)} style={{padding: '10px 12px', borderRadius: '8px', border: `1px solid ${MC_COLORS.mintBorder}`, minHeight: '44px'}} />
              </div>
              <div style={{display: 'grid', gap: '4px'}}>
                <label htmlFor="staff-email" style={{fontSize: '13px', fontWeight: 600}}>Email công việc</label>
                <input id="staff-email" name="email" type="email" required spellCheck={false} autoCapitalize="none" value={staffEmail} onChange={(e) => setStaffEmail(e.target.value)} style={{padding: '10px 12px', borderRadius: '8px', border: `1px solid ${MC_COLORS.mintBorder}`, minHeight: '44px'}} />
              </div>
              <div style={{display: 'grid', gap: '4px'}}>
                <label htmlFor="staff-password" style={{fontSize: '13px', fontWeight: 600}}>Mật khẩu khởi tạo (tối thiểu 12 ký tự)</label>
                <input id="staff-password" name="password" type="password" required minLength={12} autoComplete="new-password" value={staffPassword} onChange={(e) => setStaffPassword(e.target.value)} style={{padding: '10px 12px', borderRadius: '8px', border: `1px solid ${MC_COLORS.mintBorder}`, minHeight: '44px'}} />
              </div>
              <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px'}}>
                <div style={{display: 'grid', gap: '4px'}}>
                  <label htmlFor="staff-role" style={{fontSize: '13px', fontWeight: 600}}>Vai trò</label>
                  <select id="staff-role" name="role" value={staffRole} onChange={(e) => setStaffRole(e.target.value as typeof staffRole)} style={{padding: '10px 12px', borderRadius: '8px', border: `1px solid ${MC_COLORS.mintBorder}`, minHeight: '44px'}}>
                    <option value="PHYSICIAN">Bác sĩ (PHYSICIAN)</option>
                    <option value="RECEPTIONIST">Lễ tân (RECEPTIONIST)</option>
                    <option value="NURSE">Điều dưỡng (NURSE)</option>
                    <option value="AUDITOR">Kiểm toán (AUDITOR)</option>
                  </select>
                </div>
                <div style={{display: 'grid', gap: '4px'}}>
                  <label htmlFor="staff-dept" style={{fontSize: '13px', fontWeight: 600}}>Khoa / Phòng</label>
                  <select id="staff-dept" name="departmentId" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} style={{padding: '10px 12px', borderRadius: '8px', border: `1px solid ${MC_COLORS.mintBorder}`, minHeight: '44px'}}>
                    <option value="">-- Mặc định --</option>
                    {data.departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              {staffRole === 'PHYSICIAN' && (
                <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px'}}>
                  <div style={{display: 'grid', gap: '4px'}}>
                    <label htmlFor="staff-specialty" style={{fontSize: '13px', fontWeight: 600}}>Chuyên khoa</label>
                    <input id="staff-specialty" name="specialty" type="text" value={specialty} onChange={(e) => setSpecialty(e.target.value)} style={{padding: '10px 12px', borderRadius: '8px', border: `1px solid ${MC_COLORS.mintBorder}`, minHeight: '44px'}} />
                  </div>
                  <div style={{display: 'grid', gap: '4px'}}>
                    <label htmlFor="staff-room" style={{fontSize: '13px', fontWeight: 600}}>Phòng khám</label>
                    <input id="staff-room" name="roomLabel" type="text" value={roomLabel} onChange={(e) => setRoomLabel(e.target.value)} style={{padding: '10px 12px', borderRadius: '8px', border: `1px solid ${MC_COLORS.mintBorder}`, minHeight: '44px'}} />
                  </div>
                </div>
              )}
              <button type="submit" style={{width: 'fit-content', padding: '10px 16px', borderRadius: '8px', border: 0, backgroundColor: MC_COLORS.brandInk, color: '#fff', fontWeight: 600, cursor: 'pointer'}}>
                Cấp tài khoản nhân viên
              </button>
            </form>
          </section>

          <section style={{backgroundColor: '#fff', border: `1px solid ${MC_COLORS.mintBorder}`, borderRadius: '14px', padding: '18px'}}>
            <h3 style={{margin: '0 0 10px', fontSize: '16px', color: MC_COLORS.textInk}}>Công bố Khung giờ khám (Publish Slots)</h3>
            <form method="POST" onSubmit={handlePublishSlots} style={{display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'flex-end'}}>
              <div style={{display: 'grid', gap: '4px', minWidth: '220px', flex: 1}}>
                <label htmlFor="slot-doctor" style={{fontSize: '13px', fontWeight: 600}}>Bác sĩ</label>
                <select id="slot-doctor" name="practitionerId" value={slotPractitionerId} onChange={(e) => setSlotPractitionerId(e.target.value)} style={{padding: '10px 12px', borderRadius: '8px', border: `1px solid ${MC_COLORS.mintBorder}`, minHeight: '44px'}}>
                  {data.practitioners.map((p) => (
                    <option key={p.id} value={p.id}>{p.displayName} ({p.specialty})</option>
                  ))}
                </select>
              </div>
              <div style={{display: 'grid', gap: '4px'}}>
                <label htmlFor="slot-date" style={{fontSize: '13px', fontWeight: 600}}>Ngày khám</label>
                <input id="slot-date" name="date" type="date" required value={slotDate} onChange={(e) => setSlotDate(e.target.value)} style={{padding: '10px 12px', borderRadius: '8px', border: `1px solid ${MC_COLORS.mintBorder}`, minHeight: '44px'}} />
              </div>
              <div style={{display: 'grid', gap: '4px', width: '110px'}}>
                <label htmlFor="slot-cap" style={{fontSize: '13px', fontWeight: 600}}>Số lượt/giờ</label>
                <input id="slot-cap" name="capacity" type="text" inputMode="numeric" value={slotCapacity} onChange={(e) => setSlotCapacity(e.target.value)} style={{padding: '10px 12px', borderRadius: '8px', border: `1px solid ${MC_COLORS.mintBorder}`, minHeight: '44px'}} />
              </div>
              <button type="submit" style={{padding: '10px 16px', borderRadius: '8px', border: 0, backgroundColor: MC_COLORS.brandInk, color: '#fff', fontWeight: 600, minHeight: '44px', cursor: 'pointer'}}>
                Mở lịch 08:00–17:00
              </button>
            </form>
          </section>
        </>
      )}
    </div>
  );
}
