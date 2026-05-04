import React, { useEffect, useState } from "react";

const API_URL = "PASTE_YOUR_APPS_SCRIPT_URL";

export default function App() {
  const [students, setStudents] = useState([]);

  useEffect(() => {
    fetch(`${API_URL}?action=getStudents`)
      .then(res => res.json())
      .then(data => {
        if (data.success) setStudents(data.students);
      });
  }, []);

  const totalOutstanding = students.reduce(
    (sum, s) => sum + Number(s.Outstanding || 0),
    0
  );

  const blocked = students.filter(s => s["LMS Status"] === "Blocked").length;

  return (
    <div className="p-6 space-y-6">

      <h1 className="text-3xl font-bold">RO Dashboard</h1>

      {/* SUMMARY */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl shadow">
          Total Students: {students.length}
        </div>
        <div className="bg-white p-4 rounded-xl shadow">
          Outstanding: RM {totalOutstanding}
        </div>
        <div className="bg-white p-4 rounded-xl shadow">
          LMS Blocked: {blocked}
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-white p-4 rounded-xl shadow">
        <table className="w-full">
          <thead>
            <tr className="text-left border-b">
              <th>Name</th>
              <th>Program</th>
              <th>Outstanding</th>
              <th>LMS</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s, i) => (
              <tr key={i} className="border-b">
                <td>{s["Student Name"]}</td>
                <td>{s.Program}</td>
                <td>{s.Outstanding}</td>
                <td>{s["LMS Status"]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  );
}
