-- ============================================================================
-- MATRAN DEPOT ERP — INITIAL DATABASE SCHEMA, CONSTRAINTS, RLS & ATOMIC RPCS
-- Migration: 20261021000001_init_matran_depot_schema.sql
-- Tuân thủ: DECISIONS.md, DATABASE_CONTRACT.md, API_RPC_CONTRACT.md, ROLE_PERMISSION_MATRIX.md
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. ENUMS & DANH MỤC CỐ ĐỊNH ĐÃ XÁC NHẬN
-- ----------------------------------------------------------------------------

-- 10 vai trò hệ thống (ROLE_PERMISSION_MATRIX.md)
CREATE TYPE app_role AS ENUM (
  'ADMIN',
  'MANAGER',
  'OFFICE',
  'GATE_STAFF',
  'YARD_STAFF',
  'FORKLIFT',
  'CLEANING',
  'INSPECTOR',
  'REPAIR_STAFF',
  'ACCOUNTANT'
);

-- Các trường hợp container vào bãi đã xác nhận (DEC-007)
CREATE TYPE gate_in_type AS ENUM (
  'CUSTOMER_RETURN', -- Khách hàng trả container rỗng về bãi theo lệnh hãng tàu
  'VESSEL_IMPORT'    -- NHẬP TÀU: xe kéo bãi vận chuyển số lượng lớn từ cảng về (module mở rộng)
);

-- Các trường hợp container ra khỏi bãi đã xác nhận (DEC-014)
CREATE TYPE gate_out_type AS ENUM (
  'EMPTY_RELEASE',   -- CẤP VỎ cho khách hàng hoặc xe khách theo lệnh cấp của hãng tàu
  'VESSEL_EXPORT',   -- XUẤT TÀU: bãi tổ chức xe kéo đưa container từ bãi ra cảng
  'SPECIAL_RETURN'   -- Trả container cho hãng tàu hoặc đơn vị khác theo lệnh riêng
);

-- Phân loại Giám định Hạ vỏ Gate In (DEC-016)
CREATE TYPE field_condition_class AS ENUM ('DAMAGE', 'AV');
CREATE TYPE field_stuffing_class AS ENUM ('M', 'K', 'E');
CREATE TYPE field_cleaning_item AS ENUM (
  'KHÔNG VỆ SINH',
  'WP - QUÉT',
  'WW - RỬA NƯỚC',
  'CC - HÓA CHẤT',
  'RM - NHỔ ĐINH',
  'ML - BÓC TEM'
);

-- 3 loại hình thanh toán đã xác nhận (DEC-004)
CREATE TYPE payment_category AS ENUM (
  'TTT',  -- THANH TOÁN TRƯỚC (Quét QR Phiếu thu mẹ & trừ dần)
  'TTS',  -- THANH TOÁN SAU (Kiểm tra nguồn & ghi chú TTS trên chứng từ)
  'TTTT'  -- THANH TOÁN TRỰC TIẾP (Chuyển khoản API hoặc Tiền mặt)
);

CREATE TYPE direct_payment_method AS ENUM (
  'BANK_TRANSFER_API', -- Thanh toán chuyển khoản (API)
  'CASH'               -- Thanh toán tiền mặt
);

-- Trạng thái lượt Gate In
CREATE TYPE gate_in_status AS ENUM (
  'FIELD_RECORDED',    -- Hiện trường đã chụp ảnh & ghi nhận thông tin ban đầu
  'OFFICE_VERIFIED',   -- Văn phòng đã kiểm tra lệnh/chứng từ & bổ sung thông tin
  'PAYMENT_PENDING',   -- Đã tạo yêu cầu thanh toán (chưa hoàn tất thu tiền)
  'GATE_IN_OK',        -- Đã xác nhận thanh toán thành công -> GATE IN OK
  'CANCELLED'          -- Đã hủy/từ chối (lưu lý do)
);

-- Trạng thái container trong bãi
CREATE TYPE container_status AS ENUM (
  'PENDING_GATE_IN',   -- Đang làm thủ tục Gate In
  'WAITING_PLACEMENT', -- Đã GATE IN OK, đang chờ xe nâng hạ bãi/xếp vị trí
  'IN_YARD',           -- Đang tồn bãi
  'ALLOCATED',         -- Đã khóa phân bổ cho Booking/Lệnh cấp (DEC-006)
  'GATED_OUT'          -- Đã xuất khỏi bãi
);

