export default function Home() {
  return (
    <main style={{ padding: 20, direction: "rtl" }}>
      <h1>ברוך הבא</h1>
      <ul>
        <li><a href="/loading">זמן העמסה</a></li>
        <li><a href="/reports">דוחות</a></li>
        <li><a href="/receipts">קבלות</a></li>
        <li><a href="/production">יצור</a></li>
        <li><a href="/deliveries">הוכחות מסירה</a></li>
      </ul>
    </main>
  );
}