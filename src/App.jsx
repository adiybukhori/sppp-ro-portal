import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const API_URL =
  "https://script.google.com/macros/s/AKfycbzlp0yP-NKtixeoBWAIusWCrVIOv7kJEzerrROuwBYxPpHRJaTElvEosqECBJseNjCR/exec";

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
    id: raw["Student ID"] || raw.id || "",
    name: raw["Student Name"] || raw.name || "",
    ic: raw["IC/Passport"] || raw.ic || "",
    program: raw.Program || raw.program || "",
    intake: raw.Intake || raw.intake || "",
    category: raw["Student Category"] || raw.category || "",
    feeGroup: raw["Fee Group"] || raw.feeGroup || "",
    pic: raw["Assigned PIC"] || raw.pic || "",
    lmsStatus: raw["LMS Status"] || raw.lmsStatus || "",
    paidAmount: Number(raw["Paid Amount"] || raw.paidAmount || 0),
    outstanding: Number(raw.Outstanding || raw.outstanding || 0),
    totalFee: Number(raw["Total Tuition Fee"] || raw.totalFee || 0),
    paymentStatus: raw["Payment Status"] || raw.paymentStatus || "",
    subjects: raw.subjects || [],
  };
}

export default function ROAdminPortal() {
  const [students, setStudents] = useState([]);
  const [programFilter, setProgramFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [showNewStudent, setShowNewStudent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadStudents() {
    setLoading(true);
    setError("");

    try {
      const res = await fetch(API_URL + "?action=getStudents");
      const data = await res.json();

      if (!data.success) {
        setError(data.message || "Unable to load students.");
        return;
      }

      setStudents((data.students || []).map(normalizeStudent));
    } catch (err) {
      setError("Unable to connect to backend API.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStudents();
  }, []);

  const programmes = [...new Set(students.map((s) => s.program).filter(Boolean))];
  const categories = [...new Set(students.map((s) => s.category).filter(Boolean))];

  const filtered = students.filter((s) => {
    const matchProgram = programFilter === "All" || s.program === programFilter;
    const keyword = `${s.name} ${s.id} ${s.ic} ${s.program}`.toLowerCase();
    return matchProgram && keyword.includes(search.toLowerCase());
  });

  const summary = useMemo(() => {
    const byProgram = programmes.map((program) => {
      const list = students.filter((s) => s.program === program);
      return {
        label: program,
        total: list.length,
        collected: list.reduce((sum, s) => sum + Number(s.paidAmount || 0), 0),
        outstanding: list.reduce((sum, s) => sum + Number(s.outstanding || 0), 0),
      };
    });

    const byCategory = categories.map((category) => {
      const list = students.filter((s) => s.category === category);
      return {
        label: category,
        total: list.length,
        collected: list.reduce((sum, s) => sum + Number(s.paidAmount || 0), 0),
        outstanding: list.reduce((sum, s) => sum + Number(s.outstanding || 0), 0),
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
      collected: students.reduce((sum, s) => sum + Number(s.paidAmount || 0), 0),
      outstanding: students.reduce((sum, s) => sum + Number(s.outstanding || 0), 0),
      blocked: students.filter((s) => s.lmsStatus === "Blocked").length,
      active: students.filter((s) => s.lmsStatus === "Active").length,
      byProgram,
      byCategory,
      currentOfferings: Object.values(offeringMap).sort((a, b) => b.total - a.total),
    };
  }, [students, programmes, categories]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-100">Loading RO Portal...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="bg-gradient-to-r from-slate-950 to-blue-950 text-white">
        <div className="max-w-7xl mx-auto px-6 py-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <p className="text-sm text-blue-100">Innovative University College</p>
            <h1 className="text-2xl font-bold">Registrar Master Admin Portal</h1>
            <p className="text-sm text-blue-100">Full postgraduate access: MBA, MBM, MHUM, PhD and all programmes</p>
          </div>

          <div className="flex gap-3">
            <Button variant="secondary" className="rounded-2xl" onClick={() => setShowNewStudent(true)}>
              + Add New Student
            </Button>
            <Button variant="secondary" className="rounded-2xl" onClick={loadStudents}>
              Refresh Data
            </Button>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto p-6 space-y-6">
        {error && (
          <div className="rounded-2xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Stat title="Total Students" value={summary.total} />
          <Stat title="Total Collected" value={money(summary.collected)} />
          <Stat title="Total Outstanding" value={money(summary.outstanding)} danger={summary.outstanding > 0} />
          <Stat title="LMS Blocked" value={summary.blocked} danger={summary.blocked > 0} />
          <Stat title="LMS Active" value={summary.active} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="rounded-3xl shadow-sm">
            <CardContent className="p-5">
              <h2 className="font-bold text-lg mb-4">Summary by Programme</h2>
              <div className="space-y-3">
                {summary.byProgram.map((item) => (
                  <BreakdownRow key={item.label} item={item} />
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-3xl shadow-sm">
            <CardContent className="p-5">
              <h2 className="font-bold text-lg mb-4">Summary by Student Category</h2>
              <div className="space-y-3">
                {summary.byCategory.map((item) => (
                  <BreakdownRow key={item.label} item={item} />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-3xl shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-bold text-lg">Current Subject Offering</h2>
                <p className="text-sm text-slate-500">Subjects currently marked as Ongoing across all postgraduate programmes.</p>
              </div>
              <span className="rounded-full bg-blue-100 text-blue-700 px-3 py-1 text-xs font-bold">Live from progress data</span>
            </div>

            <div className="overflow-hidden rounded-2xl border bg-white">
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
                      <td className="p-4 text-slate-500" colSpan="3">No ongoing subject found.</td>
                    </tr>
                  ) : (
                    summary.currentOfferings.map((item) => (
                      <tr key={`${item.program}-${item.subject}`} className="border-t hover:bg-slate-50">
                        <td className="p-3">
                          <span className="rounded-full bg-blue-100 text-blue-700 px-3 py-1 text-xs font-bold">{item.program}</span>
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

        {showNewStudent && (
          <Card className="rounded-3xl shadow-sm border-blue-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="font-bold text-xl">Add New Student</h2>
                  <p className="text-sm text-slate-500">
                    UI ready. Backend save + email notification PIC akan kita connect next.
                  </p>
                </div>
                <Button variant="outline" className="rounded-xl" onClick={() => setShowNewStudent(false)}>
                  Close
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Field label="Student ID" placeholder="MBA26001" />
                <Field label="Student Name" placeholder="Full name" />
                <Field label="IC / Passport" placeholder="900101011234" />
                <SelectField label="Programme" options={programmes.length ? programmes : ["MBA", "MBM", "MHUM", "PHD"]} />
                <Field label="Intake" placeholder="May 2026" />
                <Field label="Student Category" placeholder="IUC / YEG / YPR" />
                <Field label="Fee Group" placeholder="MBA_FULL" />
                <Field label="Assigned PIC" placeholder="MBA Coordinator" />
              </div>

              <div className="mt-5 rounded-2xl bg-slate-50 border p-4 text-sm text-slate-600">
                <b>Next backend:</b> save into STUDENT_MASTER, initialize subjects, set payment RM0, and email assigned PIC.
              </div>

              <div className="mt-5 flex justify-end">
                <Button className="rounded-2xl bg-blue-950 hover:bg-blue-900" onClick={() => alert("Backend Add Student akan kita connect next.")}>
                  Save New Student
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="rounded-3xl shadow-sm">
          <CardContent className="p-5">
            <div className="flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between mb-5">
              <div>
                <h2 className="font-bold text-xl">All Postgraduate Students</h2>
                <p className="text-sm text-slate-500">Registrar can view, search and manage all programme records.</p>
              </div>

              <div className="flex flex-col md:flex-row gap-3">
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name / ID / IC" className="md:w-72" />
                <select value={programFilter} onChange={(e) => setProgramFilter(e.target.value)} className="rounded-xl border p-2 bg-white">
                  {["All", ...programmes].map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border bg-white">
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
                  {filtered.map((student) => (
                    <tr key={student.id} className="border-t hover:bg-slate-50">
                      <td className="p-3">
                        <p className="font-semibold text-slate-900">{student.name}</p>
                        <p className="text-xs text-slate-500">{student.id} · {student.ic} · {student.intake}</p>
                      </td>
                      <td className="p-3">
                        <span className="rounded-full bg-blue-100 text-blue-700 px-3 py-1 text-xs font-bold">{student.program}</span>
                      </td>
                      <td className="p-3">
                        <span className={`rounded-full px-3 py-1 text-xs font-bold ${badge(student.category)}`}>{student.category}</span>
                      </td>
                      <td className="p-3 text-slate-600">{student.pic}</td>
                      <td className="p-3">
                        <span className={`rounded-full px-3 py-1 text-xs font-bold ${badge(student.lmsStatus)}`}>{student.lmsStatus}</span>
                      </td>
                      <td className={`p-3 text-right font-bold ${student.outstanding > 0 ? "text-red-600" : "text-emerald-700"}`}>
                        {money(student.outstanding)}
                      </td>
                      <td className="p-3 text-right">
                        <Button variant="outline" className="rounded-xl text-xs">Open</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function Stat({ title, value, danger }) {
  return (
    <Card className="rounded-3xl shadow-sm hover:shadow-md transition">
      <CardContent className="p-5">
        <p className="text-xs text-slate-500">{title}</p>
        <p className={`mt-1 text-xl font-bold ${danger ? "text-red-600" : "text-slate-900"}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function BreakdownRow({ item }) {
  return (
    <div className="rounded-2xl border bg-white p-4 hover:bg-slate-50 hover:border-blue-300 transition">
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

function Field({ label, placeholder }) {
  return (
    <div>
      <label className="text-xs text-slate-500">{label}</label>
      <Input placeholder={placeholder || ""} className="mt-1" />
    </div>
  );
}

function SelectField({ label, options }) {
  return (
    <div>
      <label className="text-xs text-slate-500">{label}</label>
      <select className="w-full mt-1 rounded-xl border p-2 bg-white">
        {options.map((opt) => (
          <option key={opt}>{opt}</option>
        ))}
      </select>
    </div>
  );
}
