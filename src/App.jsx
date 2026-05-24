import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "./components/ui/card.jsx";
import { Button } from "./components/ui/button.jsx";
import { Input } from "./components/ui/input.jsx";

const API_URL =
  "https://script.google.com/macros/s/AKfycbxmIenUhCe41jAslgKYae-t6Hjrb-sSg_KKXKn0_UIKqQsjsmMem_Vd8d2U3Jj446lC/exec";

const STUDENT_PORTAL_URL = "https://sppp-portal.vercel.app/";
const PAGE_SIZE = 50;

function money(n) {
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
    minimumFractionDigits: 2,
  }).format(Number(n || 0));
}

function badge(value) {
  if (["Active", "Clear", "IUC", "Taken"].includes(value)) return "bg-emerald-100 text-emerald-700";
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
    studentPortalLink: raw["Student Portal Link"] || "",
    subjects: raw.subjects || [],
  };
}

const emptyNewStudent = {
  studentId: "",
  studentName: "",
  icPassport: "",
  program: "",
  intake: "",
  studentCategory: "",
  feeGroup: "",
  assignedPic: "",
};

export default function App() {
  const [students, setStudents] = useState([]);
  const [lookup, setLookup] = useState({ feeMaster: [], picUsers: [] });
  const [currentOfferings, setCurrentOfferings] = useState([]);
  const [dashboardSummary, setDashboardSummary] = useState(null);

  const [draftSearch, setDraftSearch] = useState("");
  const [draftProgramFilter, setDraftProgramFilter] = useState("All");
  const [draftCategoryFilter, setDraftCategoryFilter] = useState("All");
  const [draftLmsFilter, setDraftLmsFilter] = useState("All");

  const [appliedSearch, setAppliedSearch] = useState("");
  const [appliedProgramFilter, setAppliedProgramFilter] = useState("All");
  const [appliedCategoryFilter, setAppliedCategoryFilter] = useState("All");
  const [appliedLmsFilter, setAppliedLmsFilter] = useState("All");
  const [filterApplied, setFilterApplied] = useState(false);

  const [showNewStudent, setShowNewStudent] = useState(false);
  const [newStudent, setNewStudent] = useState(emptyNewStudent);
  const [savingStudent, setSavingStudent] = useState(false);

  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentDetail, setStudentDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  async function loadDashboardSummary() {
    try {
      const res = await fetch(`${API_URL}?action=getDashboardSummary`);
      const data = await res.json();

      if (data.success) {
        setDashboardSummary(data.summary);
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function loadStudents() {
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}?action=getStudents`);
      const data = await res.json();

      if (data.success) {
        const normalized = (data.students || []).map(normalizeStudent);
        setStudents(normalized);
        loadCurrentOfferings(normalized);
        loadDashboardSummary();
      }
    } catch (err) {
      console.error(err);
    }

    setLoading(false);
  }

  async function loadCurrentOfferings(studentList) {
    try {
      const details = await Promise.all(
        studentList.map(async (s) => {
          const res = await fetch(
            `${API_URL}?action=getStudentDetail&studentId=${encodeURIComponent(s.id)}`
          );
          const data = await res.json();
          return data.success ? { student: s, subjects: data.student.subjects || [] } : null;
        })
      );

      const offeringMap = {};

      details.filter(Boolean).forEach(({ student, subjects }) => {
        subjects.forEach((subject) => {
          if (String(subject.status || "").toLowerCase() !== "ongoing") return;

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

      setCurrentOfferings(Object.values(offeringMap).sort((a, b) => b.total - a.total));
    } catch (err) {
      console.error(err);
      setCurrentOfferings([]);
    }
  }

  async function loadLookup() {
    const res = await fetch(`${API_URL}?action=getLookupData`);
    const data = await res.json();

    if (data.success) {
      setLookup({
        feeMaster: data.feeMaster || [],
        picUsers: data.picUsers || [],
      });
    }
  }

  useEffect(() => {
    loadStudents();
    loadLookup();
  }, []);

  const programmes = [...new Set(students.map((s) => s.program).filter(Boolean))];
  const categories = [...new Set(students.map((s) => s.category).filter(Boolean))];
  const lmsStatuses = [...new Set(students.map((s) => s.lmsStatus).filter(Boolean))];

  function applyFilter() {
    setAppliedSearch(draftSearch);
    setAppliedProgramFilter(draftProgramFilter);
    setAppliedCategoryFilter(draftCategoryFilter);
    setAppliedLmsFilter(draftLmsFilter);
    setFilterApplied(true);
    setPage(1);
  }

  function resetFilters() {
    setDraftSearch("");
    setDraftProgramFilter("All");
    setDraftCategoryFilter("All");
    setDraftLmsFilter("All");
    setAppliedSearch("");
    setAppliedProgramFilter("All");
    setAppliedCategoryFilter("All");
    setAppliedLmsFilter("All");
    setFilterApplied(false);
    setPage(1);
  }

  const filtered = filterApplied
    ? students.filter((s) => {
        const matchProgram = appliedProgramFilter === "All" || s.program === appliedProgramFilter;
        const matchCategory = appliedCategoryFilter === "All" || s.category === appliedCategoryFilter;
        const matchLms = appliedLmsFilter === "All" || s.lmsStatus === appliedLmsFilter;
        const keyword = `${s.name} ${s.id} ${s.ic} ${s.program} ${s.intake}`.toLowerCase();

        return (
          matchProgram &&
          matchCategory &&
          matchLms &&
          keyword.includes(appliedSearch.toLowerCase())
        );
      })
    : [];

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const startIndex = (page - 1) * PAGE_SIZE;
  const paginated = filtered.slice(startIndex, startIndex + PAGE_SIZE);

  async function openStudent(student) {
    setSelectedStudent(student);
    setStudentDetail(null);
    setDetailLoading(true);

    try {
      const res = await fetch(
        `${API_URL}?action=getStudentDetail&studentId=${encodeURIComponent(student.id)}`
      );
      const data = await res.json();

      if (data.success) setStudentDetail(data.student);
    } catch (err) {
      console.error(err);
    }

    setDetailLoading(false);
  }

  function closeStudentModal() {
    setSelectedStudent(null);
    setStudentDetail(null);
    setDetailLoading(false);
  }

  function openStudentProfile(student) {
    window.open(
      `${STUDENT_PORTAL_URL}?studentId=${encodeURIComponent(student.id)}`,
      "_blank",
      "noopener,noreferrer"
    );
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
      .map((row) => row.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(","))
      .join("\n");

    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });

    const filterName =
      appliedProgramFilter !== "All"
        ? appliedProgramFilter
        : appliedCategoryFilter !== "All"
        ? appliedCategoryFilter
        : appliedLmsFilter !== "All"
        ? appliedLmsFilter
        : "All";

    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `SPPP_RO_${filterName}_Students.csv`;
    link.click();
  }

  function getPicByProgram(program) {
    return lookup.picUsers.find(
      (p) =>
        String(p.Program || "").trim() === String(program || "").trim() &&
        String(p.Role || "").trim().toUpperCase() === "PIC"
    );
  }

  function getFeeGroupsByProgram(program) {
    return lookup.feeMaster.filter(
      (f) => String(f.Program || "").trim() === String(program || "").trim()
    );
  }

  function openAddStudentModal() {
    const defaultProgram = programmes[0] || "";
    const pic = getPicByProgram(defaultProgram);
    const feeGroups = getFeeGroupsByProgram(defaultProgram);

    setNewStudent({
      ...emptyNewStudent,
      program: defaultProgram,
      assignedPic: pic?.PIC || "",
      feeGroup: feeGroups[0]?.["Fee Group"] || "",
    });

    setShowNewStudent(true);
  }

  function updateNewStudent(field, value) {
    if (field === "program") {
      const pic = getPicByProgram(value);
      const feeGroups = getFeeGroupsByProgram(value);

      setNewStudent((prev) => ({
        ...prev,
        program: value,
        assignedPic: pic?.PIC || "",
        feeGroup: feeGroups[0]?.["Fee Group"] || "",
      }));
      return;
    }

    setNewStudent((prev) => ({ ...prev, [field]: value }));
  }

  async function submitNewStudent() {
    if (
      !newStudent.studentId ||
      !newStudent.studentName ||
      !newStudent.icPassport ||
      !newStudent.program ||
      !newStudent.intake ||
      !newStudent.studentCategory ||
      !newStudent.feeGroup
    ) {
      alert("Please complete all required fields.");
      return;
    }

    setSavingStudent(true);

    try {
      const res = await fetch(API_URL, {
        method: "POST",
        body: JSON.stringify({
          action: "addNewStudent",
          ...newStudent,
          lmsStatus: "Pending Update",
          status: "Active",
        }),
      });

      const data = await res.json();

      if (!data.success) {
        alert(data.message || "Failed to add student.");
        setSavingStudent(false);
        return;
      }

      alert("New student added successfully. PIC coordinator has been notified.");
      setShowNewStudent(false);
      setNewStudent(emptyNewStudent);
      await loadStudents();
    } catch (err) {
      console.error(err);
      alert("Failed to add student. Please try again.");
    }

    setSavingStudent(false);
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

    return {
      total: students.length,
      collected: students.reduce((sum, s) => sum + s.paidAmount, 0),
      outstanding: students.reduce((sum, s) => sum + s.outstanding, 0),
      blocked: students.filter((s) => s.lmsStatus === "Blocked").length,
      active: students.filter((s) => s.lmsStatus === "Active").length,
      byProgram,
      byCategory,
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
              onClick={openAddStudentModal}
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
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <Stat title="Total Students" value={dashboardSummary?.totalStudents ?? summary.total} />
            <Stat title="Total Enrolled Fee Value" value={money(dashboardSummary?.totalEnrolledFeeValue || 0)} />
            <Stat title="Total Should Pay" value={money(dashboardSummary?.totalShouldPay || 0)} />
            <Stat title="Total Collected" value={money(dashboardSummary?.totalCollected ?? summary.collected)} />
            <Stat
              title="Total Outstanding"
              value={money(dashboardSummary?.totalOutstanding ?? summary.outstanding)}
              danger={(dashboardSummary?.totalOutstanding ?? summary.outstanding) > 0}
            />
          </div>
        </div>
        
          <div className="flex justify-end gap-3">
            <div className="rounded-full bg-white border border-slate-200 px-6 py-3 shadow-sm min-w-[170px]">
              <p className="text-xs text-slate-500">LMS Blocked</p>
              <p className="text-lg font-bold text-red-600">
                {dashboardSummary?.lmsBlocked ?? summary.blocked}
              </p>
            </div>
          
            <div className="rounded-full bg-white border border-slate-200 px-6 py-3 shadow-sm min-w-[170px]">
              <p className="text-xs text-slate-500">LMS Active</p>
              <p className="text-lg font-bold text-slate-900">
                {dashboardSummary?.lmsActive ?? summary.active}
              </p>
            </div>
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
                  {currentOfferings.length === 0 ? (
                    <tr>
                      <td colSpan="3" className="p-4 text-slate-500">
                        No ongoing subject found.
                      </td>
                    </tr>
                  ) : (
                    currentOfferings.map((item) => (
                      <tr key={`${item.program}-${item.subject}`} className="border-t border-slate-200 hover:bg-slate-50">
                        <td className="p-3"><Pill>{item.program}</Pill></td>
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
                    Select filters and click Apply Filter to display student records.
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button className="rounded-full bg-slate-900 text-white px-5 py-2" onClick={applyFilter}>
                    Apply Filter
                  </Button>
                  <Button
                    className="rounded-full bg-slate-900 text-white px-5 py-2 disabled:opacity-40"
                    onClick={exportCSV}
                    disabled={!filtered.length}
                  >
                    Export CSV
                  </Button>
                  <Button className="rounded-full border border-slate-200 bg-white px-5 py-2" onClick={resetFilters}>
                    Reset
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <Input value={draftSearch} onChange={(e) => setDraftSearch(e.target.value)} placeholder="Search name / ID / IC" />

                <select value={draftProgramFilter} onChange={(e) => setDraftProgramFilter(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 bg-white">
                  {["All", ...programmes].map((p) => <option key={p}>{p}</option>)}
                </select>

                <select value={draftCategoryFilter} onChange={(e) => setDraftCategoryFilter(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 bg-white">
                  {["All", ...categories].map((c) => <option key={c}>{c}</option>)}
                </select>

                <select value={draftLmsFilter} onChange={(e) => setDraftLmsFilter(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 bg-white">
                  {["All", ...lmsStatuses].map((l) => <option key={l}>{l}</option>)}
                </select>
              </div>
            </div>

            {!filterApplied ? (
              <EmptyState text="Please click Apply Filter to display student records." />
            ) : filtered.length === 0 ? (
              <EmptyState text="No student records found for the selected filter." />
            ) : (
              <>
                <div className="mb-3 flex items-center justify-between text-sm text-slate-500">
                  <p>Showing {startIndex + 1}–{Math.min(startIndex + PAGE_SIZE, filtered.length)} of {filtered.length} record(s)</p>
                  <p>Page {page} of {totalPages}</p>
                </div>

                <StudentTable students={paginated} openStudent={openStudent} />

                <div className="flex justify-end gap-3 mt-4">
                  <Button className="rounded-full border border-slate-200 bg-white px-5 py-2 disabled:opacity-40" disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                    Previous
                  </Button>
                  <Button className="rounded-full border border-slate-200 bg-white px-5 py-2 disabled:opacity-40" disabled={page === totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                    Next
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </main>

      {showNewStudent && (
        <AddStudentModal
          newStudent={newStudent}
          updateNewStudent={updateNewStudent}
          submitNewStudent={submitNewStudent}
          close={() => setShowNewStudent(false)}
          programmes={programmes}
          categories={categories}
          getFeeGroupsByProgram={getFeeGroupsByProgram}
          saving={savingStudent}
        />
      )}

      {selectedStudent && (
        <StudentDetailModal
          selectedStudent={selectedStudent}
          studentDetail={studentDetail}
          detailLoading={detailLoading}
          closeStudentModal={closeStudentModal}
          openStudentProfile={openStudentProfile}
        />
      )}
    </div>
  );
}

function StudentTable({ students, openStudent }) {
  return (
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
          {students.map((student) => (
            <tr key={student.id} className="border-t border-slate-200 hover:bg-slate-50">
              <td className="p-3">
                <p className="font-semibold text-slate-900">{student.name}</p>
                <p className="text-xs text-slate-500">{student.id} · {student.ic} · {student.intake}</p>
              </td>
              <td className="p-3"><Pill>{student.program}</Pill></td>
              <td className="p-3"><span className={`rounded-full px-3 py-1 text-xs font-bold ${badge(student.category)}`}>{student.category}</span></td>
              <td className="p-3 text-slate-600">{student.pic}</td>
              <td className="p-3"><span className={`rounded-full px-3 py-1 text-xs font-bold ${badge(student.lmsStatus)}`}>{student.lmsStatus}</span></td>
              <td className={`p-3 text-right font-bold ${student.outstanding > 0 ? "text-red-600" : "text-emerald-700"}`}>{money(student.outstanding)}</td>
              <td className="p-3 text-right">
                <Button className="rounded-full border border-slate-200 bg-white px-4 py-1 text-xs hover:bg-slate-50" onClick={() => openStudent(student)}>
                  Open
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StudentDetailModal({ selectedStudent, studentDetail, detailLoading, closeStudentModal, openStudentProfile }) {
  const subjects = studentDetail?.subjects || [];

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white w-full max-w-3xl rounded-3xl p-6 shadow-xl relative max-h-[85vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <p className="text-sm text-slate-500">Student Details</p>
            <h2 className="text-2xl font-bold text-slate-900">{selectedStudent.name}</h2>
            <p className="text-sm text-slate-500">{selectedStudent.id} · {selectedStudent.ic}</p>
          </div>

          <Button className="rounded-full border border-slate-200 bg-white px-5 py-2" onClick={closeStudentModal}>
            Close
          </Button>
        </div>

        <div className="flex flex-wrap gap-3 mb-6">
          <Button className="rounded-full bg-slate-900 text-white px-5 py-2" onClick={() => openStudentProfile(selectedStudent)}>
            View Student Profile
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <InfoCard title="Programme" value={selectedStudent.program} />
          <InfoCard title="Intake" value={selectedStudent.intake} />
          <InfoCard title="Category" value={selectedStudent.category} />
          <InfoCard title="PIC" value={selectedStudent.pic} />
          <InfoCard title="LMS Status" value={selectedStudent.lmsStatus} />
          <InfoCard title="Outstanding" value={money(selectedStudent.outstanding)} danger={selectedStudent.outstanding > 0} />
        </div>

        <h3 className="font-bold text-lg mb-3">Subject Progress</h3>

        {detailLoading ? (
          <EmptyState text="Loading student details..." />
        ) : !subjects.length ? (
          <EmptyState text="No subject data found." />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="text-left p-3">No.</th>
                  <th className="text-left p-3">Subject</th>
                  <th className="text-right p-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {subjects.map((sub, i) => (
                  <tr key={`${sub.subjectCode}-${i}`} className="border-t border-slate-200">
                    <td className="p-3 text-slate-500">{i + 1}</td>
                    <td className="p-3">
                      <p className="font-semibold">{sub.subjectCode}</p>
                      <p className="text-xs text-slate-500">{sub.subjectName}</p>
                    </td>
                    <td className="p-3 text-right">
                      <span className={`rounded-full px-3 py-1 text-xs font-bold ${badge(sub.status)}`}>
                        {sub.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function AddStudentModal({ newStudent, updateNewStudent, submitNewStudent, close, programmes, categories, getFeeGroupsByProgram, saving }) {
  const feeGroups = getFeeGroupsByProgram(newStudent.program);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white w-full max-w-4xl rounded-3xl p-6 shadow-xl relative">
        <button onClick={close} className="absolute top-4 right-4 text-slate-500 hover:text-black">✕</button>

        <div className="mb-5">
          <p className="text-sm text-slate-500">Registrar Office</p>
          <h2 className="text-2xl font-bold">Add New Student</h2>
          <p className="text-sm text-slate-500">PIC coordinator will be notified after submission.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <ModalField label="Student ID" value={newStudent.studentId} onChange={(v) => updateNewStudent("studentId", v)} />
          <ModalField label="Student Name" value={newStudent.studentName} onChange={(v) => updateNewStudent("studentName", v)} />
          <ModalField label="IC / Passport" value={newStudent.icPassport} onChange={(v) => updateNewStudent("icPassport", v)} />

          <ModalSelect label="Programme" value={newStudent.program} onChange={(v) => updateNewStudent("program", v)} options={programmes} />
          <ModalField label="Intake" value={newStudent.intake} onChange={(v) => updateNewStudent("intake", v)} placeholder="Jan 2026" />
          <ModalSelect label="Student Category" value={newStudent.studentCategory} onChange={(v) => updateNewStudent("studentCategory", v)} options={categories} />

          <ModalSelect label="Fee Group" value={newStudent.feeGroup} onChange={(v) => updateNewStudent("feeGroup", v)} options={feeGroups.map((f) => f["Fee Group"])} />
          <ModalField label="Assigned PIC" value={newStudent.assignedPic} readOnly />
          <ModalField label="LMS Status" value="Pending Update" readOnly />
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <Button className="rounded-full border border-slate-200 bg-white px-5 py-2" onClick={close}>Cancel</Button>
          <Button className="rounded-full bg-slate-900 text-white px-5 py-2 disabled:opacity-40" onClick={submitNewStudent} disabled={saving}>
            {saving ? "Saving..." : "Save Student"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Stat({ title, value, danger }) {
  return (
    <Card className="rounded-3xl border border-slate-200 bg-white shadow-md hover:shadow-lg transition">
      <CardContent className="p-5">
        <p className="text-xs text-slate-500">{title}</p>
        <p className={`mt-2 text-xl font-bold ${danger ? "text-red-600" : "text-slate-900"}`}>{value}</p>
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

function ModalField({ label, value, onChange, placeholder, readOnly }) {
  return (
    <div>
      <label className="text-xs text-slate-500">{label}</label>
      <Input
        value={value || ""}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder || ""}
        readOnly={readOnly}
        className={`mt-1 ${readOnly ? "bg-slate-50" : ""}`}
      />
    </div>
  );
}

function ModalSelect({ label, value, onChange, options }) {
  return (
    <div>
      <label className="text-xs text-slate-500">{label}</label>
      <select
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        className="w-full mt-1 rounded-xl border border-slate-200 px-3 py-2 bg-white"
      >
        <option value="">Select</option>
        {(options || []).map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    </div>
  );
}

function InfoCard({ title, value, danger }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs text-slate-500">{title}</p>
      <p className={`mt-1 font-bold ${danger ? "text-red-600" : "text-slate-900"}`}>{value || "-"}</p>
    </div>
  );
}

function EmptyState({ text }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-slate-500">
      {text}
    </div>
  );
}

function Pill({ children }) {
  return (
    <span className="rounded-full bg-blue-100 text-blue-700 px-3 py-1 text-xs font-bold">
      {children}
    </span>
  );
}