-- ----------------------------------------------------------------------------
-- 2. TÀI KHOẢN & PHÂN QUYỀN (3.1 DATABASE_CONTRACT.md)
-- ----------------------------------------------------------------------------

CREATE TABLE staff_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID UNIQUE, -- Liên kết Supabase Auth
  staff_code TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  roles app_role[] NOT NULL DEFAULT ARRAY['OFFICE']::app_role[],
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Hàm kiểm tra quyền ở tầng Backend/Database
CREATE OR REPLACE FUNCTION has_any_role(required_roles app_role[])
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_roles app_role[];
  v_is_active BOOLEAN;
BEGIN
  SELECT roles, is_active INTO v_user_roles, v_is_active
  FROM staff_profiles
  WHERE auth_user_id = auth.uid();

  IF NOT FOUND OR v_is_active IS FALSE THEN
    RETURN FALSE;
  END IF;

  IF 'ADMIN' = ANY(v_user_roles) THEN
    RETURN TRUE;
  END IF;

  RETURN v_user_roles && required_roles;
END;
$$;

-- ----------------------------------------------------------------------------
-- 3. KHÁCH HÀNG, HÃNG TÀU & ĐỐI TÁC (DEC-003)
-- ----------------------------------------------------------------------------

CREATE TABLE partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_code TEXT NOT NULL UNIQUE,
  partner_name TEXT NOT NULL,
  is_shipping_line BOOLEAN NOT NULL DEFAULT FALSE,
  is_customer BOOLEAN NOT NULL DEFAULT TRUE,
  is_payer BOOLEAN NOT NULL DEFAULT TRUE,
  allow_tts BOOLEAN NOT NULL DEFAULT FALSE, -- Cho phép áp dụng Thanh toán sau (TTS)
  tax_code TEXT,
  contact_phone TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 4. CẤU HÌNH VỊ TRÍ BÃI & CONTAINER (DEC-001, DEC-005)
-- ----------------------------------------------------------------------------

CREATE TABLE yard_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  block_code TEXT NOT NULL UNIQUE, -- VD: BLOCK-A, BLOCK-B, BLOCK-DAMAGE, BLOCK-CLEAN
  block_name TEXT NOT NULL,
  max_bay INT NOT NULL DEFAULT 20,
  max_row INT NOT NULL DEFAULT 6,
  max_tier INT NOT NULL DEFAULT 5,
  capacity INT NOT NULL DEFAULT 300,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE containers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  container_no TEXT NOT NULL UNIQUE CHECK (char_length(trim(container_no)) >= 10),
  size_code TEXT NOT NULL CHECK (size_code IN ('20', '40', '45')),
  type_code TEXT NOT NULL DEFAULT 'DC', -- DC, HC, OT, FR... (chỉ container rỗng)
  manufacture_year INT NOT NULL DEFAULT 2018, -- AGE: Năm sinh cont (2001, 2002...)
  owner_id UUID REFERENCES partners(id),
  status container_status NOT NULL DEFAULT 'PENDING_GATE_IN',
  condition_class field_condition_class NOT NULL DEFAULT 'AV',
  damage_remarks TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  stuffing_class field_stuffing_class NOT NULL DEFAULT 'E',
  cleaning_items field_cleaning_item[] NOT NULL DEFAULT ARRAY['KHÔNG VỆ SINH']::field_cleaning_item[],
  active_qr_code TEXT UNIQUE, -- Mã QR trên phiếu K80 TÁC NGHIỆP NỘI BỘ
  -- Hàng chờ công việc của các bộ phận (FIFO, hoàn thành tự ẩn):
  needs_cleaning BOOLEAN NOT NULL DEFAULT FALSE,  -- Bộ phận Vệ sinh: CHỜ VỆ SINH
  needs_quotation BOOLEAN NOT NULL DEFAULT FALSE, -- Bộ phận Báo giá: CHỜ BÁO GIÁ (chỉ cont DAMAGE)
  needs_repair BOOLEAN NOT NULL DEFAULT FALSE,    -- Bộ phận Sửa chữa: CHỜ SỬA CHỮA
  forklift_shift_task TEXT NOT NULL DEFAULT 'NONE'
    CHECK (forklift_shift_task IN ('NONE', 'HA_SUA_CHUA', 'HA_KE_GIAM_DINH')),
  -- Vị trí hiện tại (DEC-005):
  -- Có thể ghi nhận ở cấp Block khi chưa xác định Bay/Row/Tier.
  -- Block KHÔNG độc quyền; chỉ tổ hợp chi tiết (Block + Bay + Row + Tier) mới độc quyền.
  current_block TEXT REFERENCES yard_blocks(block_code),
  current_bay TEXT,
  current_row TEXT,
  current_tier TEXT,
  -- Tạm giữ / Khóa xuất (DEC-002, DEC-015)
  is_on_hold BOOLEAN NOT NULL DEFAULT FALSE,
  hold_reason TEXT,
  hold_by UUID REFERENCES staff_profiles(id),
  hold_at TIMESTAMPTZ,
  -- Khóa phân bổ cấp vỏ (DEC-006)
  allocated_booking_id UUID,
  allocated_at TIMESTAMPTZ,
  gate_in_at TIMESTAMPTZ,
  gate_out_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ràng buộc DEC-005: Khi đã có vị trí chi tiết (Bay, Row, Tier đều khác NULL) và container đang trong bãi,
