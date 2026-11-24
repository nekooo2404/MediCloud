'use client'

import Link from 'next/link'
import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
} from 'react'

export interface AuthScreenProps {
  mode: 'login' | 'signup'
}

type FieldKey =
  | 'fullName'
  | 'email'
  | 'password'
  | 'newPassword'
  | 'confirmPassword'
  | 'consent'

interface FieldValues {
  fullName: string
  email: string
  password: string
  newPassword: string
  confirmPassword: string
  consent: boolean
  rememberMe: boolean
}

const INITIAL_VALUES: FieldValues = {
  fullName: '',
  email: '',
  password: '',
  newPassword: '',
  confirmPassword: '',
  consent: false,
  rememberMe: false,
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validateAuthField(
  mode: 'login' | 'signup',
  field: FieldKey,
  values: FieldValues,
): string | null {
  switch (field) {
    case 'fullName': {
      if (mode !== 'signup') return null
      return values.fullName.trim().length > 0
        ? null
        : 'Vui lòng nhập họ và tên.'
    }
    case 'email': {
      const trimmed = values.email.trim()
      if (!trimmed) return 'Vui lòng nhập địa chỉ email.'
      if (!EMAIL_PATTERN.test(trimmed)) {
        return 'Vui lòng nhập địa chỉ email hợp lệ (ví dụ: vidu@email.com).'
      }
      return null
    }
    case 'password': {
      if (mode !== 'login') return null
      return values.password.length > 0 ? null : 'Vui lòng nhập mật khẩu.'
    }
    case 'newPassword': {
      if (mode !== 'signup') return null
      if (!values.newPassword) return 'Vui lòng tạo mật khẩu.'
      if (values.newPassword.length < 12) {
        return 'Mật khẩu phải có ít nhất 12 ký tự.'
      }
      return null
    }
    case 'confirmPassword': {
      if (mode !== 'signup') return null
      if (!values.confirmPassword) {
        return 'Vui lòng nhập lại mật khẩu xác nhận.'
      }
      if (values.confirmPassword !== values.newPassword) {
        return 'Mật khẩu xác nhận chưa khớp.'
      }
      return null
    }
    case 'consent': {
      if (mode !== 'signup') return null
      return values.consent
        ? null
        : 'Vui lòng xác nhận đây là giao diện thử nghiệm và không nhập dữ liệu thật.'
    }
  }
}

const FIELD_LABELS: Record<FieldKey, string> = {
  fullName: 'Họ và tên',
  email: 'Địa chỉ email',
  password: 'Mật khẩu',
  newPassword: 'Mật khẩu',
  confirmPassword: 'Xác nhận mật khẩu',
  consent: 'Xác nhận dữ liệu thử nghiệm',
}

function BrandCloudIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path
        d="M7 14h10M12 9v10"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <path
        d="M6.3 19.6a4.8 4.8 0 0 1-.7-9.5A6.8 6.8 0 0 1 18.7 8.5a5.6 5.6 0 0 1 .1 11.1"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  )
}

function ShieldCheckSvg() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 22s7-3.5 7-10V5l-7-3-7 3v7c0 6.5 7 10 7 10Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  )
}

function LockSvg({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="5" y="10" width="14" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" />
    </svg>
  )
}

function MailSvg({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m4 7 8 6 8-6" />
    </svg>
  )
}

function UserSvg({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="8" r="3.5" />
      <path d="M4 21v-2a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v2" />
    </svg>
  )
}

function UserPlusSvg() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="10" cy="8" r="3.5" />
      <path d="M3 21v-2a6 6 0 0 1 6-6h2a6 6 0 0 1 5 3M19 11v6m-3-3h6" />
    </svg>
  )
}

function EyeToggleSvg({ visible }: { visible: boolean }) {
  if (visible) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M3 3l18 18" />
        <path d="M10.6 10.6a2.5 2.5 0 0 0 3.4 3.4" />
        <path d="M9.4 5.3A10.7 10.7 0 0 1 12 5c6.4 0 10 7 10 7a16.8 16.8 0 0 1-3.3 4.3" />
        <path d="M6.2 6.8A16.5 16.5 0 0 0 2 12s3.6 7 10 7a9.7 9.7 0 0 0 4-.8" />
      </svg>
    )
  }
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6Z" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  )
}

