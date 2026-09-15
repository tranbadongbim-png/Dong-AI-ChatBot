export const DEFAULT_MYMEPTOOLS_CONTENT = `# QUY CHUẨN WPF & CHỐNG SẬP MODEL — MyMEPTools.extension

> Tài liệu này tổng hợp **phong cách thiết kế WPF/XAML** và **danh mục lỗi phải tránh tuyệt đối**,
> rút ra trực tiếp từ toàn bộ source của extension (74 file \`script.py\`, 14 file \`.xaml\`).
> Mọi quy tắc đều có **dẫn chứng file + số dòng** trong chính dự án.
> Tài liệu anh em: \`TONG_HOP_KIEN_THUC_MyMEPTools.md\` (kiến thức nền Revit API/pyRevit).

---

## 0. CÁCH ĐỌC TÀI LIỆU — HỆ THỐNG NHÃN TUÂN THỦ

| Nhãn | Ý nghĩa | Mức độ |
|---|---|---|
| 🔴 **[TTTĐ — BẮT BUỘC]** | Tuân thủ tuyệt đối. Vi phạm = tool lỗi / Revit ném exception. | Không có ngoại lệ |
| **[CẤM HOÀN TOÀN]** | Hành vi cấm hoàn toàn. Vi phạm = có thể **sập Revit / hỏng file / mất dữ liệu**. | Không có ngoại lệ |
| 🟠 **[KHUYẾN NGHỊ MẠNH]** | Nên làm; dự án đôi chỗ chưa áp dụng → nâng cấp dần. | Nên áp dụng |
| 🔵 **[GHI NHẬN THỰC TRẠNG]** | Chỉ mô tả cái đang có (nhiều phong cách song song). | Tham khảo khi sửa file |
| ✅ **[ĐÃ CHUẨN]** | Pattern này đã được dùng đúng & rộng trong dự án → copy nguyên xi. | Copy 100% |

**Nguyên tắc số 1 của dự án:** *Thà tool báo lỗi và dừng, còn hơn để Revit ở trạng thái treo/hỏng model.*

---

# PHẦN A — PHONG CÁCH THIẾT KẾ WPF CỦA MyMEPTools

## A1. Năm dòng phong cách đang tồn tại (thực trạng) 🔵

Dự án có **5 nhóm giao diện** phát triển theo thời gian. Khi làm tool mới **phải dùng nhóm ①**.

| # | Tên nhóm | Đặc trưng | File đại diện |
|---|---|---|---|
| ① | **Light Premium Dashboard** ⭐ CHUẨN MỚI | Nền \`#F3F4F6\`, card trắng, viền \`#E5E7EB\`, accent xanh \`#2563EB\`, Segoe UI, footer © | \`ZLevelPickerWindow.xaml\`, \`AlignViews.xaml\`, \`AlignResult.xaml\`, \`SheetViewManager.xaml\` |
| ② | **Dark IDE (VS Code)** | \`#252526\` / \`#333337\` / \`#2D2D30\`, chữ \`#D4D4D4\`, accent \`#0078D4\`, close hover \`#E81123\` | \`Tagging Pro\\ui.xaml\` |
| ③ | **Dark Neutral MEP** | \`#171B22\` / \`#202631\` / \`#252C37\`, accent **cam** \`#F06A35\`, chữ \`#F3F5F8\` | \`Connect Spk Pro\\ui.xaml\` |
| ④ | **Legacy Light / Material** | Nền trắng–\`#FAFAFA\`, nút màu \`#FF9800\` \`#607D8B\` \`#009688\` \`#005FB8\`, DataGrid mặc định | \`Sheet Empty\\ui.xaml\`, \`Excel Synch\\ui.xaml\`, \`Color Systems\\ui.xaml\` |
| ⑤ | **Glass Card + Gradient** | Card trắng bo 16px + drop shadow, nút gradient indigo \`#6366F1\` | \`Auto Merge Duct\\ui.xaml\`, \`Auto Split Duct\\ui.xaml\`, \`ui.xaml\` (splash) |

🔵 **[GHI NHẬN]**: Không được "trộn" palette giữa các nhóm trong cùng một file XAML. Sửa tool cũ thì giữ nhóm cũ; làm tool mới thì dùng nhóm ①.

---

## A2. Palette chuẩn nhóm ① (copy chính xác — ✅ ĐÃ CHUẨN)

\`\`\`xml
<Window.Resources>
    <SolidColorBrush x:Key="BgApp"         Color="#F3F4F6"/>  <!-- nền app -->
    <SolidColorBrush x:Key="BgCard"        Color="#FFFFFF"/>  <!-- thẻ/ô nhập -->
    <SolidColorBrush x:Key="BgCardHover"   Color="#F9FAFB"/>
    <SolidColorBrush x:Key="BgCardSel"     Color="#EFF6FF"/>  <!-- mục đang chọn -->
    <SolidColorBrush x:Key="BorderSoft"    Color="#E5E7EB"/>  <!-- viền mảnh -->
    <SolidColorBrush x:Key="AccentBlue"    Color="#3B82F6"/>  <!-- icon / caret -->
    <SolidColorBrush x:Key="AccentHover"   Color="#2563EB"/>  <!-- nút chính -->
    <SolidColorBrush x:Key="TextPrimary"   Color="#111827"/>
    <SolidColorBrush x:Key="TextSecondary" Color="#6B7280"/>
</Window.Resources>
\`\`\`

---

# PHẦN B — CHỐNG SẬP MODEL (SURVIVAL RULES)

> Đây là phần quan trọng nhất. **Phần A sai → tool xấu/khó dùng. Phần B sai → mất dữ liệu, treo Revit, hỏng file.**

1. **Mọi thay đổi model nằm trong đúng 1 \`Transaction\`** — và transaction đó phải được \`Commit\` hoặc \`RollBack\` tường minh, kể cả khi có exception.
2. **Không thao tác Revit khi luồng không phải luồng API** (modeless WPF, timer, background thread) → chỉ được hoạt động qua \`ExternalEvent\` / \`Idling\`.
3. **Thà dừng tool + báo lỗi rõ, còn hơn tiếp tục và sinh lỗi dây chuyền.** Mọi bước rủi ro phải được cô lập (\`try/except\` + \`SubTransaction\`) và có "van an toàn" (counter, kiểm tra \`IsValidObject\`, kiểm tra tồn tại trước khi dùng).

---

# 📘 TỔNG HỢP KIẾN THỨC — MyMEPTools.extension

> Tài liệu tổng hợp toàn bộ tool pyRevit trong dự án: cấu trúc, quy trình hoạt động, cách dùng hàm và các lưu ý quan trọng.
> **Tác giả:** Dong Tran Ba (BIMer) — Cập nhật: 2026
> **Nền tảng:** pyRevit (IronPython 2.7) + Revit API, giao diện WPF / WinForms

---

## MỤC LỤC

1. [Tổng quan dự án & cấu trúc thư mục](#1-tổng-quan-dự-án--cấu-trúc-thư-mục)
2. [Quy ước pyRevit: bundle, pushbutton, stack](#2-quy-ước-pyrevit-bundle-pushbutton-stack)
3. [Kiến thức nền chung (bắt buộc đọc)](#3-kiến-thức-nền-chung)
4. [Thư viện dùng chung \`lib/plumbing_pro.py\`](#4-thư-viện-dùng-chung-libplumbing_propy)
5. [Panel **Dong's Tool** (chi tiết từng tool)](#5-panel-dongs-tool)
6. [Panel **Model Tool** (bẻ co 90°/45° đa năng)](#6-panel-model-tool)
7. [Panel **Plumbing** (nối ống thoát nước)](#7-panel-plumbing)
8. [Quy trình phát triển tool mới trong dự án](#8-quy-trình-phát-triên-tool-mới)
9. [Sổ tay lưu ý & lỗi hay gặp](#9-sổ-tay-lưu-ý--lỗi-hay-gặp)

---

## 1. Tổng quan dự án & cấu trúc thư mục

### 1.1. Bản chất
Đây là **1 extension pyRevit** tên \`MyMEPTools.extension\`, chứa 3 panel công cụ MEP:

| Panel | Chủ đề | Số lượng tool |
|---|---|---|
| **Dong's Tool** | Tiện ích tổng hợp: BOQ, Clash, Color, Tag, Dim, Align, Connect Sprinkler, Excel… | ~20 tool (7 stack + 1 nút lẻ) |
| **Model Tool** | Bẻ co 90°/45° LÊN/XUỐNG/TRÁI/PHẢI cho Pipe / Duct / Cable Tray + Utility nối/ngắt | 13 nút (5 stack) |
| **Plumbing** | Nối ống thoát nước (drainage): Branch 2/3/4/5/7/8, AxisPipe, BranchPipe1, Connect Fixture, Vent Riser | 10 nút |

### 1.2. Cây thư mục

\`\`\`
MyMEPTools.extension\\                      ← thư mục gốc extension (tên bắt buộc đuôi .extension)
├── startup.py                             ← script chạy khi load extension (cửa sổ chào hỏi)
├── ui.xaml                                ← XAML của cửa sổ chào hỏi
├── lib\\
│   └── plumbing_pro.py                    ← ★ THƯ VIỆN DÙNG CHUNG cho toàn bộ tool Plumbing
└── Dong Tran Ba.tab\\                      ← Tab trên Ribbon
    ├── Dong's Tool.panel\\
    │   ├── 1.stack\\ ... 7.stack\\          ← stack xếp dọc các pushbutton
    │   └── Sheet & View Manager.pushbutton\\
    ├── Model Tool.panel\\                  ← có bundle.yaml riêng định nghĩa layout
    │   ├── Up Down.stack\\ Left Right.stack\\ 45 Up Down.stack\\ 45 Left Right.stack\\ Utility.stack\\
    └── Plumbing.panel\\
        ├── Branch 5 / Branch 7 / Branch 8 .pushbutton\\
        ├── Drainage.stack\\ (AxisPipe, BranchPipe1, Connect Fixture)
        ├── Drainage2.stack\\ (Branch 2, Branch 3, Branch 4)
        └── Vent Riser.pushbutton\\
\`\`\`

**Quy ước đặt tên thư mục:**
- Tab phải đuôi \`.tab\`, panel đuôi \`.panel\`, nhóm nút đuôi \`.stack\`, nút đuôi \`.pushbutton\` — pyRevit nhận diện **qua đuôi thư mục**, sai đuôi là không load.
- Tên hiển thị trên Ribbon được lấy từ \`bundle.yaml\` (mục \`title\`), hỗ trợ \`\\n\` để xuống 2 dòng.
- Icon: file \`icon.png\` (32x32) đặt trong thư mục pushbutton.
- Script chính **bắt buộc** tên \`script.py\` nằm trong thư mục pushbutton.
- Giao diện: \`ui.xaml\` cùng thư mục — \`forms.WPFWindow('ui.xaml')\` tự tìm file XAML cùng thư mục với script.
- Cảnh báo/kết quả: có thể dùng file XAML phụ riêng (VD: \`alert.xaml\`, \`AlignResult.xaml\`, \`ZLevelPickerWindow.xaml\`).

### 1.3. \`startup.py\` (cửa sổ chào hỏi khi khởi động)
- pyRevit tự chạy \`startup.py\` khi load extension. Nó import WPF (\`PresentationCore/Framework\`), định nghĩa class \`ChaoDongWindow(WPFWindow)\` rồi \`window.Show()\` (modeless).
- Gắn sự kiện: nút Close/Ok, nút "Chào lại", và phím **ESC** qua \`self.KeyDown += self.on_key_down\` (kiểm tra \`e.Key == System.Windows.Input.Key.Escape\`).
- Có hiệu ứng **fade-in** bằng \`Storyboard\` + \`DoubleAnimation\` trong \`ui.xaml\`.
- Lưu ý: cùng một class trong \`6.stack\\Chao Dong.pushbutton\` nhưng dùng \`ShowDialog()\` (modal).

### 1.4. Cách access document — 2 phong cách song song trong dự án

\`\`\`python
# Phong cách 1: qua __revit__ (dùng nhiều ở tool cũ)
doc   = __revit__.ActiveUIDocument.Document
uidoc = __revit__.ActiveUIDocument

# Phong cách 2: qua module pyrevit (tool mới, gọn hơn)
from pyrevit import revit
doc, uidoc = revit.doc, revit.uidoc
\`\`\`

---

## 2. Quy ước pyRevit: bundle, pushbutton, stack

### 2.1. \`bundle.yaml\`
Mỗi pushbutton có thể có \`bundle.yaml\` khai báo metadata:

\`\`\`yaml
title: "MEP BOQ\\nDashboard"     # tên nút (\\n = xuống dòng)
tooltip: "The Ultimate Quantity Takeoff Engine"
author: "Dong Tran Ba (BIMer)"
context: zero-doc               # chạy được cả khi KHÔNG mở file Revit
\`\`\`

- \`context: zero-doc\` dùng cho tool giao diện thuần (BOQ Pro, BOQ 3D Pro, Excel Synch, Chao Dong).
- Panel \`Model Tool.panel\` có \`bundle.yaml\` khai báo \`layout:\` liệt kê thứ tự các stack.

### 2.2. \`stack\`
- Thư mục đuôi \`.stack\` xếp các nút **ngang** (nếu tên bắt đầu bằng số \`1.stack\`, \`2.stack\`… thì pyRevit giữ đúng thứ tự và gộp thành dãy nút mảnh).
- Stack con có thể có \`bundle.yaml\` riêng chỉ dùng \`title\` + \`tooltip\` (VD: "Bẻ co 45 độ LÊN/XUỐNG (giữ độ dốc) cho Pipe / Duct / Cable Tray").

### 2.3. Metadata script.py
Hai dòng đầu hay dùng:

\`\`\`python
__title__ = "Align & Connect\\nSprinkler"   # tên hiển thị (ghi đè bundle.yaml)
__doc__   = "Mô tả ngắn tool"
\`\`\`

## 3. Kiến thức nền chung

> Phần này là **mẫu thiết kế chung** lặp lại trong hầu hết tool. Hiểu được phần này là đọc code tool nào cũng hiểu.

### 3.1. Đơn vị — Revit nội bộ dùng FEET
- Mọi toạ độ, đường kính, khoảng cách đọc/tạo từ API đều theo **feet**.
- Quy ước dự án: \`MM_PER_FOOT = 304.8\`, hàm \`mm_to_feet(mm) = mm / 304.8\`.
- Lấy input người dùng (mm) → chia 304.8 trước khi dùng (VD: Auto Split Duct \`max_length_mm / 304.8\`, 45° elbow \`offset_val = float(offset_mm) / 304.8\`).

### 3.2. ElementId — tương thích Revit 2024+
\`\`\`python
def _eid_int(eid):
    try:    return eid.Value          # Revit 2024+ (Int64)
    except AttributeError:
        return eid.IntegerValue       # Revit cũ (Int32)
\`\`\`
- Tạo ngược lại: \`ElementId(System.Int64(id))\` → fallback \`ElementId(int(id))\` (xem BOQ Pro \`internal_create_id\`).
- Kiểm tra phiên bản: \`IS_REVIT_2024_OR_NEWER = hasattr(DB.ElementId, "Value")\`.

### 3.3. Connector (đầu nối MEP) — trái tim của mọi tool MEP
\`\`\`python
def get_connectors(el):
    if hasattr(el, "ConnectorManager"):            # MEPCurve: Pipe / Duct / CableTray / Conduit
        return list(el.ConnectorManager.Connectors)
    elif el.MEPModel:                              # FamilyInstance: fitting / thiết bị / sprinkler
        return list(el.MEPModel.ConnectorManager.Connectors)
\`\`\`

Quy tắc bắt buộc khi làm việc với connector:
1. **Luôn bỏ connector ảo**: \`if c.ConnectorType == ConnectorType.Logical: continue\` — connector Logical là connector "hệ thống" (đếm số, thông tin), KHÔNG dùng để nối hình học.
2. Kiểm tra \`c.IsConnected\` trước khi dùng (connector còn trống mới cắm được).
3. \`c.Origin\` = toạ độ điểm nối; \`c.CoordinateSystem.BasisZ\` = hướng cổ nối.
4. \`c.AllRefs\` = danh sách connector đang cắm vào nó (duyệt ra phần tử đối diện: \`ref.Owner\`).
5. Chọn connector **gần điểm đích nhất** theo khoảng cách, đừng đoán index.

### 3.4. Các hàm tạo/nối/phá chuẩn dùng trong dự án

| Mục đích | Hàm |
|---|---|
| Tạo ống nước | \`Pipe.Create(doc, sys_type_id, pipe_type_id, level_id, pt0, pt1)\` |
| Tạo ống gió | \`Duct.Create(doc, sys_type_id, type_id, level_id, pt0, pt1)\` |
| Tạo máng cáp | \`CableTray.Create(doc, type_id, pt0, pt1, level_id)\` |
| Tạo ống luồn | \`Electrical.Conduit.Create(doc, type_id, pt0, pt1, level_id)\` |
| Cắt ống nước | \`PlumbingUtils.BreakCurve(doc, pipe_id, pt)\` → trả Id đoạn mới |
| Cắt ống gió | \`Mechanical.MechanicalUtils.BreakCurve(doc, duct_id, pt)\` |
| Chèn Co (2 cổ) | \`doc.Create.NewElbowFitting(conn1, conn2)\` |
| Chèn Tê (3 cổ) | \`doc.Create.NewTeeFitting(conn1, conn2, conn3)\` |
| Chèn Union | \`doc.Create.NewUnionFitting(conn1, conn2)\` |
| Nối thủ công | \`connA.ConnectTo(connB)\` |
| Ngắt thủ công | \`connA.DisconnectFrom(connB)\` |
| Di chuyển / Xoay | \`ElementTransformUtils.MoveElement\` / \`RotateElement(doc, id, axis_line, angle_rad)\` |
| Kéo dài/thụt ống | \`element.Location.Curve = Line.CreateBound(pt0, pt1)\` |

⚠️ **Phải gọi \`doc.Regenerate()\` sau khi tạo/sửa hình học, TRƯỚC khi lấy lại connector** — nếu không connector chưa sinh ra, tool lỗi "không tìm thấy connector".

### 3.5. Transaction — 3 mức trong dự án

\`\`\`python
# Mức 1: pyRevit context manager (tool nhỏ)
with revit.Transaction("Tên lệnh"):
    ...

# Mức 2: Transaction thủ công + chống warning (Plumbing)
t = Transaction(doc, "Branch Pipe 5"); t.Start()
opts = t.GetFailureHandlingOptions()
opts.SetFailuresPreprocessor(SuppressWarnings())   # nuốt mọi Warning vàng
t.SetFailuresPreprocessor(opts)
...
t.Commit()   # lỗi thì t.RollBack()

# Mức 3: TransactionGroup (nhiều transaction → 1 lần Undo duy nhất, chống lag)
tg = TransactionGroup(doc, "Auto Split Ducts"); tg.Start()
for item in items:
    t = Transaction(doc, "..."); t.Start(); ...; t.Commit()
tg.Assimilate()          # gộp toàn bộ thành 1 lệnh Undo
# nếu lỗi nghiêm trọng: tg.RollBack() → trả file về như chưa chạy
\`\`\`

### 3.6. Bộ chặn cảnh báo \`SuppressWarnings\` (chuẩn dự án)

\`\`\`python
class SuppressWarnings(IFailuresPreprocessor):
    def PreprocessFailures(self, failuresAccessor):
        for f in failuresAccessor.GetFailureMessages():
            if f.GetSeverity() == FailureSeverity.Warning:
                failuresAccessor.DeleteWarning(f)      # tự xóa cảnh báo vàng
        return FailureProcessingResult.Continue
\`\`\`
- Gắn vào transaction bằng \`options.SetFailuresPreprocessor(SuppressWarnings())\`.
- Mục đích: khi chèn fitting hàng loạt Revit hay phê warning chặn luồng — preprocessor nuốt hết để chạy ẩn. Lỗi Error vẫn xử lý bình thường.

### 3.7. Chọn đối tượng (\`PickObject\` / \`PickObjects\` + \`ISelectionFilter\`)

\`\`\`python
from Autodesk.Revit.UI.Selection import ObjectType, ISelectionFilter

class PipeSelectionFilter(ISelectionFilter):
    def AllowElement(self, elem):
        return elem.Category.Id.IntegerValue == int(BuiltInCategory.OST_PipeCurves)
    def AllowReference(self, ref, pos): return False   # chặn pick reference

refs = uidoc.Selection.PickObjects(ObjectType.Element, PipeSelectionFilter(),
                                   "Quét chọn ống, bấm Finish…")
# 1 đối tượng: PickObject | nhiều: PickObjects | điểm trên element: ObjectType.PointOnElement
\`\`\`

- Bắt phím hủy: \`except OperationCanceledException: sys.exit()\` (từ \`Autodesk.Revit.Exceptions\`).
- Hỗ trợ quét trước khi bấm tool: \`uidoc.Selection.GetElementIds()\` — có sẵn selection thì dùng luôn, không thì mới Pick (Align Spk, Connect to, Disconnect, Z-SKIP).
- Tính năng **SHIFT-click**: \`globals().get('__shiftclick__', False)\` (BranchPipe1: giữ Shift = chạy Test chỉ dựng hình học, không sinh fitting).

### 3.8. WPF Window (\`forms.WPFWindow\`)

\`\`\`python
class MyWindow(forms.WPFWindow):
    def __init__(self, xaml_file_name):
        forms.WPFWindow.__init__(self, xaml_file_name)   # wire sẵn mọi control theo x:Name
        self.BtnRun.Click += self.btn_run_Click
        self.IsRunClicked = False                        # cờ: user đã bấm Run chưa

w = MyWindow("ui.xaml")      # hoặc tuyệt đối: os.path.join(os.path.dirname(__file__), 'ui.xaml')
w.ShowDialog()               # modal → code dừng chờ
w.Show()                     # modeless (cần ExternalEvent, xem 3.9)
\`\`\`

Mẫu UI thường gặp:
- **Title bar tự chế**: \`WindowStyle="None" AllowsTransparency="True"\` + \`self.DragZone.MouseLeftButtonDown += ... self.DragMove()\`.
- **ESC đóng cửa sổ**: \`self.KeyDown += self.on_key_down\`, so sánh \`System.Windows.Input.Key.Escape\`.
- **Đọc control**: \`self.txtLength.Text\`, \`self.cmbOption.SelectedItem.Content\`.
- **DataSource**: gán \`ItemsSource\` với list object có **property công khai** (binding WPF cần property, VD \`DisplayName\`, \`IsChecked\`); refresh bằng \`self.ListBox.Items.Refresh()\`.
- **Chống chết tool khi đổi XAML**: luôn \`if hasattr(self, 'txtLength'):\` trước khi truy cập control.

### 3.9. Modeless UI + \`ExternalEvent\` (bắt buộc khi \`Show()\`)

Revit chỉ cho sửa model trong context API; cửa sổ modeless chạy ngoài context → dùng handler:

\`\`\`python
from Autodesk.Revit.UI import IExternalEventHandler, ExternalEvent

class MyHandler(IExternalEventHandler):
    def __init__(self): self.doc_hash = None
    def Execute(self, app):                       # app = UIApplication
        uidoc = app.ActiveUIDocument; doc = uidoc.Document
        if doc.GetHashCode() != self.doc_hash:    # ★ chống thao tác chéo document
            print("⚠️ Đang mở file khác — bỏ qua."); return
        t = DB.Transaction(doc, "..."); t.Start(); ...; t.Commit()
    def GetName(self): return "SafeHandler"

handler = MyHandler(); handler.doc_hash = revit.doc.GetHashCode()
ext_event = ExternalEvent.Create(handler)   # tạo MỘT LẦN lúc mở form
ext_event.Raise()                           # gọi chạy mỗi lần cần (toggle workset, navigate…)
\`\`\`

- **Guard \`doc.GetHashCode()\`** bắt buộc cho tool modeless (3D WS).
- BOQ Pro / BOQ 3D Pro / Clash Check dùng cùng pattern — mỗi handler đảm nhiệm 1 việc (collect data / select / color / tạo schedule / navigate).

### 3.10. Báo lỗi & output
- \`print()\` in ra pyRevit output window.
- \`forms.alert("nội dung", title="...", exitscript=True)\` — thông báo + thoát tool.
- \`script.get_output()\` → \`output.print_html(...)\`, \`output.linkify(ids)\` tạo nút chọn element trong báo cáo (Z-SKIP dùng \`re.sub(r'>.*?</a>', '>🎯 CHỌN CÁC ĐỐI TƯỢNG LỖI</a>', raw_link)\` để rút gọn link).
- \`script.get_logger()\` → \`logger.warning(...)\` (Tagging Pro).

### 3.11. Tham số an toàn đa ngôn ngữ (không phụ thuộc tiếng Anh/Việt của Revit)

\`\`\`python
def _bip(name):
    """Lấy BuiltInParameter theo tên; None nếu phiên bản không có."""
    try:    return getattr(BuiltInParameter, name)
    except AttributeError: return None
\`\`\`
- Thử theo thứ tự: \`ParameterTypeId.RbsCtcServiceType\` (Revit 2022+) → danh sách tên BIP dự phòng → quét \`el.Parameters\` theo \`StorageType\`/tên chứa "service"/"type" → cuối cùng \`LookupParameter('Service Type')\` (chỉ Revit tiếng Anh).
- Với tham số \`StorageType.ElementId\` (VD Service Type máng cáp): hỗ trợ cả lưu dạng ElementId lẫn String (\`get_service_type_value\`).
- Với fitting không rõ tham số size: thử nhiều tên ("Nominal Diameter 1/2/3", "Main/Primary Diameter", "Branch/Secondary Diameter"…) — xem \`force_fitting_size\` (Branch 7/8, Vent Riser) và \`FittingSizeUtils.TrySetDiameter\`.

## 4. Thư viện dùng chung \`lib/plumbing_pro.py\`

> "Bộ não" của toàn bộ panel Plumbing. Các tool chỉ import class từ đây và gọi service — **không copy code hình học**. Được thêm vào \`sys.path\` nhờ pyRevit: \`from plumbing_pro import ...\`.

### 4.1. \`PipeSelectionFilter\` (ISelectionFilter)
Chỉ cho pick \`Pipe\`:
\`\`\`python
def AllowElement(self, elem): return isinstance(elem, Pipe)
def AllowReference(self, reference, position): return False
\`\`\`

### 4.2. \`PipeGeometryUtils\` — hằng số & hình học
| Thành phần | Ý nghĩa |
|---|---|
| \`Tolerance\` | 0.1 mm quy ra feet (dung sai hình học toàn dự án) |
| \`VerticalDot\` | \`0.99984769\` ≈ cos(1°): đường có \|Direction.Z\| > hằng số này coi là **đứng thẳng** |
| \`GetCenterline(pipe)\` | Trả \`pipe.Location.Curve\` (Line) nếu là \`LocationCurve\` |
| \`IsNearlyVertical(line)\` | Test ống đứng bằng \`VerticalDot\` |
| \`NormalizeXY(v)\` | Chiếu vector xuống mặt phẳng XY rồi chuẩn hoá (bỏ thành phần Z) |
| \`LiesOnSegment(line, p)\` | Point p có nằm trên đoạn line không (qua \`line.Project(p)\` và Parameter) |

### 4.3. \`ConnectorUtils\` — tiện ích connector
| Hàm | Công dụng / Cách dùng |
|---|---|
| \`GetManager(element)\` | Lấy \`ConnectorManager\` từ MEPCurve **hoặc** \`FamilyInstance.MEPModel\`; không có → raise Exception |
| \`IsPhysical(c)\` | Chỉ nhận \`ConnectorType.End / Curve / Physical\` (loại trừ Logical) |
| \`FreeConnectorNearest(element, target)\` | Tìm connector **chưa nối** gần điểm target nhất; không có → raise |
| \`ConnectorAtEnd(element, target)\` | Tìm connector chưa nối trùng vị trí đấu (dung sai 0.01); dùng khi ống đã dựng tới đúng đầu fitting |
| \`Connect(a, b, step_desc)\` | \`a.ConnectTo(b)\` bọc try/except, kèm mô tả bước để biết lỗi ở đâu |

### 4.4. \`PipeUtils\` — thông số ống
| Hàm | Công dụng |
|---|---|
| \`GetNominalDiameter(pipe)\` | \`pipe.Diameter\`, validate > 0 |
| \`SetNominalDiameter(pipe, value)\` | Set qua \`BuiltInParameter.RBS_PIPE_DIAMETER_PARAM\` (check IsReadOnly) |
| \`GetPipingSystemTypeId(pipe)\` | Ưu tiên \`pipe.MEPSystem.GetTypeId()\` → fallback BIP \`RBS_PIPING_SYSTEM_TYPE_PARAM\`; không ra → raise |
| \`GetLevelId(doc)\` | **Level thấp nhất** trong model (sort theo Elevation lấy phần tử đầu) |
| \`MoveEndPoint(doc, pipe, target, extend=True)\` | Đưa đầu ống gần target tới đúng target bằng cách gán lại \`Location.Curve\`; \`extend=False\` thì chặn thụt ngược làm đảo chiều ống |

### 4.5. \`FittingFinder\` / \`FittingSizeUtils\` — tìm & set size ngã ba
- \`FindJunctionFromPipeType(doc, pipe)\`: đọc \`pipe.PipeType.RoutingPreferenceManager\`, duyệt rule nhóm \`Junctions\`, ưu tiên family có chữ **"Wye"**.
- \`FindAllJunctions(doc, pipe)\`: kết hợp kết quả trên + quét toàn bộ \`FamilySymbol\` category \`OST_PipeFitting\` khớp keyword \`["Wye", "Y-", "Tee"]\`, dedupe theo Id.
- \`EnumerateParameters(fitting)\`: yield tham số của instance **và** của Type (fitting nhiều khi set size ở Type).
- \`TrySetDiameter(fitting, paramNames, keywords, value)\`: thử set theo tên chính xác trước, rồi theo keyword trong tên tham số; chỉ set tham số \`Double\`, không ReadOnly.
- \`SetPortDiameterByRadius(fitting, connector, diameter)\`: khi không biết tên tham số — tìm tham số Double **có giá trị hiện tại ≈ 2×Radius** của cổ nối (chênh ≤ 30%) rồi ghi đè.

### 4.6. \`AxisPipeValidator\` / \`AxisPipeService\` — nối ống nhánh vào TRỤC ĐỨNG
**Validator** (\`EnsureValidPair\`) kiểm tra: 2 ống tồn tại, không trùng nhau, ống thứ 2 phải đứng thẳng, cùng Piping System Type — sai cái nào raise Exception với thông báo tiếng Việt rõ ràng.

**Service** (\`CreateBranchConnection\`, \`OffsetMultiplier = 4.0\` = 4D):
1. Tìm đầu ống nhánh gần trục đứng → tính điểm bẻ co cách trục \`4D\`.
2. Thụt ống nhánh về điểm đó (\`Location.Curve = Line.CreateBound(...)\`).
3. Tạo đoạn ống chéo 45° từ điểm bẻ tới điểm đặt Wye trên trục đứng (\`ptWye\` — nằm cách điểm bẻ đúng \`reqDist\` theo Z, validate \`LiesOnSegment\`).
4. \`PlumbingUtils.BreakCurve\` cắt trục đứng tại Wye → 2 đoạn.
5. Đặt Family Wye tại ptWye: **xoay 3 trục** (\`RotateAroundAxis\`: lộn ngược nếu ống chéo đi xuống → quay quanh Z theo phương mặt bằng → nghiêng quanh trục vuông góc) rồi set diameter.
6. \`EnsureBranchDirection\` chỉnh cổ nhánh khớp hướng ống chéo; kéo từng đầu ống về đúng cổ (\`FindAngledPort\`, \`FindRunPorts\`) rồi \`ConnectorUtils.Connect\` từng cặp kèm mô tả bước.

### 4.7. \`BranchPipe1Validator\` / \`BranchPipe1Service\` — nối ống nhánh vào ỐNG CHÍNH NGANG
\`OffsetMultiplier = 3.5\` → phải chừa ~3.5D cho Wye + 2 lồi 45°.

\`CreateBranchConnection(doc, branchPipe, mainPipe, createFittings=True)\` — quy trình chuẩn "Wye 45°":
1. Tính **giao điểm mặt bằng** F giữa tâm 2 ống: \`PlanIntersection(p0, u, m0, v)\` (tích có hướng 2D, song song → raise "Song song trên mặt bằng").
2. Chặn trường hợp tâm nhánh **cắt xuyên** tâm chính (\`PlanDot\` 2 đầu trái dấu).
3. Điểm bẻ P3 trên ống nhánh, lùi \`L = D * OffsetMultiplier\` từ giao điểm.
4. \`FindOptimalPlanAngle(...)\`: **quét lưới 201 giá trị phi** (0→89°), chọn phương đấu tối ưu để góc vào Wye gần 45° nhất cả 2 phía (\`EvaluatePlanAngle\` + \`AcuteAngleDeg\`).
5. Thụt ống nhánh về P3, tạo ống 45° từ P3 tới điểm đấu Q3 trên ống chính.
6. Cắt ống chính tại Q3 (\`BreakCurve\`), dựng Wye tại Q3 với góc cổ nhánh \`thetaQ\`:
   - \`TrySetJunctionAngle\` (set tham số góc), xoay quanh Z theo phương chính, tilt quanh trục vuông góc, \`AlignBranchPort\` (2 pass, dung sai 6°).
7. \`SetJunctionDiameters\`: set nhánh trước (thử tên tham số → fallback theo Radius), rồi trục chính cho từng cổ run.
8. \`FindBranchPort\` / \`FindRunPorts\` / \`AssignRunPorts\` (dựa dấu \`BasisZ · runAxis\` để gán đúng cổ A/B) → kéo 3 ống vào 3 cổ → \`Connect\` từng cặp.
9. Cuối cùng chèn lồi 45° nối ống nhánh – ống 45° (\`NewElbowFitting\`).

> Nếu \`createFittings=False\` (SHIFT-click): chỉ dựng hình học, không sinh family — dùng để test.

### 4.8. Cách tool Plumbing gọi thư viện (mẫu chuẩn)

\`\`\`python
from plumbing_pro import (PipeSelectionFilter, BranchPipe1Validator,
                          BranchPipe1Service, PipeGeometryUtils, PipeUtils, ConnectorUtils)

with Transaction(doc, "Tên lệnh") as tx:
    tx.Start()
    opts = tx.GetFailureHandlingOptions()
    opts.SetFailuresPreprocessor(SuppressWarnings())   # luôn kèm bộ nuốt warning
    tx.SetFailuresPreprocessor(opts)

    BranchPipe1Validator.EnsureValidPair(doc, branch_pipe, main_pipe)  # validate trước
    BranchPipe1Service.CreateBranchConnection(doc, branch_pipe, main_pipe, True)
    tx.Commit()
\`\`\`
- Bọc toàn bộ bằng try: \`OperationCanceledException\` → \`sys.exit()\`; Exception khác → \`forms.alert("Lỗi kết nối:\\n\\n{}".format(ex), title="...")\`.

## 5. Panel **Dong's Tool**

### 5.1. Stack 1 — Xử lý ống gió & Sprinkler

#### \`Align Spk.pushbutton\` — Căn thẳng & kết nối cụm Ống đứng + Côn + Sprinkler
**Cách dùng:** quét chọn (hoặc PickObjects) vùng chứa ống đứng/côn giảm/sprinkler → chạy.
**Quy trình:**
1. Phân loại selection theo \`BuiltInCategory\` (\`OST_PipeCurves\` — *lưu ý fix: phải dùng OST_PipeCurves, không phải OST_Pipes*, \`OST_PipeFitting\`, \`OST_Sprinklers\`); chỉ lấy ống **thẳng đứng** (\`is_vertical\`: 2 đầu trùng X,Y).
2. Nhóm cụm: với mỗi ống đứng, lấy connector đầu **trên cùng** (sort theo Z), tìm côn + sprinkler gần nhất trong bán kính 5 ft (~1.5 m).
3. Trong 1 Transaction, từng cụm:
   - \`safe_disconnect_all(conn)\`: duyệt \`conn.AllRefs\`, \`DisconnectFrom\` toàn bộ (ngắt triệt để).
   - \`MoveElement\` côn về đúng (X,Y,Z) của đầu ống → Regenerate → \`MoveElement\` sprinkler về đỉnh côn (đồng tâm ống).
   - \`ConnectTo\` 2 cặp: ống↔côn, côn↔sprinkler.
4. Báo số cụm thành công bằng \`forms.alert\`.

**Lưu ý:** lỗi trong 1 cụm chỉ \`print\`, không dừng toàn bộ; sau mỗi bước di chuyển phải \`doc.Regenerate()\`.

#### \`Auto Merge Duct.pushbutton\` — Nối gộp ống gió qua Union (khử phụ kiện nối thẳng)
**Cách dùng:** hộp thoại WPF → bấm Run → quét chọn vùng ống gió + fitting → Finish.
**Quy trình \`process_merge(doc, union)\`:**
1. Union phải có đúng **2 cổ vật lý**; duyệt \`AllRefs\` tìm 2 ống gió đang cắm.
2. Chỉ merge khi 2 ống **thẳng hàng**: \`dir_A.CrossProduct(dir_B).GetLength() > 0.05\` → bỏ qua (tránh nối láo ống cong).
3. **Bảo vệ Taps**: đếm connector vật lý của từng ống (\`taps_A/B\`); ống nào có >2 cổ (đang cắm cổ trích) → giữ lại làm ống sống; cả 2 đều có taps → **không xoá ống nào** (bảo vệ dữ liệu).
4. Xoá union + ống B, kéo dài ống A (\`Location.Curve\` mới tới đầu B), Regenerate, tái cắm các thiết bị (\`refs_to_reconnect\`) vào đầu mới.
**Kỹ thuật:** mỗi union 1 Transaction (commit nếu OK, RollBack nếu \`process_merge\` trả False), bọc ngoài bằng \`TransactionGroup\` + \`Assimilate\`.
**⚠️ Fix lịch sử:** xác định union bằng \`MEPModel.PartType == PartType.Union\` — **không phải** \`PartType.UnionFitting\` (không tồn tại, từng gây lỗi). Cả hai file \`ui.xaml\` (hộp thoại) và \`alert.xaml\` (kết quả) dùng chung.

#### \`Auto Split Duct.pushbutton\` — Cắt ống gio dài quá giới hạn & chèn Union
**Cách dùng:** nhập chiều dài tối đa (mm, mặc định **1120**) → quét chọn ống → chạy.
**Quy trình (mỗi ống 1 transaction, có \`safety_counter > 500\` thoát vòng lặp khẩn cấp):**
1. Xác định đầu xa điểm đích, tính điểm cắt \`start + vec * max_len_ft\` (kèm \`curve.Project\`).
2. \`Mechanical.MechanicalUtils.BreakCurve\` — nếu lỗi thì **thử lại lùi thêm 2mm** (\`+ 2.0/304.8\`), vẫn lỗi thì bỏ qua vị trí này.
3. Sau cắt: \`get_open_connector\` (chưa nối, gần break point, dung sai 0.2) cho 2 đoạn → \`doc.Create.NewUnionFitting(connA, connB)\`.
4. Chọn đoạn tiếp tục (\`Evaluate(0.5, True)\` — đo trung điểm nào gần đích hơn).
**Kỹ thuật:** TransactionGroup chống lag cuối tool; \`doc.Regenerate()\` đầu mỗi vòng lặp.

### 5.2. Stack 2 — BOQ & Clash Check

#### \`BOQ Pro.pushbutton\` — Dashboard lập bảng khối lượng MEP (WinForms)
- \`__persistentengine__ = True\` (giữ engine sống giữa các lần chạy).
- **Kiến trúc 4 lớp ExternalEvent** (form WinForms modeless):
  | Handler | Nhiệm vụ |
  |---|---|
  | \`EpDataHandler\` | Quét model, thu thập dữ liệu phần tử MEP: Workset, Level, System Type, Category, toạ độ Z, độ nghiêng; **cache** vào \`cached_data\` |
  | \`SelectionHandler\` | Set selection trong Revit khi user bấm 1 dòng |
  | \`ColorOverrideHandler\` | Ép màu phần tử theo lọc hiện tại (view override) |
  | \`ScheduleCreateHandler\` | Tạo Schedule/Qty trong Revit theo bộ lọc |
- \`BOQDashboardForm(Form)\` + \`InitLayout()\` dựng UI WinForms thuần (ListBox lọc, DataGridView, preset save/load, progress…).
- **Xử lý System Type đa dạng** (\`internal_get_system_type_name\`): với đám thiết bị điện (ElectricalEquipment/Fixtures, Lighting, FireAlarm, Security, Data, Communication, Telephone, NurseCall) → lấy \`RBS_ELEC_CIRCUIT_NUMBER\` hoặc \`RBS_ELEC_PANEL_NAME\`, không có trả "Noname".
- Lấy Z: ưu tiên Location → fallback \`get_BoundingBox(None).Min.Z\` (thiết bị bám trần/tường không có Location).
- Xuất Excel (SaveFileDialog), tạo Schedule, ép màu + reset màu, preset lưu/đọc.

#### \`BOQ 3D Pro.pushbutton\` — Phiên bản WPF + hồ sơ (profile)
- Cùng 4 handler như BOQ Pro nhưng form là **WPF** (\`BOQDashboardWPF(forms.WPFWindow)\`), thêm:
  - \`scope_3d_changed\`: lọc theo vùng 3D đang chọn (Section Box / vùng nhìn).
  - **Quản lý hồ sơ lọc** (\`_profiles_dir\`, \`_read_profile\`, \`_write_profile\`, \`_safe_filename\`, \`_current_filter_snapshot\`, \`_apply_filter_snapshot\`) — lưu JSON, load/save/save-as/delete, đổi thư mục profile.
  - \`_get_config_path\` cấu hình riêng theo máy.
- \`dgBOQ_AutoGeneratingColumn\`: tuỳ biến cột DataGrid.

#### \`Clash Check.pushbutton\` — Phát hiện va chạm MEP (WinForms modeless)
- **Phạm vi category**: \`MEP_CATEGORIES\` (20 nhóm MEP: Duct/Pipe/Flex/Accessory/Terminal/Sprinkler/CableTray/Conduit/Điện/Thiết bị) vs \`AS_CATEGORIES\` (10 nhóm kiến trúc/kết cấu), có \`MEP_ORDER\`/\`AS_ORDER\` sắp xếp.
- \`ClashNavigationHandler\` (ExternalEvent): \`Selection.SetElementIds\` + \`ShowElements\` — nhảy tới điểm va chạm khi click dòng.
- \`extract_solids(element)\`: duyệt \`get_Geometry\` đệ quy (\`_extract_solids_recursive\`) lấy Solid, \`ComputeReferences\` để có Reference cho navigate.
- UI 3 tab: **Input** (SetupInputTab: chọn category A/B, link model \`LoadRevitLinks\`, \`ToggleLinkMode\`), **Output** (danh sách va chạm, \`OnClashRowFocused\` → navigate, \`OnCopyID\`), **Report** (thống kê, xuất **Excel/CSV** \`OnExportExcelCSV\`, xuất **BCF** \`OnExportBCF\`).
- Đánh giá trạng thái từng clash: Active / Reviewed / Approved (\`UpdateSelectedStatus\`).
- Cache: \`InitCache\` / \`SaveCache\` (lưu kết quả để mở lại không phải quét).
- UI WinForms bo góc bằng GDI+ \`set_rounded_region\` (GraphicsPath AddArc, nhớ \`path.Dispose()\`).
- Filter nhanh theo từ khoá: \`BtnFilter_MEP/Pipe/Duct/Elec/Device/AS/Clear\` → \`ApplyFilter(listbox, keyword_list)\`.

### 5.3. Stack 3 — Tô màu

#### \`3D WS.pushbutton\` — Bật/tắt Workset trong 3D View (modeless)
- Chỉ chạy trên **View3D** không có View Template (\`view.ViewTemplateId == InvalidElementId\`) — có template thì khoá \`WorksetList.IsEnabled\`.
- \`FilteredWorksetCollector(doc).OfKind(WorksetKind.UserWorkset)\` → list \`WorksetItem\` (đọc trạng thái \`view.GetWorksetVisibility(ws.Id)\`; \`UseGlobalSetting\` → theo \`ws.IsVisibleByDefault\`).
- Gạt nút → \`handler.ws_id_int = int(sender.Tag)\`; \`ext_event.Raise()\` → trong \`Execute\`: \`view.SetWorksetVisibility(WorksetId, WorksetVisibility.Visible/Hidden)\` + \`uidoc.RefreshActiveView()\`.
- **Kỹ thuật đáng học**: guard \`doc.GetHashCode() == self.doc_hash\` để chặn thao tác chéo document; biến toàn cục \`_workset_modeless_window_\` giữ cửa sổ không bị GC.

#### \`Color Element.pushbutton\` — Tô màu selection theo 50+ màu
- Từ điển \`colors\` gồm ~55 màu đặt tên \`"01 Red"…\` + mục \`"00 Reset (mac dinh)"\` = \`None\`.
- Chọn màu (\`forms.SelectFromList\`) + chọn kiểu áp (\`OPTION_PROJ_LINE\`, \`OPTION_SURF_FG\`, \`OPTION_SURF_BG\`, \`OPTION_CUT_LINE\`, \`OPTION_CUT_FG\`, \`OPTION_CUT_BG\`).
- Lấy Solid Fill Pattern: duyệt \`FillPatternElement\`, \`fp.GetFillPattern().IsSolidFill\`.
- Áp dụng qua \`OverrideGraphicSettings()\`:
  - đường bao: \`SetProjectionLineColor(color)\` / \`SetCutLineColor(color)\`
  - mặt: \`SetSurfaceForegroundPatternColor\` + \`SetSurfaceForegroundPatternVisible(True)\` + \`SetSurfaceForegroundPatternId(solid_pat.Id)\` (tương tự Background, Cut)
  - gọi \`view.SetElementOverrides(eid, ogs)\` trong \`revit.Transaction\`.
- Reset = \`view.SetElementOverrides(eid, OverrideGraphicSettings())\` (trống → về mặc định).
- Đếm success/failed, in lỗi từng Id.

#### \`Color Systems.pushbutton\` — Ép màu theo Hệ thống MEP + tự tạo Legend
- Gom hệ thống theo 3 nhóm category: \`DUCT_CATS\` (6 cat), \`PIPE_CATS\` (7 cat), \`ELEC_CATS\` (4 cat).
- \`SystemItem\`: tên + màu random \`DrawingColor.FromArgb(60–220, …)\` + checkbox + nút màu (ColorDialog).
- Preset JSON ở \`%TEMP%\`: \`DBIM_MEPColorPresets_Master.json\`; import/export/save/delete preset.
- Khi chạy: tạo **View Filter** tên \`DBIM_<tên hệ thống>\`, gán lên view mục tiêu, override màu bằng \`SetElementOverrides\`.
- Nếu view có View Template → cảnh báo (override có thể bị template ghi đè).
- Tùy chọn tạo **Drafting View Legend**: dựng bảng bằng \`FilledRegion.Create\` + \`CurveLoop\` + \`TextNote.Create\` (TextNoteOptions, HorizontalTextAlignment.Left), viền bằng DetailLine — mỗi hệ 1 ô màu + tên \`DBIM_…\`.

### 5.4. Stack 4 — Dim, Title Block, Tag

#### \`Dim Pro.pushbutton\` — Tự động dimension nhánh (⚠️ code base64)
- Script.py **mã hoá base64**: \`exec(compile(base64.b64decode(_c), '<string>', 'exec'), globals())\`.
- ⚠️ Lưu ý: muốn sửa logic phải **decode** (giải mã) rồi chỉnh, không sửa trực tiếp file.
- Nội dung (đã decode): \`get_conns\`, \`get_conn_area\` (Round = πR², Rect/Oval = W×H), \`get_part_type\`, \`get_location_point\`, \`is_connected_to_selection\`; trích ứng cặn tham chiếu từ Geometry (\`Options: ComputeReferences=True, IncludeNonVisibleObjects=True, View\`) lọc mặt phẳng vuông góc hướng dim (\`abs(normal.DotProduct(dim_dir)) > 0.999\`); lọc điểm theo Z (chồng dim dùng Z cao nhất); gom thành \`ReferenceArray\` (loại trùng theo khoảng cách project); tạo \`doc.Create.NewDimension(view, dim_line, ref_array)\`.
- **Chạy liên tục** \`auto_dim_continuous()\`: hỗ trợ quét chọn trước → \`process_branch\`; vòng lặp PickObjects đến khi ESC (\`OperationCanceledException: break\`); nhấn SPACE = thực hiện dim.

#### \`List Title Block.pushbutton\` — Liệt kê Title Block trên các Sheet đã chọn
1. Lấy selection lọc \`ViewSheet\` (set Id cho O(1)); nếu không có sheet → alert + thoát (\`exitscript=True\`).
2. 1 lần duy nhất quét \`OST_TitleBlocks\` + \`WhereElementIsNotElementType()\`, lọc \`tb.OwnerViewId ∈ selected_sheet_ids\`.
3. \`TitleBlockItem\` display: \`"[{SheetNumber}] {Family} : {Type}"\`, property \`IsSelected\` bind được WPF.
4. \`TBSelectionWindow\` (WPF): Select All/None → Apply → \`revit.get_selection().set_to(selected_ids)\` (đổi selection trong Revit).
- **Kỹ thuật:** sắp xếp \`tb_list.sort(key=lambda x: x.DisplayName)\`; \`Items.Refresh()\` sau khi đổi checked.

#### \`Tagging Pro.pushbutton\` — Tag hàng loạt Pipe/Duct/Cable Tray (Plan View)
- Chỉ chạy ở **ViewPlan**; load sẵn loại tag theo 3 category (\`OST_PipeTags\`, \`OST_DuctTags\`, \`OST_CableTrayTags\`), tên hiển thị \`"{Family} : {SYMBOL_NAME_PARAM}"\`, map \`<None>\` = None.
- Cấu hình UI: kích thước tag, \`USE_LEADER\`, \`MAX_TRY\`, \`BASE_OFFSET\`, \`ALIGN_TAGS\`, \`SORT_MODE\` (TOP/BOTTOM…), \`safe_float\` (chấp nhận dấu phẩy thập phân).
- Đặt tag: \`IndependentTag.Create(doc, view.Id, Reference(el), USE_LEADER, TagMode.TM_ADDBY_CATEGORY, TagOrientation.Horizontal, final_point)\` → \`tag.ChangeTypeId(...)\` theo category.
- **Chống chồng tag**: nếu không leader, thử offset vuông góc 2 phía (\`perp = XYZ(-direction.Y, direction.X, 0)\`), mỗi lượt +2.0 ft, kiểm \`too_close(candidate)\`; xoay tag đầu theo góc ống (\`atan2\`, chuẩn hoá về ±90°, trục xoay đứng qua điểm).
- Cuối cùng (nếu \`ALIGN_TAGS\`): kéo \`TagHeadPosition\` về trung bình vị trí X (hoặc Y) của tất cả tag — tag thẳng hàng.

### 5.5. Stack 5 — Align View, Connect Spk, Z-SKIP

#### \`Align View.pushbutton\` — Căn vị trí View trên nhiều Sheet theo 1 Sheet chuẩn
- **Engine** \`AlignEngine\`:
  - \`all_viewports_by_sheet()\`: 1 collector duy nhất cho toàn bộ Viewport (nhanh hơn gọi \`GetAllViewports\` từng sheet).
  - 2 chế độ khớp: \`MODE_INDEX\` (đối theo **vị trí** trên sheet: sort \`(-center.Y, center.X)\` = từ trên xuống, trái sang phải) và \`MODE_VIEW_NAME\` (đối theo tên view).
  - \`_snap(vp)\`: căn toạ độ viewport theo sheet chuẩn; \`_almost\` so gần bằng; cache center 1 lần (\`centers\` dict) tránh gọi \`GetBoxCenter\` nhiều lần gây regen.
  - Tùy chọn copy: Rotation / View Type / View Name Label / Precise Label.
- **UI**: \`AlignViewsWindow\` — 2 ListBox (sheet chuẩn / sheet đích), search filter, chọn nhiều, chọn mode; chạy xong hiện \`AlignResultWindow\` báo số sheet đã canh.
- \`SheetItem\` hiển thị \`"Number — Name"\` + số view (\`GetAllViewports\`).
- Dùng \`SuppressWarnings\` để chặn warning khi dịch viewport.

#### \`Connect Spk.pushbutton\` — Kết nối Sprinkler với ống (3 option, có nhớ cài đặt)
- Cài đặt **lưu qua biến môi trường** (\`os.environ\`): \`SPK_CONNECT_SIZE\`, \`SPK_CONNECT_OPTION\`, \`SPK_CONNECT_RADIUS\` (mặc định 2000), \`SPK_CONNECT_RISER\` (300) — mở lại lần sau giữ nguyên.
- 3 chế độ: \`Option1\` Down Connection (tạo ống rơi xuống), \`Option2\` (kéo dài ống tới vị trí, có \`OPTION2_EXTEND_TOLERANCE_FT\` = 2 ft, \`OPTION2_MIN_PIPE_SEGMENT_FT\`), \`Option3\`.
- Hằng số chung: \`END_TOLERANCE_FT = 50/304.8\`, \`Z_TOLERANCE_FT = 0.05\`, \`CONNECTOR_TOLERANCE_FT = 0.1\`.
- \`flat_project(pipe, pt)\`: chiếu điểm lên đường tâm ống **chỉ XY** (clamp \`t ∈ [0, len]\` cho Connect Spk, không clamp cho Pro).
- Bộ lọc \`SpkPipeFilter\` cho phép chọn cả Pipe lẫn Sprinkler; dùng \`SubTransaction\` khi xử lý từng vị trí.
- UI WPF \`SpkWindow\` với cờ \`IsRunClicked\`; mọi truy cập control đều bọc \`hasattr\`.

#### \`Connect Spk Pro.pushbutton\` — Bản nâng cấp của Connect Spk
- Cùng bộ hằng số/option; khác biệt: \`flat_project\` **không clamp** (chiếu ra ngoài đoạn — cho phép đấu vào đầu kéo dài), UI lớn hơn, thuật toán chọn ống/điểm đấu thông minh hơn.
- Chọn bản nào: bản thường cho quy trình chuẩn; **Pro khi cần xử lý layout phức tạp, ống lệch vị trí**.

#### \`Z Elevation Level.pushbutton\` (Z-SKIP) — Dời hàng loạt phần tử về Level khác
- **Map category → cặp (Level param, Offset param)** \`CATEGORY_PARAM_MAP\`:
  - Walls: \`WALL_BASE_CONSTRAINT\`/\`WALL_BASE_OFFSET\`; Floors/Ceilings: \`LEVEL_PARAM\`/\`*_HEIGHTABOVELEVEL_PARAM\`; Roofs; Columns: \`FAMILY_BASE_LEVEL_*\`; Duct/Pipe/Conduit/CableTray/Flex: \`RBS_START_LEVEL_PARAM\`/\`RBS_OFFSET_PARAM\`; Structural Framing: \`INSTANCE_REFERENCE_LEVEL_PARAM\` (không offset).
  - Fallback chung: \`GENERIC_LEVEL_FALLBACK\` (FAMILY_LEVEL_PARAM → …) và \`GENERIC_OFFSET_FALLBACK\` (INSTANCE_FREE_HOST_OFFSET_PARAM → …).
- UI \`ZLevelPickerWindow\` (XAML riêng) — chọn Level đích (sort theo Elevation giảm dần), hiện số phần tử sẽ dời.
- \`process_element(el, target_level_id, elevation)\`: gán level param + tính lại offset giữ đúng Z hiện tại (kết quả: \`success\` / \`warn\` / \`error\` / \`info\`).
- **Báo cáo HTML dashboard** qua \`output.print_html\` (CSS nhúng: thẻ thống kê success/warn/error/skip, nút linkify chọn phần tử lỗi, footer copyright).

### 5.6. Stack 6 — Chào hỏi, Conduit, Excel

#### \`Chao Dong.pushbutton\` — Cửa sổ chào hỏi (WPF)
Bản modal (\`ShowDialog\`) của \`startup.py\`: hiệu ứng fade-in, nút "Chào lại" đổi text/icon thành mode VIP, ESC đóng. Demo về **custom XAML + animation + custom title bar**.

#### \`Conduit Tray.pushbutton\` — Vẽ tuyến Conduit bám theo tuyến Máng cáp
1. Quét chọn máng + fitting (\`OST_CableTray\` + \`OST_CableTrayFitting\`).
2. Lấy \`ConduitType\` đầu tiên trong model (cảnh báo nếu chưa có); level = level máng đầu tiên.
3. Với từng máng thẳng: ống luồn chạy **trên đỉnh máng** \`z + tray_height/2\` (đọc \`RBS_CABLETRAY_HEIGHT_PARAM\`), \`Electrical.Conduit.Create\`; lưu map \`tray_id → conduit\`.
4. Với fitting nối đúng 2 máng: tìm 2 conduit tương ứng qua map, nối cặp connector gần nhất bằng \`doc.Create.NewElbowFitting\` (tee/cross: chỗ để mở rộng).
- Giao dịch 1 lần cho cả tuyến, lỗi → \`t.RollBack()\` + in lỗi.

#### \`Excel Synch.pushbutton\` — Sửa tham số MEP qua bảng (đồng bộ Excel)
- **Nguồn dữ liệu**: \`DataTable\` (System.Data) hiển thị trên \`DataGrid\`.
- Dropdown category: quét \`doc.Settings.Categories\` lọc \`CategoryType.Model\`, **bỏ** category import/link (.dwg/.dxf/.rvt), chỉ giữ category có phần tử (\`GetElementCount() > 0\`).
- Cột cố định: \`UniqueId\` (ẩn/readonly), FamilyName, TypeName, Level, Workset, \`SystemAbbreviation\` — lấy qua chuỗi fallback \`RBS_SYSTEM_ABBREVIATION_PARAM\` → \`RBS_DUCT_SYSTEM_ABBREVIATION_PARAM\` → \`RBS_PIPE_SYSTEM_ABBREVIATION_PARAM\` → \`LookupParameter("System Abbreviation")\` → "N/A".
- **Ctrl+V paste khối** vào grid: parse clipboard theo \`\\r\\n\` và \`\\t\`, ghi vào từng ô (bỏ cột ReadOnly); \`AutoGeneratingColumn\` set ReadOnly cho cột hệ thống.
- **Export CSV** (SaveFileDialog) / **Import CSV** (OpenFileDialog + \`TextFieldParser\` của \`Microsoft.VisualBasic.FileIO\` — parse chuẩn CSV có dấu ngoặc kép).
- **Save (đồng bộ ngược về Revit)**: duyệt từng row, \`doc.GetElement(uniq_id)\`; với mỗi tham số động: set theo \`StorageType\` (String → \`p.Set(str)\`; Integer → \`int()\` fallback \`SetValueString\`; Double → \`SetValueString\` fallback \`float()\`) trong 1 Transaction; TaskDialog báo số cấu kiện thành công.

### 5.7. Stack 7 — Nối ống nước & Sprinkler Pro

#### \`Connect Brach.pushbutton\` — Nối 1 ống nhánh vào ống chính (vượt qua khoảng hở)
1. PickObject lần lượt: **Ống nhánh** → **Ống chính** (lọc \`OST_PipeCurves\`).
2. \`get_2d_intersection\`: giao điểm **mặt bằng** của 2 đường tâm (cramer/cross, song song → cảnh báo dừng).
3. \`get_z_elevation(curve, xy)\`: nội suy Z tại điểm XY — ống có **độ dốc** vẫn chính xác.
4. Tạo ống đứng nối 2 điểm (\`Pipe.Create\`), **kế thừa** System Type / Pipe Type / Level / Đường kính từ ống nhánh.
5. \`PlumbingUtils.BreakCurve\` cắt nhánh tại điểm giao → chèn **Tee** (\`NewTeeFitting\` 3 connector gần điểm giao); lỗi → fallback **Elbow**.
- ESC → bỏ qua êm; lỗi → rollback nếu transaction đã start + TaskDialog.

#### \`Connect to Main.pushbutton\` — Bản hàng loạt của Connect Brach
- Chọn **nhiều ống nhánh** (quét chuột) + 1 ống chính.
- **1 Transaction duy nhất** cho toàn bộ (tăng tốc, tránh rác Undo).
- Vòng lặp từng nhánh, mỗi ống bọc try/except riêng: trùng ống chính → skip; không giao → \`count_fail\`; sau \`Pipe.Create\` + \`BreakCurve\` **bắt buộc \`doc.Regenerate()\`** trước khi bắt connector.
- Fallback 3 tầng: Tee → Elbow → bỏ qua; cuối cùng TaskDialog báo \`Thành công / Thất bại\`.

#### \`Connect Spk Pro.pushbutton\`
Xem 5.5.

### 5.8. \`Sheet & View Manager.pushbutton\` — Trạm quản lý Sheet/View (WPF ~1400 dòng)

**Kiến trúc Service** (mỗi nghiệp vụ 1 class, method tĩnh):
| Service | Chức năng chính |
|---|---|
| \`SheetService\` | \`get_title_blocks\`, \`get_existing_numbers\`, \`plan_sequence_numbers(count, prefix, start, digits)\`, \`find_conflicts(numbers)\`, \`create_from_sequence\` (tạo sheet theo dãy số), \`create_from_csv(rows, tb_id)\`, \`_apply_sheet_number\` (gán number/name, check trùng) |
| \`ViewService\` | \`get_levels\`, \`get_plan_types\`, \`get_all_views\`, \`get_placed_view_map\` (view đã đặt lên sheet nào), \`create_plans(levels, view_type_id)\`, \`duplicate_views(views, option, count)\` (duplicate with detailing/dependent) |
| \`RenameService\` | \`find_replace\` (hỗ trợ **regex**), \`add_prefix_suffix\`, \`sequential\` (đổi tên dãy \`base_001\`), \`from_csv\` (map tên theo file CSV) |
| \`PlacementService\` | \`place_one_per_sheet\` (mỗi view lên 1 sheet), \`place_rows(sheet, views, start_x_mm, start_y_mm, …)\` (đặt dạng lưới theo toạ độ mm) |

**Window** \`SheetViewManagerWindow\`:
- Đăng ký sự kiện an toàn: \`_safe_wire(ctrl, event, handler)\` — control không tồn tại vẫn không crash.
- **Debounce** tìm kiếm (\`_setup_debounce\`, \`_debounce\`, DispatcherTimer) — không filter lại mỗi phím gõ.
- Tách UI khỏi lệnh: \`_unwrap_all\`/\`_release\` — mọi hành động chạy trong \`_run(action)\`.
- 5 khu vực: quản lý **Sheet** (tạo dãy / CSV / check trùng số qua \`ConflictDialog\`), **View** (tạo plan theo level, duplicate), **Rename** (4 chiến lược), **Placement** (đặt view lên sheet), filter/search từng danh sách.
- \`_eid_int\` + \`SuppressWarnings\` dùng xuyên suốt.

## 6. Panel **Model Tool**

> 12 nút bẻ co chia 5 stack + 1 stack Utility. Toàn bộ dùng chung **thuật toán "universal bend"** — hỗ trợ đồng thời **Pipe / Duct / Cable Tray**.

### 6.1. Nhóm bẻ co 90°: \`Up Elbow\` / \`Down Elbow\` / \`Left Elbow\` / \`Right Elbow\`
Cấu trúc chung (đọc 1 nút là hiểu cả 4, chỉ khác vector hướng):
- \`PickObject(ObjectType.PointOnElement, ...)\` — user **click gần đầu nào** thì bẻ ở đầu đó (\`click_pt.GlobalPoint\`, so khoảng cách tới 2 đầu).
- \`get_segment_length(src)\`: chiều dài đoạn mới — **CableTray = 3 × Width** (đủ chỗ gắn fitting), Pipe/Duct = **500 mm**.
- Xoay chặn: đoạn đang đứng thẳng (\`abs(direction.Z) > 0.99\`) không bẻ lên 90° được.
- **Trick quan trọng với Duct/CableTray**: tạo đoạn NGANG cùng hướng dòng chảy (Revit định hướng profile đúng, không bị lật 90°), rồi **xoay đoạn đó lên đứng** quanh trục vuông góc:
  \`\`\`python
  axis_vec = flat_dir.CrossProduct(XYZ.BasisZ).Normalize()
  ElementTransformUtils.RotateElement(doc, new_el.Id, Line.CreateBound(start_pt, start_pt + axis_vec), math.pi/2.0)
  \`\`\`
  Pipe thì dựng thẳng đứng trực tiếp.
- Đoạn mới được **kế thừa đồng bộ**: System/Service Type + kích thước (Ø / W / H) qua danh sách BIP dự phòng (\`RBS_PIPE_DIAMETER_PARAM\`, \`RBS_CURVE_DIAMETER_PARAM\`, \`RBS_CURVE_WIDTH/HEIGHT_PARAM\`, \`RBS_CABLETRAY_WIDTH/HEIGHT_PARAM\`).
- \`find_conn_at(el, pt)\` (dung sai 0.1 ft) tìm cặp connector 2 đầu → \`doc.Create.NewElbowFitting(c_old, c_new)\`.
- Chạy trong \`with revit.Transaction("Universal Up 90"):...; lỗi từng phần tử chỉ \`print\`.

### 6.2. Nhóm bẻ co 45°: \`45 Up/Down/Left/Right Elbow\`
- Giống nhóm 90° nhưng: xoay đoạn mới **45°** so với phương cũ (giữ độ dốc đang có — tooltip bundle: "giữ độ dốc"), đoạn mới dài 500mm/3×Width.
- Dùng cho: né cản, dẫn ống chéo qua dầm, giữ slope ống thoát nước khi đổi hướng.

### 6.3. Utility stack

#### \`45 degree elbow.pushbutton\` — Biến đổi 1 co 90° thành 2 co 45° (+ đoạn nối)
1. Quét chọn nhiều co (\`OST_PipeFitting\` + \`OST_DuctFitting\`), nhập khoảng lùi (mm, mặc định 300).
2. Tìm 2 ống chủ (\`host_data\`) qua \`conn.AllRefs\` (\`isinstance(ref_conn.Owner, MEPCurve)\` — Pipe lẫn Duct chung 1 lối).
3. Xoá co cũ → thu ngắn 2 ống chủ về điểm mới cách tâm co \`offset\` → tạo **đoạn nối trung gian** (Pipe.Create hoặc Duct.Create — Duct phải đồng bộ Ø hoặc W+H theo round/rect) → chèn **2 lồi 45°** tại 2 đầu.
- Xác định Duct: lấy \`RBS_DUCT_SYSTEM_TYPE_PARAM\`; Pipe: \`RBS_PIPING_SYSTEM_TYPE_PARAM\`.

#### \`Connect to.pushbutton\` — Nối 2 cấu kiện (cặp connector gần nhau nhất)
- Hỗ trợ **quét chọn sẵn 2 phần tử** trước khi bấm (\`GetElementIds().Count == 2\`), không thì PickObject 2 lần.
- Quét connector cả 2 (MEPCurve hoặc FamilyInstance), bỏ Logical, tìm cặp \`c1.Origin.DistanceTo(c2.Origin)\` nhỏ nhất → \`ConnectTo\` trong transaction; lỗi thường do lệch size / khác system / cổ đã bận.

#### \`Disconnect.pushbutton\` — Ngắt 2 cấu kiện
- Cùng luồng chọn như Connect to; duyệt connector el1 đang \`IsConnected\`, trong \`AllRefs\` tìm connector thuộc el2 (không Logical) → \`DisconnectFrom\`; báo số điểm đã ngắt.

### 6.4. Model Tool.panel\\bundle.yaml
\`\`\`yaml
title: Model Tool
layout: [Up Down, Left Right, 45 Up Down, 45 Left Right, Utility]
\`\`\`
→ panel xếp 5 stack theo layout khai báo (không cần prefix số).

## 7. Panel **Plumbing**

> Tất cả dùng chung \`plumbing_pro\` (xem mục 4). Các Branch khác nhau ở **biến thể hình học** (khoảng lùi, số lồi 45, đường ống trung gian).

### 7.1. \`Drainage.stack\`
| Tool | Mô tả |
|---|---|
| \`AxisPipe\` | Nối ống nhánh ngang vào **TRỤC ĐỨNG** (validator: ống 2 phải đứng, cùng system) — \`AxisPipeService.CreateBranchConnection\`, lùi 4D, tạo ống chéo 45° + Wye. |
| \`BranchPipe1\` | Nối ống nhánh vào **ống chính NGANG** — thuật toán Wye 45° chuẩn (mục 4.7). Giữ **Shift-click** → chế độ Test chỉ dựng hình học. |
| \`Connect Fixture\` | Nối **thiết bị vệ sinh** xuống ống chính: chọn connector đáy thiết bị (\`Domain == DomainPiping\`, BasisZ.Z thấp nhất, chưa nối); đường kính = \`Radius*2\` của connector; độ dốc cố định **2%**; kiểm tra khoảng trống ≥ \`3.5D + 2D\` (không đủ → báo số mm tối thiểu); kiểm tra ống chính phải **thấp hơn** thiết bị (nước chảy trọng lực); dựng ống đứng + ống ngang dốc → gọi \`BranchPipe1Service.CreateBranchConnection\` (Wye 45°) → cuối chèn co 90° đáy thiết bị. |

### 7.2. \`Drainage2.stack\` — Branch 2 / 3 / 4
Ba biến thể nối ống nhánh → ống chính cho hệ thoát nước, cùng khung code (SuppressWarnings, \`xy()\`, \`execute()\`), khác nhau ở khoảng lùi/số đoạn trung gian và cách xử lý fitting. Dùng để lựa chọn theo thực tế thi công (khoảng thông thoáng khác nhau).

### 7.3. \`Branch 5\` / \`Branch 7\` / \`Branch 8\` (nút lẻ)
- **Branch 5 — "5xD & 2xD Offset"**: nhánh trên cao, chính bên dưới. Quy trình: tính giao điểm mặt bằng P_hit + độ dốc hướng hạ lưu (\`S_m\`, \`sigma\`) → lùi \`1.5D\` tạo khoảng hở trước điểm hit → dựng chuỗi 4 đoạn: ống nhánh (thụt) → **mid_pipe** → **pipe_drop** (đoạn hạ) → **pipe_horiz** → **pipe_conn** → cắt ống chính tại P_hit → \`BranchPipe1Service.CreateJunction\` (Wye 45°, góc 45° cứng) + gán cổ → chèn **4 lồi 45°** (mỗi khớp 1 lồi, bọc try/except pass).
- **Branch 7 — "2xD Offset"**: như Branch 5 nhưng khoảng lùi nhỏ hơn (2D), thêm hàm \`force_fitting_size\` ép tham số size fitting theo nhiều tên dự phòng ("Nominal Radius 1/2/3", "Nominal Diameter 1/2/3", "Main/Branch Radius/Diameter"…) — set cả instance lẫn Type.
- **Branch 8**: biến thể tương tự Branch 7 với cấu hình khoảng lùi khác.
- **Lưu ý dùng:** chọn \`5xD\` khi không gian thoáng (đủ bẻ 2 lồi 45° + khoảng hở), \`2xD\` khi chật. Quy trình luôn: **validate bằng \`PipeUtils.GetNominalDiameter\` / \`GetPipingSystemTypeId\` trước, dựng sau**.

### 7.4. \`Vent Riser.pushbutton\` — Nối nhánh ống thông khí lên trục đứng
Các hàm đặc trưng (bên trên khung Branch chung):
- \`get_vertical_ports(fitting)\`: tìm cổ trục đứng của fitting theo hướng connector.
- \`create_vertical_wye(...)\`: dựng Wye 45° trên trục đứng, tạo **2 đoạn đứng** cho 2 phía + gán hướng ra ngoài (\`get_outward_dir\`).
- \`safe_connect(pipe, fitting_port, backup_pt, doc_ref)\`: kéo đầu ống về cổ fitting rồi nối — nếu ống kẹt/biến mất (\`min_d >= 3.0\`) raise kèm toạ độ để tra lỗi.
- \`assign_vertical_runs\`: phân đoạn cho 2 ống theo phía; \`is_elbow_connection\` phát hiện nối qua lồi.
- \`force_fitting_size\` như Branch 7/8.

### 7.5. Quy trình thao tác chuẩn của người dùng (tất cả tool Plumbing)
1. Bấm nút tool → tool hỏi **Ống nhánh** trước, **Ống chính** sau (prompt nhắc rõ + "developed by Dong Tran Ba").
2. Tool validate (cùng system, hình học hợp lệ) — sai ngay lập tức hiện \`forms.alert\` với nguyên nhân.
3. Tool dựng hình học + sinh fitting trong 1 transaction đã gắn \`SuppressWarnings\`.
4. ESC bất cứ lúc nào chọn đối tượng = thoát êm (không văng lỗi).

## 8. Quy trình phát triển tool mới

Dựa trên những gì các tool hiện có đang làm, khi thêm tool mới nên theo đúng **khung 6 bước**:

**Bước 1 — Khởi tạo bundle**
\`\`\`
Dong Tran Ba.tab\\<Panel>.panel\\<N.stack>\\<Tên Tool>.pushbutton\\
    ├── script.py     (bắt buộc)
    ├── icon.png      (32x32, khuyến nghị)
    ├── ui.xaml       (nếu có giao diện)
    └── bundle.yaml   (title/tooltip/author; context: zero-doc nếu không cần model)
\`\`\`

**Bước 2 — Khung script chuẩn**
\`\`\`python
# -*- coding: utf-8 -*-
import clr
clr.AddReference('RevitAPI'); clr.AddReference('RevitAPIUI')

from Autodesk.Revit.DB import *
from Autodesk.Revit.UI.Selection import ObjectType, ISelectionFilter
from Autodesk.Revit.Exceptions import OperationCanceledException
from pyrevit import revit, forms, script

doc, uidoc = revit.doc, revit.uidoc

# 1) FILTERS (ISelectionFilter theo category)
# 2) HELPER (connector, hình học, đơn vị)
# 3) UI (forms.WPFWindow nếu cần; modal → ShowDialog; cờ is_run)
# 4) CORE (thuật toán thuần, tách khỏi UI)
# 5) MAIN (try/except OperationCanceledException → sys.exit(); Exception → forms.alert)
if __name__ == '__main__':
    main()
\`\`\`

**Bước 3 — Viết logic MEP theo đúng quy tắc**
- Lấy thông số trước (\`GetNominalDiameter\`, system type, level) → validate → mới dựng.
- Sau \`Pipe/Duct/CableTray.Create\` và \`BreakCurve\` luôn \`doc.Regenerate()\`.
- Nối bằng cặp connector gần nhất, không nối bằng index cứng.
- Dựng thử **chỉ hình học** trước (cờ \`createFittings\`) rồi mới bật sinh fitting — cách debug an toàn của BranchPipe1.

**Bước 4 — Transaction đúng mức** (xem 3.5): tool nhỏ → \`revit.Transaction\`; hàng loạt → 1 transaction + preprocessor; chia nhỏ nhiều bước → TransactionGroup + Assimilate.

**Bước 5 — Giao diện**: modal mặc định; nếu modeless phải ExternalEvent + guard \`doc.GetHashCode()\`; mọi control bọc \`hasattr\`.

**Bước 6 — Kiểm thử & an toàn dữ liệu**
- Test trên file sao chép; kiểm undo (phải Undo 1 phát là sạch).
- Bảo vệ dữ liệu như Auto Merge Duct (không xoá phần tử có nhiều connector).
- Có \`safety_counter\` cho vòng lặp vô hạn; lỗi từng phần tử không được giết cả batch.

### Quy ước code của dự án
- Chuỗi UI/thông báo **tiếng Việt có dấu** (UTF-8, header \`# -*- coding: utf-8 -*\`), tooltip bundle không dấu.
- Thông báo lỗi kèm **nguyên nhân + gợi ý** (VD: "Hãy load family ngã ba 45° (Wye 45°) hoặc Tee có tham số GÓC cổ nhánh.").
- Thông báo thân thiện cho người dùng cuối, copyright \`developed by Dong Tran Ba\` ở prompt/báo cáo.
- Tool cải tiến từ tool cũ: giữ tên, thêm đuôi \`Pro\` (Connect Spk → Connect Spk Pro; BOQ Pro → BOQ 3D Pro).

## 9. Sổ tay lưu ý & lỗi hay gặp

### 9.1. Lỗi đã fix trong dự án (không tái phạm)
| Lỗi | Fix |
|---|---|
| Dùng \`OST_Pipes\` (không tồn tại) | Dùng \`BuiltInCategory.OST_PipeCurves\` (Align Spk) |
| \`PartType.UnionFitting\` (không tồn tại) | \`MEPModel.PartType == PartType.Union\` (Auto Merge Duct) |
| XAML không tìm thấy khi dùng đường dẫn tương đối | \`os.path.join(os.path.dirname(__file__), 'ui.xaml')\` (3D WS) |
| Window WPF bị GC khi modeless | Gán vào biến toàn cục \`_workset_modeless_window_\` |
| Thao tác chéo document khi cửa sổ modeless mở | Guard \`doc.GetHashCode()\` trong handler (3D WS) |
| Warning fitting chặn hàng loạt | \`IFailuresPreprocessor\` + \`DeleteWarning\` |
| Tool đơ khi pipeline dài (Undo lag) | TransactionGroup + Assimilate + transaction nhỏ từng ống |
| Vòng lặp cắt ống vô hạn | \`safety_counter > 500\` → thoát khẩn cấp (Auto Split Duct) |
| \`BreakCurve\` lỗi do điểm sát mút ống | Thử lại lùi thêm 2 mm (Auto Split Duct) |
| Kết nối thất bại khi ống có độ dốc | Nội suy Z tại điểm XY (\`get_z_elevation\`) thay vì lấy Z đầu ống |
| Mất Taps khi merge ống | Đếm connector > 2 → giữ ống; cả 2 có taps → huỷ merge |

### 9.2. Những "bẫy" Revit API cần nhớ
1. **Đơn vị feet** — mọi phép tính mm phải /304.8, kể cả đường kính fitting.
2. **Regenerate trước khi đụng connector** mới tạo — lỗi phổ biến nhất.
3. **ConnectorType.Logical** không nối được — luôn lọc.
4. \`Category.Id.IntegerValue\` lỗi trên Revit 2024+ (ElementId Int64) — dùng helper \`_eid_int\`/try-catch.
5. Family Wye phải có **tham số góc cổ nhánh** và đủ 3 cổ trục — thư viện tự thử nhiều family và báo danh sách lỗi từng family.
6. View có **View Template** → override màu/visibility bị khoá (3D WS tắt nút, Color Systems cảnh báo).
7. \`IndependentTag.Create\` trả tag nhưng có thể chưa dùng đúng loại — phải \`ChangeTypeId\` theo category.
8. Sửa \`Location.Curve\` của ống có thể **đảo chiều** ống — kiểm hướng trước khi thụt (\`MoveEndPoint(extend=False)\`).
9. Selection trước khi chạy tool (\`GetElementIds\`) nên được ưu tiên hơn Pick — UX chuẩn của Align Spk/Connect to/Z-SKIP.
10. CSV tiếng Việt: dùng \`TextFieldParser\` (đọc đúng encoding + dấu ") thay vì \`split(',')\`.

### 9.3. File đặc biệt cần biết
| File | Đặc điểm |
|---|---|
| \`Dim Pro\\script.py\` | **Base64-encoded** — sửa phải decode (\`exec(compile(base64.b64decode(_c)...))\`) |
| \`lib\\plumbing_pro.py\` | Thư viện dùng chung, sửa 1 chỗ cả panel Plumbing hưởng |
| \`startup.py\` + \`ui.xaml\` | Chạy tự động khi load extension (cửa sổ chào) |
| \`Clash Check\\script.py\` | Tool lớn nhất dự án (~66KB), WinForms thuần, không XAML |
| \`BOQ Pro / BOQ 3D Pro\` | \`__persistentengine__ = True\` — engine cache dữ liệu giữa các lần chạy |
| \`ui.xaml\` của Auto Merge Duct / Auto Split Duct | Hộp thoại cấu hình + \`alert.xaml\` riêng cho kết quả |
| \`Z Elevation Level\\ZLevelPickerWindow.xaml\`, \`Align View\\AlignViews.xaml + AlignResult.xaml\` | XAML phụ load bằng \`script.get_bundle_file(...)\` |

### 9.4. Tóm tắt 1 dòng cho từng tool

| Tool | Vai trò |
|---|---|
| Align Spk | Căn thẳng + nối cụm ống đứng–côn–sprinkler |
| Auto Merge Duct | Khử Union, nối gộp ống gió thẳng hàng |
| Auto Split Duct | Cắt ống gió theo chiều dài chuẩn, chèn Union |
| BOQ Pro | Dashboard khối lượng MEP (WinForms) |
| BOQ 3D Pro | Dashboard khối lượng MEP 3D + hồ sơ lọc (WPF) |
| Clash Check | Check va chạm MEP vs A/S, xuất Excel/BCF |
| 3D WS | Bật tắt Workset trong 3D view |
| Color Element | Tô màu selection (50+ màu, 6 kiểu override) |
| Color Systems | Ép màu theo hệ thống + tạo Legend |
| Dim Pro | Tự dimension nhánh, chạy liên tục (code base64) |
| List Title Block | Chọn/lọc Title Block trên Sheet |
| Tagging Pro | Tag hàng loạt Pipe/Duct/Tray, chống chồng tag |
| Align View | Căn view trên nhiều sheet theo sheet chuẩn |
| Connect Spk / Spk Pro | Kết nối sprinkler với ống (3 option, nhớ cài đặt) |
| Z Elevation Level (Z-SKIP) | Dời phần tử về Level khác, báo cáo HTML |
| Chao Dong | Cửa sổ chào hỏi (demo WPF) |
| Conduit Tray | Vẽ Conduit bám tuyến Máng cáp |
| Excel Synch | Sửa tham số qua DataGrid / CSV / clipboard |
| Connect Brach / Connect to Main | Nối ống nhánh → ống chính (lẻ / hàng loạt) |
| Sheet & View Manager | Quản trị sheet, view, rename, placement |
| Model Tool (12 nút) | Bẻ co 90°/45° 4 hướng cho Pipe/Duct/Tray |
| Utility: 45 degree elbow | Đổi 1 co 90° thành 2 co 45° |
| Utility: Connect to / Disconnect | Nối / ngắt 2 cấu kiện |
| Plumbing: Branch 2/3/4/5/7/8 | Nối ống thoát nước Wye 45° (các biến thể khoảng lùi 1.5D–5D) |
| Plumbing: AxisPipe / Vent Riser | Nối nhánh vào trục đứng / ống thông khí |
| Plumbing: Connect Fixture | Kết nối thiết bị vệ sinh xuống ống chính (slope 2%) |

---
> © 2026 — Tài liệu tổng hợp cho extension **MyMEPTools.extension**. Developed by Dong Tran Ba.
`;

