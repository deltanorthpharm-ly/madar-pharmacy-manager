# خطة بناء نظام Madar ERP (مدار)

نظام إدارة صيدلية احترافي كامل بواجهة عربية RTL مع دعم تبديل اللغة، يعتمد على معمارية ثلاث طبقات: Transactions / Editable / Rebuild Engine.

## نطاق البناء

البناء الكامل دفعة واحدة عبر جولات متتابعة. هذه خطة طريق تفصيلية للجولة الأولى التي تُرسي البنية التحتية، ثم نواصل البناء فوقها بدون انقطاع.

## التقنيات

- **Frontend**: TanStack Start + React + Tailwind + shadcn/ui
- **Backend**: Lovable Cloud (Supabase) + Server Functions
- **Auth**: Email/Password للمدير عبر Supabase Auth + PIN code للكاشير (verified server-side عبر hashed PIN في جدول profiles)
- **State**: TanStack Query
- **i18n**: react-i18next مع تبديل عربي/إنجليزي و dir=rtl/ltr ديناميكي

## معمارية الأمان

- جدول `profiles` مرتبط بـ `auth.users`
- جدول `user_roles` منفصل (`admin` / `cashier`) مع function `has_role()` كـ SECURITY DEFINER
- RLS على كل الجداول: المدير يقرأ/يكتب الكل، الكاشير يبيع فقط ويقرأ منتجاته وخزنته
- كل التعديلات (Edit Layer) تمر عبر Server Functions تتحقق من الدور وتسجّل في `edit_log` تلقائياً

## مخطط قاعدة البيانات (نفس schema المرسلة + إضافات)

سنطبق الـ schema المُرسلة كما هي مع التعديلات التالية للإنتاج:
- `profiles` (id, full_name, pin_hash, is_active, role-via-user_roles)
- `user_roles` (user_id, role enum: admin/cashier)
- `categories` (id, name) — مرجع لـ products.category_id
- `customers` و `suppliers` (للديون في التقارير المالية)
- `partner_withdrawals` (سحوبات الشركاء)
- إضافة `current_stock` كـ computed (أو cache) على products يُحدّث عبر triggers من stock_movements
- Triggers: عند insert في sale_items/purchase_items → ينشئ stock_movement تلقائياً
- Trigger عام يكتب في `edit_log` عند أي UPDATE على الجداول الحساسة

## تقسيم الجولات

### الجولة 1 — البنية التحتية (هذه الخطة)
1. تفعيل Lovable Cloud + إنشاء كل الجداول والـ RLS
2. نظام i18n (عربي/إنجليزي) + RTL toggle + Dark/Light
3. صفحة Login (Email/Password للمدير)
4. صفحة PIN entry للكاشير
5. Layout عام: Sidebar قابل للطي + Topbar + Smart Search (Ctrl+K)
6. Dashboard فارغ (هيكل فقط)

### الجولة 2 — المنتجات والمخزون
7. CRUD المنتجات + التصنيفات + الباركود
8. Batches + تواريخ صلاحية
9. شاشة Stock Movements
10. تنبيهات Low Stock / Near Expiry

### الجولة 3 — POS
11. شاشة POS كاملة بالاختصارات (F1, +, Auto-focus)
12. Barcode scan instant add
13. Split payment + طرق الدفع (نقدي/بطاقة + Secondary في "المزيد")
14. طباعة الفاتورة

### الجولة 4 — المشتريات والمصاريف
15. شاشة المشتريات + إضافة batches تلقائياً
16. شاشة المصاريف
17. شاشة الموردين والعملاء (ديون)

### الجولة 5 — الخزائن والموظفين
18. فتح/قفل خزنة لكل موظف
19. Dashboard الموظف (إيراد/نقدي/خدمات)
20. تفاصيل العمليات بالفلترة

### الجولة 6 — Edit System و Edit Log
21. واجهة تعديل أي عملية (مدير فقط)
22. عرض Before/After في Edit Log
23. إعادة حساب فورية بعد كل تعديل

### الجولة 7 — Rebuild Engine
24. جدول `system_rebuilds` يتتبع الحالة (queued/running/done/failed)
25. Server Function تشغّل background job (عبر Supabase pg_cron + جدول queue، أو async fire-and-forget مع تحديث حالة)
26. 4 أنواع: Inventory / Financials / Product Integrity / Anomalies
27. واجهة "إصلاح النظام" مع Skeleton + تقرير مفصل (قبل/بعد، عناصر مصححة، تحذيرات)

### الجولة 8 — التقارير والملخص المالي
28. تقارير المبيعات (يومي/شهري/موظف)
29. تقارير المخزون (راكد/نفاذ/قرب نفاذ)
30. تقارير مالية (أرباح/تكلفة/مصاريف)
31. Financial Summary الكامل (إيرادات/ربح/رأس مال/ديون/سحوبات)
32. تصدير PDF/Excel

## قواعد العمل المُطبَّقة

- منع البيع لأي صنف بدون `selling_price` أو `cost_price` (validation على مستوى Server Function)
- كشف المخزون السالب وعرضه في Anomalies
- كل UPDATE يكتب في `edit_log` عبر trigger
- الكاشير لا يستطيع تعديل أو حذف، فقط إنشاء مبيعات

## واجهة المستخدم

- RTL افتراضي عربي + زر تبديل للإنجليزية (يحفظ التفضيل)
- Sidebar قابل للطي مع وضع icon-only
- Tabs system للشاشات المتعددة
- Dark/Light mode toggle
- Skeleton loading لكل الجداول والشاشات
- Toast notifications (sonner)
- Smart search عام بـ Ctrl+K (يبحث في منتجات/فواتير/موظفين)
- خط عربي مناسب (Cairo أو Tajawal)

## ملاحظات تقنية

- **Background Rebuild**: نستخدم Supabase Edge Function-style عبر TanStack Server Function تُطلق المهمة وترجع فوراً، والمهمة تحدّث `system_rebuilds.status` خطوة بخطوة. الواجهة تعمل polling كل ثانيتين على حالة الـ rebuild.
- **PIN auth**: PIN يُخزَّن مُجزَّأ (bcrypt) في profiles. شاشة PIN ترسل PIN لـ server function تتحقق وتُنشئ session للكاشير عبر admin client (impersonation محدود الصلاحية للكاشير فقط).
- **Edit Log**: trigger postgres عام يلتقط OLD/NEW JSONB في كل UPDATE على الجداول الحساسة.

---

ستبدأ الجولة الأولى فور الموافقة. كل جولة تالية ستكون رسالة منفصلة لضمان جودة التنفيذ وعدم تكسر البناء.