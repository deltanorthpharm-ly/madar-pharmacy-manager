import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  ScanBarcode, Package, ShoppingCart, Wallet, Users, BarChart3,
  Wrench, History, Receipt, Boxes,
} from "lucide-react";

export const Route = createFileRoute("/_app/user-guide")({
  component: UserGuidePage,
});

const sections = [
  {
    icon: ScanBarcode, title: "نقطة البيع (POS)",
    content: [
      "ابحث عن المنتج بالاسم أو الباركود في شريط البحث.",
      "اضغط على المنتج لإضافته للسلة، عدّل الكمية بالأسهم.",
      "اختر العميل (اختياري) ثم طريقة الدفع.",
      "اضغط 'حفظ الفاتورة' (Ctrl+S) لإتمام البيع وطباعة الإيصال.",
      "⚠️ يجب أن تكون هناك خزنة (Drawer) مفتوحة للبيع.",
    ],
  },
  {
    icon: Package, title: "المنتجات والمخزون",
    content: [
      "أضف منتج جديد مع الباركود وسعر الشراء/البيع والحد الأدنى.",
      "فعّل 'له تاريخ صلاحية' للمنتجات التي تحتاج دفعات (Batches).",
      "صفحة المخزون تظهر التنبيهات (مخزون منخفض / قارب على الانتهاء).",
    ],
  },
  {
    icon: ShoppingCart, title: "المشتريات والموردين",
    content: [
      "أنشئ فاتورة شراء جديدة، اختر المورد، أضف المنتجات.",
      "عند إدخال سعر شراء جديد يتم تحديث سعر شراء المنتج تلقائياً.",
      "الباقي غير المدفوع يُسجّل كدين على المورد.",
    ],
  },
  {
    icon: Wallet, title: "الخزنة والورديات",
    content: [
      "افتح خزنة في بداية الوردية بالرصيد الافتتاحي.",
      "كل المبيعات والمصروفات تُسجَّل عليها.",
      "عند الإغلاق: النظام يحسب الفرق بين المتوقع والفعلي.",
    ],
  },
  {
    icon: Receipt, title: "المصروفات",
    content: [
      "سجّل أي مصروف (إيجار، كهرباء، رواتب) مع التصنيف.",
      "يخصم تلقائياً من الخزنة المفتوحة الحالية.",
    ],
  },
  {
    icon: Users, title: "العملاء والموظفين",
    content: [
      "العملاء: تتبع أرصدتهم والديون.",
      "الموظفون: إدارة الحسابات والصلاحيات (admin / cashier).",
    ],
  },
  {
    icon: BarChart3, title: "التقارير والملخص المالي",
    content: [
      "التقارير: تقارير المبيعات والأرباح والمخزون مع فلترة بالتاريخ.",
      "الملخص المالي: ربح صافٍ بعد المصروفات والسحوبات.",
      "يمكن تصدير كل شيء كـ CSV.",
    ],
  },
  {
    icon: Wrench, title: "Rebuild Engine",
    content: [
      "إعادة بناء المخزون من حركات المخزون الفعلية.",
      "إعادة احتساب أرباح الفواتير من البنود.",
      "كشف التناقضات (مخزون سالب، صلاحيات منتهية).",
    ],
  },
  {
    icon: History, title: "سجل التعديلات",
    content: [
      "كل تعديل/حذف على البيانات الحساسة يُسجَّل تلقائياً.",
      "الأدمن فقط يمكنه عرض السجل.",
    ],
  },
  {
    icon: Boxes, title: "البيانات والنسخ الاحتياطية",
    content: [
      "تصدير كامل قاعدة البيانات بصيغة Excel أو JSON.",
      "تصدير جدول واحد بشكل منفصل.",
      "يُنصح بأخذ نسخة أسبوعياً.",
    ],
  },
];

const shortcuts = [
  ["F2 / Ctrl+K", "تركيز شريط البحث في POS"],
  ["Ctrl+S", "حفظ الفاتورة"],
  ["Ctrl+D", "حذف عنصر من السلة"],
  ["Esc", "إغلاق النوافذ"],
];

function UserGuidePage() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold">دليل المستخدم</h1>
        <p className="text-sm text-muted-foreground mt-1">
          شرح مبسّط لكل وحدات نظام بيان فارما.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>اختصارات لوحة المفاتيح</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2">
            {shortcuts.map(([key, desc]) => (
              <div key={key} className="flex items-center justify-between border rounded-md px-3 py-2 text-sm">
                <span>{desc}</span>
                <kbd className="bg-muted px-2 py-0.5 rounded text-xs font-mono">{key}</kbd>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>الوحدات</CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion type="multiple" className="w-full">
            {sections.map((s) => (
              <AccordionItem key={s.title} value={s.title}>
                <AccordionTrigger className="hover:no-underline">
                  <span className="flex items-center gap-2">
                    <s.icon className="h-4 w-4 text-primary" />
                    {s.title}
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <ul className="space-y-2 text-sm text-muted-foreground ps-6 list-disc">
                    {s.content.map((line, i) => (
                      <li key={i}>{line}</li>
                    ))}
                  </ul>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>الدعم والاستفسارات</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          للمساعدة الفنية تواصل مع مدير النظام داخل صيدليتك.
        </CardContent>
      </Card>
    </div>
  );
}