export const DEFAULT_CSHARP_RIBBON_ICON_GUIDE = `# 🎨 Learn — Ribbon icon (Tạo Icon, Phong Cách, Màu Sắc trong C# Revit Add-in)

> Tài liệu rút ra từ cách làm icon của dự án **Avoid Clash** và **AppUI.cs**. Hướng dẫn chuẩn hóa quy trình thiết kế, tích hợp và quản lý icon trên Ribbon Revit API (.NET / C#).

---

## 1. Nguyên Tắc Thiết Kế Icon Ribbon chuẩn Revit API
- **Kích thước chuẩn (Revit API Ribbon):**
  - **Large Icon:** \`32x32 px\` (Dùng cho PushButton cỡ lớn trên Ribbon Panel).
  - **Small Icon:** \`16x16 px\` (Dùng cho PulldownButton, SplitButton hoặc Stacked Buttons).
- **Định dạng:** PNG 32-bit (có alpha channel trong suốt).
- **Độ phân giải DPI:** 96 DPI hoặc cao hơn (khuyến nghị có cả bản \`@2x\` 64x64px cho màn hình High DPI / 4K).
- **Phong cách thị giác (Visual Style):**
  - Đơn giản, phẳng (Flat Design) hoặc Semi-Flat có viền đậm 1px để tách biệt với nền sáng/tối của Ribbon Revit.
  - Sử dụng màu sắc tương phản cao: Màu xanh MEP (Cyan/Blue cho Pipe/Duct), màu đỏ/vàng cho Clash/Alert, màu cam/xanh lá cho Utility.
  - Tránh các chi tiết quá nhỏ hoặc text rườm rà inside icon 32x32px.

---

## 2. Quy Trình Tích Hợp Icon vào C# Assembly (Resource Embedding)
Để Add-in C# tự chứa icon mà không lo mất file khi copy DLL sang máy khác:

### 2.1. Đặt thuộc tính Build Action
1. Copy các file icon PNG vào thư mục dự án (ví dụ: \`Resources/Icons/\`).
2. Trong Visual Studio / JetBrains Rider, chọn file icon -> **Properties** -> **Build Action: Resource** (hoặc \`EmbeddedResource\`).

### 2.2. Helper Class chuyển đổi Resource sang BitmapImage (AppUI.cs)
\`\`\`csharp
using System;
using System.IO;
using System.Reflection;
using System.Windows.Media.Imaging;

namespace AvoidClash.UI
{
    public static class ImageUtils
    {
        /// <summary>
        /// Tải ImageSource từ Embedded Resource hoặc Pack URI của WPF
        /// </summary>
        public static BitmapImage GetEmbeddedImage(string resourceName)
        {
            try
            {
                Assembly assembly = Assembly.GetExecutingAssembly();
                string packUri = $"pack://application:,,,/{assembly.GetName().Name};component/Resources/Icons/{resourceName}";
                
                BitmapImage bitmap = new BitmapImage();
                bitmap.BeginInit();
                bitmap.UriSource = new Uri(packUri, UriKind.Absolute);
                bitmap.CacheOption = BitmapCacheOption.OnLoad;
                bitmap.EndInit();
                bitmap.Freeze(); // Freeze để dùng an toàn đa luồng WPF
                return bitmap;
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[ImageUtils Error] Không thể tải icon {resourceName}: {ex.Message}");
                return null;
            }
        }
    }
}
\`\`\`

---

## 3. Đăng Ký PushButton với Icon trên Ribbon Panel
Trích từ mẫu mã nguồn \`AppUI.cs\`:

\`\`\`csharp
using Autodesk.Revit.UI;
using AvoidClash.UI;

namespace AvoidClash
{
    public class AppUI : IExternalApplication
    {
        public Result OnStartup(UIControlledApplication application)
        {
            // 1. Tạo Ribbon Tab
            string tabName = "MEP OWN TOOLS";
            application.CreateRibbonTab(tabName);

            // 2. Tạo Panel
            RibbonPanel panel = application.CreateRibbonPanel(tabName, "Clash & Utilities");

            // 3. Đường dẫn Executing Assembly
            string assemblyPath = typeof(AppUI).Assembly.Location;

            // 4. Tạo PushButton Avoid Clash
            PushButtonData btnData = new PushButtonData(
                "btnAvoidClash",
                "Avoid\\nClash 3D",
                assemblyPath,
                "AvoidClash.Commands.AvoidClashCommand"
            )
            {
                ToolTip = "Tự động bẻ co tránh va chạm MEP (Pipe / Duct / Cable Tray)",
                LongDescription = "Công cụ phân tích va chạm 3D thời gian thực và tự động tạo các góc bẻ 45/90 độ để vượt qua điểm va chạm.",
                LargeImage = ImageUtils.GetEmbeddedImage("avoid_clash_32.png"),
                Image = ImageUtils.GetEmbeddedImage("avoid_clash_16.png")
            };

            panel.AddItem(btnData);

            return Result.Succeeded;
        }

        public Result OnShutdown(UIControlledApplication application)
        {
            return Result.Succeeded;
        }
    }
}
\`\`\`
`;