-- không cho phép 2 container chiếm cùng một ô (Block, Bay, Row, Tier).
-- Ngược lại, nếu chỉ mới ghi nhận cấp Block (Bay/Row/Tier IS NULL), nhiều container có thể cùng thuộc một Block.
CREATE UNIQUE INDEX idx_unique_detailed_yard_slot
ON containers (current_block, current_bay, current_row, current_tier)
WHERE status IN ('IN_YARD', 'ALLOCATED')
  AND current_block IS NOT NULL
  AND current_bay IS NOT NULL
  AND current_row IS NOT NULL
  AND current_tier IS NOT NULL;

-- Lịch sử di chuyển & cập nhật vị trí container (DEC-005)
CREATE TABLE container_location_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  container_id UUID NOT NULL REFERENCES containers(id),
  container_no TEXT NOT NULL,
  from_block TEXT,
  from_bay TEXT,
  from_row TEXT,
  from_tier TEXT,
  to_block TEXT,
  to_bay TEXT,
  to_row TEXT,
  to_tier TEXT,
  action_type TEXT NOT NULL, -- INITIAL_BLOCK, DETAIL_SLOT_UPDATE, YARD_MOVE, GATE_OUT_CLEAR
  reason TEXT,
  performed_by UUID REFERENCES staff_profiles(id),
  performed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 5. TÀI CHÍNH: PHIẾU THU MẸ (TTT), CHỨNG TỪ & GIAO DỊCH (DEC-004)
-- ----------------------------------------------------------------------------

-- Phiếu thu mẹ cho hình thức THANH TOÁN TRƯỚC (TTT)
CREATE TABLE master_prepaid_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_code TEXT NOT NULL UNIQUE,
  qr_code TEXT NOT NULL UNIQUE, -- Mã QR thanh toán thay phiếu thu để quét vào CHỨNG TỪ
  customer_id UUID NOT NULL REFERENCES partners(id),
  total_amount NUMERIC(15, 2) NOT NULL CHECK (total_amount > 0),
  remaining_amount NUMERIC(15, 2) NOT NULL CHECK (remaining_amount >= 0),
  lot_description TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'EXHAUSTED', 'CANCELLED')),
  created_by UUID REFERENCES staff_profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_remaining_le_total CHECK (remaining_amount <= total_amount)
);

