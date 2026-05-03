import React, { useEffect, useState } from "react";

const API_URL = "https://script.google.com/macros/s/AKfycbzlp0yP-NKtixeoBWAIusWCrVIOv7kJEzerrROuwBYxPpHRJaTElvEosqECBJseNjCR/exec";

export default function RO() {
  const [students, setStudents] = useState([]);

  useEffect(() => {
    fetch(`${API_URL}?action=getStudents`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setStudents(data.students);
        }
      });
  }, []);

  const totalOutstanding = students.reduce(
    (sum, s) => sum + Number(s.Outstanding || 0),
    0
  );

  const blocked = students.filter(s => s["LMS Status"] === "Blocked").length;

  return (
    <div style={{ padding: 30 }}>
      <h1>RO Dashboard</h1>

      <div style={{ display: "flex", gap: 20, marginBottom: 20 }}>
        <div>Total Students: {students.length}</div>
        <div>Total Outstanding: RM {totalOutstanding}</div>
        <div>LMS Blocked: {blocked}</div>
      </div>

      <table border="1" cellPadding="8">
        <thead>
          <tr>
            <th>Name</th>
            <th>Program</th>
            <th>Outstanding</th>
            <th>LMS</th>
          </tr>
        </thead>
        <tbody>
          {students.map((s, i) => (
            <tr key={i}>
              <td>{s["Student Name"]}</td>
              <td>{s.Program}</td>
              <td>{s.Outstanding}</td>
              <td>{s["LMS Status"]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