export const DEFAULT_CSHARP_REVIT_API_PLAYBOOK = `# 📚 Revit API — MEP Piping: Tài liệu học thuật & Playbook

> Tổng hợp kiến thức chuyên sâu, thuật toán hình học và các "bẫy" (pitfalls) rút ra từ dự án **Plumbing Pro 2025+** (Viết bằng C# .NET 8 / Revit API 2024-2026).

---

## 1. Kiến Kiến Thức Hình Học & Tọa Độ Trong Revit API
- **Đơn vị nội bộ Revit (Internal Units):**
  - Mọi kích thước chiều dài trong Revit DB đều tính bằng **Feet (ft)**.
  - 1 Feet = 304.8 mm.
  - Khi làm việc với góc (Angle): Revit dùng **Radian**.
- **Chuyển đổi đơn vị (UnitUtils):**
  - Revit 2022+: Sử dụng \`UnitUtils.ConvertToInternalUnits(val, UnitTypeId.Millimeters)\` và \`UnitUtils.ConvertFromInternalUnits(val, UnitTypeId.Millimeters)\`.
  - Giữ lại các hằng số helper: \`const double MM_TO_FEET = 1.0 / 304.8;\`

---

## 2. Quản Lý Connector & Nối Ống MEP (Pipe Connectors)
### 2.1. Quy tắc tìm Connector gần nhất
\`\`\`csharp
public static Connector GetClosestConnector(Pipe pipe, XYZ point)
{
    ConnectorSet connectors = pipe.ConnectorManager.Connectors;
    Connector closest = null;
    double minDistance = double.MaxValue;

    foreach (Connector conn in connectors)
    {
        double dist = conn.Origin.DistanceTo(point);
        if (dist < minDistance)
        {
            minDistance = dist;
            closest = conn;
        }
    }
    return closest;
}
\`\`\`

### 2.2. Quy tắc Nối Ống Wye 45° & Fitting (Plumbing Pro Rules)
1. **Khoảng lùi offset (Offset Distance):** Khi chèn Wye 45° vào ống chính, điểm cắt ống chính phải lùi lại một khoảng \`L = Diameter * factor + ExtraGap\` để đảm bảo fitting fit đúng kích thước mà không bị lỗi *"No fitting family loaded"* hay *"Cannot connect components"*.
2. **Kiểm tra hướng Connector:** Hai Connector nối với nhau phải có hướng Vector ngược nhau (\`conn1.CoordinateSystem.BasisZ.IsAlmostEqualTo(-conn2.CoordinateSystem.BasisZ)\`).

---

## 3. Transaction & Regenerate (Các bẫy sập thường gặp)
- **Bẫy 1: Quên \`doc.Regenerate()\` sau khi cắt/tạo mới Pipe.**
  - Khi dùng \`PlumbingUtils.BreakCurve(doc, pipe, splitPoint)\`, nếu tiếp tục truy cập Connector của đoạn ống mới tạo mà chưa \`doc.Regenerate()\`, Revit API sẽ ném ngoại lệ \`InvalidOperationException\`.
- **Bẫy 2: Nối Connector khi chưa trong Transaction.**
  - \`conn1.ConnectTo(conn2)\` bắt buộc phải bọc trong \`Transaction.Start()\` / \`Transaction.Commit()\`.
- **Bẫy 3: Suppress Warnings & Failures Preprocessor:**
  - Sử dụng \`IFailuresPreprocessor\` để tự động bỏ qua các cảnh báo không nghiêm trọng như *"Slightly off axis"*, *"Elements overlapping"* để tránh hỏng luồng chạy tự động.

---

## 4. Helper Class Mẫu: FailuresPreprocessor trong C#
\`\`\`csharp
using Autodesk.Revit.DB;

namespace PlumbingPro.Utils
{
    public class WarningSwallower : IFailuresPreprocessor
    {
        public FailureProcessingResult PreprocessFailures(FailuresAccessor failuresAccessor)
        {
            var failures = failuresAccessor.GetFailureMessages();
            foreach (var failure in failures)
            {
                FailureSeverity severity = failure.GetSeverity();
                if (severity == FailureSeverity.Warning)
                {
                    failuresAccessor.DeleteWarning(failure);
                }
            }
            return FailureProcessingResult.Continue;
        }
    }
}
\`\`\`
`;