-- Chứng từ thanh toán / Khoản phải thu
CREATE TABLE payment_vouchers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_no TEXT NOT NULL UNIQUE,
  service_type TEXT NOT NULL, -- GATE_IN, GATE_OUT, CLEANING, REPAIR, STORAGE
  reference_id UUID,          -- Liên kết lượt Gate In / Gate Out / Dịch vụ
  container_no TEXT NOT NULL,
  owner_id UUID REFERENCES partners(id),
  requester_id UUID REFERENCES partners(id),
  payer_id UUID REFERENCES partners(id),
  amount NUMERIC(15, 2) NOT NULL CHECK (amount >= 0),
  payment_category payment_category, -- TTT, TTS, TTTT (do nhân viên văn phòng xác nhận)
  direct_method direct_payment_method, -- BANK_TRANSFER_API hoặc CASH (nếu là TTTT)
  master_receipt_id UUID REFERENCES master_prepaid_receipts(id), -- Nếu quét QR TTT
  scanned_qr_code TEXT,
  tts_source_note TEXT, -- Ghi chú xác nhận TTS trên chứng từ (bắt buộc nếu là TTS)
  provider_tx_ref TEXT UNIQUE, -- Mã tham chiếu chống xử lý trùng webhook API
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'CONFIRMED', 'FAILED', 'REFUNDED', 'CANCELLED')),
  confirmed_by UUID REFERENCES staff_profiles(id),
  confirmed_at TIMESTAMPTZ,
  created_by UUID REFERENCES staff_profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Lịch sử trừ dần Phiếu thu mẹ (TTT)
CREATE TABLE master_receipt_deductions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  master_receipt_id UUID NOT NULL REFERENCES master_prepaid_receipts(id),
  voucher_id UUID NOT NULL UNIQUE REFERENCES payment_vouchers(id),
  deducted_amount NUMERIC(15, 2) NOT NULL CHECK (deducted_amount > 0),
  balance_before NUMERIC(15, 2) NOT NULL,
  balance_after NUMERIC(15, 2) NOT NULL,
  performed_by UUID REFERENCES staff_profiles(id),
  performed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 6. GATE IN — NHẬP BÃI (DEC-004, DEC-007, DEC-016)
-- ----------------------------------------------------------------------------

CREATE TABLE gate_in_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_code TEXT NOT NULL UNIQUE,
  gate_in_type gate_in_type NOT NULL DEFAULT 'CUSTOMER_RETURN',
  -- Nhóm thông tin Giám định Hạ vỏ chụp ảnh & ghi nhận ban đầu (DEC-016):
  door_photo_url TEXT NOT NULL, -- Ảnh cửa container nhìn rõ số container
  initial_container_no TEXT,
  condition_class field_condition_class NOT NULL, -- DAMAGE, AV
  damage_remarks TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  stuffing_class field_stuffing_class NOT NULL,   -- M, K, E
  cleaning_items field_cleaning_item[] NOT NULL,  -- KHÔNG VỆ SINH, WP - QUÉT, WW - RỬA NƯỚC, CC - HÓA CHẤT, RM - NHỔ ĐINH, ML - BÓC TEM
  manufacture_year INT NOT NULL DEFAULT 2018,     -- AGE: Năm sinh cont (2001, 2002...)
  field_staff_id UUID REFERENCES staff_profiles(id),
  field_recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Nhóm thông tin văn phòng kiểm tra lệnh/chứng từ và bổ sung (DEC-016):
  container_no TEXT,
  size_code TEXT CHECK (size_code IN ('20', '40', '45')),
  type_code TEXT,
  truck_no TEXT,
  customer_rep TEXT,
  shipping_line_id UUID REFERENCES partners(id),
  order_doc_no TEXT,
  office_staff_id UUID REFERENCES staff_profiles(id),
  office_verified_at TIMESTAMPTZ,
  -- Liên kết thanh toán, trạng thái GATE IN OK & Mã QR phiếu K80 (DEC-004):
  voucher_id UUID REFERENCES payment_vouchers(id),
  k80_qr_code TEXT UNIQUE,
  status gate_in_status NOT NULL DEFAULT 'FIELD_RECORDED',
  gate_in_ok_at TIMESTAMPTZ,
  gate_in_ok_by UUID REFERENCES staff_profiles(id),
  next_department TEXT, -- Bộ phận nhận chuyển tiếp sau GATE IN OK
  cancel_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 7. DỊCH VỤ TẠI BÃI: VỆ SINH, GIÁM ĐỊNH & SỬA CHỮA M&R (DEC-002)
-- ----------------------------------------------------------------------------

