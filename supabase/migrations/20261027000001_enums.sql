-- ============================================================================
-- MATRAN DEPOT — Migration 1/5 (phần 1): KIỂU ENUM
-- Thiết kế: docs/DATABASE_SCHEMA.md mục 2; mã theo docs/STATUS_CATALOG.md (DEC-150: bỏ mã chưa dùng).
-- CHỈ VIẾT FILE — người dùng tự apply (AGENTS.md). Agent không chạy lệnh lên Supabase.
-- ============================================================================

create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

create type public.app_role as enum (
  'ADMIN', 'MANAGER', 'OFFICE', 'FORKLIFT', 'CLEANING', 'INSPECTOR', 'QUOTATION', 'REPAIR_STAFF', 'ACCOUNTANT'
);

create type public.condition_class as enum ('AV', 'DAMAGE', 'W-SURVEY');
create type public.stuffing_class as enum ('M', 'K', 'E');
create type public.container_status as enum ('WAITING_PLACEMENT', 'IN_YARD', 'ALLOCATED', 'GATED_OUT');
create type public.forklift_task as enum ('NONE', 'HA_KE_GIAM_DINH');
create type public.gate_in_type as enum ('CUSTOMER_RETURN', 'VESSEL_IMPORT');
create type public.gate_in_status as enum ('FIELD_RECORDED', 'PAYMENT_PENDING', 'GATE_IN_OK', 'CANCELLED');
create type public.gate_out_type as enum ('EMPTY_RELEASE', 'VESSEL_EXPORT');
create type public.gate_out_status as enum ('PAYMENT_PENDING', 'PENDING_FORKLIFT', 'GATE_OUT_OK', 'CANCELLED');
create type public.booking_status as enum ('OPEN', 'FULLY_ALLOCATED', 'COMPLETED', 'CANCELLED');
create type public.work_category as enum ('CLEANING', 'INSPECTION', 'REPAIR');
create type public.work_status as enum ('OPEN', 'COMPLETED', 'CANCELLED');
create type public.approval_status as enum ('NOT_REQUIRED', 'PENDING_APPROVAL', 'APPROVED');
create type public.voucher_status as enum ('PENDING', 'CONFIRMED', 'DEFERRED', 'FAILED', 'CANCELLED');
create type public.payment_category as enum ('TTTT', 'TTT', 'TTS');
create type public.direct_method as enum ('CASH', 'BANK_TRANSFER_API');
create type public.tx_status as enum ('PENDING', 'SUCCEEDED', 'FAILED', 'CANCELLED');
create type public.receipt_purpose as enum ('VOUCHER', 'PREPAID_TOPUP');
create type public.prepaid_status as enum ('PENDING_PAYMENT', 'ACTIVE', 'EXHAUSTED', 'CANCELLED');
create type public.invoice_status as enum ('CHUA_XHD', 'YEU_CAU_XHD', 'DA_XHD');
create type public.vessel_mode as enum ('NHAP_TAU', 'XUAT_TAU');
create type public.vessel_list_status as enum ('OPEN', 'APPROVED');
create type public.vessel_item_status as enum ('PENDING', 'INSPECTED', 'DONE', 'SKIPPED');
create type public.location_action as enum ('INITIAL_BLOCK', 'DETAIL_SLOT_UPDATE', 'YARD_SHIFT', 'GATE_OUT_CLEAR');
create type public.feedback_status as enum ('MOI', 'DANG_XU_LY', 'DA_XU_LY', 'KHONG_AP_DUNG');
create type public.fee_category as enum ('NANG_HA', 'THU_GOM_RAC', 'KHAC');