export const DEFAULT_CSHARP_SUITE_OVERVIEW = `# 🛠️ Tổng Hợp Kiến Thức — Bộ Tool Revit API (MEP OWN TOOLS Suite)

> Tổng quan bộ công cụ **MEP OWN TOOLS Suite** gồm 10+ tool Revit Add-in C# .NET 8 WPF. Kiến trúc chuẩn Modular, WPF MVVM, và Revit API Direct Interaction.

---

## 1. Kiến Trúc Bộ Tool C# Revit Add-in
- **Target Framework:** .NET 8.0 / .NET Framework 4.8 (tương thích Revit 2020 đến Revit 2026).
- **Mô hình kiến trúc (Architecture):**
  - **Commands/**: Chứa các lớp thực thi \`IExternalCommand\` (Command Entry Points).
  - **ViewModels/**: Chứa logic điều hướng WPF MVVM (\`ObservableObject\`, \`RelayCommand\`).
  - **Views/**: Giao diện XAML WPF nâng cao.
  - **Services/**: Chứa các service thao tác Revit DB (PipingService, AlignmentService, BOQService).
  - **Models/**: Data contracts và DTOs.

---

## 2. Danh Sách 10 Tool Cốt Lõi Trong Suite
1. **Avoid Clash 3D:** Tự động phát hiện va chạm ống Pipe/Duct và bẻ co tránh va chạm theo góc 45°/90° linh hoạt.
2. **Plumbing Wye 45 Pro:** Nối nhánh ống thoát nước Wye 45° chính xác cao với các biến thể khoảng lùi 1.5D - 5D.
3. **Auto Split & Merge Duct/Pipe:** Cắt gộp ống gió, ống nước hàng loạt theo tiêu chuẩn chiều dài gia công nhà máy (6m / 3m / 1.18m).
4. **MEP BOQ Dashboard:** Dashboard bóc tách khối lượng vật tư MEP trực tiếp theo thời gian thực ra Excel / CSV.
5. **Color Systems Pro:** Quản lý tô màu sơ đồ hệ thống MEP (Chilled Water, Supply Air, Drainage, Fire Fighting) tự động gắn Legend.
6. **Smart Align Views:** Căn chỉnh vị trí Viewport trên nhiều Sheet theo Sheet tiêu chuẩn.
7. **Sprinkler Connect Pro:** Tự động nối đầu phun Sprinkler lên ống nhánh cấp nước chữa cháy (Dropdown / Upright).
8. **Z-Elevation Level Shift:** Dời cao độ toàn bộ hệ thống MEP về Level mới mà không làm gãy khớp nối fitting.
9. **Tagging MEP Batch:** Gắn Tag tự động cho tất cả cấu kiện MEP trên View hiện hành với thuật toán né đè chữ.
10. **Excel Parameter Sync:** Đồng bộ tham số 2 chiều Revit Element <-> File Excel với tốc độ cực nhanh.

---

## 3. Mẫu Khung Code \`IExternalCommand\` Chuẩn C# Revit API
\`\`\`csharp
using System;
using Autodesk.Revit.UI;
using Autodesk.Revit.DB;
using Autodesk.Revit.Attributes;

namespace MepOwnTools.Commands
{
    [Transaction(TransactionMode.Manual)]
    [Regeneration(RegenerationOption.Manual)]
    public class AvoidClashCommand : IExternalCommand
    {
        public Result Execute(
            ExternalCommandData commandData, 
            ref string message, 
            ElementSet elements)
        {
            UIApplication uiapp = commandData.Application;
            UIDocument uidoc = uiapp.ActiveUIDocument;
            Document doc = uidoc.Document;

            try
            {
                using (Transaction trans = new Transaction(doc, "MEP Avoid Clash"))
                {
                    trans.Start();
                    
                    // Logic thực thi công cụ ở đây
                    
                    trans.Commit();
                }
                return Result.Succeeded;
            }
            catch (Exception ex)
            {
                message = ex.Message;
                return Result.Failed;
            }
        }
    }
}
\`\`\`
`;

export const DEFAULT_MYMEPTOOLS_DOCUMENT = {
  id: "default_mymeptools_doc",
  name: "TONG_HOP_KIEN_THUC_MyMEPTools.md",
  content: DEFAULT_MYMEPTOOLS_CONTENT,
  size: DEFAULT_MYMEPTOOLS_CONTENT.length,
  type: "md",
  source: "manual" as const,
  updatedAt: Date.now(),
  enabled: true,
};

export const DEFAULT_KNOWLEDGE_DOCUMENTS = [
  DEFAULT_MYMEPTOOLS_DOCUMENT,
];

