"use client";

import type { Due, Expense, LedgerEntry, Payment } from "@/lib/financeTypes";
import { satangToBaht } from "@/lib/financeTypes";
import type { FinanceSummary } from "@/lib/financeCalc";
import type { Member, Room } from "@/lib/types";

interface FinanceReportExportProps {
  roomId: string;
  room: Room | null;
  summary: FinanceSummary;
  dues: Due[];
  payments: Payment[];
  expenses: Expense[];
  ledgerEntries: LedgerEntry[];
  members: Member[];
}

export default function FinanceReportExport({
  roomId,
  room,
  summary,
  dues,
  payments,
  expenses,
  ledgerEntries,
  members,
}: FinanceReportExportProps) {
  const getMemberName = (uid: string) => {
    const m = members.find((mem) => mem.id === uid);
    return m ? m.name : uid;
  };

  const handleExportCSV = () => {
    const roomTitle = room?.title || "HoneyTrip";
    const dateStr = new Date().toISOString().split("T")[0];

    // UTF-8 BOM for Thai support in Microsoft Excel
    let csv = "\uFEFF";

    // 1. Summary Section
    csv += `รายงานสรุปการเงินทริป: ${roomTitle}\n`;
    csv += `วันที่ออกรายงาน: ${dateStr}\n\n`;

    csv += `สรุปภาพรวมทางการเงิน (บาท)\n`;
    csv += `เงินกองกลางคงเหลือจริง,${satangToBaht(summary.confirmedFundBalanceSatang)}\n`;
    csv += `เงินรับเข้ากองกลางแล้วทั้งหมด,${satangToBaht(summary.totalConfirmedInflowSatang)}\n`;
    csv += `เงินจ่ายออกจากกองกลางแล้วทั้งหมด,${satangToBaht(summary.totalConfirmedOutflowSatang)}\n`;
    csv += `ยอดเงินรอสมาชิกโอนค้างจ่าย,${satangToBaht(summary.totalOutstandingDuesSatang)}\n`;
    csv += `ยอดค่าใช้จ่ายที่ต้องจ่ายร้านค้าคงค้าง,${satangToBaht(summary.totalPendingVendorLiabilitySatang)}\n\n`;

    // 2. Member Dues Breakdown
    csv += `สรุปยอดค้างชำระรายบุคคล\n`;
    csv += `ชื่อสมาชิก,ยอดต้องจ่ายรวม (บาท),ยอดโอนแล้วอนุมัติแล้ว (บาท),ยอดค้างชำระ (บาท)\n`;
    Object.entries(summary.memberBalances).forEach(([uid, bal]) => {
      csv += `"${getMemberName(uid)}",${satangToBaht(bal.allocatedSatang)},${satangToBaht(
        bal.approvedPaidSatang
      )},${satangToBaht(bal.outstandingSatang)}\n`;
    });
    csv += "\n";

    // 3. Ledger Entries
    csv += `สมุดบัญชีกองกลาง (Ledger)\n`;
    csv += `วัน-เวลา,ประเภท,รายการ,จำนวนเงิน (บาท),สมาชิก,รหัสอ้างอิง\n`;
    ledgerEntries.forEach((entry) => {
      const typeStr =
        entry.type === "income"
          ? "รายรับเข้ากองกลาง"
          : entry.type === "expense"
          ? "รายจ่ายกองกลาง"
          : "ปรับปรุงยอด";
      const dt = new Date(entry.createdAt).toLocaleString("th-TH");
      const member = entry.memberUid ? getMemberName(entry.memberUid) : "-";
      csv += `"${dt}","${typeStr}","${entry.description.replace(/"/g, '""')}",${satangToBaht(
        entry.amountSatang
      )},"${member}","${entry.referenceId}"\n`;
    });
    csv += "\n";

    // 4. Expenses List
    csv += `รายการค่าใช้จ่ายทั้งหมด\n`;
    csv += `วันที่,รายการ,หมวดหมู่,ผู้รับเงิน/ร้านค้า,ยอดรวม (บาท),จ่ายแล้ว (บาท),สถานะ,หมายเหตุ\n`;
    expenses.forEach((exp) => {
      csv += `"${exp.date || "-"}","${exp.title.replace(/"/g, '""')}","${exp.category}","${exp.vendor.replace(
        /"/g,
        '""'
      )}",${satangToBaht(exp.totalCostSatang)},${satangToBaht(exp.paidAmountSatang)},"${exp.status}","${(
        exp.notes || ""
      ).replace(/"/g, '""')}"\n`;
    });

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `HoneyTrip_Finance_${roomId}_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportJSON = () => {
    const data = {
      room: { id: roomId, title: room?.title },
      exportedAt: new Date().toISOString(),
      summary,
      dues,
      payments,
      expenses,
      ledgerEntries,
    };
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute(
      "download",
      `HoneyTrip_Finance_${roomId}_${new Date().toISOString().split("T")[0]}.json`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleExportCSV}
        className="px-3 py-1.5 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-stone-700 text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors"
        title="ดาวน์โหลดไฟล์ CSV สำหรับ Excel"
      >
        <span>📊</span> ส่งออก CSV (Excel)
      </button>
      <button
        onClick={handleExportJSON}
        className="px-3 py-1.5 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-stone-700 text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors"
        title="ดาวน์โหลดไฟล์ JSON สำรองข้อมูล"
      >
        <span>💾</span> สำรอง JSON
      </button>
    </div>
  );
}