function ArrowRightSvg() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 12h15m-6-6 6 6-6 6" />
    </svg>
  )
}

function MedicalBoxSvg() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="M12 8v8M8 12h8" />
    </svg>
  )
}

function EcosystemHubArt() {
  return (
    <svg viewBox="0 0 500 340" fill="none" aria-hidden="true">
      <circle cx="250" cy="169" r="153" stroke="#9cddc6" strokeOpacity="0.15" />
      <circle
        cx="250"
        cy="169"
        r="118"
        stroke="#9cddc6"
        strokeOpacity="0.22"
        strokeDasharray="3 7"
      />
      <circle
        cx="250"
        cy="169"
        r="86"
        fill="#d4f4e6"
        fillOpacity="0.07"
        stroke="#9cddc6"
        strokeOpacity="0.3"
      />
      <path
        d="M250 48v48M113 176h53m168 0h53M250 249v42"
        stroke="#9bdfc4"
        strokeOpacity="0.8"
        strokeWidth="1.5"
        strokeDasharray="4 6"
      />
      <circle cx="250" cy="169" r="65" fill="#e8f7f1" />
      <circle cx="250" cy="169" r="54" stroke="#95cdbb" strokeWidth="1.3" />
      <path
        d="M219 179h62M250 148v62"
        stroke="#126b56"
        strokeWidth="11"
        strokeLinecap="round"
      />
      <path
        d="M208 184a19 19 0 0 1 0-38 25 25 0 0 1 48-4 22 22 0 0 1 28 31"
        stroke="#126b56"
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.65"
      />
      <g>
        <rect
          x="160"
          y="10"
          width="180"
          height="65"
          rx="14"
          fill="#f3fbf7"
          stroke="#c6ebdc"
        />
        <rect x="174" y="23" width="39" height="39" rx="10" fill="#d7f0e5" />
        <path
          d="M183 33h21v20h-21zm0 5h21m-15-8v6m9-6v6"
          stroke="#126b56"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <text x="225" y="38" fill="#153d38" fontSize="14" fontWeight="700">
          Lịch hẹn
        </text>
        <text x="225" y="54" fill="#4b615d" fontSize="12">
          Chủ động đặt lịch
        </text>
      </g>
      <g>
        <rect
          x="5"
          y="143"
          width="155"
          height="66"
          rx="14"
          fill="#f3fbf7"
          stroke="#c6ebdc"
        />
        <rect x="17" y="156" width="37" height="39" rx="10" fill="#d7f0e5" />
        <path
          d="M27 166h17v19H27zm4 5h9m-9 5h9m-9 5h5"
          stroke="#126b56"
          strokeWidth="1.7"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <text x="63" y="171" fill="#153d38" fontSize="13" fontWeight="700">
          Hồ sơ y tế
        </text>
        <text x="63" y="187" fill="#4b615d" fontSize="12">
          Dễ dàng tra cứu
        </text>
      </g>
      <g>
        <rect
          x="340"
          y="143"
          width="155"
          height="66"
          rx="14"
          fill="#f3fbf7"
          stroke="#c6ebdc"
        />
        <rect x="352" y="156" width="37" height="39" rx="10" fill="#d7f0e5" />
        <path
          d="M358 176h6l4-9 5 17 4-8h6"
          stroke="#126b56"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <text x="398" y="171" fill="#153d38" fontSize="13" fontWeight="700">
          Sức khỏe
        </text>
        <text x="398" y="187" fill="#4b615d" fontSize="12">
          Theo dõi chỉ số
        </text>
      </g>
      <g>
        <rect
          x="160"
          y="264"
          width="180"
          height="65"
          rx="14"
          fill="#f3fbf7"
          stroke="#c6ebdc"
        />
        <rect x="174" y="277" width="39" height="39" rx="10" fill="#d7f0e5" />
        <path
          d="M194 307s9-4 9-11v-6l-9-4-9 4v6c0 7 9 11 9 11zm-4-11 3 3 5-6"
          stroke="#126b56"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <text x="225" y="292" fill="#153d38" fontSize="14" fontWeight="700">
          Tài khoản
        </text>
        <text x="225" y="308" fill="#4b615d" fontSize="12">
          Quyền riêng tư
        </text>
      </g>
      <circle cx="250" cy="91" r="3.5" fill="#a8e6c9" />
      <circle cx="166" cy="176" r="3.5" fill="#a8e6c9" />
      <circle cx="334" cy="176" r="3.5" fill="#a8e6c9" />
      <circle cx="250" cy="252" r="3.5" fill="#a8e6c9" />
    </svg>
  )
}

