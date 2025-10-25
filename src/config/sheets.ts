// Cấu hình tập trung cho Google Sheets
// Bạn có thể mở rộng thêm nhiều sheet/range khác nhau tại đây

export const USER_SHEET_ID =
  process.env.SHEET_ID || "1cv3J6DJZ7vkpNwqE1C5lJeZebf3H5KF1fKnx408XnRg";

// Mặc định: chỉ đọc các cột cần thiết A..J (A1:J); Google Sheets API tự cắt theo số hàng có dữ liệu
// Header ở hàng 1; dữ liệu bắt đầu từ hàng 2 trở đi (chúng ta đã bỏ qua hàng 2 khi liệt kê để bảo mật admin)
export const USER_SHEET_RANGE = "user!A1:J";

// Ví dụ cấu hình khác trong tương lai:
export const PRODUCTS_SHEET_RANGE = "Products!A1:M"; // A..M (mô tả + 3 cột link hình ảnh K,L,M)
// Danh mục nhóm sản phẩm: cột N (từ hàng 2 trở đi)
export const PRODUCTS_GROUPS_RANGE = "Products!N2:N";
// Danh mục đơn vị đo lường: cột O (từ hàng 2 trở đi)
export const PRODUCTS_UOMS_RANGE = "Products!O2:O";
// Danh sách mã sản phẩm bị ngưng sử dụng (soft delete): cột P (từ hàng 2 trở đi)
export const PRODUCTS_DISABLED_CODES_RANGE = "Products!P2:P";
// export const LOCATIONS_SHEET_RANGE = "Locations!A:Z";

// Phiếu nhập: dữ liệu nguồn từ sheet 'phieunhap' (A..N)
// A=mã phiếu, B=ngày nhập, C=giờ, D=kho, E=Mã SP, F=Tên SP, G=số lượng nhập, H=đvt, I=người nhập, J=diễn giải, K=ghi chú, L=nguồn dữ liệu, M=người nhận, N=link (slug)
export const INBOUND_SHEET_RANGE = "phieunhap!A1:N";
// Log sheet for inbound changes
export const INBOUND_LOG_SHEET_RANGE = "phieunhap_log!A1:F";

// Link mapping sheet for phieunhap: A=code, B=slug
export const LINK_PHIEUNHAP_SHEET_RANGE = "linkphieunhap!A1:B";
// Versions sheet for inbound snapshots: columns A=code, B=version, C=timestamp, D=user, E=data(json)
// Versions sheet for inbound snapshots: columns A=code, B=version, C=timestamp, D=user, E=data(json), F=slug (link)
export const INBOUND_VERSIONS_SHEET_RANGE = "phieunhap_versions!A1:F";

// Phiếu xuất: cấu trúc tương tự phiếu nhập nhưng dùng các sheet/tab khác
// A=mã phiếu, B=ngày, C=giờ, D=kho, E=Mã SP, F=Tên SP, G=số lượng, H=ĐVT, I=người lập, J=diễn giải, K=ghi chú, L=nguồn dữ liệu, M=người nhận, N=link (slug)
export const OUTBOUND_SHEET_RANGE = "phieuxuat!A1:N";
// Log sheet cho phiếu xuất
export const OUTBOUND_LOG_SHEET_RANGE = "phieuxuat_log!A1:F";
// Link mapping sheet cho phiếu xuất
export const LINK_PHIEUXUAT_SHEET_RANGE = "linkphieuxuat!A1:B";
// Versions sheet cho phiếu xuất
export const OUTBOUND_VERSIONS_SHEET_RANGE = "phieuxuat_versions!A1:F";

// Kho: danh mục kho
// Sheet/tab tên 'kho' với cột: A=ID (không dùng), B=Name, C=Default(1/0)
export const WAREHOUSES_SHEET_RANGE = "kho!A1:C";

// Cài đặt phiếu nhập: lưu các cặp key/value tại sheet/tab 'caidatphieunhap'
// A=key, B=value, header tùy chọn (Key | Value) ở hàng 1
export const INBOUND_SETTINGS_SHEET_RANGE = "caidatphieunhap!A1:B";

// Danh sách người nhận và mapping TEXT1..TEXT7
// Lưu ý: Theo cấu hình mới của bạn
// A=cột phụ (ví dụ STT), B=Tên người nhận, C..I ánh xạ lần lượt TEXT1..TEXT7
// Vì vậy cần đọc A..I từ hàng 2 trở đi để có đủ C..I
export const INBOUND_SETTINGS_RECEIVERS_RANGE = "caidatphieunhap!A2:I";