CREATE TABLE service_work_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_code TEXT NOT NULL UNIQUE,
  container_id UUID NOT NULL REFERENCES containers(id),
  container_no TEXT NOT NULL,
  service_category TEXT NOT NULL CHECK (service_category IN ('CLEANING', 'INSPECTION', 'REPAIR')),
  source_gate_in_id UUID REFERENCES gate_in_orders(id),
  requested_items TEXT[], -- Chi tiết hạng mục vệ sinh hoặc vị trí hư hỏng
  estimate_cost NUMERIC(15, 2) DEFAULT 0,
  approval_status TEXT NOT NULL DEFAULT 'NOT_REQUIRED'
    CHECK (approval_status IN ('NOT_REQUIRED', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED')),
  approved_by UUID REFERENCES staff_profiles(id),
  approved_at TIMESTAMPTZ,
  work_status TEXT NOT NULL DEFAULT 'OPEN'
    CHECK (work_status IN ('OPEN', 'IN_PROGRESS', 'COMPLETED', 'REWORK_REQUIRED', 'CANCELLED')),
  result_notes TEXT,
  photo_urls TEXT[] DEFAULT ARRAY[]::TEXT[],
  assigned_to UUID REFERENCES staff_profiles(id),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 8. BOOKING, PHÂN BỔ CONTAINER & GATE OUT (DEC-006, DEC-014, DEC-015)
-- ----------------------------------------------------------------------------

CREATE TABLE release_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_no TEXT NOT NULL UNIQUE,
  release_type gate_out_type NOT NULL DEFAULT 'EMPTY_RELEASE', -- CẤP VỎ, XUẤT TÀU, Trả theo lệnh riêng
  shipping_line_id UUID REFERENCES partners(id),
  requester_id UUID REFERENCES partners(id),
  receiver_name TEXT NOT NULL,
  size_code TEXT NOT NULL CHECK (size_code IN ('20', '40', '45')),
  type_code TEXT NOT NULL DEFAULT 'DC',
  requested_qty INT NOT NULL CHECK (requested_qty > 0),
  allocated_qty INT NOT NULL DEFAULT 0 CHECK (allocated_qty >= 0),
  gated_out_qty INT NOT NULL DEFAULT 0 CHECK (gated_out_qty >= 0),
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'FULLY_ALLOCATED', 'COMPLETED', 'CANCELLED')),
  created_by UUID REFERENCES staff_profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE booking_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES release_bookings(id),
  container_id UUID NOT NULL REFERENCES containers(id),
  container_no TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE, -- Đang khóa phân bổ (DEC-006)
  locked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked_by UUID REFERENCES staff_profiles(id),
  released_at TIMESTAMPTZ,
  release_reason TEXT
);

-- Ràng buộc DEC-006: Một container chỉ có thể có tối đa 1 phân bổ đang hiệu lực (is_active = TRUE) tại một thời điểm
CREATE UNIQUE INDEX idx_unique_active_container_allocation
ON booking_allocations (container_id)
WHERE is_active = TRUE;

CREATE TABLE gate_out_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gate_out_code TEXT NOT NULL UNIQUE,
  gate_out_type gate_out_type NOT NULL, -- EMPTY_RELEASE (CẤP VỎ), VESSEL_EXPORT (XUẤT TÀU), SPECIAL_RETURN
  booking_id UUID REFERENCES release_bookings(id),
  container_id UUID NOT NULL REFERENCES containers(id),
  container_no TEXT NOT NULL,
  truck_no TEXT NOT NULL,
  receiver_rep TEXT NOT NULL,
  voucher_id UUID REFERENCES payment_vouchers(id),
  -- 5 điều kiện kiểm tra bắt buộc trước khi xuất (DEC-015):
  chk_valid_order BOOLEAN NOT NULL DEFAULT FALSE,
  chk_not_on_hold BOOLEAN NOT NULL DEFAULT FALSE,
  chk_correct_container BOOLEAN NOT NULL DEFAULT FALSE,
  chk_payment_settled BOOLEAN NOT NULL DEFAULT FALSE,
  chk_documents_completed BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'GATE_OUT_OK', 'CANCELLED')),
  confirmed_by UUID REFERENCES staff_profiles(id),
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 9. NHẬT KÝ KIỂM TOÁN (AUDIT LOGS - 3.9 DATABASE_CONTRACT.md)
-- ----------------------------------------------------------------------------

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES staff_profiles(id),
  actor_name TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  action_code TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  summary TEXT NOT NULL,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 10. ATOMIC RPC FUNCTIONS (API_RPC_CONTRACT.md)
