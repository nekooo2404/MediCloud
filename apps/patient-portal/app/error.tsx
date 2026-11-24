'use client';

export default function PortalErrorBoundary({
  error,
  reset,
}: {
  error: Error & {digest?: string};
  reset: () => void;
}) {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: '24px',
        backgroundColor: '#f5f8f7',
        color: '#153d38',
      }}
    >
      <section
        role="alert"
        style={{
          width: 'min(520px, 100%)',
          backgroundColor: '#ffffff',
          border: '1px solid #d5e3df',
          borderRadius: '16px',
          padding: '24px',
          display: 'grid',
          gap: '12px',
        }}
      >
        <h1 style={{margin: 0, fontSize: '20px', fontWeight: 700, color: '#0f6350'}}>
          Không thể hiển thị không gian làm việc
        </h1>
        <p style={{margin: 0, fontSize: '14px', lineHeight: 1.5, color: '#4b615d'}}>
          {error.message || 'Đã xảy ra sự cố tạm thời khi tải dữ liệu y tế. Không có thao tác nào bị ghi nhận ngoài ý muốn.'}
        </p>
        {error.digest && (
          <p style={{margin: 0, fontSize: '12px', color: '#526965', fontVariantNumeric: 'tabular-nums'}}>
            Mã tham chiếu: {error.digest}
          </p>
        )}
        <div style={{display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '4px'}}>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              backgroundColor: '#126b56',
              color: '#ffffff',
              border: '1px solid #126b56',
              borderRadius: '10px',
              padding: '10px 16px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Thử tải lại
          </button>
        </div>
      </section>
    </main>
  );
}
