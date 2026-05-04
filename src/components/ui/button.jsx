export function Button({ children, ...props }) {
  return (
    <button {...props} style={{ padding: 10, cursor: "pointer" }}>
      {children}
    </button>
  );
}