-- ----------------------------------------------------------------------------

-- RPC 1: Xác nhận chứng từ thanh toán (TTT / TTS / TTTT) và tự động kích hoạt GATE IN OK
CREATE OR REPLACE FUNCTION rpc_confirm_gate_in_payment(
  p_gate_in_id UUID,
  p_payment_category payment_category,
  p_qr_code TEXT DEFAULT NULL,
  p_tts_note TEXT DEFAULT NULL,
  p_direct_method direct_payment_method DEFAULT NULL,
  p_provider_tx_ref TEXT DEFAULT NULL,
  p_staff_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order gate_in_orders%ROWTYPE;
  v_voucher payment_vouchers%ROWTYPE;
  v_receipt master_prepaid_receipts%ROWTYPE;
  v_container_id UUID;
BEGIN
  SELECT * INTO v_order FROM gate_in_orders WHERE id = p_gate_in_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Không tìm thấy lượt Gate In';
  END IF;

  IF v_order.status = 'GATE_IN_OK' THEN
    RETURN jsonb_build_object('status', 'ALREADY_CONFIRMED', 'order_code', v_order.order_code);
  END IF;

  IF v_order.container_no IS NULL OR v_order.size_code IS NULL OR v_order.type_code IS NULL THEN
    RAISE EXCEPTION 'Văn phòng chưa bổ sung đầy đủ SỐ CONTAINER, SIZE, TYPE';
  END IF;

  SELECT * INTO v_voucher FROM payment_vouchers WHERE id = v_order.voucher_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Chưa tạo chứng từ thanh toán cho lượt Gate In này';
  END IF;

  -- Xử lý theo 3 loại hình thanh toán đã xác nhận
  IF p_payment_category = 'TTT' THEN
    IF p_qr_code IS NULL OR trim(p_qr_code) = '' THEN
      RAISE EXCEPTION 'Phải quét mã QR thanh toán của Phiếu thu mẹ cho hình thức TTT';
    END IF;

    SELECT * INTO v_receipt FROM master_prepaid_receipts
    WHERE qr_code = trim(p_qr_code) AND status = 'ACTIVE'
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Mã QR Phiếu thu mẹ không tồn tại hoặc không còn hiệu lực';
    END IF;

    IF v_receipt.remaining_amount < v_voucher.amount THEN
      RAISE EXCEPTION 'Số dư Phiếu thu mẹ không đủ để trừ khoản phí này';
    END IF;

    UPDATE master_prepaid_receipts
    SET remaining_amount = remaining_amount - v_voucher.amount,
        status = CASE WHEN remaining_amount - v_voucher.amount = 0 THEN 'EXHAUSTED' ELSE 'ACTIVE' END,
        updated_at = NOW()
    WHERE id = v_receipt.id;

    INSERT INTO master_receipt_deductions (
      master_receipt_id, voucher_id, deducted_amount, balance_before, balance_after, performed_by
    ) VALUES (
      v_receipt.id, v_voucher.id, v_voucher.amount,
      v_receipt.remaining_amount, v_receipt.remaining_amount - v_voucher.amount, p_staff_id
    );

    UPDATE payment_vouchers
    SET payment_category = 'TTT',
        master_receipt_id = v_receipt.id,
        scanned_qr_code = trim(p_qr_code),
        status = 'CONFIRMED',
        confirmed_by = p_staff_id,
        confirmed_at = NOW()
    WHERE id = v_voucher.id;

  ELSIF p_payment_category = 'TTS' THEN
    IF p_tts_note IS NULL OR trim(p_tts_note) = '' THEN
      RAISE EXCEPTION 'Phải nhập ghi chú (note) xác nhận TTS trên chứng từ';
    END IF;

    UPDATE payment_vouchers
    SET payment_category = 'TTS',
        tts_source_note = trim(p_tts_note),
        status = 'CONFIRMED',
        confirmed_by = p_staff_id,
        confirmed_at = NOW()
    WHERE id = v_voucher.id;

  ELSIF p_payment_category = 'TTTT' THEN
    IF p_direct_method IS NULL THEN
      RAISE EXCEPTION 'Phải chọn Chuyển khoản (API) hoặc Tiền mặt cho hình thức TTTT';
    END IF;

    UPDATE payment_vouchers
    SET payment_category = 'TTTT',
        direct_method = p_direct_method,
        provider_tx_ref = p_provider_tx_ref,
        status = 'CONFIRMED',
        confirmed_by = p_staff_id,
        confirmed_at = NOW()
    WHERE id = v_voucher.id;
  END IF;

  -- Chỉ sau khi thanh toán thành công mới cập nhật GATE IN OK
  UPDATE gate_in_orders
  SET status = 'GATE_IN_OK',
      gate_in_ok_at = NOW(),
      gate_in_ok_by = p_staff_id,
      next_department = 'FORKLIFT_YARD',
      updated_at = NOW()
  WHERE id = p_gate_in_id;

  -- Đưa container vào trạng thái chờ xe nâng hạ bãi (WAITING_PLACEMENT)
  INSERT INTO containers (
    container_no, size_code, type_code, owner_id, status,
    condition_class, stuffing_class, cleaning_items, gate_in_at
  ) VALUES (
    v_order.container_no, v_order.size_code, v_order.type_code, v_order.shipping_line_id,
    'WAITING_PLACEMENT', v_order.condition_class, v_order.stuffing_class, v_order.cleaning_items, NOW()
  )
  ON CONFLICT (container_no) DO UPDATE
  SET size_code = EXCLUDED.size_code,
      type_code = EXCLUDED.type_code,
      status = 'WAITING_PLACEMENT',
      condition_class = EXCLUDED.condition_class,
      stuffing_class = EXCLUDED.stuffing_class,
      cleaning_items = EXCLUDED.cleaning_items,
      gate_in_at = NOW(),
      gate_out_at = NULL,
      updated_at = NOW()
  RETURNING id INTO v_container_id;

  -- Tự động tạo phiếu Giám định nếu phân loại là DAMAGE
  IF v_order.condition_class = 'DAMAGE' THEN
    INSERT INTO service_work_orders (
      work_order_code, container_id, container_no, service_category, source_gate_in_id, requested_items
    ) VALUES (
      'INSP-' || to_char(NOW(), 'YYMMDDHH24MISS') || '-' || substr(v_order.container_no, 1, 4),
      v_container_id, v_order.container_no, 'INSPECTION', v_order.id, ARRAY['Giám định hư hỏng đầu vào (DAMAGE)']
    );
  END IF;

  -- Tự động tạo phiếu Vệ sinh nếu có hạng mục khác KHÔNG VỆ SINH
  IF NOT ('KHÔNG VỆ SINH' = ANY(v_order.cleaning_items)) THEN
    INSERT INTO service_work_orders (
      work_order_code, container_id, container_no, service_category, source_gate_in_id, requested_items
    ) VALUES (
      'CLN-' || to_char(NOW(), 'YYMMDDHH24MISS') || '-' || substr(v_order.container_no, 1, 4),
      v_container_id, v_order.container_no, 'CLEANING', v_order.id, v_order.cleaning_items::TEXT[]
    );
  END IF;

  RETURN jsonb_build_object('status', 'GATE_IN_OK', 'container_id', v_container_id);
END;
$$;

-- ----------------------------------------------------------------------------
-- 11. ROW LEVEL SECURITY (RLS)
-- ----------------------------------------------------------------------------

ALTER TABLE staff_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE yard_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE containers ENABLE ROW LEVEL SECURITY;
ALTER TABLE container_location_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE master_prepaid_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE master_receipt_deductions ENABLE ROW LEVEL SECURITY;
ALTER TABLE gate_in_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_work_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE release_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE gate_out_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Chính sách đọc cho nhân viên đã xác thực và đang hoạt động
CREATE POLICY "Authenticated active staff can view operational tables"
ON containers FOR SELECT TO authenticated
USING (has_any_role(ARRAY['ADMIN','MANAGER','OFFICE','GATE_STAFF','YARD_STAFF','FORKLIFT','CLEANING','INSPECTOR','REPAIR_STAFF','ACCOUNTANT']::app_role[]));

-- Không cho phép xóa hoặc sửa nhật ký kiểm toán (AUD-002)
CREATE POLICY "Only ADMIN and MANAGER can read audit logs"
ON audit_logs FOR SELECT TO authenticated
USING (has_any_role(ARRAY['ADMIN','MANAGER']::app_role[]));
