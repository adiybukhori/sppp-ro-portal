import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "./components/ui/card.jsx";
import { Button } from "./components/ui/button.jsx";
import { Input } from "./components/ui/input.jsx";

const API_URL =
  "https://script.google.com/macros/s/AKfycbytisjv4mLp9bW1CAu_93PsKpLlKD2LDSggVinQNwSQHhqAFzGix-R8a6bqpTWi0oDe/exec";

const PAGE_SIZE = 50;

function money(n) {
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
    minimumFractionDigits: 2,
  }).format(Number(n || 0));
}

function badge(value) {
  if (["Active", "Clear", "IUC"].includes(value)) return "bg-emerald-100 text-emerald-700";
  if (["Pending Update", "YEG", "YPR", "Ongoing"].includes(value)) return "bg-blue-100 text-blue-700";
  if (["Blocked", "Outstanding"].includes(value)) return "bg-red-100 text-red-700";
  return "bg-slate-100 text-slate-700";
}

function normalizeStudent(raw) {
  return {
    id: raw["Student ID"] || "",
    name: raw["Student Name"] || "",
    ic: raw["IC/Passport"] || "",
    program: raw.Program || "",
    intake: raw.Intake || "",
    category: raw["Student Category"] || "",
    feeGroup: raw["Fee Group"] || "",
    pic: raw["Assigned PIC"] || "",
    lmsStatus: raw["LMS Status"] || "",
    paidAmount: Number(raw["Paid Amount"] || 0),
    outstanding: Number(raw.Outstanding || 0),
    paymentStatus: raw["Payment Status"] || "",
    subjects: raw.subjects || [],
  };
}

