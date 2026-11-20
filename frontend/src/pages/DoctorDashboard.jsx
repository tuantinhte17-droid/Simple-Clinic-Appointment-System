import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { io } from "socket.io-client";
import Loading from '../components/Loading';

const statusBadges = {
  PENDING: { label: 'Chờ xác nhận', class: 'badge-pending' },
  CONFIRMED: { label: 'Đã xác nhận', class: 'badge-confirmed' },
  COMPLETED: { label: 'Đã khám', class: 'badge-completed' },
  CANCELLED: { label: 'Đã hủy', class: 'badge-cancelled' }
};

const isAppointmentTimeReached =(dateStr, timeStr) => {
  if (!dateStr || !timeStr) return false;
  const now = new Date();
  const [h,m] = timeStr.split(':').map(Number);
  const apptDate = new Date(dateStr);
  apptDate.setHours(h, m, 0, 0);
  // Trả về true nếu thời gian hiện tại đã lớn hơn hoặc bằng giờ hẹn
  return now >= apptDate;
};



const DoctorDashboard = () => {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatingId, setUpdatingId] = useState(null);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [completingAppt, setCompletingAppt] = useState(null);
  const [diagnosis, setDiagnosis] = useState('');
  const [prescription, setPrescription] = useState('');

  useEffect(() => {
    if (message.text) {
      const timer = setTimeout(() => {
        setMessage({type: '', text: ''});
      }, 3000);
        return () => clearTimeout(timer);
      }
    }, [message]);
  

  useEffect(() => {
    loadAppointments();
    const socket_url = import.meta.env.VITE_BACKEND_URL || "http://localhost:5005"; 
    const socket = io(socket_url);
    socket.on('new_appt_created', (data) => {
      loadAppointments(true)
    });
    return () => socket.disconnect();
  }, []);

  const loadAppointments = async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const data = await api.getDoctorAppointments();
      setAppointments(data || []);
    } catch (err) {
      if (!silent) setError(err.message || 'Không thể tải lịch hẹn của bác sĩ.');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const handleUpdateStatus = async (appointmentId, newStatus) => {
    setUpdatingId(appointmentId);
    setMessage({ type: '', text: '' });

    try {
      await api.updateAppointmentStatus(appointmentId, newStatus);
      setMessage({
        type: 'success',
        text: `Đã cập nhật trạng thái lịch hẹn sang "${statusBadges[newStatus]?.label || newStatus}" thành công!`
      });

      // Update local state with updated appointment
      setAppointments((prev) =>
        prev.map((a) => (a.id === appointmentId ? { ...a, status: newStatus } : a))
      );
    } catch (err) {
      setMessage({
        type: 'danger',
        text: err.message || 'Không thể cập nhật trạng thái lịch hẹn.'
      });
    } finally {
      setUpdatingId(null);
    }
  };

  const handleCompleteWithDiagnosis = async (e) => {
    e.preventDefault();
    if(!completingAppt) return;
    try {
      setUpdatingId(completingAppt.id);
      await api.updateAppointmentStatus(completingAppt.id, 'COMPLETED', {diagnosis, prescription});
      setMessage({type: "success", text:"Đã hoàn thành ca khám"});
      setAppointments((prev) => prev.map((a) => a.id === completingAppt.id ?
               {...a, status: 'COMPLETED', diagnosis, prescription} : a) );

      setCompletingAppt(null);
      setDiagnosis('');
      setPrescription('');
    } catch (err) {
      setMessage({type: 'danger', text: err.message || "Lỗi khi truy cập kết quả khám"});
    } finally {
      setUpdatingId(null);
    }
  };

  // Stats calculation
  const totalCount = appointments.length;
  const pendingCount = appointments.filter((a) => a.status === 'PENDING').length;
  const confirmedCount = appointments.filter((a) => a.status === 'CONFIRMED').length;
  const completedCount = appointments.filter((a) => a.status === 'COMPLETED').length;

  const filteredAppointments = appointments.filter((a) => {
    if (filterStatus === 'ALL') return true;
    return a.status === filterStatus;
  });

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h2>Thông tin chung</h2>
          <p>Quản lý danh sách bệnh nhân và cập nhật trạng thái các buổi khám</p>
        </div>
      </div>

      {/* Summary KPI stats */}
      <div className="dashboard-stats-grid">
        <div
          className={`dashboard-stat-card ${filterStatus === 'ALL' ? 'active' : ''}`}
          onClick={() => setFilterStatus('ALL')}
          title="Xem tất cả lịch hẹn"
        >
          <div className="stat-card-title">Tổng lịch hẹn</div>
          <div className="stat-card-val text-primary">{totalCount}</div>
          <div className="stat-card-sub">Lịch khám của bạn</div>
        </div>

        <div
          className={`dashboard-stat-card ${filterStatus === 'PENDING' ? 'active' : ''}`}
          onClick={() => setFilterStatus('PENDING')}
          title="Lọc lịch chờ xác nhận"
        >
          <div className="stat-card-title">Chờ xác nhận</div>
          <div className="stat-card-val text-warning">{pendingCount}</div>
          <div className="stat-card-sub">Cần bác sĩ duyệt</div>
        </div>

        <div
          className={`dashboard-stat-card ${filterStatus === 'CONFIRMED' ? 'active' : ''}`}
          onClick={() => setFilterStatus('CONFIRMED')}
          title="Lọc lịch đã xác nhận"
        >
          <div className="stat-card-title">Đã xác nhận</div>
          <div className="stat-card-val text-info">{confirmedCount}</div>
          <div className="stat-card-sub">Sẵn sàng thăm khám</div>
        </div>

        <div
          className={`dashboard-stat-card ${filterStatus === 'COMPLETED' ? 'active' : ''}`}
          onClick={() => setFilterStatus('COMPLETED')}
          title="Lọc lịch đã hoàn thành"
        >
          <div className="stat-card-title">Đã hoàn thành</div>
          <div className="stat-card-val text-success">{completedCount}</div>
          <div className="stat-card-sub">Đã khám xong</div>
        </div>
      </div>

      {/* Thông báo dạng Toast nổi hiện đại có icon & nút tắt */}
      {message.text && (
        <div className ={`toast-message toast-${message.type}`}>
          <span className= 'toast-icon'>
            {message.type === 'success' ? '✅' : '⚠️'}
          </span>
          <span className="toast-message-1">{message.text}</span>
          <button
            type="button"
            className= "toast-close"
            onClick={() => setMessage({ type: '', text: '' })}
            title= "Đóng"  
          >
            ✕
          </button>
        </div>
      )}

      {loading && <Loading message="Đang tải lịch hẹn phụ trách..." />}

      {error && !loading && (
        <div className="alert alert-danger">
          <p>{error}</p>
          <button className="btn btn-outline btn-sm" onClick={loadAppointments} style={{ marginTop: '0.5rem' }}>
            Thử lại
          </button>
        </div>
      )}

      {!loading && !error && filteredAppointments.length === 0 && (
        <div className="empty-state card">
          <div className="empty-icon">🩺</div>
          <h3>Hiện tại không có lịch hẹn nào {filterStatus !== 'ALL' ? `ở trạng thái ${statusBadges[filterStatus]?.label}` : ''}</h3>
          <p>Khi bệnh nhân đăng ký khám với bạn, thông tin lịch hẹn sẽ hiển thị ở đây.</p>
          {filterStatus !== 'ALL' && (
            <button className="btn btn-outline btn-sm" onClick={() => setFilterStatus('ALL')} style={{ marginTop: '0.75rem' }}>
              Xem tất cả trạng thái
            </button>
          )}
        </div>
      )}

      {!loading && !error && filteredAppointments.length > 0 && (
        <div className="card table-card">
          <div className="table-responsive">
            <table className="custom-table">
              <thead>
                <tr>
                  <th style={{ whiteSpace: 'nowrap' }}>Mã số</th>
                  <th>Bệnh nhân</th>
                  <th>Email liên hệ</th>
                  <th style={{ whiteSpace: 'nowrap' }}>Ngày & Giờ</th>
                  <th>Triệu chứng / Lý do</th>
                  <th style={{ whiteSpace: 'nowrap' }}>Trạng thái</th>
                  <th style={{ whiteSpace: 'nowrap' }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filteredAppointments.map((appt) => {
                  const badge = statusBadges[appt.status] || { label: appt.status, class: 'badge-pending' };
                  const isUpdating = updatingId === appt.id;

                  return (
                    <tr key={appt.id}>
                      <td style={{ whiteSpace: 'nowrap' }}><strong>#{appt.id}</strong></td>
                      <td><strong>{appt.patient_name}</strong></td>
                      <td>{appt.patient_email}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <div>📅 {appt.date}</div>
                        <div>⏰ <strong>{appt.time}</strong></div>
                      </td>
                      <td className="cell-reason">{appt.reason || '—'}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <span className={`badge ${badge.class}`} style={{ whiteSpace: 'nowrap' }}>{badge.label}</span>
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <div className="action-buttons" style={{ display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap', gap: '8px' }}>
                          {/* Bước 1: Khi nhận được PENDING -> Bác sĩ Xác nhận khám hoặc Từ chối */}
                          {appt.status === 'PENDING' && (
                            <>
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-success"
                                onClick={() => handleUpdateStatus(appt.id, 'CONFIRMED')}
                                disabled={isUpdating}
                                style={{ whiteSpace: 'nowrap' }}
                                title="Xác nhận tiếp nhận lịch khám bệnh này"
                              >
                                ✓ Xác nhận khám
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-danger"
                                onClick={() => handleUpdateStatus(appt.id, 'CANCELLED')}
                                disabled={isUpdating}
                                style={{ whiteSpace: 'nowrap' }}
                                title="Hủy / Từ chối lịch hẹn"
                              >
                                ✕ Hủy lịch
                              </button>
                            </>
                          )}

                          {/* Khi đã CONFIRMED -> Kiểm tra nếu chưa đến giờ hẹn thì disable nút */}
                  { appt.status === 'CONFIRMED' && ( (() => {
                   const isReached = isAppointmentTimeReached(appt.date, appt.time);
                   return (
                     <button type="button"
                             className={`btn btn-sm ${isReached ? 'btn-outline-primary' : 'btn-outline-secondary'}`}
                             disabled={isUpdating || !isReached}
                             title={isReached  ? "Đánh dấu bệnh nhân đã hoàn thành buổi khám" 
                              : "Chưa đến giờ hẹn khám (Chỉ được hoàn thành khi đến giờ hẹn)"
                   }
                   style={{ whiteSpace: 'nowrap', 
                            opacity: isReached ? 1 : 0.6,
                            cursor: isReached ? 'pointer' : 'not-allowed' }}
                  onClick={() => {
                    if (!isReached) return;
                      setCompletingAppt(appt);
                      setDiagnosis(appt.diagnosis || '');
                      setPrescription(appt.prescription || ''); }}
                > {isReached ? '🩺 Hoàn thành khám' : '⏳ Chưa đến giờ'}
              </button>
            );
         })()
       )}
                
                {/* Bước 3: Đã khám xong */}
                {appt.status === 'COMPLETED' && (
                    <span className="text-muted-check" style={{ whiteSpace: 'nowrap' }}>
                              ✓ Đã hoàn tất
                    </span> )}

                      {/* Lịch đã hủy */}
                {appt.status === 'CANCELLED' && (
                    <span className="text-muted-cancel" style={{ whiteSpace: 'nowrap' }}>
                              ✕ Lịch đã hủy
                    </span> )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

  {completingAppt && (
  <div className="modal-backdrop">
    <div className= "diagnosis-modal">
      <h3 style={{ marginTop: 0 }}>🩺 Kết quả khám bệnh</h3>
      <p style={{ color: '#666' }}>Bệnh nhân: <strong>{completingAppt.patient_name}</strong> ({completingAppt.time} - {completingAppt.date})</p>
      
      <form onSubmit={handleCompleteWithDiagnosis}>
        <div className= "diagnosis-form-group">
          <label>Chẩn đoán bệnh (*):</label>
          <input
            type="text"
            required
            placeholder="Ví dụ: Viêm họng cấp, sốt siêu vi..."
            value={diagnosis}
            onChange={(e) => setDiagnosis(e.target.value)}
          />
        </div>

        <div className= "diagnosis-form-group prescription-group">
          <label>Đơn thuốc / Lời dặn:</label>
          <textarea
            rows="3"
            placeholder="Ví dụ: Paracetamol 500mg (2 lần/ngày), uống nhiều nước ấm, tái khám sau 3 ngày..."
            value={prescription}
            onChange={(e) => setPrescription(e.target.value)}
          />
        </div>

        <div className= "diagnosis-modal-actions">
          <button type="button" className="btn btn-outline" onClick={() => setCompletingAppt(null)}>Hủy</button>
          <button type="submit" className="btn btn-primary" disabled={updatingId === completingAppt.id}>
            {updatingId === completingAppt.id ? 'Đang lưu...' : 'Lưu kết quả & Hoàn thành'}
           </button>
         </div>
       </form>
     </div>
   </div>
  )}
</div>
  );
};

export default DoctorDashboard;