// UI prototype only. Never transmit, log, or persist credentials. Replace with approved OIDC flow.
export function AuthScreen({ mode }: AuthScreenProps) {
  const isSignup = mode === 'signup'
  const titleId = useId()
  const passwordHintId = useId()
  const fullNameErrorId = useId()
  const emailErrorId = useId()
  const passwordErrorId = useId()
  const newPasswordErrorId = useId()
  const confirmPasswordErrorId = useId()
  const consentErrorId = useId()

  const fullNameRef = useRef<HTMLInputElement | null>(null)
  const emailRef = useRef<HTMLInputElement | null>(null)
  const passwordRef = useRef<HTMLInputElement | null>(null)
  const newPasswordRef = useRef<HTMLInputElement | null>(null)
  const confirmPasswordRef = useRef<HTMLInputElement | null>(null)
  const consentRef = useRef<HTMLInputElement | null>(null)
  const announceTimerRef = useRef<number | undefined>(undefined)

  const [values, setValues] = useState<FieldValues>(INITIAL_VALUES)
  const [edited, setEdited] = useState<Partial<Record<FieldKey, boolean>>>({})
  const [blurred, setBlurred] = useState<Partial<Record<FieldKey, boolean>>>({})
  const [submitted, setSubmitted] = useState(false)
  const [notice, setNotice] = useState('')
  const [liveAnnouncement, setLiveAnnouncement] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [showPassword, setShowPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  useEffect(() => {
    setValues(INITIAL_VALUES)
    setEdited({})
    setBlurred({})
    setSubmitted(false)
    setNotice('')
    setLiveAnnouncement('')
    setIsSubmitting(false)
    setShowPassword(false)
    setShowNewPassword(false)
    setShowConfirmPassword(false)
  }, [mode])

  useEffect(() => {
    return () => window.clearTimeout(announceTimerRef.current)
  }, [])

  const scheduleAnnouncement = (field: FieldKey, message: string | null) => {
    window.clearTimeout(announceTimerRef.current)
    if (!message) {
      setLiveAnnouncement('')
      return
    }
    setLiveAnnouncement('')
    announceTimerRef.current = window.setTimeout(() => {
      setLiveAnnouncement(`${FIELD_LABELS[field]}: ${message}`)
    }, 500)
  }

  const getFieldError = (field: FieldKey, currentValues = values): string | null => {
    const shouldShow = submitted || (Boolean(edited[field]) && Boolean(blurred[field]))
    if (!shouldShow) return null
    return validateAuthField(mode, field, currentValues)
  }

  const handleFieldBlur = (field: FieldKey) => {
    setBlurred((prev) => ({ ...prev, [field]: true }))
    if (edited[field]) {
      const msg = validateAuthField(mode, field, values)
      scheduleAnnouncement(field, msg)
    }
  }

  const updateTextField = (
    field: 'fullName' | 'email' | 'password' | 'newPassword' | 'confirmPassword',
    nextValue: string,
  ) => {
    const nextValues = { ...values, [field]: nextValue }
    setValues(nextValues)
    setEdited((prev) => ({ ...prev, [field]: true }))
    if (notice) setNotice('')

    if (submitted || (edited[field] && blurred[field])) {
      const msg = validateAuthField(mode, field, nextValues)
      if (!msg) {
        setLiveAnnouncement('')
      }
    }
  }

  const handleConsentChange = (checked: boolean) => {
    const nextValues = { ...values, consent: checked }
    setValues(nextValues)
    setEdited((prev) => ({ ...prev, consent: true }))
    setBlurred((prev) => ({ ...prev, consent: true }))
    if (notice) setNotice('')
    const msg = validateAuthField(mode, 'consent', nextValues)
    scheduleAnnouncement('consent', msg)
  }

  const handleForgotPassword = () => {
    setNotice('Tính năng khôi phục mật khẩu sẽ khả dụng khi tích hợp nhà cung cấp danh tính.')
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    window.clearTimeout(announceTimerRef.current)
    setSubmitted(true)

    const order: FieldKey[] = isSignup
      ? ['fullName', 'email', 'newPassword', 'confirmPassword', 'consent']
      : ['email', 'password']

    const refMap: Record<FieldKey, HTMLInputElement | null> = {
      fullName: fullNameRef.current,
      email: emailRef.current,
      password: passwordRef.current,
      newPassword: newPasswordRef.current,
      confirmPassword: confirmPasswordRef.current,
      consent: consentRef.current,
    }

    for (const key of order) {
      const error = validateAuthField(mode, key, values)
      if (error) {
        setNotice('')
        refMap[key]?.focus()
        return
      }
    }

    setIsSubmitting(true)
    setNotice('')
    try {
      const response = await fetch('/api/bff/session', {
        method: 'POST',
        headers: {'content-type': 'application/json'},
        credentials: 'same-origin',
        body: JSON.stringify({persona_id: isSignup ? 'patient-hospital-a' : 'patient-hospital-a'}),
      })
      const payload = (await response.json()) as {error?: {message?: string}}
      if (!response.ok) {
        throw new Error(payload.error?.message ?? 'Không thể tạo phiên đăng nhập.')
      }
      window.location.assign('/')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Không thể kết nối dịch vụ xác thực. Vui lòng thử lại.')
      setIsSubmitting(false)
    }
  }

  const fullNameError = getFieldError('fullName')
  const emailError = getFieldError('email')
  const passwordError = getFieldError('password')
  const newPasswordError = getFieldError('newPassword')
  const confirmPasswordError = getFieldError('confirmPassword')
  const consentError = getFieldError('consent')

  return (
    <div className="mc-auth">
      <header className="top">
        <Link className="brand" href="/login" aria-label="MediCloud — đăng nhập">
          <span className="brand-mark">
            <BrandCloudIcon />
          </span>
          MediCloud
        </Link>
        <div className="top-note">
          <span>{isSignup ? 'Đã có tài khoản?' : 'Chưa có tài khoản?'}</span>
          <Link className="top-link" href={isSignup ? '/login' : '/signup'}>
            {isSignup ? 'Đăng nhập' : 'Đăng ký ngay'}
          </Link>
        </div>
      </header>

      <main className={isSignup ? 'layout signup' : 'layout login'}>
        <aside className="visual" aria-label="Giới thiệu MediCloud">
          <div>
            <div className="visual-kicker">
              <span />
              Cổng thông tin người bệnh
            </div>
            {isSignup ? (
              <>
                <h2>
                  Bắt đầu hành trình
                  <br />
                  <em>chăm sóc sức khỏe.</em>
                </h2>
                <p>
                  Một tài khoản để quản lý lịch hẹn, hồ sơ y tế và theo dõi sức khỏe của
                  chính bạn.
                </p>
              </>
            ) : (
              <>
                <h2>
                  Sức khỏe của bạn,
                  <br />
                  <em>luôn trong tầm tay.</em>
                </h2>
                <p>
                  Đặt lịch khám, tra cứu hồ sơ và theo dõi sức khỏe trong một không gian y
                  tế số liền mạch.
                </p>
              </>
            )}
          </div>

          <div className="art">
            <EcosystemHubArt />
          </div>

          <div className="visual-foot">
            <ShieldCheckSvg />
            <span>Thiết kế hướng đến quyền riêng tư và trải nghiệm người bệnh.</span>
          </div>
        </aside>

        <section className="form-panel" aria-labelledby={titleId}>
          <div className="form-inner">
            <div className="mini-mark">
              {isSignup ? <UserPlusSvg /> : <LockSvg />}
            </div>
            <h1 id={titleId}>{isSignup ? 'Tạo tài khoản' : 'Chào mừng trở lại'}</h1>
            <p className="intro">
              {isSignup
                ? 'Đăng ký tài khoản người bệnh MediCloud.'
                : 'Đăng nhập vào tài khoản người bệnh MediCloud.'}
            </p>

            <form
              method="post"
              noValidate
              autoComplete="on"
              onSubmit={handleSubmit}
              data-auth-form={mode}
            >
              {isSignup && (
                <div className="field">
                  <label htmlFor="full-name">Họ và tên</label>
                  <div className="field-control">
                    <UserSvg className="field-icon" />
                    <input
                      ref={fullNameRef}
                      id="full-name"
                      name="full-name"
                      type="text"
                      placeholder="Nguyễn Văn An"
                      autoComplete="name"
                      enterKeyHint="next"
                      required
                      value={values.fullName}
                      aria-invalid={fullNameError ? 'true' : 'false'}
                      aria-describedby={fullNameError ? fullNameErrorId : undefined}
                      onChange={(e) => updateTextField('fullName', e.target.value)}
                      onBlur={() => handleFieldBlur('fullName')}
                    />
                  </div>
                  {fullNameError && (
                    <p id={fullNameErrorId} className="field-error">
                      {fullNameError}
                    </p>
                  )}
                </div>
              )}

              <div className="field">
                <label htmlFor={isSignup ? 'signup-email' : 'login-email'}>
                  Địa chỉ email
                </label>
                <div className="field-control">
                  <MailSvg className="field-icon" />
                  <input
                    ref={emailRef}
                    id={isSignup ? 'signup-email' : 'login-email'}
                    name="email"
                    type="email"
                    placeholder="vidu@email.com"
                    autoComplete="username"
                    spellCheck={false}
                    autoCapitalize="none"
                    autoCorrect="off"
                    enterKeyHint="next"
                    required
                    value={values.email}
                    aria-invalid={emailError ? 'true' : 'false'}
                    aria-describedby={emailError ? emailErrorId : undefined}
                    onChange={(e) => updateTextField('email', e.target.value)}
                    onBlur={() => handleFieldBlur('email')}
                  />
                </div>
                {emailError && (
                  <p id={emailErrorId} className="field-error">
                    {emailError}
                  </p>
                )}
              </div>

              {isSignup ? (
                <>
                  <div className="field">
                    <label htmlFor="new-password">Mật khẩu</label>
                    <div className="field-control">
                      <LockSvg className="field-icon" />
                      <input
                        ref={newPasswordRef}
                        id="new-password"
                        name="new-password"
                        type={showNewPassword ? 'text' : 'password'}
                        placeholder="Tạo mật khẩu"
                        autoComplete="new-password"
                        minLength={12}
                        enterKeyHint="next"
                        required
                        value={values.newPassword}
                        aria-invalid={newPasswordError ? 'true' : 'false'}
                        aria-describedby={
                          newPasswordError
                            ? `${passwordHintId} ${newPasswordErrorId}`
                            : passwordHintId
                        }
                        onChange={(e) => updateTextField('newPassword', e.target.value)}
                        onBlur={() => handleFieldBlur('newPassword')}
                      />
                      <button
                        type="button"
                        className="password-toggle"
                        aria-label={showNewPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                        aria-pressed={showNewPassword}
                        onClick={() => setShowNewPassword((prev) => !prev)}
                      >
                        <EyeToggleSvg visible={showNewPassword} />
                      </button>
                    </div>
                    <p className="hint" id={passwordHintId}>
                      Ít nhất 12 ký tự. Ưu tiên cụm từ dài, dễ nhớ.
                    </p>
                    {newPasswordError && (
                      <p id={newPasswordErrorId} className="field-error">
                        {newPasswordError}
                      </p>
                    )}
                  </div>

                  <div className="field">
                    <label htmlFor="confirm-password">Xác nhận mật khẩu</label>
                    <div className="field-control">
                      <LockSvg className="field-icon" />
                      <input
                        ref={confirmPasswordRef}
                        id="confirm-password"
                        name="confirm-password"
                        type={showConfirmPassword ? 'text' : 'password'}
                        placeholder="Nhập lại mật khẩu"
                        autoComplete="new-password"
                        enterKeyHint="done"
                        required
                        value={values.confirmPassword}
                        aria-invalid={confirmPasswordError ? 'true' : 'false'}
                        aria-describedby={
                          confirmPasswordError ? confirmPasswordErrorId : undefined
                        }
                        onChange={(e) =>
                          updateTextField('confirmPassword', e.target.value)
                        }
                        onBlur={() => handleFieldBlur('confirmPassword')}
                      />
                      <button
                        type="button"
                        className="password-toggle"
                        aria-label={
                          showConfirmPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'
                        }
                        aria-pressed={showConfirmPassword}
                        onClick={() => setShowConfirmPassword((prev) => !prev)}
                      >
                        <EyeToggleSvg visible={showConfirmPassword} />
                      </button>
                    </div>
                    {confirmPasswordError && (
                      <p id={confirmPasswordErrorId} className="field-error">
                        {confirmPasswordError}
                      </p>
                    )}
                  </div>

                  <div
                    className="form-row"
                    style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}
                  >
                    <label className="check" htmlFor="synthetic-consent">
                      <input
                        ref={consentRef}
                        id="synthetic-consent"
                        name="synthetic-consent"
                        type="checkbox"
                        required
                        checked={values.consent}
                        aria-invalid={consentError ? 'true' : 'false'}
                        aria-describedby={consentError ? consentErrorId : undefined}
                        onChange={(e) => handleConsentChange(e.target.checked)}
                      />
                      <span>
                        Tôi hiểu đây là giao diện thử nghiệm và không nhập dữ liệu thật.
                      </span>
                    </label>
                    {consentError && (
                      <p id={consentErrorId} className="field-error">
                        {consentError}
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="field">
                    <label htmlFor="login-password">Mật khẩu</label>
                    <div className="field-control">
                      <LockSvg className="field-icon" />
                      <input
                        ref={passwordRef}
                        id="login-password"
                        name="password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Nhập mật khẩu của bạn"
                        autoComplete="current-password"
                        enterKeyHint="done"
                        required
                        value={values.password}
                        aria-invalid={passwordError ? 'true' : 'false'}
                        aria-describedby={passwordError ? passwordErrorId : undefined}
                        onChange={(e) => updateTextField('password', e.target.value)}
                        onBlur={() => handleFieldBlur('password')}
                      />
                      <button
                        type="button"
                        className="password-toggle"
                        aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                        aria-pressed={showPassword}
                        onClick={() => setShowPassword((prev) => !prev)}
                      >
                        <EyeToggleSvg visible={showPassword} />
                      </button>
                    </div>
                    {passwordError && (
                      <p id={passwordErrorId} className="field-error">
                        {passwordError}
                      </p>
                    )}
                  </div>

                  <div className="form-row">
                    <label className="check" htmlFor="remember-me">
                      <input
                        id="remember-me"
                        name="remember-me"
                        type="checkbox"
                        checked={values.rememberMe}
                        onChange={(e) =>
                          setValues((prev) => ({
                            ...prev,
                            rememberMe: e.target.checked,
                          }))
                        }
                      />
                      <span>Ghi nhớ đăng nhập</span>
                    </label>
                    <button
                      type="button"
                      className="text-button"
                      onClick={handleForgotPassword}
                    >
                      Quên mật khẩu?
                    </button>
                  </div>
                </>
              )}

              <div className="status" role="status" aria-live="polite" hidden={!notice}>
                {notice}
              </div>

              <button className="primary" type="submit" disabled={isSubmitting}>
                <span>{isSubmitting ? 'Đang kết nối…' : isSignup ? 'Tạo tài khoản' : 'Đăng nhập'}</span>
                <ArrowRightSvg />
              </button>
            </form>

            {!isSignup && <div className="separator">DÀNH CHO NHÂN VIÊN Y TẾ</div>}

            <div className="staff">
              <span className="staff-icon">
                <MedicalBoxSvg />
              </span>
              <div>
                <strong>
                  {isSignup ? 'Tài khoản nhân viên y tế' : 'Bạn là nhân viên y tế?'}
                </strong>
                <p>Liên hệ quản trị viên của cơ sở để được cấp tài khoản.</p>
              </div>
            </div>

            <p className="switch">
              {isSignup ? 'Đã có tài khoản? ' : 'Chưa có tài khoản? '}
              <Link href={isSignup ? '/login' : '/signup'}>
                {isSignup ? 'Đăng nhập' : 'Đăng ký'}
              </Link>
            </p>
          </div>
        </section>
      </main>

      <footer className="foot">
        <span>© 2026 MediCloud · Nền tảng y tế số</span>
        <span className="foot-right">
          <ShieldCheckSvg /> Bản xem trước giao diện · Chỉ dùng dữ liệu giả
        </span>
      </footer>

      <div aria-live="polite" className="sr-only-control">
        {liveAnnouncement}
      </div>
    </div>
  )
}