export default function App() {
  const [students, setStudents] = useState([]);
  const [programFilter, setProgramFilter] = useState("All");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [lmsFilter, setLmsFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [showNewStudent, setShowNewStudent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  async function loadStudents() {
    setLoading(true);
    const res = await fetch(`${API_URL}?action=getStudents`);
    const data = await res.json();

    if (data.success) {
      setStudents((data.students || []).map(normalizeStudent));
    }

    setLoading(false);
  }

  useEffect(() => {
    loadStudents();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [search, programFilter, categoryFilter, lmsFilter]);

  const programmes = [...new Set(students.map((s) => s.program).filter(Boolean))];
  const categories = [...new Set(students.map((s) => s.category).filter(Boolean))];
  const lmsStatuses = [...new Set(students.map((s) => s.lmsStatus).filter(Boolean))];

  const hasFilter =
    search.trim() !== "" ||
    programFilter !== "All" ||
    categoryFilter !== "All" ||
    lmsFilter !== "All";

  const filtered = hasFilter
    ? students.filter((s) => {
        const matchProgram = programFilter === "All" || s.program === programFilter;
        const matchCategory = categoryFilter === "All" || s.category === categoryFilter;
        const matchLms = lmsFilter === "All" || s.lmsStatus === lmsFilter;
        const keyword = `${s.name} ${s.id} ${s.ic} ${s.program} ${s.intake}`.toLowerCase();
        return (
          matchProgram &&
          matchCategory &&
          matchLms &&
          keyword.includes(search.toLowerCase())
        );
      })
    : [];

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const startIndex = (page - 1) * PAGE_SIZE;
  const paginated = filtered.slice(startIndex, startIndex + PAGE_SIZE);

  function resetFilters() {
    setSearch("");
    setProgramFilter("All");
    setCategoryFilter("All");
    setLmsFilter("All");
    setPage(1);
  }

  function exportCSV() {
    if (!filtered.length) {
      alert("No filtered data to export.");
      return;
    }

    const headers = [
      "Student ID",
      "Student Name",
      "IC/Passport",
      "Programme",
      "Intake",
      "Category",
      "Fee Group",
      "PIC",
      "LMS Status",
      "Paid Amount",
      "Outstanding",
      "Payment Status",
    ];

    const rows = filtered.map((s) => [
      s.id,
      s.name,
      s.ic,
      s.program,
      s.intake,
      s.category,
      s.feeGroup,
      s.pic,
      s.lmsStatus,
      s.paidAmount,
      s.outstanding,
      s.paymentStatus,
    ]);

    const csv = [headers, ...rows]
      .map((row) =>
        row.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(",")
      )
      .join("\n");

    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    });

    const filterName =
      programFilter !== "All"
        ? programFilter
        : categoryFilter !== "All"
        ? categoryFilter
        : lmsFilter !== "All"
        ? lmsFilter
        : "Filtered";

    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `SPPP_RO_${filterName}_Students.csv`;
    link.click();
  }

  const summary = useMemo(() => {
    const byProgram = programmes.map((program) => {
      const list = students.filter((s) => s.program === program);
      return {
        label: program,
        total: list.length,
        collected: list.reduce((sum, s) => sum + s.paidAmount, 0),
        outstanding: list.reduce((sum, s) => sum + s.outstanding, 0),
      };
    });

    const byCategory = categories.map((category) => {
      const list = students.filter((s) => s.category === category);
      return {
        label: category,
        total: list.length,
        collected: list.reduce((sum, s) => sum + s.paidAmount, 0),
        outstanding: list.reduce((sum, s) => sum + s.outstanding, 0),
      };
    });

    const offeringMap = {};
    students.forEach((student) => {
      (student.subjects || []).forEach((subject) => {
        if (subject.status !== "Ongoing") return;
        const key = `${student.program}|${subject.subjectCode}|${subject.subjectName}`;

        if (!offeringMap[key]) {
          offeringMap[key] = {
            program: student.program,
            subject: `${subject.subjectCode} ${subject.subjectName}`,
            total: 0,
          };
        }

        offeringMap[key].total += 1;
      });
    });

    return {
      total: students.length,
      collected: students.reduce((sum, s) => sum + s.paidAmount, 0),
      outstanding: students.reduce((sum, s) => sum + s.outstanding, 0),
      blocked: students.filter((s) => s.lmsStatus === "Blocked").length,
      active: students.filter((s) => s.lmsStatus === "Active").length,
      byProgram,
      byCategory,
      currentOfferings: Object.values(offeringMap).sort((a, b) => b.total - a.total),
    };
  }, [students, programmes, categories]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center text-slate-700 font-semibold">
        Loading RO Portal...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="bg-gradient-to-r from-slate-950 via-blue-950 to-slate-900 text-white">
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <p className="text-sm text-blue-100">Innovative University College</p>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              Registrar Master Admin Portal
            </h1>
            <p className="text-sm text-blue-100">
              Full postgraduate access: MBA, MBM, MHUM, PhD and all programmes
            </p>
          </div>

          <div className="flex gap-3">
            <Button
              className="rounded-full bg-white text-slate-900 hover:bg-blue-50 px-5 py-2"
              onClick={() => setShowNewStudent(true)}
            >
              + Add New Student
            </Button>
            <Button
              className="rounded-full bg-white text-slate-900 hover:bg-blue-50 px-5 py-2"
              onClick={loadStudents}
            >
              Refresh Data
            </Button>
          </div>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <Stat title="Total Students" value={summary.total} />
          <Stat title="Total Collected" value={money(summary.collected)} />
          <Stat title="Total Outstanding" value={money(summary.outstanding)} danger={summary.outstanding > 0} />
          <Stat title="LMS Blocked" value={summary.blocked} danger={summary.blocked > 0} />
          <Stat title="LMS Active" value={summary.active} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="rounded-3xl border border-slate-200 bg-white shadow-md">
            <CardContent className="p-6">
              <h2 className="font-bold text-lg mb-5">Summary by Programme</h2>
              <div className="space-y-3">
                {summary.byProgram.map((item) => (
                  <BreakdownRow key={item.label} item={item} />
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border border-slate-200 bg-white shadow-md">
            <CardContent className="p-6">
              <h2 className="font-bold text-lg mb-5">Summary by Student Category</h2>
              <div className="space-y-3">
                {summary.byCategory.map((item) => (
                  <BreakdownRow key={item.label} item={item} />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-3xl border border-slate-200 bg-white shadow-md">
          <CardContent className="p-6">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <h2 className="font-bold text-lg">Current Subject Offering</h2>
                <p className="text-sm text-slate-500">
                  Subjects currently marked as Ongoing across all postgraduate programmes.
                </p>
              </div>
              <span className="rounded-full bg-blue-100 text-blue-700 px-4 py-1 text-xs font-bold">
                Live from progress data
              </span>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="text-left p-3">Programme</th>
                    <th className="text-left p-3">Subject Currently Offered</th>
                    <th className="text-right p-3">Students Ongoing</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.currentOfferings.length === 0 ? (
                    <tr>
                      <td colSpan="3" className="p-4 text-slate-500">
                        No ongoing subject found.
                      </td>
                    </tr>
                  ) : (
                    summary.currentOfferings.map((item) => (
                      <tr key={`${item.program}-${item.subject}`} className="border-t border-slate-200 hover:bg-slate-50">
                        <td className="p-3">
                          <span className="rounded-full bg-blue-100 text-blue-700 px-3 py-1 text-xs font-bold">
                            {item.program}
                          </span>
                        </td>
                        <td className="p-3 font-semibold text-slate-900">{item.subject}</td>
                        <td className="p-3 text-right font-bold">{item.total}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border border-slate-200 bg-white shadow-md">
          <CardContent className="p-6">
            <div className="flex flex-col gap-4 mb-5">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                <div>
                  <h2 className="font-bold text-xl">All Postgraduate Students</h2>
                  <p className="text-sm text-slate-500">
                    Search or filter first to display student records.
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button
                    className="rounded-full bg-slate-900 text-white px-5 py-2 disabled:opacity-40"
                    onClick={exportCSV}
                    disabled={!filtered.length}
                  >
                    Export CSV
                  </Button>
                  <Button
                    className="rounded-full border border-slate-200 bg-white px-5 py-2"
                    onClick={resetFilters}
                  >
                    Reset
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search name / ID / IC"
                />

                <select
                  value={programFilter}
                  onChange={(e) => setProgramFilter(e.target.value)}
                  className="rounded-xl border border-slate-200 px-3 py-2 bg-white"
                >
                  {["All", ...programmes].map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>

                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="rounded-xl border border-slate-200 px-3 py-2 bg-white"
                >
                  {["All", ...categories].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>

                <select
                  value={lmsFilter}
                  onChange={(e) => setLmsFilter(e.target.value)}
                  className="rounded-xl border border-slate-200 px-3 py-2 bg-white"
                >
                  {["All", ...lmsStatuses].map((l) => (
                    <option key={l}>{l}</option>
                  ))}
                </select>
              </div>
            </div>

            {!hasFilter ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-slate-500">
                Please search or select a filter to display student records.
              </div>
            ) : filtered.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-slate-500">
                No student records found for the selected filter.
              </div>
            ) : (
              <>
                <div className="mb-3 flex items-center justify-between text-sm text-slate-500">
                  <p>
                    Showing {startIndex + 1}–{Math.min(startIndex + PAGE_SIZE, filtered.length)} of{" "}
                    {filtered.length} record(s)
                  </p>
                  <p>Page {page} of {totalPages}</p>
                </div>

                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-slate-600">
                      <tr>
                        <th className="text-left p-3">Student</th>
                        <th className="text-left p-3">Programme</th>
                        <th className="text-left p-3">Category</th>
                        <th className="text-left p-3">PIC</th>
                        <th className="text-left p-3">LMS</th>
                        <th className="text-right p-3">Outstanding</th>
                        <th className="text-right p-3">Action</th>
                      </tr>
                    </thead>

                    <tbody>
                      {paginated.map((student) => (
                        <tr key={student.id} className="border-t border-slate-200 hover:bg-slate-50">
                          <td className="p-3">
                            <p className="font-semibold text-slate-900">{student.name}</p>
                            <p className="text-xs text-slate-500">
                              {student.id} · {student.ic} · {student.intake}
                            </p>
                          </td>
                          <td className="p-3">
                            <span className="rounded-full bg-blue-100 text-blue-700 px-3 py-1 text-xs font-bold">
                              {student.program}
                            </span>
                          </td>
                          <td className="p-3">
                            <span className={`rounded-full px-3 py-1 text-xs font-bold ${badge(student.category)}`}>
                              {student.category}
                            </span>
                          </td>
                          <td className="p-3 text-slate-600">{student.pic}</td>
                          <td className="p-3">
                            <span className={`rounded-full px-3 py-1 text-xs font-bold ${badge(student.lmsStatus)}`}>
                              {student.lmsStatus}
                            </span>
                          </td>
                          <td className={`p-3 text-right font-bold ${student.outstanding > 0 ? "text-red-600" : "text-emerald-700"}`}>
                            {money(student.outstanding)}
                          </td>
                          <td className="p-3 text-right">
                            <Button className="rounded-full border border-slate-200 bg-white px-4 py-1 text-xs hover:bg-slate-50">
                              Open
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-end gap-3 mt-4">
                  <Button
                    className="rounded-full border border-slate-200 bg-white px-5 py-2 disabled:opacity-40"
                    disabled={page === 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </Button>

                  <Button
                    className="rounded-full border border-slate-200 bg-white px-5 py-2 disabled:opacity-40"
                    disabled={page === totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Next
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function Stat({ title, value, danger }) {
  return (
    <Card className="rounded-3xl border border-slate-200 bg-white shadow-md hover:shadow-lg transition">
      <CardContent className="p-5">
        <p className="text-xs text-slate-500">{title}</p>
        <p className={`mt-2 text-xl font-bold ${danger ? "text-red-600" : "text-slate-900"}`}>
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

function BreakdownRow({ item }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 hover:bg-slate-50 transition">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-bold text-slate-900">{item.label}</p>
          <p className="text-xs text-slate-500">{item.total} student(s)</p>
        </div>
        <div className="text-right text-xs">
          <p className="text-emerald-700 font-bold">Collected: {money(item.collected)}</p>
          <p className={item.outstanding > 0 ? "text-red-600 font-bold" : "text-slate-500 font-bold"}>
            Outstanding: {money(item.outstanding)}
          </p>
        </div>
      </div>
    </div>
  );
}
